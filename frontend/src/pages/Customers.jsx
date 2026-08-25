import { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, Mail, Phone, Clock, Star, UserPlus, Repeat, Plus, X, Briefcase, Car, Eye, Trash2, Edit3 } from 'lucide-react';
import { api, supabase } from '../api/api';
import CreateProjectModal from '../components/CreateProjectModal';

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

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('NEW');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);

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
        vehicle: vehicleDesc || null,
        channel: 'DIRECT_CALL',
        status: 'NEW',
        notes: newCustomerForm.notes 
          ? `${newCustomerForm.notes}${vehicleDesc ? ` | Vehicle: ${vehicleDesc}` : ''}`
          : (vehicleDesc ? `Vehicle requested/offered: ${vehicleDesc}` : 'Added directly from Customers Directory')
      });

      alert(`Customer ${newCustomerForm.name} successfully created!`);
      setIsAddCustomerOpen(false);
      loadCustomers();

      if (andCreateProject) {
        setIsCreateProjectOpen(true);
      }
    } catch (err) {
      alert('Error creating customer: ' + err.message);
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
      alert(`Customer ${name} successfully deleted.`);
      if (selectedCustomerDetail?.id === customer.id) setSelectedCustomerDetail(null);
      loadCustomers();
    } catch (err) {
      alert('Error deleting customer: ' + err.message);
    }
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a', margin: '0 0 6px 0' }}>Customers</h1>
          <p style={{ fontSize: '0.9rem' }}>Manage your client relationships, categorizing New vs Repeat customers.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => setIsAddCustomerOpen(true)} style={{ padding: '8px 16px' }}>
            <Plus size={16} /> Add Customer
          </button>
        </div>
      </div>

      {/* Folder Tabs */}
      <div style={{ display: 'flex', paddingLeft: 0, position: 'relative', zIndex: 10, marginBottom: 0 }}>
        {[
          { id: 'NEW', label: 'New Customers', icon: UserPlus },
          { id: 'REPEAT', label: 'Repeat Customers', icon: Repeat }
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="customer-tab-btn"
              style={{
                background: isActive ? 'var(--surface)' : 'transparent',
                border: 'none',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                color: isActive ? 'var(--brand-600)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                zIndex: isActive ? 2 : 1,
                boxShadow: isActive ? '0 -4px 6px -4px rgba(0,0,0,0.05)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Customers Table */}
      <div className="card" style={{ border: 'none', borderTopLeftRadius: activeTab === 'NEW' ? 0 : 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
        <div className="card-header customers-header-mobile" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            {activeTab === 'NEW' ? 'New Customers' : 'Repeat Customers'} ({filtered.length})
          </span>

          <div className="customers-actions-mobile" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="search-bar customers-search-mobile" style={{ padding: '4px 12px', borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                placeholder="Search customers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '0.85rem', border: 'none', background: 'transparent', outline: 'none', marginLeft: 8 }}
              />
            </div>
            <button className="btn btn-secondary btn-icon" onClick={loadCustomers} style={{ padding: '6px', borderRadius: '50%' }} title="Refresh customers">
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div className="spinner" style={{ margin: '0 auto 16px', width: 28, height: 28, borderWidth: 3 }} />
            <div style={{ color: 'var(--text-muted)' }}>Loading customers from Supabase...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ width: 64, height: 64, background: 'var(--gray-50)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Users size={32} color="var(--gray-400)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No {activeTab.toLowerCase()} customers found</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
              Try adjusting your search or check back later.
            </p>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', boxShadow: 'none' }}>
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24, paddingTop: 16, paddingBottom: 16 }}>Client</th>
                  <th>Contact Info</th>
                  <th>Vehicle</th>
                  {activeTab === 'NEW' ? (
                    <th>Total Leads</th>
                  ) : (
                    <th>Activity</th>
                  )}
                  <th>Type</th>
                  <th>Last Active</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(customer => (
                  <tr key={customer.id} style={{ transition: 'background-color 0.2s', cursor: 'pointer' }}>
                    <td style={{ paddingLeft: 24, paddingVertical: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ 
                          width: 44, height: 44, borderRadius: '50%', 
                          background: customer.interactions.length > 1 ? 'linear-gradient(135deg, #fef3c7, #fde68a)' : 'linear-gradient(135deg, #fff3ec, #ffe4d6)',
                          border: customer.interactions.length > 1 ? '1px solid #fcd34d' : '1px solid #fed7aa',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.9rem', fontWeight: 800, 
                          color: customer.interactions.length > 1 ? '#b45309' : '#ea580c',
                          boxShadow: customer.interactions.length > 1 ? '0 2px 8px rgba(180, 83, 9, 0.1)' : '0 2px 8px rgba(234, 88, 12, 0.1)', flexShrink: 0
                        }}>
                          {getInitials(customer.name, customer.email)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {customer.name || 'Unknown Client'}
                            {customer.interactions.length > 1 && <Star size={12} color="#f59e0b" fill="#f59e0b" />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                          <Mail size={14} color="#f47c3c" flexShrink={0} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                            {customer.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                          <Phone size={14} color="#f47c3c" flexShrink={0} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                            {customer.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const car = getCustomerCar(customer);
                        return car ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', fontWeight: 700, color: '#1a1a1a' }}>
                            <Car size={16} color="#f47c3c" />
                            <span>{car}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        );
                      })()}
                    </td>
                    {activeTab === 'NEW' ? (
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {customer.interactions.filter(i => i.type === 'Lead').length} Leads
                        </div>
                      </td>
                    ) : (
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
                            {customer.interactions.filter(i => i.type === 'Project').length} Projects
                          </div>
                          <div style={{ fontWeight: 600, fontSize: '0.75rem', color: '#64748b' }}>
                            {customer.interactions.filter(i => i.type === 'Lead').length} Leads
                          </div>
                        </div>
                      </td>
                    )}
                    <td>
                      {customer.interactions.length > 1 ? (
                        <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>Repeat</span>
                      ) : (
                        <span className="badge badge-new">New</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} />
                        {customer.last_interaction ? (() => {
                          const d = new Date(customer.last_interaction);
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          return `${day}/${month}/${d.getFullYear()}`;
                        })() : '—'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedCustomerDetail(customer)}
                          style={{ padding: '6px 10px', fontSize: '0.75rem', gap: 4 }}
                          title="View / Edit Customer Details"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => handleDeleteCustomer(customer, e)}
                          style={{ padding: '6px 8px', color: '#ef4444', borderColor: '#fca5a5' }}
                          title="Delete Customer Record"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {/* Customer Details / View Modal */}
      {selectedCustomerDetail && (
        <div className="modal-overlay" onClick={() => setSelectedCustomerDetail(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fff3ec, #ffe4d6)',
                  border: '1px solid #fed7aa',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', fontWeight: 800, color: '#ea580c',
                  boxShadow: '0 4px 12px rgba(234, 88, 12, 0.15)', flexShrink: 0
                }}>
                  {getInitials(selectedCustomerDetail.name, selectedCustomerDetail.email)}
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>{selectedCustomerDetail.name || 'Unknown Client'}</h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                    {selectedCustomerDetail.interactions.length > 1 ? (
                      <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', boxShadow: '0 2px 4px rgba(180, 83, 9, 0.05)' }}>
                        <Star size={12} fill="currentColor" /> REPEAT CLIENT
                      </span>
                    ) : (
                      <span className="badge badge-new" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <UserPlus size={12} /> NEW CLIENT
                      </span>
                    )}
                    <span>• {selectedCustomerDetail.interactions.length} Total Interaction(s)</span>
                  </div>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelectedCustomerDetail(null)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: 24 }}>
              
              {/* Contact Info Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ padding: '16px 20px', background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Email Contact</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, wordBreak: 'break-all', color: '#0f172a' }}>
                    <Mail size={16} color="#f47c3c" flexShrink={0} />
                    {selectedCustomerDetail.email || '—'}
                  </div>
                </div>
                <div style={{ padding: '16px 20px', background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>Phone Contact</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10, color: '#0f172a' }}>
                    <Phone size={16} color="#f47c3c" flexShrink={0} />
                    {selectedCustomerDetail.phone || '—'}
                  </div>
                </div>
              </div>

              {/* Vehicle Interest Banner */}
              {getCustomerCar(selectedCustomerDetail) && (
                <div style={{ padding: '20px', background: 'linear-gradient(to right, #fff7ed, #ffffff)', borderRadius: 12, border: '1px solid #ffedd5', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 2px 8px rgba(249, 115, 22, 0.05)' }}>
                  <div style={{ padding: 12, background: '#ffedd5', borderRadius: 12 }}>
                    <Car size={24} color="#ea580c" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Target Vehicle / Car Interest</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1a1a1a', marginTop: 4 }}>{getCustomerCar(selectedCustomerDetail)}</div>
                  </div>
                </div>
              )}

              {/* Interaction Timeline History */}
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>Client Interaction History</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                  {selectedCustomerDetail.interactions.map((inter, idx) => {
                    const isProject = inter.type === 'Project' || inter.type === 'PROJECT';
                    const Icon = isProject ? Briefcase : UserPlus;
                    const badgeClass = isProject ? 'badge-email' : 'badge-whatsapp';
                    return (
                      <div key={idx} style={{ padding: '14px 16px', background: '#ffffff', borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                          <span className={`badge ${badgeClass}`} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <Icon size={12} /> {inter.type}
                          </span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8' }}>{(() => {
                          const d = new Date(inter.date || Date.now());
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          return `${day}/${month}/${d.getFullYear()}`;
                        })()}</span>
                      </div>
                      <div style={{ color: '#334155', fontSize: '0.85rem', fontWeight: 500, lineHeight: 1.5 }}>{inter.details?.subject || inter.details?.notes || inter.details?.message?.slice(0, 100) || 'Inquiry logged'}</div>
                    </div>
                  )})}
                </div>
              </div>

            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={(e) => handleDeleteCustomer(selectedCustomerDetail, e)}
                style={{ color: '#ef4444', borderColor: '#fca5a5', gap: 6 }}
              >
                <Trash2 size={14} /> Delete Customer
              </button>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => setSelectedCustomerDetail(null)}>Close</button>
                <button
                  className="btn btn-primary"
                  onClick={() => {
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
                  style={{ gap: 6 }}
                >
                  <Briefcase size={15} /> Launch Project / Deal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
