import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users, Plus, Search, RefreshCw, RotateCcw, Trash2,
  ChevronLeft, ChevronRight, ArrowRight, Filter, ArrowDownUp,
  MoreHorizontal, Check, ChevronDown, Sparkles,
  AlertCircle, Clock, CheckCircle, MessageCircle, Mail, Pencil, UserPlus
} from 'lucide-react';
import { api } from '../api/api';
import LeadModal from '../components/LeadModal';
import LeadDetailPanel from '../components/LeadDetailPanel';
import Customers from './Customers';
import { formatDistanceToNow } from 'date-fns';
import { cleanText, getCleanInitials, formatContactName, isAutomatedSpam } from '../utils/textUtils';

function getLeadVehicleDisplay(lead) {
  if (lead.vehicle_interest) return cleanText(lead.vehicle_interest);
  if (lead.vehicle) return cleanText(lead.vehicle);
  if (lead.manufacturer || lead.model) return cleanText(`${lead.manufacturer || ''} ${lead.model || ''}`.trim());
  const text = `${lead.subject || ''} ${lead.message || ''} ${lead.notes || ''}`;
  const carMatch = text.match(/(Porsche\s+[\w\d\.\s\(\)\-]+|BMW\s+[\w\d\.\s\-]+|Audi\s+[\w\d\.\s\-]+|Mercedes-?Benz?\s+[\w\d\.\s\-]+|VW\s+[\w\d\.\s\-]+|Volkswagen\s+[\w\d\.\s\-]+)/i);
  if (carMatch) return cleanText(carMatch[0].split('\n')[0].split('-')[0].trim().slice(0, 35));
  return null;
}

const PAGE_SIZE = 15;

function getInitials(name, email) {
  return getCleanInitials(name, email);
}

function timeAgo(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ''; }
}

function DropdownMenu({ icon: Icon, label, children, align = 'left' }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="btn btn-secondary btn-sm"
        style={{ padding: '6px 12px', background: open ? 'var(--bg-surface-subtle)' : 'transparent', border: '1px solid var(--border)' }}
        onClick={() => setOpen(!open)}
      >
        {Icon && <Icon size={14} style={{ opacity: 0.6 }} />}
        <span style={{ fontWeight: 500 }}>{label}</span>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: '100%',
            left: align === 'left' ? 0 : 'auto',
            right: align === 'right' ? 0 : 'auto',
            marginTop: 4, zIndex: 100,
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)',
            minWidth: 200, padding: 8, display: 'flex', flexDirection: 'column', gap: 4
          }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

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
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
          cursor: 'pointer',
          textAlign: 'left'
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
              <DropdownItem
                key={opt.value}
                active={value === opt.value}
                onClick={() => { onChange(opt.value); setOpen(false); }}
              >
                {opt.label}
              </DropdownItem>
            ))}
          </div>
        </>
      )}
    </div>
  );
}



export default function Leads() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'customers' ? 'customers' : 'leads';
  const customersRef = useRef(null);
  const [customerCount, setCustomerCount] = useState(null);
  const switchTab = (tab) => {
    if (tab === 'customers') setSearchParams({ tab: 'customers' }, { replace: true });
    else setSearchParams({}, { replace: true });
  };
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New Filters (supports deep-linking e.g. /leads?source=WHATSAPP&label=Hot&lead=<id>)
  const urlSource = searchParams.get('source') || '';
  const urlLabel = searchParams.get('label') || '';
  const urlLeadId = searchParams.get('lead') || '';

  const [showFilters, setShowFilters] = useState(Boolean(urlSource || urlLabel));
  const [statusFilter, setStatusFilter] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState(urlSource);
  const [labelFilter, setLabelFilter] = useState(urlLabel);
  const [sortOrder, setSortOrder] = useState('label');
  const autoOpenedLeadRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [convertingId, setConvertingId] = useState(null);
  const [actioningId, setActioningId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLead, setSelectedLead] = useState(null);
  const [checkedLeadIds, setCheckedLeadIds] = useState(new Set());

  const loadLeads = async () => {
    setLoading(true);
    try {
      const data = await api.getLeads({});
      setLeads(data || []);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreLead = async (lead) => {
    setActioningId(lead.id);
    try {
      const cleanedNotes = (lead.notes || '').replace(/\[AUTO-FLAGGED:.*?\]/g, '').trim();
      await api.updateLead(lead.id, { status: 'NEW', notes: cleanedNotes || null });
      await loadLeads();
    } finally { setActioningId(null); }
  };

  const handleDeleteSpamLead = async (lead) => {
    if (!window.confirm(`Permanently remove "${lead.name || lead.email}" from DB?`)) return;
    setActioningId(lead.id);
    try {
      await api.deleteLead(lead.id);
      if (selectedLead?.id === lead.id) setSelectedLead(null);
      await loadLeads();
    } finally { setActioningId(null); }
  };

  const handleConvertLeadToProject = async (lead, skipNavigate = false) => {
    setConvertingId(lead.id);
    try {
      const cleanNotes = cleanText(lead.notes || lead.message);
      const conversionNote = cleanNotes
        ? `${cleanNotes} (Converted from ${pType === 'SELL' ? 'Sell' : 'Buy'} Lead)`
        : `Converted from ${pType === 'SELL' ? 'Sell' : 'Buy'} Lead: ${vehicleName}`;

      await api.createProject({
        client_name: cleanText(lead.name) || 'Client Lead',
        client_email: lead.email || null,
        client_phone: lead.phone || null,
        project_type: pType,
        target_vehicle: vehicleName,
        vin: lead.vin || null,
        status: 'ACTIVE',
        current_stage: 'Intake & Onboarding',
        notes: conversionNote
      });
      await api.deleteLead(lead.id).catch(() => { });
      setSelectedLead(null);
      await loadLeads();
      if (!skipNavigate) navigate('/projects');
    } catch (err) {
      alert('Conversion Error: ' + err.message);
    } finally { setConvertingId(null); }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${checkedLeadIds.size} selected leads?`)) return;
    setActioningId('bulk');
    try {
      for (const id of checkedLeadIds) {
        await api.deleteLead(id);
      }
      setCheckedLeadIds(new Set());
      await loadLeads();
    } catch (err) {
      alert('Error deleting leads: ' + err.message);
    } finally {
      setActioningId(null);
    }
  };

  const handleBulkConvert = async () => {
    if (!window.confirm(`Convert ${checkedLeadIds.size} selected leads to active deals?`)) return;
    setConvertingId('bulk');
    try {
      for (const id of checkedLeadIds) {
        const lead = leads.find(l => l.id === id);
        if (lead) await handleConvertLeadToProject(lead, true);
      }
      setCheckedLeadIds(new Set());
      await loadLeads();
      navigate('/projects');
    } catch (err) {
      alert('Bulk Conversion Error: ' + err.message);
    } finally {
      setConvertingId(null);
    }
  };

  useEffect(() => {
    loadLeads();
    const sub = api.subscribeToLeads(() => loadLeads());
    return () => { if (sub) sub.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!urlLeadId || !leads.length || autoOpenedLeadRef.current === urlLeadId) return;
    const match = leads.find(l => String(l.id) === String(urlLeadId));
    if (match) {
      setSelectedLead(match);
      autoOpenedLeadRef.current = urlLeadId;
    }
  }, [leads, urlLeadId]);

  // Filtering
  const filtered = leads.filter(l => {
    // 1. Status Filter
    const isSpam = l.status === 'SPAM' || isAutomatedSpam(l);
    if (statusFilter === 'SPAM') { if (!isSpam) return false; }
    else if (statusFilter === 'NEW') { if (isSpam || l.status !== 'NEW') return false; }
    else if (statusFilter === '') { if (isSpam) return false; }

    // 2. Intent Filter
    const lIntent = (l.intent || '').toUpperCase();
    if (intentFilter === 'SELL') { if (!lIntent.includes('SELL')) return false; }
    else if (intentFilter === 'BUY') { if (!lIntent.includes('BUY')) return false; }

    // 3. Source Filter
    const lSource = (l.source || l.channel || 'MANUAL').toUpperCase();
    if (sourceFilter) {
      if (sourceFilter === 'WHATSAPP') {
        if (!lSource.includes('WHATSAPP')) return false;
      } else if (lSource !== sourceFilter) {
        return false;
      }
    }

    // 4. Label Filter (Hot / Warm / Cold)
    if (labelFilter) {
      const lLabel = (l.label || l.lead_label || '').toLowerCase();
      if (lLabel !== labelFilter.toLowerCase()) return false;
    }

    // 5. Search Query
    const query = search.toLowerCase();
    if (query) {
      const name = (l.name || '').toLowerCase();
      const email = (l.email || '').toLowerCase();
      const vehicle = `${l.manufacturer || ''} ${l.model || ''}`.toLowerCase();
      const notes = (l.notes || '').toLowerCase();
      if (!name.includes(query) && !email.includes(query) && !vehicle.includes(query) && !notes.includes(query)) return false;
    }
    return true;
  });

  // Sorting — Hot first by default, then by date
  const LABEL_ORDER = { hot: 0, warm: 1, cold: 2, '': 3 };
  filtered.sort((a, b) => {
    if (sortOrder === 'label') {
      const lA = LABEL_ORDER[(a.label || a.lead_label || '').toLowerCase()] ?? 3;
      const lB = LABEL_ORDER[(b.label || b.lead_label || '').toLowerCase()] ?? 3;
      if (lA !== lB) return lA - lB;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }
    const tA = new Date(a.created_at || 0).getTime();
    const tB = new Date(b.created_at || 0).getTime();
    return sortOrder === 'newest' ? tB - tA : tA - tB;
  });

  useEffect(() => { setCurrentPage(1); setCheckedLeadIds(new Set()); }, [search, statusFilter, intentFilter, sourceFilter, labelFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const allPaginatedChecked = paginated.length > 0 && paginated.every(l => checkedLeadIds.has(l.id));

  const toggleAllPaginated = (checked) => {
    const next = new Set(checkedLeadIds);
    paginated.forEach(l => {
      if (checked) next.add(l.id);
      else next.delete(l.id);
    });
    setCheckedLeadIds(next);
  };

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 48 }}>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">{activeTab === 'leads' ? 'Leads' : 'Customers'}</h1>
            {activeTab === 'leads' && <span className="badge badge-gray">{filtered.length} total</span>}
            {activeTab === 'customers' && customerCount !== null && <span className="badge badge-gray">{customerCount} total</span>}
          </div>
          <p className="page-subtitle">
            {activeTab === 'leads'
              ? 'Inbound inquiries from Strato Email, WhatsApp, and Web Forms.'
              : 'Manage client relationships, contact records, and active deal histories.'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {activeTab === 'leads' ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={loadLeads} title="Refresh">
                <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => { setEditingLead(null); setIsModalOpen(true); }}>
                <Plus size={13} /> New Lead
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => customersRef.current?.refresh()} title="Refresh Directory">
                <RefreshCw size={13} /> Refresh
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => customersRef.current?.openAddModal()}>
                <Plus size={13} /> Add Customer
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Leads / Customers Tabs ── */}
      <div className="tabs-container">
        <button className={`tab-btn ${activeTab === 'leads' ? 'active' : ''}`} onClick={() => switchTab('leads')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} /> Leads
          <span className="badge badge-gray">{filtered.length}</span>
        </button>
        <button className={`tab-btn ${activeTab === 'customers' ? 'active' : ''}`} onClick={() => switchTab('customers')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <UserPlus size={14} /> Customers
          {customerCount !== null && <span className="badge badge-gray">{customerCount}</span>}
        </button>
      </div>

      {activeTab === 'customers' && (
        <Customers ref={customersRef} isEmbedded onCustomerCountChange={setCustomerCount} />
      )}

      {/* ── CRM Layout: Table Only ── */}
      {activeTab === 'leads' && (
        <div className="crm-layout" style={{ display: 'block' }}>

          <div className="crm-list-area" style={{ flex: 'none', borderRight: 'none', minWidth: '100%' }}>

            {/* Top Toolbar */}
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              {checkedLeadIds.size > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, padding: '4px 0' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{checkedLeadIds.size} selected</span>
                  <button className="btn btn-primary btn-sm" onClick={handleBulkConvert} disabled={convertingId === 'bulk'}>
                    <Sparkles size={13} /> Convert to Deal
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={actioningId === 'bulk'}>
                    <Trash2 size={13} /> Delete
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCheckedLeadIds(new Set())}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="input-group" style={{ maxWidth: 320, flex: 1 }}>
                  <Search size={13} className="input-icon-left" />
                  <input
                    type="text"
                    className="input input-sm input-with-icon-left"
                    placeholder="Search by name, vehicle, email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={loadLeads} style={{ padding: '6px 8px', border: '1px solid var(--border)', background: 'transparent' }}>
                  <RefreshCw size={14} className={loading ? 'spin' : ''} style={{ opacity: 0.6 }} />
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '6px 12px', background: showFilters ? 'var(--bg-surface-subtle)' : 'transparent', border: '1px solid var(--border)' }}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter size={14} style={{ opacity: 0.6 }} />
                  <span style={{ fontWeight: 500 }}>Filter</span>
                </button>

                <DropdownMenu icon={ArrowDownUp} label="Sort" align="right">
                  <DropdownItem active={sortOrder === 'label'} onClick={() => setSortOrder('label')}>🔥 Hot First</DropdownItem>
                  <DropdownItem active={sortOrder === 'newest'} onClick={() => setSortOrder('newest')}>Newest First</DropdownItem>
                  <DropdownItem active={sortOrder === 'oldest'} onClick={() => setSortOrder('oldest')}>Oldest First</DropdownItem>
                </DropdownMenu>
              </div>
            </div>

            {/* Horizontal Filters Bar */}
            {showFilters && (
              <div style={{ marginBottom: 16, padding: '12px 16px', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</label>
                  <CustomSelect
                    style={{ minWidth: 160 }}
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: '', label: 'All Leads' },
                      { value: 'NEW', label: 'New Leads' },
                      { value: 'SPAM', label: 'Junk / Spam' }
                    ]}
                  />
                </div>

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
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Source</label>
                  <CustomSelect
                    style={{ minWidth: 160 }}
                    value={sourceFilter}
                    onChange={setSourceFilter}
                    options={[
                      { value: '', label: 'All Sources' },
                      { value: 'WHATSAPP', label: 'WhatsApp' },
                      { value: 'STRATO_EMAIL', label: 'Email' },
                      { value: 'MANUAL', label: 'Manual' },
                      { value: 'TELEGRAM', label: 'Telegram' },
                      { value: 'DIRECT_CALL', label: 'Direct Call' }
                    ]}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Label</label>
                  <CustomSelect
                    style={{ minWidth: 160 }}
                    value={labelFilter}
                    onChange={setLabelFilter}
                    options={[
                      { value: '', label: 'All Labels' },
                      { value: 'Hot', label: '🔥 Hot' },
                      { value: 'Warm', label: '🟡 Warm' },
                      { value: 'Cold', label: '❄️ Cold' },
                    ]}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setStatusFilter(''); setIntentFilter(''); setSourceFilter(''); setLabelFilter(''); setSearchParams({}, { replace: true }); }}>
                    Clear Filters
                  </button>
                </div>
              </div>
            )}

            {/* Table container */}

            <div className="table-container" style={{ flex: 1, overflow: 'auto' }}>
              {loading ? (
                <div className="empty-state"><div className="spinner spinner-dark" /></div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <Users size={32} style={{ opacity: 0.2 }} />
                  <div className="empty-state-title">No leads found</div>
                  <div className="empty-state-sub">Try clearing filters or search terms.</div>
                </div>
              ) : (
                <table className="frappe-table">
                  <thead>
                    <tr>
                      <th style={{ width: 32, padding: '10px 12px' }}>
                        <input
                          type="checkbox"
                          checked={allPaginatedChecked}
                          onChange={e => toggleAllPaginated(e.target.checked)}
                        />
                      </th>
                      <th style={{ width: 36, padding: '10px 12px' }}></th>
                      <th style={{ minWidth: 200 }}>Lead / Client</th>
                      <th className="hide-on-mobile" style={{ width: 120 }}>Intent</th>
                      <th className="hide-on-mobile" style={{ width: 110 }}>Label</th>
                      <th>Vehicle / Inquiry</th>
                      <th className="hide-on-mobile" style={{ width: 130 }}>Source</th>
                      <th className="hide-on-mobile" style={{ width: 120 }}>Received</th>
                      <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map(lead => {
                      const isSpam = lead.status === 'SPAM';
                      const isSell = (lead.intent || '').toUpperCase().includes('SELL');
                      const vehicle = getLeadVehicleDisplay(lead);
                      const selected = selectedLead?.id === lead.id;
                      const isChecked = checkedLeadIds.has(lead.id);

                      // Label badge helper — lucide icons, no emojis
                      const labelKey = (lead.label || lead.lead_label || '').toLowerCase();
                      const labelBadge = labelKey === 'hot'
                        ? (
                          <span className="badge badge-red" title={lead.label_reason || 'Hot lead'}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                            <AlertCircle size={9} /> Hot
                          </span>
                        )
                        : labelKey === 'warm'
                          ? (
                            <span className="badge badge-amber" title={lead.label_reason || 'Warm lead'}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontWeight: 600 }}>
                              <Clock size={9} /> Warm
                            </span>
                          )
                          : labelKey === 'cold'
                            ? (
                              <span className="badge badge-gray" title={lead.label_reason || 'Cold lead'}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <CheckCircle size={9} /> Cold
                              </span>
                            )
                            : null;

                      // Source badge helper — lucide icons
                      const srcRaw = (lead.source || lead.channel || 'MANUAL').toUpperCase();
                      const sourceBadge = srcRaw.includes('WHATSAPP')
                        ? (
                          <span className="badge badge-green" title="WhatsApp"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <img src="/assets/whatsapp.png" alt="WhatsApp" style={{ width: 11, height: 11, objectFit: 'contain' }} />
                            WhatsApp
                          </span>
                        )
                        : srcRaw.includes('EMAIL') || srcRaw.includes('STRATO')
                          ? (
                            <span className="badge badge-blue" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Mail size={9} /> Email
                            </span>
                          )
                          : srcRaw === 'TELEGRAM'
                            ? (
                              <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <MessageCircle size={9} /> Telegram
                              </span>
                            )
                            : (
                              <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                <Pencil size={9} /> {lead.source || lead.channel || 'Manual'}
                              </span>
                            );

                      return (
                        <tr
                          key={lead.id}
                          className={`crm-row${selected || isChecked ? ' selected' : ''}`}
                          onClick={() => setSelectedLead(selected ? null : lead)}
                        >
                          {/* Checkbox */}
                          <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const next = new Set(checkedLeadIds);
                                if (e.target.checked) next.add(lead.id);
                                else next.delete(lead.id);
                                setCheckedLeadIds(next);
                              }}
                            />
                          </td>

                          {/* Avatar / initials */}
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{
                              width: 28, height: 28,
                              borderRadius: '50%',
                              background: isSpam ? 'var(--status-red-bg)' : isSell ? '#dcfce7' : '#ede9fe',
                              color: isSpam ? 'var(--status-red-text)' : isSell ? '#166534' : '#5b21b6',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.65rem', fontWeight: 700, flexShrink: 0
                            }}>
                              {getInitials(lead.name, lead.email)}
                            </div>
                          </td>

                          {/* Name + Email */}
                          <td>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{formatContactName(lead.name, lead.email, vehicle)}</span>
                              {/-mo-mo@kontakt\.mobile\.de/i.test(lead.email || '') && (
                                <span className="badge badge-gray" style={{ fontSize: '0.65rem', padding: '1px 5px', fontWeight: 600 }} title="Anonymized proxy relay from mobile.de">
                                  mobile.de
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {cleanText(lead.email || lead.phone || '—')}
                            </div>
                          </td>

                          {/* Intent badge */}
                          <td className="hide-on-mobile">
                            {isSpam ? (
                              <span className="badge badge-red">Spam</span>
                            ) : isSell ? (
                              <span className="badge badge-green">Sell Side</span>
                            ) : (
                              <span className="badge badge-purple">Buy Side</span>
                            )}
                          </td>

                          {/* Label (Hot / Warm / Cold) */}
                          <td className="hide-on-mobile">
                            {labelBadge || <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>}
                          </td>

                          {/* Vehicle */}
                          <td>
                            <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                              {cleanText(vehicle || lead.subject || 'General Inquiry')}
                            </div>
                            {(lead.notes || lead.message) && (
                              <div style={{
                                fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 320,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                              }}>
                                {cleanText(lead.notes || lead.message)}
                              </div>
                            )}
                          </td>

                          {/* Source */}
                          <td className="hide-on-mobile">
                            {sourceBadge}
                          </td>

                          {/* Time */}
                          <td className="hide-on-mobile" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {timeAgo(lead.created_at)}
                          </td>

                          {/* Actions */}
                          <td style={{ textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                            {isSpam ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => handleRestoreLead(lead)}
                                  disabled={actioningId === lead.id}
                                >
                                  <RotateCcw size={11} /> Restore
                                </button>
                                <button
                                  className="btn btn-danger btn-sm btn-icon"
                                  onClick={() => handleDeleteSpamLead(lead)}
                                  disabled={actioningId === lead.id}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={(e) => { e.stopPropagation(); setEditingLead(lead); setIsModalOpen(true); }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={(e) => { e.stopPropagation(); setSelectedLead(selected ? null : lead); }}
                                >
                                  View <ArrowRight size={11} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="card-footer">
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    Showing {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      <ChevronLeft size={13} />
                    </button>
                    <span style={{ fontSize: '0.78rem', padding: '0 8px', display: 'flex', alignItems: 'center' }}>
                      {currentPage} / {totalPages}
                    </span>
                    <button className="btn btn-secondary btn-sm btn-icon"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Lead Detail Panel (right side) ── */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onConvert={handleConvertLeadToProject}
          onRefresh={loadLeads}
          converting={convertingId === selectedLead.id}
          onEdit={(lead) => { setEditingLead(lead); setIsModalOpen(true); }}
        />
      )}

      {/* ── New/Edit Lead Modal ── */}
      <LeadModal
        isOpen={isModalOpen}
        initialData={editingLead}
        onClose={() => { setIsModalOpen(false); setEditingLead(null); }}
        onLeadCreated={(newOrUpdatedLead) => {
          setIsModalOpen(false);
          setEditingLead(null);
          if (newOrUpdatedLead) {
            setLeads(prev => {
              const idx = prev.findIndex(l => l.id === newOrUpdatedLead.id);
              if (idx > -1) {
                const newLeads = [...prev];
                newLeads[idx] = newOrUpdatedLead;
                return newLeads;
              }
              return [newOrUpdatedLead, ...prev];
            });
            setSelectedLead(prev => prev?.id === newOrUpdatedLead.id ? newOrUpdatedLead : prev);
          } else {
            loadLeads();
          }
        }}
      />
    </div>
  );
}