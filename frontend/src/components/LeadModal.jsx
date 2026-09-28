import { useState } from 'react';
import { X, User, Car, Contact2, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../api/api';
import { isValidVIN, isValidEmail, isValidPhone, cleanText } from '../utils/textUtils';

export default function LeadModal({ isOpen, onClose, onLeadCreated }) {
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    intent: 'BUY',
    channel: 'MANUAL',
    manufacturer: '',
    model: '',
    vin: '',
    license_plate: '',
    initial_registration: '',
    mileage: '',
    price_limit: '',
    notes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    // Contact requirement: At least email or phone must be provided
    const emailVal = form.email.trim();
    const phoneVal = form.phone.trim();
    if (!emailVal && !phoneVal) {
      setErrorMsg('Please provide at least one contact channel (Email address or Phone number).');
      return;
    }

    if (emailVal && !isValidEmail(emailVal)) {
      setErrorMsg('Please enter a valid email address (e.g. client@example.com).');
      return;
    }

    if (phoneVal && !isValidPhone(phoneVal)) {
      setErrorMsg('Please enter a valid phone number with country/area code (at least 6 digits).');
      return;
    }

    // Strict 17-character VIN validation according to ISO 3779
    const vinVal = form.vin.trim().toUpperCase();
    if (vinVal && !isValidVIN(vinVal)) {
      setErrorMsg('Invalid VIN: Must be exactly 17 alphanumeric characters (ISO 3779 standard, excluding letters I, O, and Q). Input was: "' + vinVal + '".');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        name: cleanText(form.name) || (emailVal ? emailVal.split('@')[0] : 'Client Lead'),
        email: emailVal || null,
        phone: phoneVal || null,
        vin: vinVal || null,
        notes: cleanText(form.notes),
        price_limit: form.price_limit ? parseFloat(form.price_limit) : null,
      };
      delete payload.vehicle;
      await api.createLead(payload);
      if (onLeadCreated) onLeadCreated();
      onClose();
    } catch (err) {
      setErrorMsg('Failed to save lead: ' + (err.message || 'Supabase database error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title">New Lead DocType</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Enter prospective buyer or seller inquiry details
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {errorMsg && (
              <div style={{
                padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 8, color: '#b91c1c', fontSize: '0.82rem', lineHeight: 1.4
              }}>
                ⚠️ <strong>Validation Error:</strong> {errorMsg}
              </div>
            )}

            {/* Client Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              <Contact2 size={13} /> Client Contact Details (Email or Phone required)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  required
                  placeholder="e.g. Maximilian Lorenz"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Intent Pipeline *</label>
                <select
                  className="form-select"
                  value={form.intent}
                  onChange={e => setForm({ ...form, intent: e.target.value })}
                >
                  <option value="SELL">Sell Side (Vermittlung)</option>
                  <option value="BUY">Buy Side (Beschaffung)</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="client@example.de"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Phone Number</label>
                <input
                  className="form-input"
                  placeholder="+49 8404 9385840"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                />
              </div>
            </div>

            {/* Vehicle Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 4 }}>
              <Car size={13} /> Vehicle Requirements
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Manufacturer</label>
                <input
                  className="form-input"
                  placeholder="e.g. Porsche / VW"
                  value={form.manufacturer}
                  onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Vehicle Model</label>
                <input
                  className="form-input"
                  placeholder="e.g. 911 GT3 / Multivan"
                  value={form.model}
                  onChange={e => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">VIN (17 characters)</label>
                <input
                  className="form-input"
                  placeholder="WV2ZZZ7HZGH056070"
                  maxLength={17}
                  value={form.vin}
                  onChange={e => setForm({ ...form, vin: e.target.value.toUpperCase().trim() })}
                />
                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                  Standard ISO 3779 (17 alphanumeric chars, no I, O, Q)
                </span>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Budget / Limit (€)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 45000"
                  value={form.price_limit}
                  onChange={e => setForm({ ...form, price_limit: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Internal Broker Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Additional vehicle specs, inspection requests, or client requirements…"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? <Loader2 size={13} className="spin" /> : <CheckCircle2 size={13} />}
              <span>Save Lead</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
