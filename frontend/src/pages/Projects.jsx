import { useState, useEffect } from 'react';
import { FolderKanban, Plus, RefreshCw, Calculator, Car, CheckCircle, Clock, ChevronRight, Tag, Search, Banknote, User } from 'lucide-react';
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
          <button className="btn btn-primary" onClick={() => setIsLeadModalOpen(true)} style={{ padding: '8px 16px' }}>
            <Plus size={16} /> New Deal
          </button>
        </div>
      </div>

      {/* Pipeline Tabs */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexShrink: 0 }}>
        <button
          onClick={() => setTab('SELL')}
          style={{
            padding: '12px 24px', borderRadius: 'var(--radius-lg)', display: 'inline-flex', alignItems: 'center', gap: 10,
            background: tab === 'SELL' ? 'var(--brand-50)' : 'var(--surface)',
            border: `1px solid ${tab === 'SELL' ? 'var(--brand-500)' : 'var(--gray-200)'}`,
            boxShadow: tab === 'SELL' ? '0 4px 12px rgba(var(--brand-500-rgb), 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
            color: tab === 'SELL' ? 'var(--brand-700)' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Tag size={16} color={tab === 'SELL' ? 'var(--brand-600)' : 'var(--text-muted)'} />
          SELL SIDE — Vermittlung
        </button>
        <button
          onClick={() => setTab('BUY')}
          style={{
            padding: '12px 24px', borderRadius: 'var(--radius-lg)', display: 'inline-flex', alignItems: 'center', gap: 10,
            background: tab === 'BUY' ? 'var(--brand-50)' : 'var(--surface)',
            border: `1px solid ${tab === 'BUY' ? 'var(--brand-500)' : 'var(--gray-200)'}`,
            boxShadow: tab === 'BUY' ? '0 4px 12px rgba(var(--brand-500-rgb), 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
            color: tab === 'BUY' ? 'var(--brand-700)' : 'var(--text-secondary)',
            fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          <Search size={16} color={tab === 'BUY' ? 'var(--brand-600)' : 'var(--text-muted)'} />
          BUY SIDE — Beschaffung
        </button>
      </div>

      {/* Kanban Stages Board */}
      {loading ? (
        <div className="card" style={{ padding: 60, textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', width: 32, height: 32, borderWidth: 3 }} />
          <div style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Loading projects...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16, flex: 1, alignItems: 'flex-start' }}>
          {stages.map((stage, idx) => {
            const list = byStage(stage);
            return (
              <div key={stage} style={{ 
                minWidth: 320, flex: '0 0 320px', 
                background: 'var(--gray-50)', 
                borderRadius: 'var(--radius-lg)', 
                padding: '16px',
                display: 'flex', flexDirection: 'column',
                maxHeight: '100%',
                border: '1px solid var(--gray-200)'
              }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 16, paddingBottom: 12, borderBottom: '2px solid var(--gray-200)'
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-primary)' }}>
                    <span style={{ color: 'var(--brand-500)', marginRight: 4 }}>{idx + 1}.</span> {stage}
                  </span>
                  <span className="badge" style={{ background: 'var(--gray-200)', color: 'var(--text-primary)', fontWeight: 700 }}>
                    {list.length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', paddingRight: 4 }}>
                  {list.length === 0 ? (
                    <div style={{
                      border: '2px dashed var(--gray-300)', borderRadius: 'var(--radius)',
                      padding: '30px 20px', textAlign: 'center', fontSize: '0.8rem', color: 'var(--gray-400)',
                      fontWeight: 600
                    }}>
                      Empty Stage
                    </div>
                  ) : list.map(p => {
                    const totalExpenses = (p.project_expenses || []).reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
                    const totalLaborHours = (p.project_labor || []).reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
                    const laborCost = totalLaborHours * (p.hourly_rate || 20);
                    const totalInvestment = (p.purchase_price || 0) + totalExpenses + laborCost;
                    const netProfit = (p.agreed_sale_price || 0) - totalInvestment;

                    return (
                      <div key={p.id} className="card" style={{ padding: 16, border: '1px solid var(--gray-200)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <User size={14} color="var(--gray-400)" /> {p.client_name}
                            </div>
                            {p.target_vehicle && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Car size={14} color="var(--brand-500)" /> {p.target_vehicle}
                              </div>
                            )}
                          </div>
                        </div>

                        {p.vin && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: 12, padding: '4px 8px', background: 'var(--gray-50)', borderRadius: 4, display: 'inline-block' }}>
                            VIN: {p.vin}
                          </div>
                        )}

                        {/* Financial Mini Badge */}
                        <div style={{
                          background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2',
                          border: `1px solid ${netProfit >= 0 ? '#bbf7d0' : '#fecaca'}`,
                          borderRadius: 'var(--radius)',
                          padding: '8px 10px', fontSize: '0.75rem', display: 'flex',
                          justifyContent: 'space-between', alignItems: 'center', marginBottom: 12
                        }}>
                          <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Banknote size={14} /> Net Profit:
                          </span>
                          <strong style={{ color: netProfit >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '0.8rem' }}>
                            € {netProfit.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </strong>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ flex: 1, justifyContent: 'center', padding: '8px' }}
                            onClick={() => setSelectedExpenseProject(p)}
                          >
                            <Calculator size={14} /> Financials
                          </button>

                          {idx < stages.length - 1 && (
                            <button
                              className="btn btn-primary btn-sm"
                              title="Advance to next stage"
                              style={{ padding: '8px 12px' }}
                              onClick={(e) => advanceStage(p, e)}
                            >
                              <ChevronRight size={16} />
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
