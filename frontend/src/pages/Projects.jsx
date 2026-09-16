import { useState, useEffect } from 'react';
import {
  FolderKanban, LayoutGrid, List, Plus, Search, RefreshCw, User, Car,
  ChevronRight, ChevronDown, Calculator, Clock, Receipt, Folder, Sparkles, CheckCircle2,
  X, ExternalLink, Tag, FileText, Phone, Mail, ShieldCheck, UploadCloud, Check, Filter
} from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';
import DealDetailPanel from '../components/DealDetailPanel';

// Import from shared utils (avoids circular deps with DealDetailPanel)
export { STAGES, getNormalizedStage } from '../utils/stageUtils';
import { STAGES, getNormalizedStage } from '../utils/stageUtils';

function formatDateDDMMYYYY(dateInput) {
  if (!dateInput) return '—';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${d.getFullYear()}`;
  } catch {
    return '—';
  }
}

function getInitials(name) {
  if (!name) return 'CA';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
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
            maxHeight: 250, overflowY: 'auto'
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

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [pipelineFilter, setPipelineFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL'
  const [search, setSearch] = useState('');
  
  // Advanced Filters
  const [showFilters, setShowFilters] = useState(false);
  const [stageFilter, setStageFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [advancingCardId, setAdvancingCardId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Selected detail drawer
  const [selectedProject, setSelectedProject] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [createProjectForm, setCreateProjectForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    project_type: 'SELL',
    target_vehicle: '',
    vin: '',
    purchase_price: '',
    agreed_sale_price: '',
    notes: ''
  });

  const handleCreateProjectSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createProject({
        client_name: createProjectForm.client_name,
        client_email: createProjectForm.client_email || null,
        client_phone: createProjectForm.client_phone || null,
        project_type: createProjectForm.project_type,
        target_vehicle: createProjectForm.target_vehicle || null,
        vin: createProjectForm.vin || null,
        purchase_price: createProjectForm.purchase_price ? parseFloat(createProjectForm.purchase_price) : 0.0,
        agreed_sale_price: createProjectForm.agreed_sale_price ? parseFloat(createProjectForm.agreed_sale_price) : 0.0,
        status: 'ACTIVE',
        current_stage: 'Intake & Onboarding',
        notes: createProjectForm.notes || null
      });
      setShowCreateModal(false);
      setCreateProjectForm({
        client_name: '', client_email: '', client_phone: '',
        project_type: 'SELL', target_vehicle: '', vin: '',
        purchase_price: '', agreed_sale_price: '', notes: ''
      });
      await loadProjects();
    } catch (err) {
      alert('Error creating project: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.getProjects();
      const loaded = Array.isArray(res) ? res : (res.projects || []);
      setProjects(loaded);

      // Keep selected project state fresh if drawer is open
      if (selectedProject) {
        const fresh = loaded.find(p => p.id === selectedProject.id);
        if (fresh) setSelectedProject(fresh);
      }
    } catch (err) {
      console.error('Error loading projects:', err);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleAdvanceStage = async (project, e) => {
    if (e) e.stopPropagation();
    const currentStage = getNormalizedStage(project.current_stage);
    const currentIdx = STAGES.indexOf(currentStage);
    if (currentIdx >= STAGES.length - 1) return;

    setAdvancingCardId(project.id);
    const nextStage = STAGES[currentIdx + 1];
    try {
      const nowIso = new Date().toISOString();
      await api.updateProject(project.id, { current_stage: nextStage, updated_at: nowIso });

      setProjects(prev => prev.map(p => p.id === project.id ? { ...p, current_stage: nextStage, updated_at: nowIso } : p));
      if (selectedProject && selectedProject.id === project.id) {
        setSelectedProject(prev => ({ ...prev, current_stage: nextStage, updated_at: nowIso }));
      }

      // Scroll logic for mobile
      if (window.innerWidth <= 768) {
        setTimeout(() => {
          const targetCol = document.getElementById(`kanban-col-${currentIdx + 1}`);
          if (targetCol) {
            targetCol.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 50);
      }

      // Quietly refresh real data in the background
      api.getProjects().then(res => {
        const fresh = Array.isArray(res) ? res : (res?.projects || []);
        if (fresh.length > 0) setProjects(fresh);
      }).catch(() => { });
    } catch (err) {
      alert('Error advancing stage: ' + err.message);
    } finally {
      setAdvancingCardId(null);
    }
  };

  // Filtered projects
  const filtered = projects.filter(p => {
    // Pipeline Tab filter
    if (pipelineFilter !== 'ALL' && p.project_type !== pipelineFilter) return false;
    
    // Status Filter
    if (statusFilter && p.status !== statusFilter) return false;
    
    // Stage Filter
    if (stageFilter && getNormalizedStage(p.current_stage) !== stageFilter) return false;

    // Search filter
    const q = search.toLowerCase().trim();
    if (q) {
      const matchesSearch = (
        (p.client_name || '').toLowerCase().includes(q) ||
        (p.target_vehicle || '').toLowerCase().includes(q) ||
        (p.vin || '').toLowerCase().includes(q)
      );
      if (!matchesSearch) return false;
    }
    
    return true;
  });

  const PAGE_SIZE = 10;
  useEffect(() => { setCurrentPage(1); }, [search, pipelineFilter, stageFilter, statusFilter, viewMode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const getPageNumbers = () => {
    const pages = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  return (
    <div>
      {/* Frappe CRM Deal Detail Panel */}
      {selectedProject && (
        <DealDetailPanel
          project={selectedProject}
          onClose={() => setSelectedProject(null)}
          onAdvance={(proj) => handleAdvanceStage(proj)}
          advancing={advancingCardId === selectedProject?.id}
          onUpdate={loadProjects}
        />
      )}

      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Deals & Projects</h1>
          <p className="page-subtitle">Unified Sales Pipeline, Financial Ledger & Drive Document Management</p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* View Switcher Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
            <button
              className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '5px 10px', fontSize: '0.78rem', gap: 6 }}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid size={13} /> Kanban Board
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '5px 10px', fontSize: '0.78rem', gap: 6 }}
              onClick={() => setViewMode('table')}
            >
              <List size={13} /> Table View
            </button>
          </div>

          <button className="btn btn-secondary" onClick={loadProjects}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ gap: 6 }}>
            <Plus size={14} /> Create Deal / Project
          </button>
        </div>
      </div>

      {/* Search & Frappe Filter Tabs */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        {/* Pipeline Type Filters */}
        <div className="tabs-container" style={{ margin: 0, border: 'none', gap: 4 }}>
          {['ALL', 'BUY', 'SELL'].map(type => {
            const isActive = pipelineFilter === type;
            return (
              <button
                key={type}
                onClick={() => setPipelineFilter(type)}
                className={`tab-btn ${isActive ? 'active' : ''}`}
                style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              >
                {type === 'ALL' ? 'All Deals' : type === 'BUY' ? 'Buy Side (Beschaffung)' : 'Sell Side (Vermittlung)'}
              </button>
            );
          })}
        </div>

        {/* Search Bar & Filter Toggle */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ padding: '6px 12px', background: showFilters ? 'var(--bg-surface-subtle)' : 'transparent', border: '1px solid var(--border)' }}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={14} style={{ opacity: 0.6 }} />
            <span style={{ fontWeight: 500 }}>Filter</span>
          </button>
          <div className="input-group" style={{ width: 320, background: 'var(--bg-surface)' }}>
            <Search size={14} className="input-icon-left" />
            <input
              className="input input-sm input-with-icon-left"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search deals by client, car model, VIN…"
            />
          </div>
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
                { value: '', label: 'All Statuses' },
                { value: 'ACTIVE', label: 'Active' },
                { value: 'COMPLETED', label: 'Completed' },
                { value: 'CANCELLED', label: 'Cancelled' }
              ]}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pipeline Stage</label>
            <CustomSelect
              style={{ minWidth: 200 }}
              value={stageFilter}
              onChange={setStageFilter}
              options={[
                { value: '', label: 'All Stages' },
                ...STAGES.map(s => ({ value: s, label: s }))
              ]}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', marginLeft: 'auto' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setStatusFilter(''); setStageFilter(''); }}>
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        /* Sleek Empty State Hero Card when no deals exist */
        <div className="card" style={{ padding: '48px 32px', textAlign: 'center', maxWidth: 760, margin: '24px auto', borderRadius: 16, border: '1px solid var(--border)', background: 'white' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-50)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <FolderKanban size={28} color="var(--brand-600)" />
          </div>
          <div style={{ display: 'inline-block', background: 'var(--brand-50)', color: 'var(--brand-700)', padding: '4px 14px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 700, marginBottom: 14 }}>
            ⚡ Sales & Procurement Pipeline
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>
            No Active Deals or Projects
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: 520, margin: '0 auto 28px', lineHeight: 1.6 }}>
            Convert an inbound customer inquiry from your <strong>Leads</strong> tab or run <code>/createlead</code> on <strong>Telegram</strong> to start tracking deals across sales stages.
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ padding: '10px 20px', gap: 8 }}>
              <Plus size={16} /> Create New Deal / Project
            </button>
            <a href="/leads" className="btn btn-secondary" style={{ padding: '10px 20px', textDecoration: 'none' }}>
              Go to Leads & Convert
            </a>
            <button className="btn btn-secondary" onClick={loadProjects} style={{ padding: '10px 20px' }}>
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        /* KANBAN BOARD VIEW */
        <div className="kanban-container">
          {STAGES.map((stage, sIdx) => {
            const stageDeals = filtered.filter(p => (p.current_stage || STAGES[0]) === stage);
            return (
              <div
                key={stage}
                id={`kanban-col-${sIdx}`}
                className="kanban-column"
              >
                {/* Column Header */}
                <div className="kanban-column-header">
                  <div className="kanban-column-title">
                    <span style={{
                      width: 18,
                      height: 18,
                      borderRadius: 'var(--radius-xs)',
                      background: 'var(--primary)',
                      color: 'var(--primary-text)',
                      fontSize: '0.68rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700
                    }}>
                      {sIdx + 1}
                    </span>
                    {stage}
                  </div>
                  <span className="kanban-column-count">
                    {stageDeals.length}
                  </span>
                </div>

                {/* Deal Cards Container */}
                <div className="kanban-cards-list">
                  {stageDeals.length === 0 ? (
                    <div style={{ border: '1px dashed var(--border-dark)', borderRadius: 'var(--radius-sm)', padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.78rem', background: 'transparent' }}>
                      No deals in this stage
                    </div>
                  ) : (
                    stageDeals.map(p => {
                      const totalExpenses = (p.project_expenses || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                      const totalLaborHours = (p.project_labor || []).reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
                      const laborCost = totalLaborHours * (p.hourly_rate || 20);
                      const totalInvestment = (p.purchase_price || 0) + totalExpenses + laborCost;
                      const netProfit = (p.agreed_sale_price || 0) - totalInvestment;

                      return (
                        <div
                          key={p.id}
                          className="kanban-card"
                          onClick={() => { setSelectedProject(p); setActiveTab('overview'); }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div className="notranslate" style={{
                                width: 28,
                                height: 28,
                                borderRadius: 'var(--radius-xs)',
                                background: 'var(--bg-surface-subtle)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border)',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                              }}>
                                {getInitials(p.client_name)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{p.client_name}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{p.client_phone || 'No phone'}</div>
                              </div>
                            </div>
                            <span className={`badge ${p.project_type === 'BUY' ? 'badge-purple' : 'badge-emerald'}`}>
                              {p.project_type === 'BUY' ? 'Buy' : 'Sell'}
                            </span>
                          </div>

                          {/* Target Vehicle */}
                          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Car size={14} color="var(--text-secondary)" />
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.target_vehicle || 'No vehicle specified'}
                            </span>
                          </div>

                          {/* Project Date Info */}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <Clock size={11} /> {formatDateDDMMYYYY(p.created_at)}
                            </span>
                            <span>
                              Upd {formatDateDDMMYYYY(p.updated_at)}
                            </span>
                          </div>

                          {/* Profit & Action Footer */}
                          <div className="kanban-card-footer">
                            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: netProfit >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                              {netProfit >= 0 ? '+' : ''}€{netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </div>

                            {sIdx < STAGES.length - 1 && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.72rem', gap: 3 }}
                                onClick={(e) => handleAdvanceStage(p, e)}
                                title="Advance to next stage"
                              >
                                Advance <ChevronRight size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Client Name</th>
                  <th>Vehicle Details</th>
                  <th>VIN</th>
                  <th>Pipeline Type</th>
                  <th>Current Stage</th>
                  <th>Created Date</th>
                  <th>Investment</th>
                  <th>Net Profit</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                      No deals or projects found.
                    </td>
                  </tr>
                ) : (
                  paginated.map(p => {
                    const totalExpenses = (p.project_expenses || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                    const totalLaborHours = (p.project_labor || []).reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
                    const laborCost = totalLaborHours * (p.hourly_rate || 20);
                    const totalInvestment = (p.purchase_price || 0) + totalExpenses + laborCost;
                    const netProfit = (p.agreed_sale_price || 0) - totalInvestment;
                    const currentStage = getNormalizedStage(p.current_stage);
                    const stageIdx = STAGES.indexOf(currentStage);

                    return (
                      <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedProject(p); setActiveTab('overview'); }}>
                        <td style={{ paddingLeft: 16 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="notranslate" style={{
                              width: 30, height: 30, borderRadius: 'var(--radius-xs)',
                              background: 'var(--bg-surface-subtle)',
                              border: '1px solid var(--border)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 700,
                              color: 'var(--text-primary)', flexShrink: 0
                            }}>
                              {getInitials(p.client_name)}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                              {p.client_name}
                            </div>
                          </div>
                        </td>
                        <td>
                          {p.target_vehicle ? (
                            <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Car size={14} color="var(--text-secondary)" />
                              <span>{p.target_vehicle}</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg-surface-subtle)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>
                            {p.vin || '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${p.project_type === 'BUY' ? 'badge-purple' : 'badge-emerald'}`}>
                            {p.project_type === 'BUY' ? 'Buy Side' : 'Sell Side'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                              {currentStage}
                            </div>
                            <div style={{ display: 'flex', gap: 2, width: 120 }}>
                              {STAGES.map((s, idx) => {
                                const isPast = idx < stageIdx;
                                const isCurrent = idx === stageIdx;
                                const isCompleted = p.status === 'COMPLETED';
                                const isCancelled = p.status === 'CANCELLED';
                                
                                let bg = 'var(--border)';
                                if (isCompleted) bg = 'var(--status-green)';
                                else if (isCancelled) bg = 'var(--status-red)';
                                else if (isPast || isCurrent) bg = 'var(--primary)';

                                let opacity = 0.5;
                                if (isCurrent || isCompleted || isCancelled) opacity = 1;
                                else if (isPast) opacity = 0.3;

                                return (
                                  <div key={s} style={{ 
                                    height: 4, 
                                    flex: 1, 
                                    borderRadius: 2, 
                                    background: bg,
                                    opacity: opacity,
                                    transition: 'all 0.2s'
                                  }} />
                                );
                              })}
                            </div>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {formatDateDDMMYYYY(p.created_at)}
                        </td>
                        <td style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                          €{totalInvestment.toLocaleString()}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: netProfit >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                            {netProfit >= 0 ? '+' : ''}€{netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td style={{ paddingRight: 16, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-sm btn-icon"
                              onClick={(e) => { e.stopPropagation(); setSelectedProject(p); setActiveTab('financials'); }}
                              title="Financial Ledger & Expenses"
                            >
                              <Calculator size={13} />
                            </button>
                            {stageIdx < STAGES.length - 1 && (
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={(e) => handleAdvanceStage(p, e)}
                                style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                                title="Advance to next stage"
                              >
                                Advance <ChevronRight size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination Bar ── */}
          {filtered.length > PAGE_SIZE && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface)',
              flexWrap: 'wrap',
              gap: 12
            }}>
              {/* Info text */}
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} projects
              </span>

              {/* Page controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: currentPage === 1 ? 'var(--gray-50)' : 'var(--surface)',
                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >← Prev</button>

                {getPageNumbers()[0] > 1 && (
                  <>
                    <button onClick={() => setCurrentPage(1)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>1</button>
                    {getPageNumbers()[0] > 2 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 2px' }}>…</span>}
                  </>
                )}

                {getPageNumbers().map(n => (
                  <button
                    key={n}
                    onClick={() => setCurrentPage(n)}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 8,
                      border: n === currentPage ? 'none' : '1px solid var(--border)',
                      background: n === currentPage ? 'var(--primary)' : 'var(--surface)',
                      color: n === currentPage ? '#ffffff' : 'var(--text-primary)',
                      fontWeight: n === currentPage ? 700 : 600,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      minWidth: 32,
                      transition: 'all 0.2s',
                      boxShadow: n === currentPage ? '0 2px 6px rgba(0,0,0,0.15)' : 'none'
                    }}
                  >{n}</button>
                ))}

                {getPageNumbers().at(-1) < totalPages && (
                  <>
                    {getPageNumbers().at(-1) < totalPages - 1 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '0 2px' }}>…</span>}
                    <button onClick={() => setCurrentPage(totalPages)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>{totalPages}</button>
                  </>
                )}

                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: currentPage === totalPages ? 'var(--gray-50)' : 'var(--surface)',
                    color: currentPage === totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CREATE NEW PROJECT / DEAL MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header" style={{ padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--brand-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={18} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ margin: 0, fontSize: '1.1rem' }}>Create New Deal / Project</h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Start tracking a vehicle sales or procurement deal</div>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setShowCreateModal(false)}><X size={16} /></button>
            </div>

            <form onSubmit={handleCreateProjectSubmit}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Client Full Name *</label>
                    <input
                      className="form-input"
                      required
                      placeholder="e.g. Stefan Meier"
                      value={createProjectForm.client_name}
                      onChange={e => setCreateProjectForm({ ...createProjectForm, client_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Pipeline Type *</label>
                    <select
                      className="form-select"
                      value={createProjectForm.project_type}
                      onChange={e => setCreateProjectForm({ ...createProjectForm, project_type: e.target.value })}
                    >
                      <option value="SELL">Sell Side (Vermittlung)</option>
                      <option value="BUY">Buy Side (Beschaffung)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Client Phone</label>
                    <input
                      className="form-input"
                      placeholder="+49 170 1234567"
                      value={createProjectForm.client_phone}
                      onChange={e => setCreateProjectForm({ ...createProjectForm, client_phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Client Email</label>
                    <input
                      className="form-input"
                      type="email"
                      placeholder="client@example.de"
                      value={createProjectForm.client_email}
                      onChange={e => setCreateProjectForm({ ...createProjectForm, client_email: e.target.value })}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Target Vehicle Make & Model</label>
                    <input
                      className="form-input"
                      placeholder="e.g. BMW 320i M Sport"
                      value={createProjectForm.target_vehicle}
                      onChange={e => setCreateProjectForm({ ...createProjectForm, target_vehicle: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">VIN (17-digit)</label>
                    <input
                      className="form-input"
                      placeholder="WV2ZZZ7HZGH056070"
                      value={createProjectForm.vin}
                      onChange={e => setCreateProjectForm({ ...createProjectForm, vin: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Purchase / Base Price (€)</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="28000"
                      value={createProjectForm.purchase_price}
                      onChange={e => setCreateProjectForm({ ...createProjectForm, purchase_price: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Target / Agreed Sale Price (€)</label>
                    <input
                      className="form-input"
                      type="number"
                      placeholder="31500"
                      value={createProjectForm.agreed_sale_price}
                      onChange={e => setCreateProjectForm({ ...createProjectForm, agreed_sale_price: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Internal Deal Notes</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    placeholder="Key client preferences, agreed broker commission, or inspection dates..."
                    value={createProjectForm.notes}
                    onChange={e => setCreateProjectForm({ ...createProjectForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ padding: '16px 24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  <CheckCircle2 size={15} /> Save Deal to Supabase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}