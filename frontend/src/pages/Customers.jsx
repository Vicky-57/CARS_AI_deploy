import { useState, useEffect } from 'react';
import { Users, UserPlus, Search, RefreshCw, Mail, Phone, Plus, X, Briefcase, Car, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { api, supabase } from '../api/api';
import CreateProjectModal from '../components/CreateProjectModal';
import ContactDetailPanel from '../components/ContactDetailPanel';

function getCustomerCar(customer) {
  if (!customer || !customer.interactions) return null;
  for (const inter of customer.interactions) {
    const item = inter.details || {};
    if (item.target_vehicle) return item.target_vehicle;
    if (item.vehicle) return item.vehicle;
    if (item.manufacturer || item.model) return `${item.manufacturer || ''} ${item.model || ''}`.trim();
    const text = `${item.subject || ''} ${item.message || ''} ${item.notes || ''}`;
    const match = text.match(/(Porsche\s+[\w\d\.\s\(\)\-]+|BMW\s+[\w\d\.\s\-]+|Audi\s+[\w\d\.\s\-]+|Mercedes-?Benz?\s+[\w\d\.\s\-]+|VW\s+[\w\d\.\s\-]+)/i);
    if (match) return match[0].split('\n')[0].split('-')[0].trim().slice(0, 30);
  }
  return null;
}

const PAGE_SIZE = 10;

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('NEW');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Add customer modal & project creation state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    intent: 'BUY',
    vehicle: '',
    year: '',
    notes: ''
  });
  const [savingCustomer, setSavingCustomer] = useState(false);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const [leads, projects] = await Promise.all([
        api.getLeads(),
        api.getProjects()
      ]);

      const customerMap = new Map();

      const addInteraction = (email, phone, name, type, item) => {
        // Normalize keys, prioritize email, then phone, then name
        const key = (email || '').toLowerCase().trim() ||
          (phone || '').trim() ||
          (name || '').toLowerCase().trim();

        if (!key) return; // Skip if no identifiable info

        if (!customerMap.has(key)) {
          customerMap.set(key, {
            id: key,
            name: name || '',
            email: email || '',
            phone: phone || '',
            interactions: [],
            created_at: item.created_at
          });
        }

        const customer = customerMap.get(key);
        // Fill in missing details if this interaction has them
        if (!customer.name && name) customer.name = name;
        if (!customer.email && email) customer.email = email;
        if (!customer.phone && phone) customer.phone = phone;

        customer.interactions.push({ type, date: item.created_at || item.updated_at, details: item });
      };

      leads.forEach(l => addInteraction(l.email, l.phone, l.name, 'Lead', l));
      projects.forEach(p => addInteraction(p.client_email, p.client_phone, p.client_name, 'Project', p));

      const allCustomers = Array.from(customerMap.values());
      // Sort by latest interaction
      allCustomers.forEach(c => {
        c.interactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        c.last_interaction = c.interactions[0]?.date;
      });
      allCustomers.sort((a, b) => new Date(b.last_interaction || 0) - new Date(a.last_interaction || 0));

      setCustomers(allCustomers);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filtered = customers.filter(c => {
    // Filter by Tab (NEW = 1 interaction, REPEAT = > 1 interaction)
    if (activeTab === 'NEW' && c.interactions.length > 1) return false;
    if (activeTab === 'REPEAT' && c.interactions.length === 1) return false;

    // Filter by search
    const query = search.toLowerCase();
    const name = (c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    return !search || name.includes(query) || email.includes(query) || phone.includes(query);
  });

  // Reset to page 1 whenever search or activeTab changes
  useEffect(() => { setCurrentPage(1); }, [search, activeTab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Build page number array (max 5 buttons around current)
  const getPageNumbers = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const getInitials = (name, email) => {
    const val = name || email;
    if (!val) return '?';
    return val.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const handleAddCustomerSubmit = async (e, andCreateProject = false) => {
    if (e) e.preventDefault();
    setSavingCustomer(true);
    try {
      const vehicleDesc = [newCustomerForm.vehicle, newCustomerForm.year ? `(${newCustomerForm.year})` : ''].filter(Boolean).join(' ');

      await api.createLead({
        name: newCustomerForm.name,
        email: newCustomerForm.email || null,
        phone: newCustomerForm.phone || null,
        intent: newCustomerForm.intent,
        channel: 'DIRECT_CALL',
        status: 'NEW',
        notes: newCustomerForm.notes
          ? `${newCustomerForm.notes}${vehicleDesc ? ` | Vehicle: ${vehicleDesc}` : ''}`
          : (vehicleDesc ? `Vehicle requested/offered: ${vehicleDesc}` : 'Added directly from Customers Directory')
      });

      toast.success(`Customer ${newCustomerForm.name} successfully created!`);
      setIsAddCustomerOpen(false);
      loadCustomers();

      if (andCreateProject) {
        setIsCreateProjectOpen(true);
      }
    } catch (err) {
      toast.error('Error creating customer: ' + err.message);
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleDeleteCustomer = async (customer, e) => {
    if (e) e.stopPropagation();
    const name = customer.name || customer.email || 'this customer';
    if (!window.confirm(`Are you sure you want to delete customer "${name}"?`)) return;

    try {
      if (customer.email) {
        await supabase.from('leads').delete().eq('email', customer.email);
        await supabase.from('projects').delete().eq('client_email', customer.email);
      }
      toast.success(`Customer ${name} successfully deleted.`);
      if (selectedCustomerDetail?.id === customer.id) setSelectedCustomerDetail(null);
      loadCustomers();
    } catch (err) {
      toast.error('Error deleting customer: ' + err.message);
    }
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Contact Detail Panel */}
      {selectedCustomerDetail && (
        <ContactDetailPanel
          customer={selectedCustomerDetail}
          getCustomerCar={getCustomerCar}
          onClose={() => setSelectedCustomerDetail(null)}
          onDelete={(e) => handleDeleteCustomer(selectedCustomerDetail, e)}
          onLaunchProject={() => {
            const c = selectedCustomerDetail;
            setSelectedCustomerDetail(null);
            setNewCustomerForm({
              name: c.name || '',
              email: c.email || '',
              phone: c.phone || '',
              intent: 'BUY',
              vehicle: getCustomerCar(c) || '',
              year: '',
              notes: ''
            });
            setIsCreateProjectOpen(true);
          }}
        />
      )}

      {/* Frappe Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Manage client relationships, contact records, and active deal histories.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadCustomers} title="Refresh Directory">
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setIsAddCustomerOpen(true)}>
            <Plus size={14} /> Add Customer
          </button>
        </div>
      </div>

      {/* Frappe Container */}
      <div className="frappe-list-container">
        {/* Toolbar with Filter Tabs and Search */}
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <div className="tabs-container" style={{ margin: 0, border: 'none', gap: 4 }}>
              <button
                className={`tab-btn ${activeTab === 'NEW' ? 'active' : ''}`}
                onClick={() => setActiveTab('NEW')}
              >
                New Clients
              </button>
              <button
                className={`tab-btn ${activeTab === 'REPEAT' ? 'active' : ''}`}
                onClick={() => setActiveTab('REPEAT')}
              >
                Repeat Clients
              </button>
            </div>
          </div>

          <div className="table-toolbar-right">
            <div className="input-group" style={{ width: 280 }}>
              <Search size={14} className="input-icon-left" />
              <input
                type="text"
                className="input input-sm input-with-icon-left"
                placeholder="Search customers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            Loading customer records from Supabase...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              No {activeTab.toLowerCase()} customers found
            </h3>
            <p style={{ fontSize: '0.8rem' }}>Try adjusting your search terms.</p>
          </div>
        ) : (
          <table className="frappe-table">
            <thead>
              <tr>
                <th style={{ width: 220 }}>Client Name</th>
                <th>Contact Info</th>
                <th>Vehicle / Interest</th>
                <th>Activity</th>
                <th>Category</th>
                <th>Last Active</th>
                <th style={{ textAlign: 'right', width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(customer => (
                <tr key={customer.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedCustomerDetail(customer)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="notranslate" style={{
                        width: 30, height: 30, borderRadius: 'var(--radius-xs)',
                        background: 'var(--bg-surface-subtle)',
                        border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 700,
                        color: 'var(--text-primary)', flexShrink: 0
                      }}>
                        {getInitials(customer.name, customer.email)}
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                        {customer.name || 'Unknown Client'}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div>{customer.email || '—'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{customer.phone || ''}</div>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const car = getCustomerCar(customer);
                      return car ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          <Car size={13} color="var(--text-secondary)" />
                          <span>{car}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                      );
                    })()}
                  </td>
                  <td>
                    <span className="badge badge-gray">
                      {customer.interactions.length} {customer.interactions.length === 1 ? 'record' : 'records'}
                    </span>
                  </td>
                  <td>
                    {customer.interactions.length > 1 ? (
                      <span className="badge badge-amber">Repeat</span>
                    ) : (
                      <span className="badge badge-blue">New</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                    {customer.last_interaction ? new Date(customer.last_interaction).toLocaleDateString('de-DE') : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={(e) => { e.stopPropagation(); setSelectedCustomerDetail(customer); }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Frappe Pagination Footer */}
        {totalPages > 1 && (
          <div className="card-footer">
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Showing {((currentPage - 1) * PAGE_SIZE) + 1} to {Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} customers
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Prev
              </button>
              <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.78rem', fontWeight: 600 }}>
                Page {currentPage} of {totalPages}
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      {isAddCustomerOpen && (
        <div className="modal-overlay" onClick={() => setIsAddCustomerOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <UserPlus size={20} color="var(--brand-600)" /> Add New Customer / Client
              </h3>
              <button className="btn-icon" onClick={() => setIsAddCustomerOpen(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddCustomerSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Client Full Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Dr. Thomas Lindner"
                    value={newCustomerForm.name}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Email Address</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="client@example.de"
                      value={newCustomerForm.email}
                      onChange={e => setNewCustomerForm({ ...newCustomerForm, email: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Phone Number</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="+49 152 3456789"
                      value={newCustomerForm.phone}
                      onChange={e => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Customer Intent</label>
                  <select
                    className="form-select"
                    value={newCustomerForm.intent}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, intent: e.target.value })}
                  >
                    <option value="BUY">Buy Side (Wants to acquire/search a vehicle)</option>
                    <option value="SELL">Sell Side (Wants to sell/consign a vehicle)</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Vehicle (Make & Model)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Porsche 911 Carrera S or BMW 320i"
                      value={newCustomerForm.vehicle}
                      onChange={e => setNewCustomerForm({ ...newCustomerForm, vehicle: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Year (Baujahr)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 2021 or 2017+"
                      value={newCustomerForm.year}
                      onChange={e => setNewCustomerForm({ ...newCustomerForm, year: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Notes & Initial Inquiry</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Direct phone call inquiry, car specs, or consultation notes..."
                    value={newCustomerForm.notes}
                    onChange={e => setNewCustomerForm({ ...newCustomerForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddCustomerOpen(false)} disabled={savingCustomer}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-secondary" disabled={savingCustomer}>
                  Save Customer Only
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => handleAddCustomerSubmit(e, true)}
                  disabled={savingCustomer || !newCustomerForm.name}
                  style={{ gap: 6 }}
                >
                  <Briefcase size={15} /> Save & Create Project / Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Project / Deal Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreated={() => loadCustomers()}
        defaultStatus="ACTIVE"
        defaultType={newCustomerForm.intent}
      />


    </div>
  );
}
