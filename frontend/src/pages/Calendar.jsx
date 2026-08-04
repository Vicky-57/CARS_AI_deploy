import { useState, useEffect } from 'react';
import { Calendar, Plus, X, AlertTriangle, Trash2, MapPin, Video, User as UserIcon, Clock } from 'lucide-react';
import { api } from '../api/api';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

const MOCK_MEETINGS = [
  {
    id: 'm1',
    title: 'Vehicle Inspection: Porsche 911',
    start_time: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 3.5 * 60 * 60 * 1000).toISOString(),
    is_onsite: true,
    location: 'Berlin Showroom',
    attendee_name: 'Max Mustermann',
    notes: 'Check for scratch on front bumper'
  },
  {
    id: 'm2',
    title: 'Contract Signing & Handover',
    start_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
    is_onsite: false,
    location: '',
    attendee_name: 'Sarah Schmidt',
    notes: 'Finalize documents and hand over keys'
  },
  {
    id: 'm3',
    title: 'Initial Consultation',
    start_time: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString(),
    is_onsite: false,
    location: '',
    attendee_name: 'John Doe',
    notes: 'Discuss selling his Audi R8'
  },
  {
    id: 'm4',
    title: 'Photography Session',
    start_time: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 74 * 60 * 60 * 1000).toISOString(),
    is_onsite: true,
    location: 'Studio 4, Munich',
    attendee_name: 'Photo Team',
    notes: 'BMW M3 Competition shoot'
  }
];

function NewMeetingModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', attendee_name: '', attendee_contact: '',
    start_time: '', end_time: '', is_onsite: false, location: '', notes: ''
  });
  const [conflict, setConflict] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const checkConflict = async () => {
    if (!form.start_time || !form.end_time) return;
    setChecking(true);
    try {
      const res = await api.checkConflict({
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        is_onsite: form.is_onsite,
      });
      setConflict(res);
    } catch { setConflict(null); }
    finally { setChecking(false); }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title || !form.start_time || !form.end_time) return;
    setSaving(true);
    try {
      await api.createMeeting({
        ...form,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
      });
      onCreated();
      onClose();
    } catch (e) {
      const detail = e.message;
      alert('Could not create meeting: ' + detail);
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h3 className="modal-title">New Meeting</h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Meeting Title *</label>
              <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Car inspection with Herr Müller" required />
            </div>
            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Start Time *</label>
                <input className="form-input" type="datetime-local" value={form.start_time} onChange={e => { set('start_time', e.target.value); setConflict(null); }} required />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">End Time *</label>
                <input className="form-input" type="datetime-local" value={form.end_time} onChange={e => { set('end_time', e.target.value); setConflict(null); }} onBlur={checkConflict} required />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface-hover)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border)' }}>
              <input type="checkbox" id="is_onsite" checked={form.is_onsite} onChange={e => set('is_onsite', e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--brand-500)' }} />
              <label htmlFor="is_onsite" className="form-label" style={{ margin: 0, fontWeight: 500, cursor: 'pointer' }}>
                Onsite meeting (adds 30-min travel buffer for conflict check)
              </label>
            </div>

            {form.is_onsite && (
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Location</label>
                <input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Address…" />
              </div>
            )}

            <div className="grid-2" style={{ gap: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Attendee Name</label>
                <input className="form-input" value={form.attendee_name} onChange={e => set('attendee_name', e.target.value)} placeholder="Full Name" />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Attendee Contact</label>
                <input className="form-input" value={form.attendee_contact} onChange={e => set('attendee_contact', e.target.value)} placeholder="+49 or email" />
              </div>
            </div>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any preparation details..." style={{ minHeight: 80 }} />
            </div>

            {checking && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Checking for scheduling conflicts…</p>}
            {conflict?.has_conflict && (
              <div className="conflict-alert" style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: 16, borderRadius: 8, display: 'flex', gap: 12, color: '#991b1b' }}>
                <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                <div>
                  <strong style={{ display: 'block', marginBottom: 4 }}>Conflict detected!</strong>
                  <div style={{ fontSize: '0.85rem' }}>{conflict.conflicts.map(c => c.title).join(', ')}</div>
                  {conflict.checked_window.travel_buffer_applied && <div style={{ fontSize: '0.75rem', marginTop: 4, opacity: 0.8 }}>Includes 30-min travel buffer.</div>}
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !form.title || !form.start_time || !form.end_time}>
              {saving ? 'Saving…' : 'Book Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function WeekView({ meetings }) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 16 }}>
      {days.map(day => {
        const dayMeetings = meetings.filter(m => {
          try { return isSameDay(new Date(m.start_time), day); } catch { return false; }
        });
        const isToday = isSameDay(day, today);
        return (
          <div key={day.toISOString()} style={{
            borderRadius: 'var(--radius-lg)',
            border: isToday ? '2px solid var(--brand-500)' : '1px solid var(--gray-200)',
            background: 'var(--surface)',
            minHeight: 180,
            boxShadow: isToday ? '0 8px 16px rgba(var(--brand-500-rgb), 0.15)' : '0 2px 6px rgba(0,0,0,0.03)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}>
            {/* Day Header */}
            <div style={{ 
              padding: '16px 12px 12px', 
              background: isToday ? 'var(--brand-50)' : 'var(--gray-50)',
              borderBottom: isToday ? '1px solid var(--brand-200)' : '1px solid var(--gray-200)',
              textAlign: 'center' 
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: isToday ? 'var(--brand-700)' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>
                {format(day, 'EEE')}
              </div>
              <div style={{ 
                fontSize: '1.4rem', 
                fontWeight: 800, 
                color: isToday ? 'white' : 'var(--text-primary)',
                background: isToday ? 'var(--brand-500)' : 'transparent',
                width: 36, height: 36, 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto',
                borderRadius: '50%'
              }}>
                {format(day, 'd')}
              </div>
            </div>
            
            {/* Day Body (Meetings) */}
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, background: isToday ? 'rgba(var(--brand-50-rgb), 0.3)' : 'transparent' }}>
              {dayMeetings.length === 0 ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '1rem', color: 'var(--gray-300)' }}>-</span>
                </div>
              ) : (
                dayMeetings.map(m => (
                  <div key={m.id} style={{
                    background: m.is_onsite ? '#fffbeb' : '#f0f9ff',
                    color: m.is_onsite ? '#92400e' : '#0369a1',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    lineHeight: 1.3,
                    border: `1px solid ${m.is_onsite ? '#fde68a' : '#bae6fd'}`,
                    borderLeft: `4px solid ${m.is_onsite ? '#f59e0b' : '#0ea5e9'}`
                  }}>
                    <div style={{ marginBottom: 4, opacity: 0.85, fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.3px' }}>{format(new Date(m.start_time), 'HH:mm')}</div>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', whiteSpace: 'normal' }}>{m.title}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CalendarPage() {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try { 
      const data = await api.getMeetings();
      setMeetings(data && data.length > 0 ? data : MOCK_MEETINGS);
    } catch { 
      setMeetings(MOCK_MEETINGS); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this meeting?')) return;
    try { 
      await api.cancelMeeting(id); 
      load(); 
    } catch (e) { 
      // Fallback for mock data deletion
      setMeetings(meetings.filter(m => m.id !== id));
    }
  };

  const upcoming = meetings
    .filter(m => new Date(m.start_time) >= new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Calendar</h1>
          <p style={{ fontSize: '0.9rem' }}>Schedule and manage client meetings. Conflict guard active.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Book Meeting
        </button>
      </div>

      {/* Week view */}
      <div className="card" style={{ marginBottom: 32, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div className="card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={18} color="var(--brand-500)" /> This Week
          </span>
        </div>
        <div className="card-body" style={{ padding: '24px' }}>
          {loading ? <div className="loading-spinner"><div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /></div> : <WeekView meetings={meetings} />}
        </div>
      </div>

      {/* Upcoming list */}
      <div className="card" style={{ border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div className="card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', justifyContent: 'space-between' }}>
          <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={18} color="var(--gray-500)" /> Upcoming Meetings
          </span>
          <span className="badge" style={{ fontSize: '0.75rem', background: 'var(--brand-100)', color: 'var(--brand-700)' }}>
            {upcoming.length} scheduled
          </span>
        </div>
        <div className="card-body" style={{ padding: '24px' }}>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /></div>
          ) : upcoming.length === 0 ? (
            <div className="empty-state" style={{ padding: '60px 0' }}>
              <Calendar size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>No upcoming meetings</h3>
              <p style={{ color: 'var(--text-muted)' }}>Book your first meeting above.</p>
            </div>
          ) : (
            <div className="calendar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {upcoming.map(m => (
                <div key={m.id} className="card" style={{ 
                  display: 'flex', 
                  flexDirection: 'row',
                  padding: 0,
                  border: '1px solid var(--gray-200)',
                  overflow: 'hidden',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                }}>
                  {/* Left edge accent */}
                  <div style={{ width: 6, background: m.is_onsite ? '#f59e0b' : 'var(--brand-500)' }} />
                  
                  <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.2 }}>{m.title}</div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--brand-600)', fontWeight: 600 }}>
                          {format(new Date(m.start_time), 'EEEE, MMM d')} · {format(new Date(m.start_time), 'HH:mm')}
                        </div>
                      </div>
                      <button className="btn-icon" onClick={() => cancel(m.id)} title="Cancel meeting" style={{ color: 'var(--gray-400)', hover: { color: 'var(--danger)' } }}>
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {m.is_onsite ? <MapPin size={14} color="#d97706" /> : <Video size={14} color="var(--brand-500)" />}
                        <span style={{ fontWeight: 500, color: m.is_onsite ? '#92400e' : 'var(--text-secondary)' }}>
                          {m.is_onsite ? 'Onsite' : 'Online'} {m.location ? `· ${m.location}` : ''}
                        </span>
                      </div>
                      
                      {m.attendee_name && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <UserIcon size={14} color="var(--gray-400)" />
                          <span>{m.attendee_name}</span>
                        </div>
                      )}
                      
                      {m.notes && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 8, padding: '8px 12px', background: 'var(--gray-50)', borderRadius: 6, border: '1px solid var(--gray-100)' }}>
                          {m.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNew && <NewMeetingModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}
