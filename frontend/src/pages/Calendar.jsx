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
    <div className="modal-overlay" onClick={onClose} style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, background: '#ffffff', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '24px 28px 20px', background: '#ffffff' }}>
          <span className="modal-title" style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem', color: '#0f172a' }}>{isEdit ? 'Edit Meeting' : 'New Meeting'}</span>
          <button className="btn-icon" onClick={onClose} style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '50%', padding: 6 }}><X size={18} /></button>
        </div>
        <div className="modal-body" style={{ padding: '24px 28px', maxHeight: '75vh', overflowY: 'auto' }}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Meeting Title <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 500 }}>(auto-filled if blank)</span></label>
            <input className="form-input" style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', color: '#0f172a', fontSize: '0.9rem', width: '100%', background: '#f8fafc', transition: 'all 0.2s', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#ea580c'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }} value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Car inspection with Herr Müller" />
          </div>
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Start Time *</label>
              <input ref={startRef} className="form-input" type="datetime-local" style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', color: '#0f172a', fontSize: '0.9rem', width: '100%', background: '#f8fafc', transition: 'all 0.2s', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#ea580c'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }} value={form.start_time} onChange={e => { set('start_time', e.target.value); setConflict(null); setBookAnyway(false); }} />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>End Time *</label>
              <input className="form-input" type="datetime-local" style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', color: '#0f172a', fontSize: '0.9rem', width: '100%', background: '#f8fafc', transition: 'all 0.2s', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#ea580c'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }} value={form.end_time} min={form.start_time || undefined} onChange={e => { set('end_time', e.target.value); setConflict(null); setBookAnyway(false); }} />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, background: '#f8fafc', padding: '12px 16px', borderRadius: 10, border: '1px solid #e2e8f0' }}>
            <input type="checkbox" id="is_onsite" checked={isOnsite} onChange={e => { set('location_type', e.target.checked ? 'OFFLINE_ONSITE' : 'ONLINE'); setConflict(null); setBookAnyway(false); }} style={{ width: 18, height: 18, accentColor: '#ea580c', cursor: 'pointer' }} />
            <label htmlFor="is_onsite" className="form-label" style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', cursor: 'pointer' }}>
              Onsite meeting (30-min travel buffer)
            </label>
          </div>

          {isOnsite && (
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Location</label>
              <input className="form-input" style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', color: '#0f172a', fontSize: '0.9rem', width: '100%', background: '#f8fafc', transition: 'all 0.2s', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#ea580c'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }} value={form.location_address} onChange={e => set('location_address', e.target.value)} placeholder="Address…" />
            </div>
          )}

          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Client Name *</label>
              <input className="form-input" style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', color: '#0f172a', fontSize: '0.9rem', width: '100%', background: '#f8fafc', transition: 'all 0.2s', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#ea580c'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }} value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Full Name" />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Client Contact</label>
              <input className="form-input" style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', color: '#0f172a', fontSize: '0.9rem', width: '100%', background: '#f8fafc', transition: 'all 0.2s', outline: 'none' }} onFocus={e => { e.target.style.borderColor = '#ea580c'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }} value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+49 or email" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>Notes</label>
            <textarea className="form-textarea" style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', color: '#0f172a', fontSize: '0.9rem', width: '100%', background: '#f8fafc', transition: 'all 0.2s', outline: 'none', minHeight: 80 }} onFocus={e => { e.target.style.borderColor = '#ea580c'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any preparation details..." />
          </div>

          {checking && <p style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Checking for conflicts…</p>}

          {conflict?.has_overlap && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: 12, borderRadius: 10, color: '#991b1b', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertTriangle size={18} />
              <div style={{ fontSize: '0.85rem' }}><strong>Scheduling Conflict!</strong> Another meeting exists in this slot.</div>
            </div>
          )}

          {googleBusy?.connected && googleBusy?.busy?.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 12, borderRadius: 10, color: '#92400e', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
              <AlertTriangle size={18} />
              <div style={{ fontSize: '0.85rem' }}><strong>Google Calendar Busy:</strong> {googleBusy.busy.map(b => `${format(new Date(b.start), 'HH:mm')}–${format(new Date(b.end), 'HH:mm')}`).join(', ')}</div>
            </div>
          )}

          {bookAnyway && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: 16, borderRadius: 10, color: '#92400e', marginBottom: 16 }}>
              <strong style={{ fontSize: '0.9rem' }}>Book anyway?</strong>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn" style={{ padding: '8px 16px', background: '#ffffff', color: '#92400e', border: '1px solid #fcd34d', borderRadius: 8, fontWeight: 700, fontSize: '0.8rem' }} onClick={() => { setBookAnyway(false); startRef.current?.focus(); }}>Reschedule</button>
                <button type="button" className="btn" style={{ padding: '8px 16px', background: '#d97706', color: '#ffffff', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '0.8rem' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Book Anyway'}</button>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '20px 28px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" className="btn" style={{ padding: '10px 20px', background: '#ffffff', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem' }} onClick={onClose}>Cancel</button>
          <button type="button" className="btn" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)', opacity: (saving || !form.client_name.trim() || !timesValid) ? 0.6 : 1, cursor: (saving || !form.client_name.trim() || !timesValid) ? 'not-allowed' : 'pointer' }} onClick={handleSave} disabled={saving || !form.client_name.trim() || !timesValid}>
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
        background: isGoogle ? '#f0f9ff' : isOutlook ? '#f0f9ff' : isOnsite ? '#fffbeb' : '#f0fdf4',
        color: isGoogle ? '#0369a1' : isOutlook ? '#0369a1' : isOnsite ? '#b45309' : '#15803d',
        border: `1px solid ${isGoogle ? '#bae6fd' : isOutlook ? '#bae6fd' : isOnsite ? '#fde68a' : '#bbf7d0'}`,
        borderRadius: 8,
        padding: '4px 8px',
        fontSize: '0.7rem',
        fontWeight: 700,
        marginBottom: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
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
              borderRadius: 16,
              border: isToday ? '2px solid #ea580c' : '1px solid #e2e8f0',
              background: isToday ? '#fffaf5' : '#ffffff',
              boxShadow: isToday ? '0 4px 12px rgba(234, 88, 12, 0.08)' : 'none',
              minHeight: 180,
              padding: 10,
              display: 'flex', flexDirection: 'column',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: isToday ? '#ea580c' : '#64748b', marginBottom: 8, textTransform: 'uppercase' }}>
              {format(day, 'EEE')}<br />
              <span style={{ fontSize: '1.4rem', color: isToday ? '#ea580c' : '#0f172a' }}>{format(day, 'd')}</span>
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
              borderRadius: 12,
              border: `1px solid ${isToday ? '#ea580c' : '#e2e8f0'}`,
              background: isToday ? '#fffaf5' : (inMonth ? '#ffffff' : '#f8fafc'),
              boxShadow: isToday ? '0 4px 12px rgba(234, 88, 12, 0.08)' : 'none',
              padding: '6px 5px',
              minHeight: 90,
              opacity: inMonth ? 1 : 0.4,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: isToday ? 800 : 700, color: isToday ? '#ea580c' : (inMonth ? '#0f172a' : '#94a3b8'), marginBottom: 6, textAlign: 'center' }}>
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
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a', margin: '0 0 6px 0' }}>
            Calendar & Appointments
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
            Portal meetings + Outlook Calendar events — 30-min travel conflict guard
          </p>
        </div>
        <div className="calendar-actions-mobile" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button className="btn hide-on-mobile" style={{ flexShrink: 0, padding: '10px', background: '#ffffff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }} onClick={() => loadData(true)} disabled={refreshing} title="Refresh">
            <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          
          {/* Week / Month toggle */}
          <div style={{ display: 'inline-flex', gap: 4, background: '#f1f5f9', padding: 4, borderRadius: 12, flexShrink: 0 }}>
            {['week', 'month'].map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} style={{
                padding: '8px 20px', borderRadius: 8, fontWeight: 800, fontSize: '0.85rem',
                border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: viewMode === mode ? '#0f172a' : 'transparent',
                color: viewMode === mode ? '#ffffff' : '#64748b',
                boxShadow: viewMode === mode ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
              }}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
            ))}
          </div>

          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', background: outlookConnected ? '#dcfce7' : '#fef3c7', color: outlookConnected ? '#166534' : '#92400e', border: `1px solid ${outlookConnected ? '#bbf7d0' : '#fde68a'}`, borderRadius: 20, padding: '6px 12px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {outlookConnected ? <><CheckCircle size={14} /> <span className="hide-on-mobile">Outlook Synced</span></> : <><AlertTriangle size={14} /> <span className="hide-on-mobile">Outlook Offline</span></>}
          </span>

          <button className="btn" style={{ marginLeft: 'auto', whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)' }} onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus size={14} /> <span className="hide-on-mobile">Book Meeting</span><span className="show-on-mobile">Book</span>
          </button>
        </div>
      </div>

      {/* Today's meetings strip */}
      {todayMeetings.length > 0 && (
        <div style={{ background: '#fffaf5', border: '1px solid #fed7aa', borderRadius: 16, padding: '16px 24px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.05)' }}>
          <div style={{ color: '#ea580c', fontWeight: 800, fontSize: '0.9rem', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} /> Today · {format(today, 'EEEE, dd/MM/yyyy')}
          </div>
          <div style={{ width: 1, height: 24, background: '#fed7aa', margin: '0 4px' }} />
          {todayMeetings.map(m => {
            const isOutlook = m.source === 'outlook';
            const isOnsite = m.location_type === 'OFFLINE_ONSITE';
            return (
              <div key={m.id} onClick={() => { setSelectedDay(today); }} style={{
                background: isOutlook ? '#f0f9ff' : isOnsite ? '#fffbeb' : '#f0fdf4',
                color: isOutlook ? '#0369a1' : isOnsite ? '#b45309' : '#15803d',
                borderRadius: 24,
                padding: '6px 14px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${isOutlook ? '#bae6fd' : isOnsite ? '#fde68a' : '#bbf7d0'}`,
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <span style={{ opacity: 0.8 }}>{format(new Date(m.start_time), 'HH:mm')}</span> {m.title}
                {isOutlook && <Calendar size={12} style={{ opacity: 0.8, marginLeft: 2 }} />}
              </div>
            );
          })}
        </div>
      )}

      {/* Calendar View Card */}
      <div className="card" style={{ marginBottom: 24, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', borderRadius: 16, overflow: 'hidden' }}>
        <div className="card-header" style={{ justifyContent: 'space-between', padding: '16px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <span className="card-title" style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>{periodLabel}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ padding: '6px 12px', background: '#ffffff', color: '#0f172a', border: '1.5px solid #e2e8f0', borderRadius: 8 }} onClick={prevPeriod}><ChevronLeft size={16} /></button>
            <button className="btn" style={{ padding: '6px 16px', fontSize: '0.8rem', fontWeight: 700, background: '#ffffff', color: '#0f172a', border: '1.5px solid #e2e8f0', borderRadius: 8 }}
              onClick={viewMode === 'week' ? goTodayWeek : goTodayMonth}>Today</button>
            <button className="btn" style={{ padding: '6px 12px', background: '#ffffff', color: '#0f172a', border: '1.5px solid #e2e8f0', borderRadius: 8 }} onClick={nextPeriod}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="card-body" style={{ padding: '20px 24px' }}>
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
      <div className="card" style={{ border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', borderRadius: 16, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '16px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a' }}>
            <Clock size={18} color="#ea580c" /> Upcoming ({upcoming.length})
          </span>
        </div>
        <div className="card-body" style={{ padding: 24 }}>
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
                    padding: '16px 20px', borderRadius: 14,
                    background: isGoogle ? '#f8fafc' : isOnsite ? '#fffaf5' : '#ffffff',
                    border: `1.5px solid ${isGoogle ? '#e2e8f0' : isOnsite ? '#fed7aa' : '#e2e8f0'}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    transition: 'all 0.2s', cursor: 'pointer', position: 'relative'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)'; }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
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
