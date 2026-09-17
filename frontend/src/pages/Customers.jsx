import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Search, RefreshCw, Mail, Phone, Plus, X, Briefcase, Car, Trash2, Eye, Check, ChevronDown, Filter, Calendar, Loader2 } from 'lucide-react';
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

function DropdownItem({ active, onClick, children }) {
  return (
    <div
      style={{
        padding: '6px 12px', fontSize: '0.85rem', cursor: 'pointer',
        borderRadius: 4, background: active ? 'var(--bg-canvas)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontWeight: active ? 600 : 400
      }}
      onClick={onClick}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-canvas)'}
      onMouseLeave={e => e.currentTarget.style.background = active ? 'var(--bg-canvas)' : 'transparent'}
    >
      {children}
      {active && <Check size={14} style={{ color: 'var(--primary)' }} />}
    </div>
  );
}

function CustomSelect({ value, onChange, options, style }) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div style={{ position: 'relative', ...style }}>
      <button
        className="input input-sm"
        style={{ 
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-surface)', cursor: 'pointer', textAlign: 'left'
        }}
        onClick={() => setOpen(!open)}
      >
        <span>{selectedOption ? selectedOption.label : 'Select...'}</span>
        <ChevronDown size={14} style={{ opacity: 0.5 }} />
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, zIndex: 100,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-md)',
            padding: 4, display: 'flex', flexDirection: 'column', gap: 2,
            maxHeight: 200, overflowY: 'auto'
          }}>
            {options.map(opt => (
              <DropdownItem key={opt.value} active={value === opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}>
                {opt.label}
              </DropdownItem>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Filters
  const [showFilters, setShowFilters] = useState(false);
  const [intentFilter, setIntentFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [activeTab, setActiveTab] = useState('NEW');
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [checkedCustomerIds, setCheckedCustomerIds] = useState(new Set());
  const [actioningId, setActioningId] = useState(null);
  
  const navigate = useNavigate();
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

    // Intent Filter
    if (intentFilter) {
      const hasIntent = c.interactions.some(inter => {
        const item = inter.details || {};
        const intent = (item.intent || item.project_type || '').toUpperCase();
        return intent.includes(intentFilter);
      });
      if (!hasIntent) return false;
    }

    // Type Filter
    if (typeFilter) {
      const hasLead = c.interactions.some(i => i.type === 'Lead');
      const hasProject = c.interactions.some(i => i.type === 'Project');
      if (typeFilter === 'LEAD' && (hasProject || !hasLead)) return false;
      if (typeFilter === 'PROJECT' && (hasLead || !hasProject)) return false;
      if (typeFilter === 'BOTH' && (!hasLead || !hasProject)) return false;
    }

    // Vehicle Filter
    if (vehicleFilter) {
      const hasVeh = !!getCustomerCar(c);
      if (vehicleFilter === 'YES' && !hasVeh) return false;
      if (vehicleFilter === 'NO' && hasVeh) return false;
    }

    // Date Filter
    if (dateFilter) {
      const lastInt = c.last_interaction ? new Date(c.last_interaction) : new Date(0);
      const now = new Date();
      // Calculate start of today for accurate "today" filtering
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (dateFilter === 'TODAY' && lastInt < today) return false;
      
      const diffTime = Math.abs(now - lastInt);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (dateFilter === 'WEEK' && diffDays > 7) return false;
      if (dateFilter === 'MONTH' && diffDays > 30) return false;
    }

    // Filter by search
    const query = search.toLowerCase();
    const name = (c.name || '').toLowerCase();
    const email = (c.email || '').toLowerCase();
    const phone = (c.phone || '').toLowerCase();
    return !search || name.includes(query) || email.includes(query) || phone.includes(query);
  });

  // Reset to page 1 whenever search or filters change
  useEffect(() => { setCurrentPage(1); }, [search, activeTab, intentFilter, typeFilter, vehicleFilter, dateFilter]);

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

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${checkedCustomerIds.size} selected customers (including all their leads and projects)?`)) return;
    setActioningId('bulk');
    try {
      for (const id of checkedCustomerIds) {
        const customer = customers.find(c => c.id === id);
        if (customer && customer.email) {
          await supabase.from('leads').delete().eq('email', customer.email);
          await supabase.from('projects').delete().eq('client_email', customer.email);
        }
      }
      setCheckedCustomerIds(new Set());
      toast.success(`Successfully deleted ${checkedCustomerIds.size} customers.`);
      await loadCustomers();
    } catch (err) {
      toast.error('Error deleting customers: ' + err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleBulkLaunch = async () => {
    if (!window.confirm(`Launch Deals/Projects for ${checkedCustomerIds.size} selected customers?`)) return;
    setActioningId('bulk-launch');
    try {
      for (const id of checkedCustomerIds) {
        const c = customers.find(x => x.id === id);
        if (c) {
          const payload = {
            client_name: c.name || 'Unknown Client',
            client_email: c.email || null,
            client_phone: c.phone || null,
            project_type: 'SELL',
            target_vehicle: getCustomerCar(c) || '',
            current_stage: 'Intake & Onboarding',
            status: 'ACTIVE',
            notes: 'Bulk launched from Customers page'
          };
          await api.createProject(payload).catch(console.error);
        }
      }
      setCheckedCustomerIds(new Set());
      toast.success(`Successfully launched projects for ${checkedCustomerIds.size} customers.`);
      await loadCustomers();
      navigate('/projects');
    } catch (err) {
      toast.error('Bulk Launch Error: ' + err.message);
    } finally {
      setActioningId(null);
    }
  };

  // Bulk Selection Handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) setCheckedCustomerIds(new Set(paginated.map(c => c.id)));
    else setCheckedCustomerIds(new Set());
  };
  const handleSelectOne = (e, id) => {
    e.stopPropagation();
    const next = new Set(checkedCustomerIds);
    if (e.target.checked) next.add(id);
    else next.delete(id);
    setCheckedCustomerIds(next);
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

      {/* Tabs & Search Outside Container */}
      <div style={{ marginBottom: 16, padding: '0 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div className="tabs-container" style={{ margin: 0, borderBottom: 'none', gap: 16 }}>
          <button
            className={`tab-btn ${activeTab === 'NEW' ? 'active' : ''}`}
            onClick={() => setActiveTab('NEW')}
            style={{ padding: '8px 4px', fontSize: '0.9rem' }}
          >
            New Clients
          </button>
          <button
            className={`tab-btn ${activeTab === 'REPEAT' ? 'active' : ''}`}
            onClick={() => setActiveTab('REPEAT')}
            style={{ padding: '8px 4px', fontSize: '0.9rem' }}
          >
            Repeat Clients
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '6px 12px', background: showFilters ? 'var(--bg-surface-subtle)' : 'transparent', border: '1px solid var(--border)' }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} style={{ opacity: 0.6 }} />
            <span style={{ fontWeight: 500 }}>Filter</span>
          </button>
          <div className="input-group" style={{ width: 300, background: 'var(--bg-surface)' }}>
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
      
      {/* Horizontal Filters Bar */}
      {showFilters && (
        <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Intent</label>
            <CustomSelect
              style={{ minWidth: 160 }}
              value={intentFilter}
              onChange={setIntentFilter}
              options={[
                { value: '', label: 'All Intents' },
                { value: 'SELL', label: 'Sell Side' },
                { value: 'BUY', label: 'Buy Side' }
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type</label>
            <CustomSelect
              style={{ minWidth: 160 }}
              value={typeFilter}
              onChange={setTypeFilter}
              options={[
                { value: '', label: 'All Customers' },
                { value: 'LEAD', label: 'Lead Only' },
                { value: 'PROJECT', label: 'Project Only' },
                { value: 'BOTH', label: 'Lead + Project' }
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Vehicle</label>
            <CustomSelect
              style={{ minWidth: 160 }}
              value={vehicleFilter}
              onChange={setVehicleFilter}
              options={[
                { value: '', label: 'Any' },
                { value: 'YES', label: 'Has Vehicle' },
                { value: 'NO', label: 'No Vehicle' }
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Active</label>
            <CustomSelect
              style={{ minWidth: 160 }}
              value={dateFilter}
              onChange={setDateFilter}
              options={[
                { value: '', label: 'Any Time' },
                { value: 'TODAY', label: 'Today' },
                { value: 'WEEK', label: 'Past 7 Days' },
                { value: 'MONTH', label: 'Past 30 Days' }
              ]}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setIntentFilter(''); setTypeFilter(''); setVehicleFilter(''); setDateFilter(''); }}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      <div className="frappe-list-container">
        
        {/* Bulk Action Bar overlay */}
        {checkedCustomerIds.size > 0 && (
          <div className="bulk-action-bar" style={{
            background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)',
            padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            animation: 'fadeIn 0.2s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="badge badge-blue" style={{ fontSize: '0.8rem', padding: '2px 8px' }}>
                {checkedCustomerIds.size} selected
              </span>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handleBulkLaunch} 
                disabled={actioningId === 'bulk-launch'}
                style={{ padding: '6px 12px' }}
              >
                {actioningId === 'bulk-launch' ? <Loader2 size={13} className="spin" /> : <Briefcase size={13} />}
                Launch Deal / Project
              </button>
              <button 
                className="btn btn-danger btn-sm btn-icon" 
                onClick={handleBulkDelete}
                disabled={actioningId === 'bulk'}
                title="Delete Selected"
              >
                {actioningId === 'bulk' ? <Loader2 size={13} className="spin" /> : <Trash2 size={13} />}
              </button>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setCheckedCustomerIds(new Set())}>
              Cancel
            </button>
          </div>
        )}

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
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll}
                    checked={paginated.length > 0 && checkedCustomerIds.size === paginated.length}
                  />
                </th>
                <th style={{ width: 220 }}>Client Name</th>
                <th className="hide-on-mobile">Contact Info</th>
                <th>Vehicle / Interest</th>
                <th className="hide-on-mobile">Activity</th>
                <th className="hide-on-mobile">Category</th>
                <th className="hide-on-mobile">Last Active</th>
                <th style={{ textAlign: 'right', width: 120 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(customer => {
                const isChecked = checkedCustomerIds.has(customer.id);
                return (
                <tr key={customer.id} className={`crm-row ${isChecked ? 'selected' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setSelectedCustomerDetail(customer)}>
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={isChecked}
                      onChange={(e) => handleSelectOne(e, customer.id)}
                    />
                  </td>
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
                  <td className="hide-on-mobile">
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      <div>{customer.email || '—'}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{customer.phone || ''}</div>
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const car = getCustomerCar(customer);
                      return car ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                          <Car size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{car}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>—</span>
                      );
                    })()}
                  </td>
                  <td className="hide-on-mobile">
                    <span className="badge badge-gray">
                      {customer.interactions.length} {customer.interactions.length === 1 ? 'record' : 'records'}
                    </span>
                  </td>
                  <td className="hide-on-mobile">
                    {customer.interactions.length > 1 ? (
                      <span className="badge badge-amber">Repeat</span>
                    ) : (
                      <span className="badge badge-blue">New</span>
                    )}
                  </td>
                  <td className="hide-on-mobile" style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
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
                );
              })}
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
