import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, Search, RefreshCw, RotateCcw, Trash2,
  ChevronLeft, ChevronRight, ArrowRight
} from 'lucide-react';
import { api } from '../api/api';
import LeadModal from '../components/LeadModal';
import LeadDetailPanel from '../components/LeadDetailPanel';
import { formatDistanceToNow } from 'date-fns';

function getLeadVehicleDisplay(lead) {
  if (lead.vehicle_interest) return lead.vehicle_interest;
  if (lead.vehicle) return lead.vehicle;
  if (lead.manufacturer || lead.model) return `${lead.manufacturer || ''} ${lead.model || ''}`.trim();
  const text = `${lead.subject || ''} ${lead.message || ''} ${lead.notes || ''}`;
  const carMatch = text.match(/(Porsche\s+[\w\d\.\s\(\)\-]+|BMW\s+[\w\d\.\s\-]+|Audi\s+[\w\d\.\s\-]+|Mercedes-?Benz?\s+[\w\d\.\s\-]+|VW\s+[\w\d\.\s\-]+|Volkswagen\s+[\w\d\.\s\-]+)/i);
  if (carMatch) return carMatch[0].split('\n')[0].split('-')[0].trim().slice(0, 35);
  return null;
}

const PAGE_SIZE = 15;

const STATUS_FILTERS = [
  { key: '',      label: 'All Leads' },
  { key: 'NEW',   label: 'New' },
  { key: 'SELL',  label: 'Sell Intent' },
  { key: 'BUY',   label: 'Buy Intent' },
  { key: 'SPAM',  label: 'Junk / Spam' },
];

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function timeAgo(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ''; }
}

export default function Leads() {
  const navigate = useNavigate();
  const [leads,        setLeads]        = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const [actioningId,  setActioningId]  = useState(null);
  const [currentPage,  setCurrentPage]  = useState(1);
  const [selectedLead, setSelectedLead] = useState(null);

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

  const handleConvertLeadToProject = async (lead) => {
    setConvertingId(lead.id);
    try {
      const vehicleName = getLeadVehicleDisplay(lead) || 'Vehicle TBD';
      const pType = (lead.intent || '').toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
      await api.createProject({
        client_name:    lead.name || 'Client Lead',
        client_email:   lead.email,
        client_phone:   lead.phone,
        project_type:   pType,
        target_vehicle: vehicleName,
        vin:            lead.vin,
        status:         'ACTIVE',
        current_stage:  'Intake & Onboarding',
        notes:          lead.notes || lead.message || `Converted from Lead ID ${lead.id}`
      });
      await api.deleteLead(lead.id).catch(() => {});
      setSelectedLead(null);
      await loadLeads();
      navigate('/projects');
    } catch (err) {
      alert('Conversion Error: ' + err.message);
    } finally { setConvertingId(null); }
  };

  useEffect(() => {
    loadLeads();
    const sub = api.subscribeToLeads(() => loadLeads());
    return () => { if (sub) sub.unsubscribe(); };
  }, []);

  // Counts for filter sidebar
  const spamCount   = leads.filter(l => l.status === 'SPAM').length;
  const sellCount   = leads.filter(l => l.status !== 'SPAM' && (l.intent || '').toUpperCase().includes('SELL')).length;
  const buyCount    = leads.filter(l => l.status !== 'SPAM' && (l.intent || '').toUpperCase().includes('BUY')).length;
  const activeCount = leads.filter(l => l.status !== 'SPAM').length;

  const getCounts = (key) => {
    if (key === '')     return leads.length;
    if (key === 'SPAM') return spamCount;
    if (key === 'SELL') return sellCount;
    if (key === 'BUY')  return buyCount;
    if (key === 'NEW')  return activeCount;
    return 0;
  };

  // Filtering
  const filtered = leads.filter(l => {
    const isSpam = l.status === 'SPAM';
    if (statusFilter === 'SPAM')                  { if (!isSpam) return false; }
    else if (statusFilter === 'SELL')             { if (isSpam || !(l.intent || '').toUpperCase().includes('SELL')) return false; }
    else if (statusFilter === 'BUY')              { if (isSpam || !(l.intent || '').toUpperCase().includes('BUY'))  return false; }
    else if (statusFilter === 'NEW' || statusFilter === '') { if (isSpam && statusFilter === 'NEW') return false; }

    const query  = search.toLowerCase();
    const name   = (l.name    || '').toLowerCase();
    const email  = (l.email   || '').toLowerCase();
    const vehicle = `${l.manufacturer || ''} ${l.model || ''}`.toLowerCase();
    const notes  = (l.notes   || '').toLowerCase();
    return !search || name.includes(query) || email.includes(query) || vehicle.includes(query) || notes.includes(query);
  });

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Page Header ── */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 className="page-title">Leads</h1>
            <span className="badge badge-gray">{filtered.length} total</span>
          </div>
          <p className="page-subtitle">Inbound inquiries from Strato Email, WhatsApp, and Web Forms.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={loadLeads} title="Refresh">
            <RefreshCw size={13} className={loading ? 'spin' : ''} /> Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => setIsModalOpen(true)}>
            <Plus size={13} /> New Lead
          </button>
        </div>
      </div>

      {/* ── CRM Layout: Filter Sidebar + List ── */}
      <div className="crm-layout">

        {/* Left: Status Filter Sidebar */}
        <div className="crm-filter-sidebar">
          <div className="crm-filter-section-label">Status</div>
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              className={`crm-filter-pill ${statusFilter === key ? 'active' : ''}`}
              onClick={() => setStatusFilter(key)}
            >
              <span>{label}</span>
              <span className="crm-filter-pill-count">{getCounts(key)}</span>
            </button>
          ))}
        </div>

        {/* Right: List Area */}
        <div className="crm-list-area">
          {/* Search bar */}
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="input-group" style={{ maxWidth: 320 }}>
              <Search size={13} className="input-icon-left" />
              <input
                type="text"
                className="input input-sm input-with-icon-left"
                placeholder="Search by name, vehicle, email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

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
                    <th style={{ width: 36, padding: '10px 12px' }}></th>
                    <th style={{ minWidth: 200 }}>Lead / Client</th>
                    <th style={{ width: 120 }}>Intent</th>
                    <th>Vehicle / Inquiry</th>
                    <th style={{ width: 130 }}>Source</th>
                    <th style={{ width: 120 }}>Received</th>
                    <th style={{ width: 120, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(lead => {
                    const isSpam   = lead.status === 'SPAM';
                    const isSell   = (lead.intent || '').toUpperCase().includes('SELL');
                    const vehicle  = getLeadVehicleDisplay(lead);
                    const selected = selectedLead?.id === lead.id;

                    return (
                      <tr
                        key={lead.id}
                        className={`crm-row${selected ? ' selected' : ''}`}
                        onClick={() => setSelectedLead(selected ? null : lead)}
                      >
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
                            {getInitials(lead.name || lead.email)}
                          </div>
                        </td>

                        {/* Name + Email */}
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {lead.name || 'Anonymous Lead'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {lead.email || lead.phone || '—'}
                          </div>
                        </td>

                        {/* Intent badge */}
                        <td>
                          {isSpam ? (
                            <span className="badge badge-red">Spam</span>
                          ) : isSell ? (
                            <span className="badge badge-green">Sell Side</span>
                          ) : (
                            <span className="badge badge-purple">Buy Side</span>
                          )}
                        </td>

                        {/* Vehicle */}
                        <td>
                          <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                            {vehicle || lead.subject || 'General Inquiry'}
                          </div>
                          {(lead.notes || lead.message) && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', maxWidth: 320,
                                          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {lead.notes || lead.message}
                            </div>
                          )}
                        </td>

                        {/* Source */}
                        <td style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {lead.channel || 'Manual'}
                        </td>

                        {/* Time */}
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
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
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedLead(selected ? null : lead)}
                            >
                              View <ArrowRight size={11} />
                            </button>
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

      {/* ── Lead Detail Panel (right side) ── */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onConvert={handleConvertLeadToProject}
          onRefresh={loadLeads}
          converting={convertingId === selectedLead.id}
        />
      )}

      {/* ── New Lead Modal ── */}
      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={() => { setIsModalOpen(false); loadLeads(); }}
      />
    </div>
  );
}