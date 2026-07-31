import { useState, useEffect } from 'react';
import { Calendar, Plus, X, AlertTriangle, Trash2 } from 'lucide-react';
import { api } from '../api/api';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';

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

  const save = async () => {
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
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New Meeting</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Meeting Title *</label>
            <input className="form-input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Car inspection with Herr Müller" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Start Time *</label>
              <input className="form-input" type="datetime-local" value={form.start_time} onChange={e => { set('start_time', e.target.value); setConflict(null); }} />
            </div>
            <div className="form-group">
              <label className="form-label">End Time *</label>
              <input className="form-input" type="datetime-local" value={form.end_time} onChange={e => { set('end_time', e.target.value); setConflict(null); }} onBlur={checkConflict} />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="is_onsite" checked={form.is_onsite} onChange={e => set('is_onsite', e.target.checked)} />
            <label htmlFor="is_onsite" className="form-label" style={{ margin: 0 }}>
              Onsite meeting (adds 30-min travel buffer for conflict check)
            </label>
          </div>

          {form.is_onsite && (
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} placeholder="Address…" />
            </div>
          )}

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Attendee Name</label>
              <input className="form-input" value={form.attendee_name} onChange={e => set('attendee_name', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Attendee Contact</label>
              <input className="form-input" value={form.attendee_contact} onChange={e => set('attendee_contact', e.target.value)} placeholder="+49 or email" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>

          {checking && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Checking for conflicts…</p>}
          {conflict?.has_conflict && (
            <div className="conflict-alert">
              <AlertTriangle size={16} />
              <div>
                <strong>Conflict detected!</strong>
                <div>{conflict.conflicts.map(c => c.title).join(', ')}</div>
                {conflict.checked_window.travel_buffer_applied && <div style={{ fontSize: '0.7rem' }}>Includes 30-min travel buffer.</div>}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.title || !form.start_time || !form.end_time}>
            {saving ? 'Saving…' : 'Book Meeting'}
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
                background: m.is_onsite ? '#fef3c7' : 'var(--brand-100)',
                color: m.is_onsite ? '#92400e' : 'var(--brand-700)',
                borderRadius: 4,
                padding: '3px 6px',
                fontSize: '0.65rem',
                fontWeight: 500,
                marginBottom: 3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {format(new Date(m.start_time), 'HH:mm')} {m.title}
              </div>
            ))}
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
    try { setMeetings(await api.getMeetings()); }
    catch { setMeetings([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!confirm('Cancel this meeting?')) return;
    try { await api.cancelMeeting(id); load(); } catch (e) { alert(e.message); }
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
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> Book Meeting
        </button>
      </div>

      {/* Week view */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">This Week</span>
        </div>
        <div className="card-body">
          {loading ? <div className="loading-spinner"><div className="spinner" /></div> : <WeekView meetings={meetings} />}
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
                <div key={m.id} className={`meeting-card${m.is_onsite ? ' onsite' : ''}`}>
                  <div>
                    <div className="meeting-time">
                      {format(new Date(m.start_time), 'dd.MM')} · {format(new Date(m.start_time), 'HH:mm')} – {format(new Date(m.end_time), 'HH:mm')}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="meeting-title">{m.title}</div>
                    <div className="meeting-detail">
                      {m.is_onsite ? '📍 Onsite' : '💻 Online'}
                      {m.attendee_name ? ` · ${m.attendee_name}` : ''}
                      {m.location ? ` · ${m.location}` : ''}
                    </div>
                    {m.notes && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{m.notes}</div>}
                  </div>
                  <button className="btn-icon" onClick={() => cancel(m.id)} title="Cancel meeting">
                    <Trash2 size={14} color="var(--danger)" />
                  </button>
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
