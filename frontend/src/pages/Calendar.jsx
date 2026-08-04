import { useState, useEffect, useMemo, useRef } from 'react';
import { Calendar, Plus, X, AlertTriangle, Trash2, Pencil } from 'lucide-react';
import { api } from '../api/api';
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth } from 'date-fns';

function MeetingModal({ meeting, onClose, onSaved }) {
  const isEdit = !!meeting;

  // Convert a DB ISO string (UTC) into the datetime-local format the browser
  // understands, expressed in the user's local timezone. Without this the edit
  // modal shows EMPTY time fields (which disabled the save button silently).
  const toInputValue = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return format(d, "yyyy-MM-dd'T'HH:mm");
  };

  // Default a new meeting to the next 30-min slot (better than empty fields).
  const nextSlot = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    const rem = 30 - (d.getMinutes() % 30);
    d.setMinutes(d.getMinutes() + rem);
    return d;
  };

  const buildInitialForm = () => {
    if (meeting) {
      return {
        title: meeting?.title || '',
        client_name: meeting?.client_name || '',
        client_phone: meeting?.client_phone || '',
        start_time: toInputValue(meeting.start_time),
        end_time: toInputValue(meeting.end_time),
        location_type: meeting?.location_type || 'ONLINE',
        location_address: meeting?.location_address || '',
        notes: meeting?.notes || '',
      };
    }
    const start = nextSlot();
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    return {
      title: '', client_name: '', client_phone: '',
      start_time: format(start, "yyyy-MM-dd'T'HH:mm"),
      end_time: format(end, "yyyy-MM-dd'T'HH:mm"),
      location_type: 'ONLINE', location_address: '', notes: '',
    };
  };

  const [form, setForm] = useState(buildInitialForm);
  const [conflict, setConflict] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bookAnyway, setBookAnyway] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(null);
  const startRef = useRef(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const isOnsite = form.location_type === 'OFFLINE_ONSITE';

  const start = new Date(form.start_time);
  const end = new Date(form.end_time);
  const timesValid = !isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start;

  // True if a free-busy slot corresponds to THIS meeting's own Google event
  // (only relevant when editing an already-synced meeting).
  const isOwnGoogleEvent = (b) => {
    if (!meeting || !meeting.start_time || !meeting.end_time) return false;
    const ownStart = new Date(meeting.start_time).getTime();
    const ownEnd = new Date(meeting.end_time).getTime();
    const bStart = new Date(b.start).getTime();
    const bEnd = new Date(b.end).getTime();
    return Math.abs(bStart - ownStart) < 60000 && Math.abs(bEnd - ownEnd) < 60000;
  };

  // One conflict check used by BOTH the live debounced effect AND handleSave.
  // Returns the result so the save handler can evaluate it freshly.
  const checkConflict = async () => {
    if (!timesValid) return { portal: null, google: null };
    setChecking(true);
    try {
      const [portalRes, googleRes] = await Promise.all([
        api.checkMeetingConflicts({
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          location_type: form.location_type,
          exclude_id: meeting?.id || null,
        }),
        api.checkGoogleFreeBusy(
          start.toISOString(),
          end.toISOString()
        ).catch(() => null),
      ]);
      // On edit, ignore the meeting's own Google event (avoid false self-clash).
      if (googleRes?.busy) googleRes.busy = googleRes.busy.filter(b => !isOwnGoogleEvent(b));
      const result = { portal: portalRes, google: googleRes };
      setConflict(portalRes);
      setGoogleBusy(googleRes);
      return result;
    } catch {
      setConflict(null);
      setGoogleBusy(null);
      return { portal: null, google: null };
    } finally { setChecking(false); }
  };

  // Debounced conflict check on every change (start, end, onsite toggle).
  useEffect(() => {
    if (!timesValid) { setConflict(null); setGoogleBusy(null); return; }
    const t = setTimeout(checkConflict, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.start_time, form.end_time, form.location_type]);

  const save = async () => {
    if (!timesValid || !form.client_name.trim()) return;
    setSaving(true);
    try {
      const title = form.title.trim() || `Meeting with ${form.client_name.trim()}`;
      const payload = {
        title,
        client_name: form.client_name,
        client_phone: form.client_phone || null,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        location_type: form.location_type,
        location_address: isOnsite ? (form.location_address || null) : null,
        notes: form.notes || null,
      };
      if (isEdit) {
        await api.updateMeeting(meeting.id, payload);
        await api.syncMeeting(meeting.id).catch(() => {}); // re-sync (creates if missing, updates if exists)
      } else {
        const newMeeting = await api.createMeeting(payload);
        await api.syncMeeting(newMeeting.id).catch(() => {}); // best-effort; works when connected
      }
      onSaved();
      onClose();
    } catch (e) {
      const detail = e.message;
      alert((isEdit ? 'Could not update' : 'Could not create') + ' meeting: ' + detail);
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!timesValid || !form.client_name.trim()) return;

    // Fresh check right before saving so the debounced state can't be stale.
    const { portal, google } = await checkConflict();
    if (portal?.has_overlap) return; // hard block: refuse to save

    const bufferClash = portal?.has_buffer_clash;
    const googleClash = google?.connected && google?.busy?.length;

    if ((bufferClash || googleClash) && !bookAnyway) {
      setBookAnyway(true);
      return;
    }
    await save();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Edit Meeting' : 'New Meeting'}</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Meeting Title <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>(auto-filled if blank)</span></label>
            <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Car inspection with Herr Müller" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input ref={startRef} className="form-input" type="datetime-local" value={form.start_time} onChange={e => { set('start_time', e.target.value); setConflict(null); setBookAnyway(false); }} />
            </div>
            <div className="form-group">
              <label className="form-label">End Time *</label>
              <input className="form-input" type="datetime-local" value={form.end_time} min={form.start_time || undefined} onChange={e => { set('end_time', e.target.value); setConflict(null); setBookAnyway(false); }} />
            </div>
          </div>
          {form.start_time && form.end_time && !timesValid && (
            <div className="conflict-alert">
              <AlertTriangle size={16} />
              <div><strong>Invalid time range.</strong><div>End time must be after start time.</div></div>
            </div>
          )}

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="is_onsite" checked={isOnsite} onChange={e => { set('location_type', e.target.checked ? 'OFFLINE_ONSITE' : 'ONLINE'); setConflict(null); setBookAnyway(false); }} />
            <label htmlFor="is_onsite" className="form-label" style={{ margin: 0 }}>
              Onsite meeting (adds 30-min travel buffer for conflict check)
            </label>
          </div>

          {isOnsite && (
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location_address} onChange={e => set('location_address', e.target.value)} placeholder="Address…" />
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input className="form-input" value={form.client_name} onChange={e => set('client_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Client Contact</label>
              <input className="form-input" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+49 or email" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {checking && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Checking for conflicts…</p>}

          {conflict?.has_overlap && (
            <div className="conflict-alert">
              <AlertTriangle size={16} />
              <div>
                <strong>Time clash — please pick a different time.</strong>
                <div>You already have: {conflict.overlapping_meetings.map(c => c.title).join(', ')}</div>
                <div style={{ fontSize: '0.7rem' }}>Overlapping bookings are not allowed. Choose a new time to continue.</div>
              </div>
            </div>
          )}

          {conflict?.has_buffer_clash && !conflict.has_overlap && !bookAnyway && (
            <div className="conflict-alert">
              <AlertTriangle size={16} />
              <div>
                <strong>Travel buffer warning!</strong>
                <div>Too close to: {conflict.buffer_clash_meetings.map(c => c.title).join(', ')} (onsite needs {conflict.buffer_minutes} min gap)</div>
              </div>
            </div>
          )}

          {googleBusy?.connected && googleBusy?.busy?.length > 0 && !conflict?.has_overlap && !bookAnyway && (
            <div className="conflict-alert">
              <AlertTriangle size={16} />
              <div>
                <strong>Google Calendar clash!</strong>
                <div>You have an event on your Google Calendar: {googleBusy.busy.map(b => `${format(new Date(b.start), 'HH:mm')}–${format(new Date(b.end), 'HH:mm')}`).join(', ')}</div>
              </div>
            </div>
          )}

          {bookAnyway && (
            <div className="conflict-alert">
              <div>
                <strong>Reschedule or book anyway?</strong>
                <div style={{ fontSize: '0.7rem' }}>
                  {[
                    conflict?.has_buffer_clash ? 'This booking is closer than the 30-min travel buffer.' : null,
                    (googleBusy?.connected && googleBusy?.busy?.length) ? 'This clashes with an event on your Google Calendar.' : null,
                  ].filter(Boolean).join(' And ')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-secondary" onClick={() => { setBookAnyway(false); startRef.current?.focus(); }}>Reschedule</button>
                  <button className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : (isEdit ? 'Save Anyway' : 'Book Anyway')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.client_name.trim() || !timesValid || conflict?.has_overlap || bookAnyway}>
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Book Meeting')}
          </button>
        </div>
      </div>
    </div>
  );
}

function WeekView({ meetings }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {days.map(day => {
        const dayMeetings = meetings.filter(m => {
          try { return isSameDay(new Date(m.start_time), day); } catch { return false; }
        });
        const isToday = isSameDay(day, today);
        return (
          <div key={day.toISOString()} style={{
            borderRadius: 'var(--radius)',
            border: `1px solid ${isToday ? 'var(--brand-500)' : 'var(--border)'}`,
            background: isToday ? 'var(--brand-50)' : 'var(--surface)',
            padding: '10px 8px',
            minHeight: 100,
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: isToday ? 'var(--brand-600)' : 'var(--text-muted)', marginBottom: 6 }}>
              {format(day, 'EEE')}<br />
              <span style={{ fontSize: '1rem', color: isToday ? 'var(--brand-700)' : 'var(--text-primary)' }}>{format(day, 'd')}</span>
            </div>
            {dayMeetings.map(m => (
              <div key={m.id} style={{
                background: m.location_type === 'OFFLINE_ONSITE' ? '#fef3c7' : 'var(--brand-100)',
                color: m.location_type === 'OFFLINE_ONSITE' ? '#92400e' : 'var(--brand-700)',
                borderRadius: 4,
                padding: '3px 6px',
                fontSize: '0.65rem',
                fontWeight: 500,
                marginBottom: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {format(new Date(m.start_time), 'HH:mm')} {m.title} {m.google_event_id ? '✅' : ''}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function MonthView({ meetings }) {
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const startDay = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
  const days = [];
  for (let d = new Date(startDay); d <= monthEnd; d = addDays(d, 1)) {
    days.push(new Date(d));
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(dow => (
        <div key={dow} style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center' }}>{dow}</div>
      ))}
      {days.map(day => {
        const inMonth = day.getMonth() === today.getMonth();
        const dayMeetings = meetings.filter(m => {
          try { return isSameDay(new Date(m.start_time), day); } catch { return false; }
        });
        const isToday = isSameDay(day, today);
        return (
          <div key={day.toISOString()} style={{
            borderRadius: 'var(--radius)',
            border: `1px solid ${isToday ? 'var(--brand-500)' : 'var(--border)'}`,
            background: isToday ? 'var(--brand-50)' : (inMonth ? 'var(--surface)' : 'var(--bg)'),
            padding: '8px 6px',
            minHeight: 78,
            opacity: inMonth ? 1 : 0.45,
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: isToday ? 'var(--brand-600)' : (inMonth ? 'var(--text-primary)' : 'var(--text-muted)'), marginBottom: 4 }}>
              {format(day, 'd')}
            </div>
            {dayMeetings.slice(0, 3).map(m => (
              <div key={m.id} style={{
                background: m.location_type === 'OFFLINE_ONSITE' ? '#fef3c7' : 'var(--brand-100)',
                color: m.location_type === 'OFFLINE_ONSITE' ? '#92400e' : 'var(--brand-700)',
                borderRadius: 4,
                padding: '2px 4px',
                fontSize: '0.6rem',
                fontWeight: 500,
                marginBottom: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {format(new Date(m.start_time), 'HH:mm')} {m.title}
              </div>
            ))}
            {dayMeetings.length > 3 && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>+{dayMeetings.length - 3} more</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function CalendarPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewMode, setViewMode] = useState('week');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setMeetings(await api.getMeetings()); }
    catch { setMeetings([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    api.googleAuthStatus().then(r => setGoogleConnected(!!r.connected)).catch(() => setGoogleConnected(false));
  }, []);

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      const res = await api.googleAuthUrl();
      if (res.url) window.open(res.url, '_blank');
      else alert('Google not configured. Add credentials in backend/.env first.');
    } catch (e) { alert('Could not start Google connect: ' + e.message); }
    finally { setConnecting(false); }
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this meeting?')) return;
    try {
      await api.unsyncMeeting(id).catch(() => {}); // best-effort: delete from Google
      await api.deleteMeeting(id);
      load();
    } catch (e) { alert(e.message); }
  };

  const upcoming = meetings
    .filter(m => new Date(m.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Calendar</h1>
          <p>Schedule and manage client meetings. Conflict guard active.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="btn-group">
            <button className={`btn ${viewMode === 'week' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('week')}>Week</button>
            <button className={`btn ${viewMode === 'month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('month')}>Month</button>
          </div>
          <button className={`btn ${googleConnected ? '' : 'btn-secondary'}`} onClick={connectGoogle} disabled={connecting}>
            {googleConnected ? '✅ Google Connected' : 'Connect Google Calendar'}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus size={16} /> Book Meeting
          </button>
        </div>
      </div>

      {/* View (week or month) */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{viewMode === 'week' ? 'This Week' : 'This Month'}</span>
        </div>
        <div className="card-body">
          {loading ? <div className="loading-spinner"><div className="spinner" /></div> : (
            viewMode === 'week'
              ? <WeekView meetings={meetings} />
              : <MonthView meetings={meetings} />
          )}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Upcoming Meetings</span>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{upcoming.length} scheduled</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : upcoming.length === 0 ? (
            <div className="empty-state">
              <Calendar size={28} />
              <h3>No upcoming meetings</h3>
              <p>Book your first meeting above.</p>
            </div>
          ) : (
            <div className="calendar-grid">
              {upcoming.map(m => (
                <div key={m.id} className={`meeting-card${m.location_type === 'OFFLINE_ONSITE' ? ' onsite' : ''}`}>
                  <div>
                    <div className="meeting-time">
                      {format(new Date(m.start_time), 'dd.MM')} · {format(new Date(m.start_time), 'HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="meeting-title">
                      {m.title}
                      {m.google_event_id && <span title="Synced to Google Calendar" style={{ marginLeft: 6 }}>✅</span>}
                    </div>
                    <div className="meeting-detail">
                      {m.location_type === 'OFFLINE_ONSITE' ? '📍 Onsite' : '💻 Online'}
                      {m.client_name ? ` · ${m.client_name}` : ''}
                      {m.location_address ? ` · ${m.location_address}` : ''}
                    </div>
                    {m.notes && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.notes}</div>}
                  </div>
                  <button className="btn-icon" onClick={() => { setEditing(m); setShowModal(true); }} title="Edit meeting">
                    <Pencil size={14} />
                  </button>
                  <button className="btn-icon" onClick={() => cancel(m.id)} title="Cancel meeting">
                    <Trash2 size={14} color="var(--danger)" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && <MeetingModal meeting={editing || undefined} onClose={() => setShowModal(false)} onSaved={load} />}
    </div>
  );
}
