import { useState, useEffect } from 'react';
import { X, Car, Tag, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api/api';
import ConfirmDialog from './ConfirmDialog';
import { isValidVIN, isValidEmail, isValidPhone, cleanText } from '../utils/textUtils';

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
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', detail: '', onConfirm: null });
  const openConfirm = (cfg) => setConfirmDialog({ open: true, variant: 'warning', ...cfg });
  const closeConfirm = () => setConfirmDialog(d => ({ ...d, open: false }));

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

    const clientEmail = (formData.client_email || '').trim();
    const clientPhone = (formData.client_phone || '').trim();
    const vinVal = (formData.vin || '').trim().toUpperCase();

    // 1. Mandatory contact channel: At least email or phone must be provided
    if (!clientEmail && !clientPhone) {
      toast.error('Please provide at least one contact channel (Email or Phone).');
      return;
    }
    if (clientEmail && !isValidEmail(clientEmail)) {
      toast.error('Please provide a valid email address (e.g. client@example.com).');
      return;
    }
    if (clientPhone && !isValidPhone(clientPhone)) {
      toast.error('Please provide a valid phone number (at least 6 digits).');
      return;
    }

    // 2. Strict 17-character VIN validation (ISO 3779)
    if (vinVal && !isValidVIN(vinVal)) {
      toast.error(`Invalid VIN "${vinVal}": Must be exactly 17 alphanumeric characters (ISO 3779 standard, excluding letters I, O, and Q).`);
      return;
    }

    // 3. Duplicate check if entering a new customer
    if (selectedCustomerId === 'NEW') {
      const duplicateContact = existingCustomers.find(c =>
        (clientEmail && c.email?.toLowerCase() === clientEmail.toLowerCase()) ||
        (clientPhone && c.phone && c.phone.replace(/\D/g, '') === clientPhone.replace(/\D/g, ''))
      );
      if (duplicateContact) {
        openConfirm({
          title: 'Duplicate Contact Found',
          message: `A contact already exists: "${duplicateContact.name || duplicateContact.email}"`,
          detail: 'Proceeding will link this project to that existing customer profile.',
          confirmLabel: 'Link & Continue',
          variant: 'warning',
          onConfirm: () => { closeConfirm(); doSubmit(clientEmail, clientPhone, vinVal); },
        });
        return;
      }
    }

    doSubmit(clientEmail, clientPhone, vinVal);
  };

  const doSubmit = async (clientEmail, clientPhone, vinVal) => {
    setSubmitting(true);
    try {
      const initialStage = 'Intake & Onboarding';

      const payload = {
        client_name: cleanText(formData.client_name),
        client_email: clientEmail || null,
        client_phone: clientPhone || null,
        project_type: formData.project_type,
        target_vehicle: cleanText(formData.target_vehicle),
        vin: vinVal || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : 0,
        target_price: formData.target_price ? parseFloat(formData.target_price) : 0,
        current_stage: initialStage,
        status: formData.status,
        notes: cleanText(formData.notes) || null
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
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        detail={confirmDialog.detail}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
        
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Car size={16} />
            <span>{formData.status === 'COMPLETED' ? 'New Deal Record' : 'New Project DocType'}</span>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Pipeline Type Selection */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Pipeline Type</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  className={`btn btn-sm ${formData.project_type === 'SELL' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormData({ ...formData, project_type: 'SELL' })}
                  style={{ justifyContent: 'center', gap: 6 }}
                >
                  <Tag size={14} /> SELL (Vermittlung)
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${formData.project_type === 'BUY' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFormData({ ...formData, project_type: 'BUY' })}
                  style={{ justifyContent: 'center', gap: 6 }}
                >
                  <Search size={14} /> BUY (Beschaffung)
                </button>
              </div>
            </div>

            {/* Customer Dropdown */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Select Client / Customer</span>
                {loadingCustomers && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Loading contacts…</span>}
              </label>
              <select
                className="form-select"
                value={selectedCustomerId}
                onChange={handleCustomerSelect}
              >
                <option value="NEW">➕ Add New Client</option>
                <optgroup label="Existing Customers">
                  {existingCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.email ? `(${c.email})` : c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Client Details */}
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

            {/* Target Vehicle Details & VIN */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Target Vehicle *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Porsche 911 Carrera S"
                  value={formData.target_vehicle}
                  onChange={e => setFormData({ ...formData, target_vehicle: e.target.value })}
                  required
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">VIN (17 characters)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="WV2ZZZ7HZGH056070"
                  maxLength={17}
                  value={formData.vin}
                  onChange={e => setFormData({ ...formData, vin: e.target.value.toUpperCase().trim() })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Purchase Price (€)</label>
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
                <label className="form-label">Target Sale Price (€)</label>
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

            {/* Notes */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Notes & Specifications</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Max mileage, preferred color, options..."
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Creating…' : formData.status === 'COMPLETED' ? 'Create Deal Record' : 'Create Project'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
