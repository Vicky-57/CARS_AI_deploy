import React, { useState } from 'react';

export default function CalendarGuard() {
  const [title, setTitle] = useState('Onsite BMW 320i Inspection');
  const [startTime, setStartTime] = useState('2026-08-01T14:00');
  const [endTime, setEndTime] = useState('2026-08-01T15:00');
  const [locationType, setLocationType] = useState('OFFLINE_ONSITE');
  const [alertResult, setAlertResult] = useState(null);

  const API_BASE = 'http://localhost:9000';

  const checkConflict = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/calendar/check-conflict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_time: startTime + ':00Z',
          end_time: endTime + ':00Z',
          location_type: locationType,
          existing_meetings: [
            {
              title: 'Client Landline Onsite Briefing',
              start_time: '2026-08-01T14:15:00Z',
              end_time: '2026-08-01T15:15:00Z'
            }
          ]
        })
      });
      const data = await res.json();
      setAlertResult(data);
    } catch (err) {
      alert('Conflict check failed: ' + err.message);
    }
  };

  return (
    <div className="card">
      <div className="card-title">📅 Meeting Conflict Guard & Booking Scheduler</div>

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-field">
            <label className="form-label">Meeting Title</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid-2">
            <div className="form-field">
              <label className="form-label">Start Time</label>
              <input className="form-input" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="form-field">
              <label className="form-label">End Time</label>
              <input className="form-input" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Location Type</label>
            <select className="form-select" value={locationType} onChange={(e) => setLocationType(e.target.value)}>
              <option value="OFFLINE_ONSITE">Offline / Onsite (Includes 30-min travel buffer)</option>
              <option value="ONLINE">Online Video Call</option>
            </select>
          </div>

          <button className="btn-primary" onClick={checkConflict}>
            🔍 Check Slot Availability & Conflicts
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
          <h4 style={{ color: 'var(--text-secondary)' }}>Google & Outlook Calendar Conflict Protection</h4>
          {alertResult ? (
            alertResult.has_conflict ? (
              <div className="alert-banner alert-warning">
                {alertResult.warning_message}
              </div>
            ) : (
              <div className="alert-banner alert-success">
                ✅ Slot is open! No calendar conflicts detected (Google/Outlook synced).
              </div>
            )
          ) : (
            <div className="alert-banner alert-success">
              Select a meeting time slot above to test conflict detection.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
