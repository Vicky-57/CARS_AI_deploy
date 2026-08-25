import { useState, useEffect } from 'react';
import {
  FolderKanban, LayoutGrid, List, Plus, Search, RefreshCw, User, Car,
  ChevronRight, Calculator, Clock, Receipt, Folder, Sparkles, CheckCircle2,
  X, ExternalLink, Tag, FileText, Phone, Mail, ShieldCheck, UploadCloud
} from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';

const STAGES = [
  'Intake & Onboarding',
  'Vehicle Inspection',
  'Marketing & Listing',
  'Negotiation & Contract',
  'Completed & Delivered'
];

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

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' | 'table'
  const [pipelineFilter, setPipelineFilter] = useState('ALL'); // 'ALL' | 'BUY' | 'SELL'
  const [search, setSearch] = useState('');
  const [advancingCardId, setAdvancingCardId] = useState(null);
  
  // Selected detail drawer
  const [selectedProject, setSelectedProject] = useState(null);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'financials' | 'drive'

  // Drive State & Uploads
  const [driveUrls, setDriveUrls] = useState(null);
  const [loadingDriveUrls, setLoadingDriveUrls] = useState(false);
  const [uploadingDriveFile, setUploadingDriveFile] = useState(false);
  const [uploadTargetFolder, setUploadTargetFolder] = useState('1. OCR');
  const [uploadedFileResult, setUploadedFileResult] = useState(null);

  const fetchDriveUrls = async (project) => {
    if (!project) return;
    setLoadingDriveUrls(true);
    try {
      const res = await api.getProjectDriveFolders(project.id, project.client_name);
      if (res && res.success) {
        setDriveUrls(res);
      }
    } catch (err) {
      console.error('Failed to fetch Drive URLs:', err);
    } finally {
      setLoadingDriveUrls(false);
    }
  };

  useEffect(() => {
    if (selectedProject && activeTab === 'drive') {
      fetchDriveUrls(selectedProject);
    }
  }, [selectedProject, activeTab]);

  const handleFileUploadToDrive = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedProject) return;

    setUploadingDriveFile(true);
    setUploadedFileResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('client_name', selectedProject.client_name || 'Customer');
    formData.append('target_folder', uploadTargetFolder);

    try {
      const res = await api.uploadFileToProjectDrive(selectedProject.id, formData);
      if (res && res.success) {
        setUploadedFileResult(res);
        alert(`Successfully uploaded "${file.name}" to Google Drive!`);
      } else {
        alert('Upload error: ' + (res.error || 'Could not upload to Drive'));
      }
    } catch (err) {
      alert('Upload error: ' + err.message);
    } finally {
      setUploadingDriveFile(false);
      e.target.value = '';
    }
  };

  // Sub-forms for Expenses & Labor inside drawer
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showLaborModal, setShowLaborModal] = useState(false);
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

  const [expenseForm, setExpenseForm] = useState({
    expense_type: 'OTHER',
    description: '',
    amount: ''
  });

  const [laborForm, setLaborForm] = useState({
    hours_spent: '',
    activity_description: ''
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
    const currentStage = project.current_stage || STAGES[0];
    const currentIdx = STAGES.indexOf(currentStage);
    if (currentIdx >= STAGES.length - 1) return;

    setAdvancingCardId(project.id);
    const nextStage = STAGES[currentIdx + 1];
    try {
      // 1. Send the backend update
      await api.updateProject(project.id, { current_stage: nextStage });
      
      // 2. Wait for the slide animation to complete
      setTimeout(() => {
        // 3. Optimistically update the UI without triggering the loading spinner
        setProjects(prev => prev.map(p => p.id === project.id ? { ...p, current_stage: nextStage } : p));
        setAdvancingCardId(null);
        
        // 4. Quietly refresh real data in the background
        api.getProjects().then(res => {
          const fresh = Array.isArray(res) ? res : (res.projects || []);
          if (fresh.length > 0) setProjects(fresh);
        }).catch(() => {});
      }, 350);
    } catch (err) {
      alert('Error advancing stage: ' + err.message);
      setAdvancingCardId(null);
    }
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      await api.addExpense(selectedProject.id, {
        expense_type: expenseForm.expense_type,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount) || 0
      });
      setShowExpenseModal(false);
      setExpenseForm({ expense_type: 'OTHER', description: '', amount: '' });
      await loadProjects();
    } catch (err) {
      alert('Error adding expense: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLabor = async (e) => {
    e.preventDefault();
    if (!selectedProject) return;
    setSubmitting(true);
    try {
      await api.addLabor(selectedProject.id, {
        hours_spent: parseFloat(laborForm.hours_spent) || 0,
        activity_description: laborForm.activity_description
      });
      setShowLaborModal(false);
      setLaborForm({ hours_spent: '', activity_description: '' });
      await loadProjects();
    } catch (err) {
      alert('Error adding labor hours: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered projects
  const filtered = projects.filter(p => {
    const matchesPipeline = pipelineFilter === 'ALL' || p.project_type === pipelineFilter;
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
      (p.client_name || '').toLowerCase().includes(q) ||
      (p.target_vehicle || '').toLowerCase().includes(q) ||
      (p.vin || '').toLowerCase().includes(q)
    );
    return matchesPipeline && matchesSearch;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Deals & Projects</h1>
          <p>Unified Sales Pipeline, Financial Ledger & Drive Document Management</p>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Pipeline Filters moved below search bar */}

          {/* View Switcher Toggle */}
          <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 3 }}>
            <button
              className={`btn btn-sm ${viewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', border: 'none', borderRadius: 6, fontSize: '0.8rem', gap: 6 }}
              onClick={() => setViewMode('kanban')}
            >
              <LayoutGrid size={14} /> Kanban Board
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', border: 'none', borderRadius: 6, fontSize: '0.8rem', gap: 6 }}
              onClick={() => setViewMode('table')}
            >
              <List size={14} /> Table View
            </button>
          </div>

          <button className="btn btn-secondary" onClick={loadProjects}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)} style={{ gap: 6 }}>
            <Plus size={16} /> Create Deal / Project
          </button>
        </div>
      </div>

      {/* Search & Filters */}
      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Search Bar */}
        <div className="search-bar" style={{ maxWidth: 420 }}>
          <Search size={14} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search deals by client, vehicle make/model, or VIN…"
          />
        </div>

        {/* Pipeline Type Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {['ALL', 'BUY', 'SELL'].map(type => {
            const isActive = pipelineFilter === type;
            return (
              <button
                key={type}
                onClick={() => setPipelineFilter(type)}
                style={{
                  padding: '8px 20px',
                  borderRadius: 24,
                  fontSize: '0.8rem',
                  fontWeight: isActive ? 800 : 600,
                  background: isActive ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#ffffff',
                  color: isActive ? '#ffffff' : '#64748b',
                  border: isActive ? '1px solid #ea580c' : '1px solid #e2e8f0',
                  boxShadow: isActive ? '0 4px 10px rgba(234, 88, 12, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = '#fed7aa';
                    e.currentTarget.style.color = '#ea580c';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.color = '#64748b';
                  }
                }}
              >
                {type === 'ALL' ? 'All Deals' : type === 'BUY' ? 'Buy Side' : 'Sell Side'}
              </button>
            );
          })}
        </div>
      </div>

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
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 24, minHeight: 500 }}>
          {STAGES.map((stage, sIdx) => {
            const stageDeals = filtered.filter(p => (p.current_stage || STAGES[0]) === stage);
            return (
              <div
                key={stage}
                style={{
                  flex: '1 0 280px',
                  maxWidth: 320,
                  background: 'rgba(15, 23, 42, 0.04)', /* Subtle dark overlay to distinctly separate from bg */
                  border: '1px solid rgba(15, 23, 42, 0.08)',
                  borderRadius: 16,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.02)' /* Subtle inner shadow to look like a tray */
                }}
              >
                {/* Column Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(0, 0, 0, 0.06)' }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#ffffff', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, boxShadow: '0 2px 6px rgba(234, 88, 12, 0.2)' }}>
                      {sIdx + 1}
                    </span>
                    {stage}
                  </div>
                  <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.8)', color: '#64748b', fontSize: '0.75rem', border: '1px solid rgba(0, 0, 0, 0.05)', fontWeight: 700 }}>
                    {stageDeals.length}
                  </span>
                </div>

                {/* Deal Cards Container */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  {stageDeals.length === 0 ? (
                    <div style={{ border: '1.5px dashed rgba(203, 213, 225, 0.6)', borderRadius: 12, padding: '24px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', fontWeight: 600, background: 'rgba(255, 255, 255, 0.3)' }}>
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
                          className="card kanban-card"
                          onClick={() => { setSelectedProject(p); setActiveTab('overview'); }}
                          style={{
                            padding: 18,
                            borderRadius: 12,
                            border: '1px solid rgba(226, 232, 240, 0.8)',
                            cursor: 'pointer',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            background: '#ffffff',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
                            transform: advancingCardId === p.id ? 'translateX(280px) scale(0.95)' : 'translateX(0) scale(1)',
                            opacity: advancingCardId === p.id ? 0 : 1,
                            zIndex: advancingCardId === p.id ? 10 : 1,
                            position: 'relative',
                            pointerEvents: advancingCardId === p.id ? 'none' : 'auto'
                          }}
                          onMouseEnter={(e) => {
                            if (advancingCardId === p.id) return;
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 24px rgba(234, 88, 12, 0.08)';
                            e.currentTarget.style.borderColor = '#fed7aa';
                          }}
                          onMouseLeave={(e) => {
                            if (advancingCardId === p.id) return;
                            e.currentTarget.style.transform = 'translateY(0) scale(1)';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.03)';
                            e.currentTarget.style.borderColor = 'rgba(226, 232, 240, 0.8)';
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #fff3ec, #ffe4d6)', color: '#ea580c', border: '1px solid #fed7aa', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(234, 88, 12, 0.1)', flexShrink: 0 }}>
                                {getInitials(p.client_name)}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{p.client_name}</div>
                                <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, marginTop: 2 }}>{p.client_phone || 'No phone'}</div>
                              </div>
                            </div>
                            <span className={`badge ${p.project_type === 'BUY' ? 'badge-buy' : 'badge-sell'}`} style={{ fontSize: '0.7rem', padding: '4px 8px', border: 'none' }}>
                              {p.project_type === 'BUY' ? 'BUY' : 'SELL'}
                            </span>
                          </div>

                          {/* Target Vehicle */}
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Car size={16} color="#f47c3c" />
                            {p.target_vehicle || 'No vehicle specified'}
                          </div>

                          {/* Profit & Action Footer */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid rgba(226, 232, 240, 0.6)' }}>
                            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: netProfit >= 0 ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {netProfit >= 0 ? '+' : ''}€{netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                            </div>

                            {sIdx < STAGES.length - 1 && (
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '6px 12px', fontSize: '0.75rem', gap: 4, background: 'rgba(241, 245, 249, 0.8)', border: 'none', color: '#475569', fontWeight: 700 }}
                                onClick={(e) => handleAdvanceStage(p, e)}
                                title="Move to next stage"
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = '#ffedd5';
                                  e.currentTarget.style.color = '#ea580c';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(241, 245, 249, 0.8)';
                                  e.currentTarget.style.color = '#475569';
                                }}
                              >
                                Advance <ChevronRight size={14} />
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
                  <th>Investment</th>
                  <th>Net Profit</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                      No deals or projects found.
                    </td>
                  </tr>
                ) : (
                  filtered.map(p => {
                    const totalExpenses = (p.project_expenses || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                    const totalLaborHours = (p.project_labor || []).reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
                    const laborCost = totalLaborHours * (p.hourly_rate || 20);
                    const totalInvestment = (p.purchase_price || 0) + totalExpenses + laborCost;
                    const netProfit = (p.agreed_sale_price || 0) - totalInvestment;
                    const currentStage = p.current_stage || STAGES[0];
                    const stageIdx = STAGES.indexOf(currentStage);

                    return (
                      <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => { setSelectedProject(p); setActiveTab('overview'); }}>
                        <td style={{ paddingLeft: 24 }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <User size={14} color="var(--gray-400)" /> {p.client_name}
                          </div>
                        </td>
                        <td>
                          {p.target_vehicle ? (
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Car size={14} color="var(--brand-500)" /> {p.target_vehicle}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.82rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                            {p.vin || '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${p.project_type === 'BUY' ? 'badge-email' : 'badge-whatsapp'}`}>
                            {p.project_type === 'BUY' ? 'Buy Side' : 'Sell Side'}
                          </span>
                        </td>
                        <td>
                          <span className="badge" style={{ background: 'var(--gray-100)', color: 'var(--text-primary)' }}>
                            <span style={{ color: 'var(--brand-500)', marginRight: 6 }}>{stageIdx + 1}.</span>
                            {currentStage}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                            €{totalInvestment.toLocaleString()}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: netProfit >= 0 ? '#166534' : '#991b1b' }}>
                            €{netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </span>
                        </td>
                        <td style={{ paddingRight: 24, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => { e.stopPropagation(); setSelectedProject(p); setActiveTab('financials'); }}
                              style={{ padding: '6px 12px' }}
                              title="Financial Ledger & Expenses"
                            >
                              <Calculator size={14} />
                            </button>
                            {stageIdx < STAGES.length - 1 && (
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={(e) => handleAdvanceStage(p, e)}
                                style={{ padding: '6px 12px' }}
                              >
                                Advance <ChevronRight size={14} />
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
        </div>
      )}

      {/* UNIFIED SIDE DRAWER DETAIL MODAL */}
      {selectedProject && (
        <div className="modal-overlay" onClick={() => setSelectedProject(null)}>
          <div
            className="modal"
            onClick={e => e.stopPropagation()}
            style={{
              maxWidth: 720,
              width: '100%',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 16
            }}
          >
            {/* Drawer Header */}
            <div style={{ padding: '24px 28px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {selectedProject.client_name}
                  </h2>
                  <span className="badge" style={{ 
                    background: 'var(--brand-100)', color: 'var(--brand-700)', 
                    padding: '4px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, 
                    textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none'
                  }}>
                    {selectedProject.project_type === 'BUY' ? 'Buy Side (Beschaffung)' : 'Sell Side (Vermittlung)'}
                  </span>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Car size={14} style={{ color: 'var(--brand-500)' }} /> 
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedProject.target_vehicle || 'No vehicle specified'}</span>
                  </span>
                  {selectedProject.vin && <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Tag size={14} style={{ color: 'var(--brand-500)' }} /> VIN: <code>{selectedProject.vin}</code></span>}
                  <span>Updated: {formatDateDDMMYYYY(selectedProject.updated_at)}</span>
                </div>
              </div>
              <button className="btn-icon" onClick={() => setSelectedProject(null)}><X size={18} /></button>
            </div>

            {/* Drawer Tabs Bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--gray-50)', padding: '0 28px' }}>
              <button
                className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', fontSize: '0.85rem', fontWeight: 600, borderBottom: activeTab === 'overview' ? '2px solid var(--brand-600)' : '2px solid transparent', color: activeTab === 'overview' ? 'var(--brand-700)' : 'var(--text-muted)' }}
                onClick={() => setActiveTab('overview')}
              >
                <FileText size={16} /> Stage & Overview
              </button>
              <button
                className={`tab-item ${activeTab === 'financials' ? 'active' : ''}`}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', fontSize: '0.85rem', fontWeight: 600, borderBottom: activeTab === 'financials' ? '2px solid var(--brand-600)' : '2px solid transparent', color: activeTab === 'financials' ? 'var(--brand-700)' : 'var(--text-muted)' }}
                onClick={() => setActiveTab('financials')}
              >
                <Receipt size={16} /> Financials & Profit Ledger
              </button>
              <button
                className={`tab-item ${activeTab === 'drive' ? 'active' : ''}`}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', fontSize: '0.85rem', fontWeight: 600, borderBottom: activeTab === 'drive' ? '2px solid var(--brand-600)' : '2px solid transparent', color: activeTab === 'drive' ? 'var(--brand-700)' : 'var(--text-muted)' }}
                onClick={() => setActiveTab('drive')}
              >
                <img src="/assets/google-drive (1).png" alt="Drive" style={{ width: 16, height: 16, objectFit: 'contain' }} /> Drive Cloud Storage
              </button>
            </div>

            {/* Drawer Body Content */}
            <div style={{ padding: '24px 28px', overflowY: 'auto', flex: 1 }}>
              {activeTab === 'overview' && (
                <div>
                  {/* Current Stage Card */}
                  <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: 12, padding: 20, marginBottom: 24, boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-700)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                          <ShieldCheck size={14} /> Current Sales Stage
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-900)', marginTop: 4 }}>
                          {selectedProject.current_stage || STAGES[0]}
                        </div>
                      </div>

                      {STAGES.indexOf(selectedProject.current_stage || STAGES[0]) < STAGES.length - 1 && (
                        <button className="btn btn-primary" onClick={(e) => handleAdvanceStage(selectedProject, e)} style={{ padding: '8px 16px', boxShadow: 'var(--shadow)' }}>
                          Advance Stage <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Client Info Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                    <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', padding: 16, borderRadius: 10 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Phone Number</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Phone size={14} color="var(--brand-600)" /> {selectedProject.client_phone || 'Not provided'}
                      </div>
                    </div>

                    <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', padding: 16, borderRadius: 10 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>Email Address</div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Mail size={14} color="var(--brand-600)" /> {selectedProject.client_email || 'Not provided'}
                      </div>
                    </div>
                  </div>

                  {/* Internal Notes */}
                  {selectedProject.notes && (
                    <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', padding: 16, borderRadius: 10, boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', fontWeight: 700, color: 'var(--brand-700)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '0.5px' }}>
                        <FileText size={14} /> Internal Deal Notes
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--gray-900)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {selectedProject.notes}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'financials' && (() => {
                const totalExpenses = (selectedProject.project_expenses || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                const totalLaborHours = (selectedProject.project_labor || []).reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
                const laborCost = totalLaborHours * (selectedProject.hourly_rate || 20);
                const totalInvestment = (selectedProject.purchase_price || 0) + totalExpenses + laborCost;
                const netProfit = (selectedProject.agreed_sale_price || 0) - totalInvestment;

                return (
                  <div>
                    {/* Financial Summary Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', padding: 16, borderRadius: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Expenses</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#d97706', marginTop: 4 }}>€{totalExpenses.toFixed(2)}</div>
                      </div>
                      <div style={{ background: 'var(--gray-50)', border: '1px solid var(--border)', padding: 16, borderRadius: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Labor ({totalLaborHours}h @ €20/h)</div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--brand-700)', marginTop: 4 }}>€{laborCost.toFixed(2)}</div>
                      </div>
                      <div style={{ background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${netProfit >= 0 ? '#bbf7d0' : '#fecaca'}`, padding: 16, borderRadius: 12 }}>
                        <div style={{ fontSize: '0.75rem', color: netProfit >= 0 ? '#166534' : '#991b1b', fontWeight: 700 }}>Net Broker Profit</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: netProfit >= 0 ? '#15803d' : '#b91c1c', marginTop: 4 }}>
                          {netProfit >= 0 ? '+' : ''}€{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowExpenseModal(true)}>
                        <Receipt size={14} /> Log Receipt / Expense
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setShowLaborModal(true)}>
                        <Clock size={14} /> Log Labor Hours
                      </button>
                    </div>

                    {/* Expenses History List */}
                    <div style={{ marginBottom: 24 }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>Logged Expenses</h4>
                      {(!selectedProject.project_expenses || selectedProject.project_expenses.length === 0) ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No receipts logged yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedProject.project_expenses.map(e => (
                            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.82rem' }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{e.description}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDateDDMMYYYY(e.logged_at)}</div>
                              </div>
                              <div style={{ fontWeight: 700, color: '#d97706' }}>€{parseFloat(e.amount).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Labor Hours List */}
                    <div>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 12 }}>Broker Labor Log</h4>
                      {(!selectedProject.project_labor || selectedProject.project_labor.length === 0) ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No labor hours logged yet.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {selectedProject.project_labor.map(l => (
                            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.82rem' }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{l.activity_description}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDateDDMMYYYY(l.logged_at)}</div>
                              </div>
                              <div style={{ fontWeight: 700, color: 'var(--brand-700)' }}>{l.hours_spent} hrs</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {activeTab === 'drive' && (
                <div style={{ padding: '16px 8px' }}>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--brand-50)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                      <img src="/assets/google-drive (1).png" alt="Drive" style={{ width: 32, height: 32, objectFit: 'contain' }} />
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: 6 }}>Google Drive Customer Storage</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto', lineHeight: 1.5 }}>
                      Automated 3-tier document archiving active for customer <strong>{selectedProject.client_name}</strong>.
                    </p>
                  </div>

                  {/* Direct Folder Links */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 520, margin: '0 auto 32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Folder size={16} color="var(--brand-500)" style={{ flexShrink: 0 }} /> 1. OCR & Media Scans Folder
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Vehicle photos, walkaround videos, vehicle specs</div>
                      </div>
                      <a
                        href={driveUrls?.ocr_folder_url || 'https://drive.google.com'}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ gap: 6 }}
                      >
                        Open Drive <ExternalLink size={13} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Folder size={16} color="var(--brand-500)" style={{ flexShrink: 0 }} /> 2. Legal Contracts Folder
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Power of Attorney, CAR-AGENTS GTC, disclaimers</div>
                      </div>
                      <a
                        href={driveUrls?.legal_docs_folder_url || 'https://drive.google.com'}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ gap: 6 }}
                      >
                        Open Drive <ExternalLink size={13} />
                      </a>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'var(--gray-50)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-sm)' }}>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Folder size={16} color="var(--brand-500)" style={{ flexShrink: 0 }} /> 3. Signed PDF Contracts
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Final signed brokerage & sale contracts</div>
                      </div>
                      <a
                        href={driveUrls?.signed_docs_folder_url || 'https://drive.google.com'}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ gap: 6 }}
                      >
                        Open Drive <ExternalLink size={13} />
                      </a>
                    </div>
                  </div>

                  {/* Upload Media / Videos / Documents Box */}
                  <div style={{ background: 'white', border: '1px solid var(--border)', borderRadius: 14, padding: 24, maxWidth: 520, margin: '0 auto', boxShadow: 'var(--shadow-sm)' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
                      <UploadCloud size={16} color="var(--brand-600)" /> Upload Media or Documents to Drive
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                      Select a vehicle walkaround video, photo, or PDF scan to upload directly to customer's Google Drive.
                    </p>

                    <div className="form-group" style={{ marginBottom: 16 }}>
                      <label className="form-label">Target Drive Subfolder</label>
                      <select
                        className="form-select"
                        value={uploadTargetFolder}
                        onChange={e => setUploadTargetFolder(e.target.value)}
                      >
                        <option value="1. OCR">1. OCR (Vehicle Photos, Videos & Spec Scans)</option>
                        <option value="2. Legal Docs">2. Legal Docs (GTC & Power of Attorney)</option>
                        <option value="3. Signed Docs">3. Signed Docs (Executed PDF Contracts)</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <label className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', padding: '10px 16px' }}>
                        {uploadingDriveFile ? <Sparkles size={16} className="spin" /> : <Folder size={16} />}
                        <span>{uploadingDriveFile ? 'Uploading File to Drive…' : 'Select Photo, Video, or PDF to Upload'}</span>
                        <input
                          type="file"
                          accept="image/*,video/*,application/pdf"
                          onChange={handleFileUploadToDrive}
                          disabled={uploadingDriveFile}
                          style={{ display: 'none' }}
                        />
                      </label>
                    </div>

                    {uploadedFileResult && (
                      <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '0.8rem', color: '#166534', textAlign: 'left' }}>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ Upload Successful!</div>
                        <div>File: <strong>{uploadedFileResult.filename}</strong></div>
                        <a href={uploadedFileResult.drive_url} target="_blank" rel="noreferrer" style={{ color: '#15803d', textDecoration: 'underline', marginTop: 4, display: 'inline-block', fontWeight: 600 }}>
                          View File on Google Drive <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EXPENSE LOG MODAL */}
      {showExpenseModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Expense / Receipt</h3>
              <button className="btn-icon" onClick={() => setShowExpenseModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Expense Category</label>
                  <select
                    className="form-select"
                    value={expenseForm.expense_type}
                    onChange={e => setExpenseForm({ ...expenseForm, expense_type: e.target.value })}
                  >
                    <option value="DETAILING">Vehicle Detailing</option>
                    <option value="TUEV_INSPECTION">TÜV Inspection</option>
                    <option value="TRANSPORT">Vehicle Transport</option>
                    <option value="OIL_CHANGE">Oil Change / Service</option>
                    <option value="ADMIN">Administrative / Legal</option>
                    <option value="OTHER">Other Expense</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (€) *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    required
                    placeholder="150.00"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Vendor</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. TÜV Süd Inspection fee"
                    value={expenseForm.description}
                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LABOR HOURS LOG MODAL */}
      {showLaborModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Broker Labor Hours</h3>
              <button className="btn-icon" onClick={() => setShowLaborModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddLabor}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Hours Spent *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.5"
                    required
                    placeholder="2.5"
                    value={laborForm.hours_spent}
                    onChange={e => setLaborForm({ ...laborForm, hours_spent: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Activity Description *</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. On-site vehicle inspection & photo shoot"
                    value={laborForm.activity_description}
                    onChange={e => setLaborForm({ ...laborForm, activity_description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLaborModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Save Labor Hours</button>
              </div>
            </form>
          </div>
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
