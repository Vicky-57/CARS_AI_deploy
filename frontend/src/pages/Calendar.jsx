import { useState, useEffect, useRef } from 'react';
import { Calendar, Plus, X, AlertTriangle, Trash2, Pencil, Clock, ChevronLeft, ChevronRight, RefreshCw, MapPin, Video, User, CheckCircle } from 'lucide-react';
import { api } from '../api/api';
import { format, startOfWeek, addDays, isSameDay, startOfMonth, endOfMonth, addWeeks, subWeeks, addMonths, subMonths } from 'date-fns';

// ─── Meeting Modal ────────────────────────────────────────────────────────────
function MeetingModal({ meeting, onClose, onSaved }) {
  const isEdit = !!meeting && !meeting.id?.startsWith('google_') && !meeting.id?.startsWith('outlook_');

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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <span className="modal-title">{isEdit ? 'Edit Meeting' : 'New Meeting'}</span>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Meeting Title <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(auto-filled if blank)</span></label>
            <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Car inspection with Herr Müller" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Start Time *</label>
              <input ref={startRef} className="form-input" type="datetime-local" value={form.start_time} onChange={e => { set('start_time', e.target.value); setConflict(null); setBookAnyway(false); }} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">End Time *</label>
              <input className="form-input" type="datetime-local" value={form.end_time} min={form.start_time || undefined} onChange={e => { set('end_time', e.target.value); setConflict(null); setBookAnyway(false); }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-canvas)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
            <input type="checkbox" id="is_onsite" checked={isOnsite} onChange={e => { set('location_type', e.target.checked ? 'OFFLINE_ONSITE' : 'ONLINE'); setConflict(null); setBookAnyway(false); }} style={{ width: 16, height: 16, cursor: 'pointer' }} />
            <label htmlFor="is_onsite" style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
              Onsite meeting (30-min travel conflict guard)
            </label>
          </div>

          {isOnsite && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Location Address</label>
              <input className="form-input" value={form.location_address} onChange={e => set('location_address', e.target.value)} placeholder="e.g. Gewerbepark 4, Mindelstetten" />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Client Name *</label>
              <input className="form-input" value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Full Name" />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Client Contact</label>
              <input className="form-input" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+49 or email" />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Preparation details, vehicle requirements, etc." />
          </div>

          {checking && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>Checking for conflicts…</p>}

          {conflict?.has_overlap && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '10px 14px', borderRadius: 'var(--radius-sm)', color: '#991b1b', fontSize: '0.8125rem', display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div><strong>Scheduling Conflict!</strong> Another meeting exists in this time slot.</div>
            </div>
          )}

          {googleBusy?.connected && googleBusy?.busy?.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '10px 14px', borderRadius: 'var(--radius-sm)', color: '#92400e', fontSize: '0.8125rem', display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <div><strong>External Calendar Busy:</strong> {googleBusy.busy.map(b => `${format(new Date(b.start), 'HH:mm')}–${format(new Date(b.end), 'HH:mm')}`).join(', ')}</div>
            </div>
          )}

          {bookAnyway && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 12, borderRadius: 'var(--radius-sm)', color: '#92400e' }}>
              <strong style={{ fontSize: '0.85rem' }}>Book anyway despite conflict?</strong>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setBookAnyway(false); startRef.current?.focus(); }}>Reschedule</button>
                <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Book Anyway'}</button>
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

  const bg = isGoogle || isOutlook ? '#f0fdf4' : isOnsite ? '#fffbeb' : '#f8fafc';
  const color = isGoogle || isOutlook ? '#166534' : isOnsite ? '#92400e' : '#18181b';
  const border = isGoogle || isOutlook ? '#bbf7d0' : isOnsite ? '#fde68a' : '#e5e7eb';

  return (
    <div
      onClick={() => onClick && onClick(m)}
      title={`${m.title}${m.client_name ? ' · ' + m.client_name : ''}`}
      style={{
        background: bg,
        color: color,
        border: `1px solid ${border}`,
        borderRadius: 'var(--radius-sm)',
        padding: '3px 6px',
        fontSize: '0.72rem',
        fontWeight: 600,
        marginBottom: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'transform 0.1s ease',
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
      <div className="calendar-week-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
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
                borderRadius: 'var(--radius)',
                border: isToday ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                background: isToday ? 'var(--surface-active)' : 'var(--surface)',
                minHeight: 180,
                padding: 10,
                display: 'flex', flexDirection: 'column',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isToday ? 'var(--primary)' : 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                {format(day, 'EEE')}<br />
                <span style={{ fontSize: '1.25rem', color: isToday ? 'var(--primary)' : 'var(--text-primary)', fontWeight: 800 }}>{format(day, 'd')}</span>
              </div>
              {dayMeetings.map(m => <EventPill key={m.id} m={m} onClick={onEventClick} />)}
              {dayMeetings.length === 0 && (
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 'auto', textAlign: 'center', paddingBottom: 8 }}>—</div>
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
      <div className="calendar-month-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(dow => (
          <div key={dow} style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0', textTransform: 'uppercase' }}>{dow}</div>
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
                borderRadius: 'var(--radius-sm)',
                border: `1px solid ${isToday ? 'var(--primary)' : 'var(--border)'}`,
                background: isToday ? 'var(--surface-active)' : (inMonth ? 'var(--surface)' : 'var(--bg-canvas)'),
                padding: '6px 6px',
                minHeight: 88,
                opacity: inMonth ? 1 : 0.45,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: isToday ? 800 : 600, color: isToday ? 'var(--primary)' : (inMonth ? 'var(--text-primary)' : 'var(--text-muted)'), marginBottom: 4, textAlign: 'center' }}>
                {format(day, 'd')}
              </div>
              {dayMeetings.slice(0, 3).map(m => <EventPill key={m.id} m={m} onClick={onEventClick} />)}
              {dayMeetings.length > 3 && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'center' }}>+{dayMeetings.length - 3} more</div>
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
      <div className="day-panel" style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
        <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--text-primary)' }}>{format(day, 'EEEE')}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>{format(day, 'dd/MM/yyyy')}</div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 24px' }}>
          {dayMeetings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <Calendar size={32} style={{ opacity: 0.3, marginBottom: 12 }} /><br />
              No meetings scheduled for this day
            </div>
          ) : dayMeetings.map(m => {
            const isGoogle = m.source === 'google';
            const isOutlook = m.source === 'outlook';
            const isOnsite = m.location_type === 'OFFLINE_ONSITE';
            return (
              <div key={m.id} style={{
                background: 'var(--bg-canvas)',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                padding: '14px',
                marginBottom: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                    {m.title}
                  </div>
                  {!isGoogle && !isOutlook && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-icon" onClick={() => onEdit(m)} title="Edit" style={{ padding: 4 }}><Pencil size={13} color="var(--text-muted)" /></button>
                      <button className="btn-icon" onClick={() => onDelete(m.id)} title="Delete" style={{ padding: 4 }}><Trash2 size={13} color="var(--danger)" /></button>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Clock size={13} /> {format(new Date(m.start_time), 'HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
                  </div>
                  {m.client_name && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><User size={13} color="var(--text-muted)" /> {m.client_name}</div>}
                  {m.location_address && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}><MapPin size={13} color="var(--text-muted)" /> {m.location_address}</div>}
                  {m.notes && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2, fontStyle: 'italic' }}>{m.notes}</div>}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500 }}>
                  {isOnsite ? <MapPin size={11} /> : (isGoogle || isOutlook) ? <Calendar size={11} /> : <Video size={11} />}
                  {isOnsite ? 'Onsite' : isGoogle ? 'Google Calendar' : isOutlook ? 'Outlook Calendar' : 'Online Portal'}
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
      const sbData = await api.getMeetings();
      setSupabaseMeetings(sbData || []);

      const timeMin = viewMode === 'week' ? currentWeek.toISOString() : startOfMonth(currentMonth).toISOString();
      const timeMax = viewMode === 'week' ? addDays(currentWeek, 7).toISOString() : endOfMonth(currentMonth).toISOString();

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
    if (m.source === 'google' || m.source === 'outlook') { setSelectedDay(new Date(m.start_time)); return; }
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
      {/* Frappe Workspace Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div className="page-header-left">
          <h1 className="page-title">Calendar & Appointments</h1>
          <p className="page-subtitle">Portal meetings + Outlook sync with automated 30-min travel conflict guard</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Week / Month Pill Tabs */}
          <div style={{ display: 'inline-flex', background: 'var(--border)', padding: 2, borderRadius: 'var(--radius-sm)' }}>
            {['week', 'month'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: '5px 14px', borderRadius: 4, fontWeight: 600, fontSize: '0.75rem',
                border: 'none', cursor: 'pointer',
                background: viewMode === mode ? 'var(--surface)' : 'transparent',
                color: viewMode === mode ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: viewMode === mode ? 'var(--shadow-xs)' : 'none',
              }}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
            ))}
          </div>

          <span className={`badge ${outlookConnected ? 'badge-success' : 'badge-neutral'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {outlookConnected ? <><CheckCircle size={12} /> Outlook Synced</> : <><AlertTriangle size={12} /> Outlook Offline</>}
          </span>

          <button className="btn btn-secondary btn-sm" onClick={() => loadData(true)} disabled={refreshing} title="Refresh">
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>

          <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus size={14} /> Book Meeting
          </button>
        </div>
      </div>

      {/* Outlook Calendar not-configured banner */}
      {!outlookConnected && !loading && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fef3c7',
          borderRadius: 'var(--radius)',
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <AlertTriangle size={16} color="#d97706" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: '#92400e', fontSize: '0.8125rem' }}>
              Outlook Calendar Sync Offline
            </div>
            <div style={{ color: '#b45309', fontSize: '0.75rem', marginTop: 2 }}>
              To sync Outlook: copy your ICS calendar link and configure <code style={{ background: 'rgba(0,0,0,0.06)', padding: '1px 4px', borderRadius: 3 }}>OUTLOOK_ICS_URL</code> in environment variables. Portal meetings continue to operate normally.
            </div>
          </div>
        </div>
      )}

      {/* Today's meetings strip */}
      {todayMeetings.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ color: 'var(--primary)', fontWeight: 700, fontSize: '0.8125rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={15} /> Today ({format(today, 'dd/MM/yyyy')}):
          </div>
          {todayMeetings.map(m => {
            const isOutlook = m.source === 'outlook';
            const isOnsite = m.location_type === 'OFFLINE_ONSITE';
            return (
              <div key={m.id} onClick={() => { setSelectedDay(today); }} style={{
                background: isOutlook ? '#f0fdf4' : isOnsite ? '#fffbeb' : 'var(--bg-canvas)',
                color: isOutlook ? '#166534' : isOnsite ? '#92400e' : 'var(--text-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${isOutlook ? '#bbf7d0' : isOnsite ? '#fde68a' : 'var(--border)'}`,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                <span>{format(new Date(m.start_time), 'HH:mm')}</span> {m.title}
                {isOutlook && <Calendar size={11} style={{ opacity: 0.8 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar View Card */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header" style={{ justifyContent: 'space-between' }}>
          <span className="card-title" style={{ fontSize: '0.95rem', fontWeight: 700 }}>{periodLabel}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn btn-secondary btn-sm" onClick={prevPeriod}><ChevronLeft size={14} /></button>
            <button className="btn btn-secondary btn-sm" onClick={viewMode === 'week' ? goTodayWeek : goTodayMonth}>Today</button>
            <button className="btn btn-secondary btn-sm" onClick={nextPeriod}><ChevronRight size={14} /></button>
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
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#bbf7d0', border: '1px solid #166534' }} />Outlook Calendar</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: 'var(--bg-canvas)', border: '1px solid var(--border)' }} />Portal Meeting (Online)</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#fffbeb', border: '1px solid #d97706' }} />Portal Meeting (Onsite)</span>
          </div>
        </div>
      </div>

      {/* Upcoming list */}
      <div className="card">
        <div className="card-header">
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.9rem' }}>
            <Clock size={15} /> Upcoming Appointments ({upcoming.length})
          </span>
        </div>
        <div className="card-body">
          {upcoming.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              <Calendar size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div>No upcoming meetings.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
              {upcoming.map(m => {
                const isGoogle = m.source === 'google';
                const isOutlook = m.source === 'outlook';
                const isOnsite = m.location_type === 'OFFLINE_ONSITE';
                return (
                  <div key={m.id} style={{
                    padding: '12px 14px', borderRadius: 'var(--radius)',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    cursor: 'pointer',
                  }}
                    onClick={() => handleEventClick(m)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        {m.title}
                        {isGoogle && <span className="badge badge-info" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Google</span>}
                        {isOutlook && <span className="badge badge-success" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>Outlook</span>}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Clock size={12} /> {format(new Date(m.start_time), 'EEE, MMM d · HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
                        </div>
                        {m.client_name && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><User size={12} /> {m.client_name}</div>}
                      </div>
                    </div>
                    {!isGoogle && !isOutlook && (
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setEditing(m); setShowModal(true); }} title="Edit" style={{ padding: 4 }}><Pencil size={12} color="var(--text-muted)" /></button>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); cancel(m.id); }} title="Delete" style={{ padding: 4 }}><Trash2 size={12} color="var(--danger)" /></button>
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
    </div>
  );
}
