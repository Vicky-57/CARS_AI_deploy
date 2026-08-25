import { useState } from 'react';
import { X, Upload, Sparkles, User, Mail, Phone, Car, FileText, CheckCircle2, Loader2, Contact2 } from 'lucide-react';
import { api } from '../api/api';

export default function LeadModal({ isOpen, onClose, onLeadCreated }) {
  const [submitting, setSubmitting] = useState(false);

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
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        price_limit: form.price_limit ? parseFloat(form.price_limit) : null,
      };
      delete payload.vehicle;
      await api.createLead(payload);
      if (onLeadCreated) onLeadCreated();
      onClose();
    } catch (err) {
      alert('Failed to save lead: ' + (err.message || 'Supabase database error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-header" style={{ padding: '24px 28px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white',
              boxShadow: '0 2px 4px rgba(244,124,60,0.2)'
            }}>
              <User size={18} />
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.3px' }}>Create New Lead</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Enter client contact info and vehicle criteria
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ padding: 8 }}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ overflowY: 'auto', padding: '20px 28px 28px' }}>

            {/* Client Info Grid */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              <Contact2 size={14} color="var(--brand-500)" /> Client Contact Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
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

            {/* Vehicle Info Grid */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              <Car size={14} color="var(--brand-500)" /> Vehicle Specifications (Auto-extracted or Manual)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
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
                  placeholder="e.g. Multivan Comfortline"
                  value={form.model}
                  onChange={e => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">VIN (17-digit)</label>
                <input
                  className="form-input"
                  placeholder="WV2ZZZ7HZGH056070"
                  value={form.vin}
                  onChange={e => setForm({ ...form, vin: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">License Plate / Budget (€)</label>
                <input
                  className="form-input"
                  placeholder="e.g. IN-CA-8580 or 45000"
                  value={form.price_limit}
                  onChange={e => setForm({ ...form, price_limit: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Internal Notes</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Additional vehicle specs, TÜV date, or client requirements..."
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '16px 28px', background: 'var(--gray-50)', borderRadius: '0 0 var(--radius-xl) var(--radius-xl)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '10px 16px' }}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: '10px 16px' }}>
              {submitting ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
              Save Lead to Supabase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
