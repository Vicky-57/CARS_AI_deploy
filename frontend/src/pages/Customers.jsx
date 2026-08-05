import { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, Mail, Phone, Clock, Star, UserPlus, Repeat, Plus, X, Briefcase } from 'lucide-react';
import { api } from '../api/api';
import CreateProjectModal from '../components/CreateProjectModal';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('NEW');

  // Add customer modal & project creation state
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    intent: 'BUY',
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
      await api.createLead({
        name: newCustomerForm.name,
        email: newCustomerForm.email || null,
        phone: newCustomerForm.phone || null,
        intent: newCustomerForm.intent,
        channel: 'DIRECT_CALL',
        status: 'NEW',
        notes: newCustomerForm.notes || 'Added directly from Customers Directory'
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

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Customers</h1>
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
                  <th>Email</th>
                  <th>Phone</th>
                  {activeTab === 'NEW' ? (
                    <th>Total Leads</th>
                  ) : (
                    <>
                      <th>Previous Projects</th>
                      <th>New Leads</th>
                    </>
                  )}
                  <th>Type</th>
                  <th>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(customer => (
                  <tr key={customer.id}>
                    <td style={{ paddingLeft: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                          width: 40, height: 40, borderRadius: '50%', 
                          background: customer.interactions.length > 1 ? 'linear-gradient(135deg, var(--brand-100), var(--brand-200))' : 'linear-gradient(135deg, var(--gray-100), var(--gray-200))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.85rem', fontWeight: 700, 
                          color: customer.interactions.length > 1 ? 'var(--brand-700)' : 'var(--gray-600)'
                        }}>
                          {getInitials(customer.name, customer.email)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {customer.name || 'Unknown Client'}
                            {customer.interactions.length > 1 && <Star size={12} color="#fbbf24" fill="#fbbf24" />}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                        <Mail size={12} color="var(--text-muted)" />
                        {customer.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                        <Phone size={12} color="var(--text-muted)" />
                        {customer.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                    {activeTab === 'NEW' ? (
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {customer.interactions.filter(i => i.type === 'Lead').length}
                        </div>
                      </td>
                    ) : (
                      <>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {customer.interactions.filter(i => i.type === 'Project').length}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                            {customer.interactions.filter(i => i.type === 'Lead').length}
                          </div>
                        </td>
                      </>
                    )}
                    <td>
                      {customer.interactions.length > 1 ? (
                        <span className="badge badge-whatsapp">Repeat</span>
                      ) : (
                        <span className="badge badge-new">New</span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Clock size={12} />
                        {customer.last_interaction ? new Date(customer.last_interaction).toLocaleDateString() : '—'}
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
