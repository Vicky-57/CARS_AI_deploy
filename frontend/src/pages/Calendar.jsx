import { useState, useEffect, useRef } from 'react';
import { Calendar, Plus, X, AlertTriangle, Trash2, Pencil, Clock, ChevronLeft, ChevronRight, RefreshCw, MapPin, Video, User, CheckCircle } from 'lucide-react';
import { api } from '../api/api';
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths, parseISO } from 'date-fns';

// ─── Meeting Modal ────────────────────────────────────────────────────────────
function MeetingModal({ meeting, onClose, onSaved }) {
  const isEdit = !!meeting && !meeting.id?.startsWith('google_');

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
    if (meeting && isEdit) {
      return {
        title: meeting?.title || '',
        client_name: meeting?.client_name || '',
        client_phone: meeting?.client_phone || '',
        start_time: toInputValue(meeting.start_time),
        end_time: toInputValue(meeting.end_time),
        location_type: meeting?.location_type === 'OFFLINE_ONSITE' ? 'OFFLINE_ONSITE' : 'ONLINE',
        location_address: meeting?.location_address || '',
        notes: meeting?.notes || '',
      };
    }
    const start = meeting?.start_time ? new Date(meeting.start_time) : nextSlot();
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
      title: meeting?.title || '', client_name: '', client_phone: '',
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
      setConflict(portalRes);
      setGoogleBusy(googleRes);
      return { portal: portalRes, google: googleRes };
    } catch {
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
        if (api.syncMeeting) await api.syncMeeting(meeting.id).catch(() => { });
      } else {
        const newMeeting = await api.createMeeting(payload);
        if (api.syncMeeting) await api.syncMeeting(newMeeting.id).catch(() => { });
      }
      onSaved();
      onClose();
    } catch (e) {
      alert('Could not save meeting: ' + e.message);
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    if (!timesValid || !form.client_name.trim()) return;
    const { portal } = await checkConflict();
    if (portal?.has_overlap) return;
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

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="is_onsite" checked={isOnsite} onChange={e => { set('location_type', e.target.checked ? 'OFFLINE_ONSITE' : 'ONLINE'); setConflict(null); setBookAnyway(false); }} />
            <label htmlFor="is_onsite" className="form-label" style={{ margin: 0 }}>
              Onsite meeting (30-min travel buffer)
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

          {conflict?.has_overlap && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: 12, borderRadius: 8, color: '#991b1b', marginBottom: 12, display: 'flex', gap: 8 }}>
              <AlertTriangle size={16} />
              <div><strong>Scheduling Conflict!</strong> Another meeting already exists in this slot.</div>
            </div>
          )}

          {googleBusy?.connected && googleBusy?.busy?.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 12, borderRadius: 8, color: '#92400e', marginBottom: 12, display: 'flex', gap: 8 }}>
              <AlertTriangle size={16} />
              <div><strong>Google Calendar Busy:</strong> {googleBusy.busy.map(b => `${format(new Date(b.start), 'HH:mm')}–${format(new Date(b.end), 'HH:mm')}`).join(', ')}</div>
            </div>
          )}

          {bookAnyway && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 12, borderRadius: 8, color: '#92400e', marginBottom: 12 }}>
              <strong>Book anyway?</strong>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setBookAnyway(false); startRef.current?.focus(); }}>Reschedule</button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Book Anyway'}</button>
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

// ─── Event pill ───────────────────────────────────────────────────────────────
function EventPill({ m, onClick }) {
  const isGoogle = m.source === 'google';
  const isOnsite = m.location_type === 'OFFLINE_ONSITE';
  return (
    <div
      onClick={() => onClick && onClick(m)}
      title={`${m.title}${m.client_name ? ' · ' + m.client_name : ''}`}
      style={{
        background: isGoogle ? '#e8f0fe' : isOnsite ? '#fef3c7' : '#dcfce7',
        color: isGoogle ? '#1a56db' : isOnsite ? '#92400e' : '#15803d',
        borderLeft: `3px solid ${isGoogle ? '#4285F4' : isOnsite ? '#f59e0b' : '#22c55e'}`,
        borderRadius: 4,
        padding: '3px 6px',
        fontSize: '0.68rem',
        fontWeight: 600,
        marginBottom: 3,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4
      }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
        {format(new Date(m.start_time), 'HH:mm')} {m.title}
      </span>
      {isGoogle && <Calendar size={10} style={{ opacity: 0.7, flexShrink: 0 }} />}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ meetings, weekStart, onEventClick, onDayClick }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10 }}>
      {days.map(day => {
        const dayMeetings = meetings.filter(m => {
          try { return isSameDay(new Date(m.start_time), day); } catch { return false; }
        }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        const isToday = isSameDay(day, today);
        return (
          <div
            key={day.toISOString()}
            onClick={() => onDayClick && onDayClick(day)}
            style={{
              borderRadius: 'var(--radius-lg)',
              border: isToday ? '2px solid var(--brand-500)' : '1px solid var(--border)',
              background: isToday ? 'var(--brand-50)' : 'var(--surface)',
              minHeight: 160,
              padding: 8,
              display: 'flex', flexDirection: 'column',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: isToday ? 'var(--brand-600)' : 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase' }}>
              {format(day, 'EEE')}<br />
              <span style={{ fontSize: '1.2rem', color: isToday ? 'var(--brand-700)' : 'var(--text-primary)' }}>{format(day, 'd')}</span>
            </div>
            {dayMeetings.map(m => <EventPill key={m.id} m={m} onClick={onEventClick} />)}
            {dayMeetings.length === 0 && (
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: 'auto', textAlign: 'center', paddingBottom: 8 }}>—</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────
function MonthView({ meetings, currentMonth, onEventClick, onDayClick }) {
  const today = new Date();
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDay = startOfWeek(monthStart, { weekStartsOn: 1 });
  const days = [];
  for (let d = new Date(startDay); d <= monthEnd || days.length % 7 !== 0; d = addDays(d, 1)) {
    days.push(new Date(d));
    if (days.length > 42) break;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(dow => (
        <div key={dow} style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0', textTransform: 'uppercase' }}>{dow}</div>
      ))}
      {days.map(day => {
        const inMonth = day.getMonth() === currentMonth.getMonth();
        const dayMeetings = meetings.filter(m => {
          try { return isSameDay(new Date(m.start_time), day); } catch { return false; }
        }).sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        const isToday = isSameDay(day, today);
        return (
          <div
            key={day.toISOString()}
            onClick={() => onDayClick && onDayClick(day)}
            style={{
              borderRadius: 'var(--radius)',
              border: `1px solid ${isToday ? 'var(--brand-500)' : 'var(--border)'}`,
              background: isToday ? 'var(--brand-50)' : (inMonth ? 'var(--surface)' : 'var(--bg)'),
              padding: '6px 5px',
              minHeight: 80,
              opacity: inMonth ? 1 : 0.35,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
          >
            <div style={{ fontSize: '0.72rem', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--brand-600)' : (inMonth ? 'var(--text-primary)' : 'var(--text-muted)'), marginBottom: 4, textAlign: 'center' }}>
              {format(day, 'd')}
            </div>
            {dayMeetings.slice(0, 3).map(m => <EventPill key={m.id} m={m} onClick={onEventClick} />)}
            {dayMeetings.length > 3 && (
              <div style={{ fontSize: '0.6rem', color: 'var(--brand-600)', fontWeight: 600 }}>+{dayMeetings.length - 3} more</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────
function DayPanel({ day, meetings, onEdit, onDelete, onClose }) {
  const dayMeetings = meetings
    .filter(m => { try { return isSameDay(new Date(m.start_time), day); } catch { return false; } })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 340,
      background: 'var(--surface)', borderLeft: '1px solid var(--border)',
      zIndex: 200, display: 'flex', flexDirection: 'column',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.1)',
    }}>
      <div style={{ padding: '20px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem' }}>{format(day, 'EEEE')}</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{format(day, 'MMMM d, yyyy')}</div>
        </div>
        <button className="btn-icon" onClick={onClose}><X size={18} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {dayMeetings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            <Calendar size={30} style={{ opacity: 0.3, marginBottom: 8 }} /><br />
            No meetings this day
          </div>
        ) : dayMeetings.map(m => {
          const isGoogle = m.source === 'google';
          const isOnsite = m.location_type === 'OFFLINE_ONSITE';
          return (
            <div key={m.id} style={{
              background: isGoogle ? '#f0f4ff' : isOnsite ? '#fffbeb' : '#f0fdf4', borderRadius: 10,
              border: `1px solid ${isGoogle ? '#c7d7f5' : isOnsite ? '#fde68a' : '#bbf7d0'}`,
              padding: '12px 14px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>
                  {isGoogle && <span style={{ fontSize: '0.7rem', background: '#e8f0fe', color: '#1a56db', borderRadius: 4, padding: '1px 5px', marginRight: 5 }}>Google</span>}
                  {m.title}
                </div>
                {!isGoogle && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn-icon" onClick={() => onEdit(m)} title="Edit"><Pencil size={13} /></button>
                    <button className="btn-icon" onClick={() => onDelete(m.id)} title="Delete"><Trash2 size={13} color="var(--danger)" /></button>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--brand-600)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} /> {format(new Date(m.start_time), 'HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
              </div>
              {m.client_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} /> {m.client_name}</div>}
              {m.location_address && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} /> {m.location_address}</div>}
              {m.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>{m.notes}</div>}
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                {isOnsite ? <MapPin size={10} /> : isGoogle ? <Calendar size={10} /> : <Video size={10} />}
                {isOnsite ? 'Onsite' : isGoogle ? 'Google Calendar' : 'Online'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date();
  const [supabaseMeetings, setSupabaseMeetings] = useState([]);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewMode, setViewMode] = useState('week');
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(false);

  // Merge Supabase + Google events (dedup by google_event_id)
  const allMeetings = (() => {
    const supabaseGoogleIds = new Set(supabaseMeetings.map(m => m.google_event_id).filter(Boolean));
    const filteredGoogle = googleEvents.filter(e => !supabaseGoogleIds.has(e.google_event_id));
    return [...supabaseMeetings, ...filteredGoogle];
  })();

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      // Load Supabase meetings
      const sbData = await api.getMeetings();
      setSupabaseMeetings(sbData || []);

      // Load Google Calendar events for current visible range
      if (viewMode === 'week') {
        const timeMin = currentWeek.toISOString();
        const timeMax = addDays(currentWeek, 7).toISOString();
        const res = await api.getGoogleCalendarEvents(timeMin, timeMax).catch(() => ({ events: [] }));
        setGoogleEvents(res.events || []);
        setGoogleConnected(!!res.connected);
      } else {
        const timeMin = startOfMonth(currentMonth).toISOString();
        const timeMax = endOfMonth(currentMonth).toISOString();
        const res = await api.getGoogleCalendarEvents(timeMin, timeMax).catch(() => ({ events: [] }));
        setGoogleEvents(res.events || []);
        setGoogleConnected(!!res.connected);
      }
    } catch (e) {
      console.error('Calendar load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); }, [viewMode, currentWeek, currentMonth]);

  const goTodayWeek = () => setCurrentWeek(startOfWeek(today, { weekStartsOn: 1 }));
  const goTodayMonth = () => setCurrentMonth(startOfMonth(today));

  const prevPeriod = () => viewMode === 'week' ? setCurrentWeek(w => subWeeks(w, 1)) : setCurrentMonth(m => subMonths(m, 1));
  const nextPeriod = () => viewMode === 'week' ? setCurrentWeek(w => addWeeks(w, 1)) : setCurrentMonth(m => addMonths(m, 1));

  const periodLabel = viewMode === 'week'
    ? `${format(currentWeek, 'MMM d')} – ${format(addDays(currentWeek, 6), 'MMM d, yyyy')}`
    : format(currentMonth, 'MMMM yyyy');

  const handleDayClick = (day) => setSelectedDay(day);
  const handleEventClick = (m) => {
    if (m.source === 'google') { setSelectedDay(new Date(m.start_time)); return; }
    setEditing(m); setShowModal(true);
  };

  const cancel = async (id) => {
    if (!confirm('Cancel this meeting?')) return;
    try {
      if (api.unsyncMeeting) await api.unsyncMeeting(id).catch(() => { });
      await api.deleteMeeting(id);
      setSelectedDay(null);
      loadData(true);
    } catch (e) { alert(e.message); }
  };

  // Today's meetings for the summary strip
  const todayMeetings = allMeetings
    .filter(m => { try { return isSameDay(new Date(m.start_time), today); } catch { return false; } })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  const upcoming = allMeetings
    .filter(m => new Date(m.end_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 10);

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 20 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Calendar & Appointments</h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Portal meetings + Google Calendar events — 30-min travel conflict guard
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => loadData(true)} disabled={refreshing} title="Refresh">
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {/* Week / Month toggle */}
          <div style={{ display: 'inline-flex', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--gray-50)' }}>
            {['week', 'month'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: '8px 18px', fontSize: '0.875rem', fontWeight: 600,
                border: 'none', borderRight: mode === 'week' ? '1.5px solid var(--border)' : 'none',
                cursor: 'pointer', transition: 'all 0.18s',
                background: viewMode === mode ? 'var(--brand-500)' : 'transparent',
                color: viewMode === mode ? 'white' : 'var(--text-secondary)', borderRadius: 0,
              }}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
            ))}
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', background: googleConnected ? '#dcfce7' : '#fef3c7', color: googleConnected ? '#15803d' : '#92400e', borderRadius: 20, padding: '4px 10px', fontWeight: 600 }}>
            {googleConnected ? <><CheckCircle size={14} /> Google Synced</> : <><AlertTriangle size={14} /> Not Connected</>}
          </span>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus size={14} /> Book Meeting
          </button>
        </div>
      </div>

      {/* Today's meetings strip */}
      {todayMeetings.length > 0 && (
        <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--brand-700)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} /> Today · {format(today, 'EEEE, MMMM d')}
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--brand-200)', margin: '0 4px' }} />
          {todayMeetings.map(m => {
            const isGoogle = m.source === 'google';
            const isOnsite = m.location_type === 'OFFLINE_ONSITE';
            return (
              <div key={m.id} onClick={() => { setSelectedDay(today); }} style={{
                background: isGoogle ? '#e8f0fe' : isOnsite ? '#fef3c7' : '#dcfce7',
                color: isGoogle ? '#1a56db' : isOnsite ? '#92400e' : '#15803d',
                borderRadius: 20,
                padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isGoogle ? '#4285F4' : isOnsite ? '#f59e0b' : '#22c55e'}`,
                display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                {format(new Date(m.start_time), 'HH:mm')} {m.title}
                {isGoogle && <Calendar size={12} style={{ opacity: 0.8 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar View Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <span className="card-title">{periodLabel}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={prevPeriod}><ChevronLeft size={16} /></button>
            <button className="btn btn-secondary" style={{ padding: '4px 12px', fontSize: '0.8rem' }}
              onClick={viewMode === 'week' ? goTodayWeek : goTodayMonth}>Today</button>
            <button className="btn btn-secondary" style={{ padding: '4px 10px' }} onClick={nextPeriod}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : viewMode === 'week' ? (
            <WeekView meetings={allMeetings} weekStart={currentWeek} onEventClick={handleEventClick} onDayClick={handleDayClick} />
          ) : (
            <MonthView meetings={allMeetings} currentMonth={currentMonth} onEventClick={handleEventClick} onDayClick={handleDayClick} />
          )}
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#e8f0fe', border: '1px solid #4285F4', marginRight: 4 }} />Google Calendar</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#dcfce7', border: '1px solid #22c55e', marginRight: 4 }} />Portal Meeting (Online)</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#fef3c7', border: '1px solid #f59e0b', marginRight: 4 }} />Portal Meeting (Onsite)</span>
          </div>
        </div>
      </div>

      {/* Upcoming list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} color="var(--brand-600)" /> Upcoming ({upcoming.length})
          </span>
        </div>
        <div className="card-body">
          {upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
              <Calendar size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>No upcoming meetings.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
              {upcoming.map(m => {
                const isGoogle = m.source === 'google';
                const isOnsite = m.location_type === 'OFFLINE_ONSITE';
                return (
                  <div key={m.id} style={{
                    padding: '12px 14px', borderRadius: 10,
                    border: `1px solid ${isGoogle ? '#c7d7f5' : 'var(--border)'}`,
                    background: isGoogle ? '#f8faff' : 'var(--surface)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isGoogle && <span style={{ fontSize: '0.65rem', background: '#e8f0fe', color: '#1a56db', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>Google</span>}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--brand-600)', marginTop: 3 }}>
                        {format(new Date(m.start_time), 'EEE, MMM d · HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {isOnsite ? <MapPin size={10} /> : isGoogle ? <Calendar size={10} /> : <Video size={10} />}
                        {isOnsite ? 'Onsite' : isGoogle ? 'Google Cal' : 'Online'}
                        {m.client_name ? ` · ${m.client_name}` : ''}
                      </div>
                    </div>
                    {!isGoogle && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn-icon" onClick={() => { setEditing(m); setShowModal(true); }} title="Edit"><Pencil size={13} /></button>
                        <button className="btn-icon" onClick={() => cancel(m.id)} title="Delete"><Trash2 size={13} color="var(--danger)" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Day panel */}
      {selectedDay && (
        <DayPanel
          day={selectedDay}
          meetings={allMeetings}
          onEdit={m => { setEditing(m); setShowModal(true); setSelectedDay(null); }}
          onDelete={cancel}
          onClose={() => setSelectedDay(null)}
        />
      )}

      {showModal && (
        <MeetingModal
          meeting={editing || undefined}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={() => loadData(true)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
