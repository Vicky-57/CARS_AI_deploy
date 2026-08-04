import { useState, useEffect, useRef } from 'react';
import { Calendar, Plus, X, AlertTriangle, Trash2, Pencil, MapPin, Video, User as UserIcon, Clock } from 'lucide-react';
import { api } from '../api/api';
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth } from 'date-fns';

function MeetingModal({ meeting, onClose, onSaved }) {
  const isEdit = !!meeting;

  const toInputValue = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return format(d, "yyyy-MM-dd'T'HH:mm");
  };

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
        client_name: meeting?.client_name || meeting?.attendee_name || '',
        client_phone: meeting?.client_phone || meeting?.attendee_contact || '',
        start_time: toInputValue(meeting.start_time),
        end_time: toInputValue(meeting.end_time),
        location_type: meeting?.location_type || (meeting?.is_onsite ? 'OFFLINE_ONSITE' : 'ONLINE'),
        location_address: meeting?.location_address || meeting?.location || '',
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

  const isOwnGoogleEvent = (b) => {
    if (!meeting || !meeting.start_time || !meeting.end_time) return false;
    const ownStart = new Date(meeting.start_time).getTime();
    const ownEnd = new Date(meeting.end_time).getTime();
    const bStart = new Date(b.start).getTime();
    const bEnd = new Date(b.end).getTime();
    return Math.abs(bStart - ownStart) < 60000 && Math.abs(bEnd - ownEnd) < 60000;
  };

  const checkConflict = async () => {
    if (!timesValid) return { portal: null, google: null };
    setChecking(true);
    try {
      const [portalRes, googleRes] = await Promise.all([
        api.checkConflict(start.toISOString(), end.toISOString(), isOnsite),
        api.checkGoogleFreeBusy
          ? api.checkGoogleFreeBusy(start.toISOString(), end.toISOString()).catch(() => null)
          : null,
      ]);
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

  useEffect(() => {
    if (!timesValid) { setConflict(null); setGoogleBusy(null); return; }
    const t = setTimeout(checkConflict, 400);
    return () => clearTimeout(t);
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
        if (api.syncMeeting) await api.syncMeeting(meeting.id).catch(() => {});
      } else {
        const newMeeting = await api.createMeeting(payload);
        if (api.syncMeeting) await api.syncMeeting(newMeeting.id).catch(() => {});
      }
      onSaved();
      onClose();
    } catch (e) {
      alert((isEdit ? 'Could not update' : 'Could not create') + ' meeting: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!timesValid || !form.client_name.trim()) return;
    const { portal, google } = await checkConflict();
    if (portal?.has_overlap) return;

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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
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
              <input className="form-input" value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Full Name" />
            </div>
            <div className="form-group">
              <label className="form-label">Client Contact</label>
              <input className="form-input" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+49 or email" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any preparation details..." />
          </div>

          {checking && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Checking for conflicts…</p>}

          {conflict?.has_conflict && (
            <div className="conflict-alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: 12, borderRadius: 8, color: '#991b1b', marginBottom: 12 }}>
              <AlertTriangle size={16} />
              <div>
                <strong>Scheduling Conflict Detected!</strong>
                <div style={{ fontSize: '0.8rem' }}>Includes 30-min travel buffer for onsite visits.</div>
              </div>
            </div>
          )}

          {googleBusy?.connected && googleBusy?.busy?.length > 0 && !bookAnyway && (
            <div className="conflict-alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: 12, borderRadius: 8, color: '#991b1b', marginBottom: 12 }}>
              <AlertTriangle size={16} />
              <div>
                <strong>Google Calendar Event Clash!</strong>
                <div>Clashes with Google Calendar: {googleBusy.busy.map(b => `${format(new Date(b.start), 'HH:mm')}–${format(new Date(b.end), 'HH:mm')}`).join(', ')}</div>
              </div>
            </div>
          )}

          {bookAnyway && (
            <div className="conflict-alert" style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 12, borderRadius: 8, color: '#92400e', marginBottom: 12 }}>
              <div>
                <strong>Reschedule or book anyway?</strong>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setBookAnyway(false); startRef.current?.focus(); }}>Reschedule</button>
                  <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
                    {saving ? 'Saving…' : (isEdit ? 'Save Anyway' : 'Book Anyway')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving || !form.client_name.trim() || !timesValid}>
            {saving ? 'Saving…' : (isEdit ? 'Save Changes' : 'Book Meeting')}
          </button>
        </div>
      </div>
    </div>
  );
}

function WeekView({ meetings }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 12 }}>
      {days.map(day => {
        const dayMeetings = meetings.filter(m => {
          try { return isSameDay(new Date(m.start_time), day); } catch { return false; }
        });
        const isToday = isSameDay(day, today);
        return (
          <div key={day.toISOString()} style={{
            borderRadius: 'var(--radius-lg)',
            border: isToday ? '2px solid var(--brand-500)' : '1px solid var(--border)',
            background: 'var(--surface)',
            minHeight: 180,
            padding: 8,
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isToday ? 'var(--brand-600)' : 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
              {format(day, 'EEE')}<br />
              <span style={{ fontSize: '1.1rem', color: isToday ? 'var(--brand-700)' : 'var(--text-primary)' }}>{format(day, 'd')}</span>
            </div>
            {dayMeetings.map(m => (
              <div key={m.id} style={{
                background: (m.location_type === 'OFFLINE_ONSITE' || m.is_onsite) ? '#fef3c7' : 'var(--brand-100)',
                color: (m.location_type === 'OFFLINE_ONSITE' || m.is_onsite) ? '#92400e' : 'var(--brand-700)',
                borderRadius: 4,
                padding: '4px 6px',
                fontSize: '0.68rem',
                fontWeight: 600,
                marginBottom: 4,
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
  const startDay = startOfWeek(monthStart, { weekStartsOn: 1 });
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
                background: (m.location_type === 'OFFLINE_ONSITE' || m.is_onsite) ? '#fef3c7' : 'var(--brand-100)',
                color: (m.location_type === 'OFFLINE_ONSITE' || m.is_onsite) ? '#92400e' : 'var(--brand-700)',
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
    try { 
      const data = await api.getMeetings();
      setMeetings(data || []);
    } catch { 
      setMeetings([]); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    load();
    if (api.googleAuthStatus) {
      api.googleAuthStatus().then(r => setGoogleConnected(!!r.connected)).catch(() => setGoogleConnected(false));
    }
  }, []);

  const connectGoogle = async () => {
    setConnecting(true);
    try {
      if (api.googleAuthUrl) {
        const res = await api.googleAuthUrl();
        if (res.url) window.open(res.url, '_blank');
        else alert('Google OAuth not configured. Check settings in backend.');
      }
    } catch (e) { alert('Could not start Google connect: ' + e.message); }
    finally { setConnecting(false); }
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this meeting?')) return;
    try {
      if (api.unsyncMeeting) await api.unsyncMeeting(id).catch(() => {});
      await api.deleteMeeting(id);
      load();
    } catch (e) { alert(e.message); }
  };

  const upcoming = meetings
    .filter(m => new Date(m.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 24 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Calendar & Appointments</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage client meetings with 30-min travel conflict guard & Google Calendar sync</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div className="pipeline-tabs" style={{ margin: 0 }}>
            <button className={`pipeline-tab ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')}>Week</button>
            <button className={`pipeline-tab ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')}>Month</button>
          </div>
          <button className={`btn ${googleConnected ? 'btn-secondary' : 'btn-secondary'}`} onClick={connectGoogle} disabled={connecting}>
            {googleConnected ? '✅ Google Sync Active' : 'Connect Google Calendar'}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus size={14} /> Book Meeting
          </button>
        </div>
      </div>

      {/* View (week or month) */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">{viewMode === 'week' ? 'This Week' : 'This Month'}</span>
        </div>
        <div className="card-body">
          {loading ? <div className="card-body" style={{ textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
            viewMode === 'week'
              ? <WeekView meetings={meetings} />
              : <MonthView meetings={meetings} />
          )}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="card">
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="var(--brand-600)" /> Upcoming Meetings ({upcoming.length})
          </span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="spinner" style={{ margin: '0 auto' }} />
          ) : upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              <Calendar size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>No upcoming meetings. Click "Book Meeting" to schedule.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {upcoming.map(m => (
                <div key={m.id} className="project-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                      {m.title} {m.google_event_id ? '✅' : ''}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--brand-600)', marginTop: 2 }}>
                      {format(new Date(m.start_time), 'EEEE, MMM d · HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {(m.location_type === 'OFFLINE_ONSITE' || m.is_onsite) ? '📍 Onsite' : '💻 Online'}
                      {m.client_name ? ` · ${m.client_name}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => { setEditing(m); setShowModal(true); }} title="Edit meeting">
                      <Pencil size={14} />
                    </button>
                    <button className="btn-icon" onClick={() => cancel(m.id)} title="Cancel meeting">
                      <Trash2 size={14} color="var(--danger)" />
                    </button>
                  </div>
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
