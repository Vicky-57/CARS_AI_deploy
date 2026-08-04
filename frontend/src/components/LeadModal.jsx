import { useState } from 'react';
import { X, Upload, Sparkles, User, Mail, Phone, Car, FileText, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../api/api';

export default function LeadModal({ isOpen, onClose, onLeadCreated }) {
  const [activeTab, setActiveTab] = useState('ocr'); // 'ocr' or 'manual'
  const [ocrFile, setOcrFile] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
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

  const handleFileDrop = async (file) => {
    if (!file) return;
    setOcrFile(file);
    setOcrLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Call FastAPI backend for client & vehicle details OCR
      const isVehicleDoc = file.name.match(/\.(jpg|jpeg|png)$/i) || file.name.includes('Fahrzeug');
      
      let ocrRes;
      if (isVehicleDoc) {
        ocrRes = await api.extractVehicleSpecs(formData);
        setForm(prev => ({
          ...prev,
          manufacturer: ocrRes.manufacturer || prev.manufacturer,
          model: ocrRes.model || prev.model,
          vin: ocrRes.vin || prev.vin,
          license_plate: ocrRes.licence_plate || prev.license_plate,
          initial_registration: ocrRes.initial_registration || prev.initial_registration,
          mileage: ocrRes.mileage ? String(ocrRes.mileage) : prev.mileage,
          notes: `OCR Auto-extracted from ${file.name}`
        }));
      } else {
        ocrRes = await api.extractClientDetails(formData);
        setForm(prev => ({
          ...prev,
          name: `${ocrRes.first_name || ''} ${ocrRes.last_name || ''}`.trim() || prev.name,
          email: ocrRes.email || prev.email,
          phone: ocrRes.phone || prev.phone,
          notes: `Client details extracted from ${file.name}`
        }));
      }
    } catch (err) {
      alert('OCR Extraction note: Could not parse document automatically. You can fill the details manually below.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        price_limit: form.price_limit ? parseFloat(form.price_limit) : null,
      };
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
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, var(--brand-500), var(--brand-700))',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white'
            }}>
              <User size={16} />
            </div>
            <div>
              <div className="modal-title">Create New Lead</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Add client details or upload a document to auto-fill
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* OCR / Manual Tab Switch */}
        <div style={{ padding: '12px 24px 0', display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={`filter-chip ${activeTab === 'ocr' ? 'active' : ''}`}
            onClick={() => setActiveTab('ocr')}
          >
            <Sparkles size={12} /> OCR Upload & Pre-fill
          </button>
          <button
            type="button"
            className={`filter-chip ${activeTab === 'manual' ? 'active' : ''}`}
            onClick={() => setActiveTab('manual')}
          >
            <FileText size={12} /> Manual Entry
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {activeTab === 'ocr' && (
              <div style={{
                border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
                padding: 20, textAlign: 'center', background: 'var(--gray-50)',
                marginBottom: 20, position: 'relative'
              }}>
                {ocrLoading ? (
                  <div style={{ padding: 12 }}>
                    <Loader2 size={24} className="spin" color="var(--brand-600)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Extracting details using Claude & OCR...</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Parsing Fahrzeugdatenträger / Client document</div>
                  </div>
                ) : (
                  <div>
                    <Upload size={24} color="var(--brand-500)" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Drop Document or Click to Upload</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      Upload Fahrzeugschein, Fahrzeugdatenträger, or Client Followup PDF
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                      onChange={(e) => handleFileDrop(e.target.files[0])}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Client Info Grid */}
            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--brand-600)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              👤 Client Contact Information
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  required
                  placeholder="e.g. Maximilian Lorenz"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="form-group">
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
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="client@example.de"
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="form-group">
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
            <div style={{ fontWeight: 600, fontSize: '0.78rem', color: 'var(--brand-600)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              🚗 Vehicle Specifications (Auto-extracted or Manual)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Manufacturer</label>
                <input
                  className="form-input"
                  placeholder="e.g. Porsche / VW"
                  value={form.manufacturer}
                  onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vehicle Model</label>
                <input
                  className="form-input"
                  placeholder="e.g. Multivan Comfortline"
                  value={form.model}
                  onChange={e => setForm({ ...form, model: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">VIN (17-digit)</label>
                <input
                  className="form-input"
                  placeholder="WV2ZZZ7HZGH056070"
                  value={form.vin}
                  onChange={e => setForm({ ...form, vin: e.target.value })}
                />
              </div>
              <div className="form-group">
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

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <Loader2 size={14} className="spin" /> : <CheckCircle2 size={14} />}
              Save Lead to Supabase
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
