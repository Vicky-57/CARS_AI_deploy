import { useState, useEffect } from 'react';
import { FolderKanban, Plus, RefreshCw, Calculator, Car, CheckCircle, Clock, ChevronRight } from 'lucide-react';
import { api } from '../api/api';
import LeadModal from '../components/LeadModal';
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

  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
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

  const byStage = (stageName) => projects.filter(p => (p.current_stage || stages[0]) === stageName);

  const advanceStage = async (project, e) => {
    e.stopPropagation();
    const currentIndex = stages.indexOf(project.current_stage);
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
    <div>
      {/* Header & Controls */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Dual Brokerage Pipelines</h1>
          <p>Manage active vehicle sales (Vermittlung) and procurement (Beschaffung)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={loadProjects}><RefreshCw size={14} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setIsLeadModalOpen(true)}><Plus size={14} /> Create New Deal / Lead</button>
        </div>
      </div>

      {/* Pipeline Tabs */}
      <div className="pipeline-tabs" style={{ marginBottom: 20 }}>
        <button
          className={`pipeline-tab ${tab === 'SELL' ? 'active' : ''}`}
          onClick={() => setTab('SELL')}
        >
          🏷️ SELL SIDE — Vermittlung (Vehicle Sale)
        </button>
        <button
          className={`pipeline-tab ${tab === 'BUY' ? 'active' : ''}`}
          onClick={() => setTab('BUY')}
        >
          🔍 BUY SIDE — Beschaffung (Procurement)
        </button>
      </div>

      {/* Kanban Stages Board */}
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 12px' }} />
          <div>Loading projects from Supabase...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 16 }}>
          {stages.map((stage, idx) => {
            const list = byStage(stage);
            return (
              <div key={stage} style={{ minWidth: 260, flex: '0 0 260px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 10, padding: '0 4px'
                }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-secondary)' }}>
                    {idx + 1}. {stage}
                  </span>
                  <span className="badge badge-manual">{list.length}</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {list.length === 0 ? (
                    <div style={{
                      border: '2px dashed var(--border)', borderRadius: 'var(--radius-lg)',
                      padding: 20, textAlign: 'center', fontSize: '0.72rem', color: 'var(--text-muted)',
                      background: 'var(--surface)'
                    }}>
                      No active projects
                    </div>
                  ) : list.map(p => {
                    const totalExpenses = (p.project_expenses || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                    const totalLaborHours = (p.project_labor || []).reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
                    const laborCost = totalLaborHours * (p.hourly_rate || 20);
                    const totalInvestment = (p.purchase_price || 0) + totalExpenses + laborCost;
                    const netProfit = (p.agreed_sale_price || 0) - totalInvestment;

                    return (
                      <div key={p.id} className="project-card" style={{ position: 'relative' }}>
                        <div className="project-card-header">
                          <div>
                            <div className="project-client">{p.client_name}</div>
                            {p.target_vehicle && (
                              <div className="project-vehicle">
                                <Car size={12} style={{ display: 'inline', marginRight: 4 }} />
                                {p.target_vehicle}
                              </div>
                            )}
                          </div>
                        </div>

                        {p.vin && (
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 8 }}>
                            VIN: {p.vin}
                          </div>
                        )}

                        {/* Financial Mini Badge */}
                        <div style={{
                          background: 'var(--gray-50)', borderRadius: 'var(--radius)',
                          padding: '6px 8px', fontSize: '0.72rem', display: 'flex',
                          justify: 'space-between', alignItems: 'center', marginBottom: 10
                        }}>
                          <span>Net Profit:</span>
                          <strong style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            € {netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </strong>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1 }}
                            onClick={() => setSelectedExpenseProject(p)}
                          >
                            <Calculator size={12} /> Financials
                          </button>

                          {idx < stages.length - 1 && (
                            <button
                              className="btn btn-primary btn-sm"
                              title="Advance to next stage"
                              onClick={(e) => advanceStage(p, e)}
                            >
                              <ChevronRight size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Lead Modal */}
      <LeadModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onLeadCreated={loadProjects}
      />

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
