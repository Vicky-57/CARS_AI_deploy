import { useState, useEffect } from 'react';
import { FolderKanban, Plus, RefreshCw, Calculator, Car, CheckCircle, Clock, ChevronRight, ChevronDown, Tag, Search, Banknote, User, Filter, Edit } from 'lucide-react';
import { api } from '../api/api';
import ExpenseModal from '../components/ExpenseModal';

const STAGES_SELL = [
  'Onboarding & Lead Capture',
  'Vehicle Docs & Specs',
  'Marketing & Listing',
  'Buyer Negotiation',
  'Contract Signing',
  'Handover & Close'
];

const STAGES_BUY = [
  'Requirement Capture',
  'Procurement Contract',
  'Vehicle Sourcing',
  'Technical Inspection',
  'Price Negotiation',
  'Delivery & Acquisition'
];

export default function Projects() {
  const [tab, setTab] = useState('SELL');
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');

  const [selectedExpenseProject, setSelectedExpenseProject] = useState(null);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await api.getProjects(tab);
      setProjects(data || []);
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();

    // Subscribe to realtime updates from Supabase!
    const sub = api.subscribeToProjects(() => {
      loadProjects();
    });
    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [tab]);

  const stages = tab === 'SELL' ? STAGES_SELL : STAGES_BUY;

  const filtered = projects.filter(p => {
    const currentStage = p.current_stage || stages[0];
    if (stageFilter && currentStage !== stageFilter) return false;

    const query = search.toLowerCase();
    if (query) {
      const clientName = (p.client_name || '').toLowerCase();
      const targetVehicle = (p.target_vehicle || '').toLowerCase();
      const vin = (p.vin || '').toLowerCase();
      if (!clientName.includes(query) && !targetVehicle.includes(query) && !vin.includes(query)) {
        return false;
      }
    }

    return true;
  });

  const advanceStage = async (project, e) => {
    if (e) e.stopPropagation();
    const currentStage = project.current_stage || stages[0];
    const currentIndex = stages.indexOf(currentStage);
    if (currentIndex < stages.length - 1) {
      const nextStage = stages[currentIndex + 1];
      try {
        await api.updateProject(project.id, { current_stage: nextStage });
        loadProjects();
      } catch (err) {
        alert('Could not update stage: ' + err.message);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', paddingBottom: 20 }}>
      {/* Header & Controls */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 24, flexShrink: 0 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Dual Brokerage Pipelines</h1>
          <p style={{ fontSize: '0.9rem' }}>Manage active vehicle sales and procurement projects</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={loadProjects} style={{ padding: '8px 16px' }}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Folder Tabs */}
      <div style={{ display: 'flex', paddingLeft: 0, position: 'relative', zIndex: 10, marginBottom: 0 }}>
        {[
          { id: 'SELL', label: 'SELL SIDE — Vermittlung', icon: Tag },
          { id: 'BUY', label: 'BUY SIDE — Beschaffung', icon: Search }
        ].map((t) => {
          const isActive = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setStageFilter(''); }}
              style={{
                padding: '14px 28px',
                background: isActive ? 'var(--surface)' : 'transparent',
                border: 'none',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                color: isActive ? 'var(--brand-600)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 600,
                fontSize: '0.9rem',
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
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Projects Table */}
      <div className="card" style={{ border: 'none', borderTopLeftRadius: tab === 'SELL' ? 0 : 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
        <div className="card-header" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Active Projects ({filtered.length})
          </span>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Search Bar */}
            <div className="search-bar" style={{ display: 'flex', alignItems: 'center', padding: '4px 12px', borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                placeholder="Search projects..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '0.85rem', border: 'none', background: 'transparent', outline: 'none', marginLeft: 8, width: 140 }}
              />
            </div>

            {/* Custom Premium Filter Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', borderRadius: 24,
                  background: stageFilter ? 'var(--brand-50)' : 'var(--surface)',
                  border: `1px solid ${stageFilter ? 'var(--brand-200)' : 'var(--border)'}`,
                  color: stageFilter ? 'var(--brand-700)' : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                }}
              >
                <Filter size={14} color={stageFilter ? 'var(--brand-500)' : 'var(--text-muted)'} />
                {stageFilter || 'All Stages'}
                <ChevronDown size={14} style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              {isDropdownOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIsDropdownOpen(false)} />
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                    width: 260, background: 'var(--surface)', borderRadius: 16,
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                    border: '1px solid var(--border)', zIndex: 100, overflow: 'hidden',
                    display: 'flex', flexDirection: 'column'
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--gray-50)' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filter by Stage</span>
                    </div>
                    <div style={{ maxHeight: 300, overflowY: 'auto', padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        onClick={() => { setStageFilter(''); setIsDropdownOpen(false); }}
                        style={{
                          padding: '10px 12px', borderRadius: 8, border: 'none', background: stageFilter === '' ? 'var(--brand-50)' : 'transparent',
                          color: stageFilter === '' ? 'var(--brand-700)' : 'var(--text-primary)',
                          fontWeight: stageFilter === '' ? 600 : 500, fontSize: '0.85rem', textAlign: 'left', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.1s'
                        }}
                        onMouseEnter={e => { if (stageFilter !== '') e.currentTarget.style.background = 'var(--gray-50)'; }}
                        onMouseLeave={e => { if (stageFilter !== '') e.currentTarget.style.background = 'transparent'; }}
                      >
                        All Stages
                        {stageFilter === '' && <CheckCircle size={14} color="var(--brand-500)" />}
                      </button>
                      {stages.map(s => (
                        <button
                          key={s}
                          onClick={() => { setStageFilter(s); setIsDropdownOpen(false); }}
                          style={{
                            padding: '10px 12px', borderRadius: 8, border: 'none', background: stageFilter === s ? 'var(--brand-50)' : 'transparent',
                            color: stageFilter === s ? 'var(--brand-700)' : 'var(--text-primary)',
                            fontWeight: stageFilter === s ? 600 : 500, fontSize: '0.85rem', textAlign: 'left', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.1s'
                          }}
                          onMouseEnter={e => { if (stageFilter !== s) e.currentTarget.style.background = 'var(--gray-50)'; }}
                          onMouseLeave={e => { if (stageFilter !== s) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {s}
                          {stageFilter === s && <CheckCircle size={14} color="var(--brand-500)" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>


          </div>
        </div>

        <div className="table-wrap" style={{ border: 'none', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', boxShadow: 'none' }}>
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: 24, paddingTop: 16, paddingBottom: 16 }}>Client</th>
                <th>Vehicle Details</th>
                <th>Stage</th>
                <th>Investment</th>
                <th>Profit</th>
                <th style={{ paddingRight: 24, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 60 }}>
                    <div className="spinner" style={{ margin: '0 auto 16px', width: 28, height: 28, borderWidth: 3 }} />
                    <div style={{ color: 'var(--text-muted)' }}>Loading projects...</div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 80 }}>
                    <div style={{ width: 64, height: 64, background: 'var(--gray-50)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                      <FolderKanban size={32} color="var(--gray-400)" />
                    </div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No projects found</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
                      {stageFilter ? 'Try clearing the stage filter.' : 'Wait for new projects to appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map(p => {
                  const totalExpenses = (p.project_expenses || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                  const totalLaborHours = (p.project_labor || []).reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
                  const laborCost = totalLaborHours * (p.hourly_rate || 20);
                  const totalInvestment = (p.purchase_price || 0) + totalExpenses + laborCost;
                  const netProfit = (p.agreed_sale_price || 0) - totalInvestment;
                  const currentStage = p.current_stage || stages[0];
                  const stageIdx = stages.indexOf(currentStage);

                  return (
                    <tr key={p.id}>
                      <td style={{ paddingLeft: 24 }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <User size={14} color="var(--gray-400)" /> {p.client_name}
                        </div>
                      </td>
                      <td>
                        {p.target_vehicle ? (
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: p.vin ? 4 : 0 }}>
                            <Car size={14} color="var(--brand-500)" /> {p.target_vehicle}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>-</span>
                        )}
                        {p.vin && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            VIN: {p.vin}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ background: 'var(--gray-100)', color: 'var(--text-primary)' }}>
                          <span style={{ color: 'var(--brand-500)', marginRight: 6 }}>{stageIdx + 1}.</span>
                          {currentStage}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          €{totalInvestment.toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600, color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                          €{netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                        </span>
                      </td>
                      <td style={{ paddingRight: 24, textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedExpenseProject(p)}
                            style={{ padding: '6px 12px' }}
                            title="Financials"
                          >
                            <Calculator size={14} />
                          </button>
                          {stageIdx < stages.length - 1 && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={(e) => advanceStage(p, e)}
                              style={{ padding: '6px 12px' }}
                              title="Advance to next stage"
                            >
                              Advance <ChevronRight size={14} style={{ marginLeft: 4 }} />
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


      {/* Expenses & Calculator Modal */}
      <ExpenseModal
        isOpen={!!selectedExpenseProject}
        onClose={() => setSelectedExpenseProject(null)}
        project={selectedExpenseProject}
        onExpensesUpdated={loadProjects}
      />
    </div>
  );
}
