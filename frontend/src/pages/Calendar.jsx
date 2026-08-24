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
  const isOutlook = m.source === 'outlook';
  const isOnsite = m.location_type === 'OFFLINE_ONSITE';
  return (
    <div
      onClick={() => onClick && onClick(m)}
      title={`${m.title}${m.client_name ? ' · ' + m.client_name : ''}`}
      style={{
        background: isGoogle ? '#e8f0fe' : isOutlook ? '#e0f2fe' : isOnsite ? '#fef3c7' : '#dcfce7',
        color: isGoogle ? '#1a56db' : isOutlook ? '#0369a1' : isOnsite ? '#92400e' : '#15803d',
        borderLeft: `3px solid ${isGoogle ? '#4285F4' : isOutlook ? '#0284c7' : isOnsite ? '#f59e0b' : '#22c55e'}`,
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
      {(isGoogle || isOutlook) && <Calendar size={10} style={{ opacity: 0.7, flexShrink: 0 }} />}
    </div>
  );
}

// ─── Week View ────────────────────────────────────────────────────────────────
function WeekView({ meetings, weekStart, onEventClick, onDayClick }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div className="calendar-scroll-wrap">
      <div className="calendar-week-grid">
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
    <div className="calendar-scroll-wrap">
      <div className="calendar-month-grid">
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
    </div>
  );
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────
function DayPanel({ day, meetings, onEdit, onDelete, onClose }) {
  const dayMeetings = meetings
    .filter(m => { try { return isSameDay(new Date(m.start_time), day); } catch { return false; } })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return (
    <>
      <div className="day-panel-backdrop" onClick={onClose} />
      <div className="day-panel">
        <div style={{ padding: '32px 32px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.6rem', color: '#09090b', letterSpacing: '-0.5px' }}>{format(day, 'EEEE')}</div>
            <div style={{ fontSize: '0.95rem', color: '#71717a', marginTop: 4, fontWeight: 500 }}>{format(day, 'dd/MM/yyyy')}</div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ background: '#f4f4f5', color: '#52525b', borderRadius: '50%', padding: 8, transition: 'all 0.2s', border: 'none', cursor: 'pointer', display: 'flex' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e4e4e7'; e.currentTarget.style.color = '#09090b'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f4f4f5'; e.currentTarget.style.color = '#52525b'; }}
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 32px 32px' }}>
          {dayMeetings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: '#a1a1aa', fontSize: '0.95rem', fontWeight: 500 }}>
              <Calendar size={40} style={{ opacity: 0.2, marginBottom: 16 }} /><br />
              No meetings scheduled
            </div>
        ) : dayMeetings.map(m => {
          const isGoogle = m.source === 'google';
          const isOnsite = m.location_type === 'OFFLINE_ONSITE';
          return (
            <div key={m.id} style={{
              background: isGoogle ? '#f0f4ff' : isOnsite ? '#fffbeb' : '#f0fdf4', 
              borderRadius: 12,
              border: `1px solid ${isGoogle ? '#c7d7f5' : isOnsite ? '#fde68a' : '#bbf7d0'}`,
              padding: '16px', 
              marginBottom: 16,
              position: 'relative'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {m.title}
                </div>
                {!isGoogle && (
                  <div style={{ display: 'flex', gap: 4 }} className="event-actions">
                    <button className="btn-icon" onClick={() => onEdit(m)} title="Edit" style={{ padding: 4 }}><Pencil size={14} color="var(--text-muted)" /></button>
                    <button className="btn-icon" onClick={() => onDelete(m.id)} title="Delete" style={{ padding: 4 }}><Trash2 size={14} color="#ef4444" /></button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: '0.85rem', color: isGoogle ? '#1d4ed8' : isOnsite ? '#b45309' : '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={14} /> {format(new Date(m.start_time), 'HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
                </div>
                {m.client_name && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><User size={14} color="var(--text-muted)" /> {m.client_name}</div>}
                {m.location_address && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={14} color="var(--text-muted)" /> {m.location_address}</div>}
                {m.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2, fontStyle: 'italic' }}>{m.notes}</div>}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                {isOnsite ? <MapPin size={12} /> : isGoogle ? <Calendar size={12} /> : <Video size={12} />}
                {isOnsite ? 'Onsite' : isGoogle ? 'Google Calendar' : 'Online'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
    </>
  );
}

// ─── Main Calendar Page ───────────────────────────────────────────────────────
export default function CalendarPage() {
  const today = new Date();
  const [supabaseMeetings, setSupabaseMeetings] = useState([]);
  const [outlookEvents, setOutlookEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewMode, setViewMode] = useState('week');
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(today, { weekStartsOn: 1 }));
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(today));
  const [selectedDay, setSelectedDay] = useState(null);
  const [outlookConnected, setOutlookConnected] = useState(false);

  // Merge Supabase Portal meetings + Outlook events
  const allMeetings = [...supabaseMeetings, ...outlookEvents];

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      // Load Supabase meetings
      const sbData = await api.getMeetings();
      setSupabaseMeetings(sbData || []);

      const timeMin = viewMode === 'week' ? currentWeek.toISOString() : startOfMonth(currentMonth).toISOString();
      const timeMax = viewMode === 'week' ? addDays(currentWeek, 7).toISOString() : endOfMonth(currentMonth).toISOString();

      // Load Outlook events
      if (api.getOutlookCalendarEvents) {
        const oRes = await api.getOutlookCalendarEvents(timeMin, timeMax).catch(() => ({ events: [], connected: false }));
        setOutlookEvents(oRes.events || []);
        setOutlookConnected(!!oRes.connected);
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
    ? `${format(currentWeek, 'dd/MM')} – ${format(addDays(currentWeek, 6), 'dd/MM/yyyy')}`
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
            Portal meetings + Outlook Calendar events — 30-min travel conflict guard
          </p>
        </div>
        <div className="calendar-actions-mobile" style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 4 }}>
          <button className="btn btn-secondary hide-on-mobile" style={{ flexShrink: 0 }} onClick={() => loadData(true)} disabled={refreshing} title="Refresh">
            <RefreshCw size={14} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          {/* Week / Month toggle */}
          <div style={{ display: 'inline-flex', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--gray-50)', flexShrink: 0 }}>
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', background: outlookConnected ? '#e0f2fe' : '#fef3c7', color: outlookConnected ? '#0369a1' : '#92400e', borderRadius: 20, padding: '4px 10px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {outlookConnected ? <><CheckCircle size={14} /> <span className="hide-on-mobile">Outlook Synced</span></> : <><AlertTriangle size={14} /> <span className="hide-on-mobile">Outlook Offline</span></>}
          </span>
          <button className="btn btn-primary" style={{ marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0 }} onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus size={14} /> <span className="hide-on-mobile">Book Meeting</span><span className="show-on-mobile">Book</span>
          </button>
        </div>
      </div>

      {/* Today's meetings strip */}
      {todayMeetings.length > 0 && (
        <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: 12, padding: '14px 20px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--brand-700)', fontWeight: 700, fontSize: '0.85rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={16} /> Today · {format(today, 'EEEE, dd/MM/yyyy')}
          </div>
          <div style={{ width: 1, height: 20, background: 'var(--brand-200)', margin: '0 4px' }} />
          {todayMeetings.map(m => {
            const isOutlook = m.source === 'outlook';
            const isOnsite = m.location_type === 'OFFLINE_ONSITE';
            return (
              <div key={m.id} onClick={() => { setSelectedDay(today); }} style={{
                background: isOutlook ? '#e0f2fe' : isOnsite ? '#fef3c7' : '#dcfce7',
                color: isOutlook ? '#0369a1' : isOnsite ? '#92400e' : '#15803d',
                borderRadius: 20,
                padding: '4px 12px', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isOutlook ? '#0284c7' : isOnsite ? '#f59e0b' : '#22c55e'}`,
                display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}>
                {format(new Date(m.start_time), 'HH:mm')} {m.title}
                {isOutlook && <Calendar size={12} style={{ opacity: 0.8 }} />}
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
            <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#e0f2fe', border: '1px solid #0284c7', marginRight: 4 }} />Outlook Calendar</span>
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
                    padding: '16px', borderRadius: 12,
                    background: isGoogle ? '#f0f4ff' : isOnsite ? '#fffbeb' : '#f0fdf4',
                    border: `1px solid ${isGoogle ? '#c7d7f5' : isOnsite ? '#fde68a' : '#bbf7d0'}`,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    transition: 'all 0.2s', cursor: 'pointer', position: 'relative'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        {m.title}
                        {isGoogle && <span style={{ fontSize: '0.65rem', background: '#e8f0fe', color: '#1a56db', borderRadius: 4, padding: '2px 6px', flexShrink: 0, fontWeight: 600 }}>Google</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ fontSize: '0.85rem', color: isGoogle ? '#1d4ed8' : isOnsite ? '#b45309' : '#15803d', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                          <Clock size={14} /> {format(new Date(m.start_time), 'EEE, MMM d · HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
                        </div>
                        {m.client_name && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><User size={14} color="var(--text-muted)" /> {m.client_name}</div>}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 12, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                        {isOnsite ? <MapPin size={12} /> : isGoogle ? <Calendar size={12} /> : <Video size={12} />}
                        {isOnsite ? 'Onsite' : isGoogle ? 'Google Calendar' : 'Online'}
                      </div>
                    </div>
                    {!isGoogle && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditing(m); setShowModal(true); }} title="Edit" style={{ padding: 4 }}><Pencil size={14} color="var(--text-muted)" /></button>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); cancel(m.id); }} title="Delete" style={{ padding: 4 }}><Trash2 size={14} color="#ef4444" /></button>
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
