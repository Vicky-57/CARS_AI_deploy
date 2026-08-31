import { useState, useEffect } from 'react';
import { X, User, Car, DollarSign, Tag, Search, Plus, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/api';

export default function CreateProjectModal({ isOpen, onClose, onCreated, defaultStatus = 'ACTIVE', defaultType = 'SELL' }) {
  const [existingCustomers, setExistingCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('NEW');
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    project_type: defaultType,
    target_vehicle: '',
    vin: '',
    purchase_price: '',
    target_price: '',
    status: defaultStatus,
    notes: ''
  });

  const [submitting, setSubmitting] = useState(false);

  // Load existing customers on open
  useEffect(() => {
    if (!isOpen) return;

    setFormData(prev => ({
      ...prev,
      project_type: defaultType,
      status: defaultStatus
    }));

    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      try {
        const [leads, projects] = await Promise.all([
          api.getLeads().catch(() => []),
          api.getProjects().catch(() => [])
        ]);

        const customerMap = new Map();

        const addCustomer = (email, phone, name) => {
          const key = (email || '').toLowerCase().trim() || (phone || '').trim() || (name || '').toLowerCase().trim();
          if (!key) return;

          if (!customerMap.has(key)) {
            customerMap.set(key, {
              id: key,
              name: name || 'Unknown Client',
              email: email || '',
              phone: phone || ''
            });
          } else {
            const existing = customerMap.get(key);
            if (!existing.name && name) existing.name = name;
            if (!existing.email && email) existing.email = email;
            if (!existing.phone && phone) existing.phone = phone;
          }
        };

        leads.forEach(l => addCustomer(l.email, l.phone, l.name));
        projects.forEach(p => addCustomer(p.client_email, p.client_phone, p.client_name));

        setExistingCustomers(Array.from(customerMap.values()));
      } catch (err) {
        console.error('Error fetching existing customers:', err);
      } finally {
        setLoadingCustomers(false);
      }
    };

    fetchCustomers();
  }, [isOpen, defaultType, defaultStatus]);

  // When dropdown selection changes
  const handleCustomerSelect = (e) => {
    const val = e.target.value;
    setSelectedCustomerId(val);

    if (val === 'NEW') {
      setFormData(prev => ({
        ...prev,
        client_name: '',
        client_email: '',
        client_phone: ''
      }));
    } else {
      const selected = existingCustomers.find(c => c.id === val);
      if (selected) {
        setFormData(prev => ({
          ...prev,
          client_name: selected.name,
          client_email: selected.email,
          client_phone: selected.phone
        }));
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const initialStage = 'Intake & Onboarding';

      const payload = {
        client_name: formData.client_name,
        client_email: formData.client_email || null,
        client_phone: formData.client_phone || null,
        project_type: formData.project_type,
        target_vehicle: formData.target_vehicle,
        vin: formData.vin || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : 0,
        target_price: formData.target_price ? parseFloat(formData.target_price) : 0,
        current_stage: initialStage,
        status: formData.status,
        notes: formData.notes || null
      };

      const created = await api.createProject(payload);
      toast.success(`Successfully created ${formData.status === 'COMPLETED' ? 'Deal' : 'Project'} for ${formData.client_name}!`);
      if (onCreated) onCreated(created);
      onClose();
    } catch (err) {
      toast.error('Error creating record: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Car size={20} color="var(--brand-600)" />
            {formData.status === 'COMPLETED' ? 'Create New Historical Deal' : 'Create New Brokerage Project'}
          </h3>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Pipeline Type Selection */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Pipeline Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <button
                  type="button"
                  className={`btn ${formData.project_type === 'SELL' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormData({ ...formData, project_type: 'SELL' })}
                  style={{ justifyContent: 'center', gap: 8, padding: '10px' }}
                >
                  <Tag size={16} /> SELL SIDE (Vermittlung)
                </button>
                <button
                  type="button"
                  className={`btn ${formData.project_type === 'BUY' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormData({ ...formData, project_type: 'BUY' })}
                  style={{ justifyContent: 'center', gap: 8, padding: '10px' }}
                >
                  <Search size={16} /> BUY SIDE (Beschaffung)
                </button>
              </div>
            </div>

            {/* Customer Dropdown */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                <span>Select Client / Customer</span>
                {loadingCustomers && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Loading contacts...</span>}
              </label>
              <select
                className="form-select"
                value={selectedCustomerId}
                onChange={handleCustomerSelect}
                style={{ fontWeight: 500 }}
              >
                <option value="NEW">➕ Add New Customer / Client</option>
                <optgroup label="Existing Customers Directory">
                  {existingCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      👤 {c.name} {c.email ? `(${c.email})` : c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Client Details (Auto-filled if existing selected, editable if new) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Client Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Vikas Purohit"
                  value={formData.client_name}
                  onChange={e => setFormData({ ...formData, client_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Client Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="client@example.com"
                  value={formData.client_email}
                  onChange={e => setFormData({ ...formData, client_email: e.target.value })}
                />
              </div>
            </div>

            {/* Target Vehicle Details */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Target Vehicle *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Porsche 911 Carrera S (991.2) or BMW 320i M Sport"
                value={formData.target_vehicle}
                onChange={e => setFormData({ ...formData, target_vehicle: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Purchase / Base Price (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="e.g. 105000"
                  value={formData.purchase_price}
                  onChange={e => setFormData({ ...formData, purchase_price: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Agreed / Target Sale Price (€)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="e.g. 115000"
                  value={formData.target_price}
                  onChange={e => setFormData({ ...formData, target_price: e.target.value })}
                />
              </div>
            </div>

            {/* Notes / Special Instructions */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Notes & Criteria</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="e.g. Max 50,000 km, Agategrau color preference, TÜV valid until 2027..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating...' : formData.status === 'COMPLETED' ? 'Create Deal Record' : 'Create Project'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
