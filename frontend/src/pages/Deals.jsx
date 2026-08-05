import { useState, useEffect } from 'react';
import { Briefcase, Clock, DollarSign, Plus, CheckCircle, Car, Search, SearchX, ChevronLeft } from 'lucide-react';
import LeadModal from '../components/LeadModal';

// --- STATIC MOCK DATA ---
const MOCK_DEALS = [
  {
    id: '1',
    client_name: 'Max Mustermann',
    target_vehicle: 'Porsche 911 GT3 (992)',
    project_type: 'SELL',
    status: 'COMPLETED',
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    project_labor: [
      { id: 'l1', hours_spent: 2.5, activity_description: 'Initial consultation and valuation', logged_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'l2', hours_spent: 4.0, activity_description: 'Photography and listing creation', logged_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'l3', hours_spent: 1.5, activity_description: 'Handover and contract signing', logged_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    project_expenses: [
      { id: 'e1', amount: 150.00, expense_type: 'DETAILING', description: 'Pre-sale interior and exterior detailing', logged_at: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'e2', amount: 89.90, expense_type: 'TUEV_INSPECTION', description: 'TÜV renewal fee', logged_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString() }
    ]
  },
  {
    id: '2',
    client_name: 'Sarah Schmidt',
    target_vehicle: 'BMW M3 Competition',
    project_type: 'BUY',
    status: 'COMPLETED',
    updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    project_labor: [
      { id: 'l4', hours_spent: 3.0, activity_description: 'Market research and vehicle sourcing', logged_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString() },
      { id: 'l5', hours_spent: 2.0, activity_description: 'On-site vehicle inspection', logged_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    project_expenses: [
      { id: 'e3', amount: 250.00, expense_type: 'TRANSPORT', description: 'Vehicle transport from Munich to Berlin', logged_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }
    ]
  }
];

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export default function Deals() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [search, setSearch] = useState('');

  // Modals state
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  // Form states
  const [timeForm, setTimeForm] = useState({ hours: '', description: '' });
  const [expenseForm, setExpenseForm] = useState({ amount: '', description: '', expense_type: 'OTHER' });
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setDeals(MOCK_DEALS);
      setLoading(false);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleLogTime = (e) => {
    e.preventDefault();
    if (!selectedDeal) return;
    
    const newLabor = {
      id: Math.random().toString(),
      hours_spent: parseFloat(timeForm.hours),
      activity_description: timeForm.description,
      logged_at: new Date().toISOString()
    };
    
    const updatedDeal = {
      ...selectedDeal,
      project_labor: [newLabor, ...selectedDeal.project_labor]
    };
    
    const updatedDeals = deals.map(d => d.id === updatedDeal.id ? updatedDeal : d);
    
    setDeals(updatedDeals);
    setSelectedDeal(updatedDeal);
    setShowTimeModal(false);
    setTimeForm({ hours: '', description: '' });
  };

  const handleLogExpense = (e) => {
    e.preventDefault();
    if (!selectedDeal) return;

    const newExpense = {
      id: Math.random().toString(),
      amount: parseFloat(expenseForm.amount),
      description: expenseForm.description,
      expense_type: expenseForm.expense_type,
      logged_at: new Date().toISOString()
    };
    
    const updatedDeal = {
      ...selectedDeal,
      project_expenses: [newExpense, ...selectedDeal.project_expenses]
    };
    
    const updatedDeals = deals.map(d => d.id === updatedDeal.id ? updatedDeal : d);
    
    setDeals(updatedDeals);
    setSelectedDeal(updatedDeal);
    setShowExpenseModal(false);
    setExpenseForm({ amount: '', description: '', expense_type: 'OTHER' });
  };

  const calculateTotalTime = (laborArray) => {
    if (!laborArray) return 0;
    return laborArray.reduce((acc, curr) => acc + (parseFloat(curr.hours_spent) || 0), 0);
  };

  const calculateTotalExpenses = (expenseArray) => {
    if (!expenseArray) return 0;
    return expenseArray.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  };

  const filtered = deals.filter(d => 
    !search || 
    (d.client_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.target_vehicle || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Deals</h1>
          <p style={{ fontSize: '0.9rem' }}>Review completed projects, log post-sale labor, and track expenses.</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={() => setIsLeadModalOpen(true)} style={{ padding: '8px 16px' }}>
            <Plus size={16} /> New Deal
          </button>
        </div>
      </div>

      <div className={`split-panel deals-split-panel ${selectedDeal ? 'thread-active' : ''}`} style={{ flex: 1 }}>
        
        {/* LEFT: Deals List */}
        <div className="split-left" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <div className="search-bar" style={{ borderRadius: 9999, padding: '8px 16px', maxWidth: '100%' }}>
              <Search size={16} />
              <input 
                placeholder="Search deals..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto', width: 24, height: 24, borderWidth: 2 }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
                <SearchX size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <div style={{ fontWeight: 500, fontSize: '0.9rem' }}>No deals found</div>
              </div>
            ) : (
              filtered.map(deal => {
                const isSelected = selectedDeal?.id === deal.id;
                return (
                  <div 
                    key={deal.id} 
                    className={`contact-item ${isSelected ? 'active' : ''}`}
                    onClick={() => setSelectedDeal(deal)}
                    style={{ padding: '16px 20px', gap: 16 }}
                  >
                    <div style={{ 
                      width: 42, height: 42, borderRadius: '50%', 
                      background: 'linear-gradient(135deg, var(--gray-100), var(--gray-200))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.9rem', fontWeight: 700, color: 'var(--gray-600)',
                      flexShrink: 0
                    }}>
                      {getInitials(deal.client_name)}
                    </div>
                    <div className="contact-info">
                      <div className="contact-name" style={{ fontSize: '0.95rem', marginBottom: 2 }}>{deal.client_name}</div>
                      <div className="contact-preview" style={{ fontSize: '0.8rem' }}>{deal.target_vehicle || 'No vehicle specified'}</div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>
                      {new Date(deal.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Deal Details & Logging */}
        <div className="split-right">
          {selectedDeal ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              
              {/* Header */}
              <div className="thread-header deals-header-mobile" style={{ justifyContent: 'space-between', padding: '20px 28px', background: 'var(--surface)', borderBottom: '1px solid var(--gray-200)', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <button className="btn-icon show-on-mobile" style={{ marginRight: -4, padding: 4 }} onClick={() => setSelectedDeal(null)}>
                    <ChevronLeft size={20} />
                  </button>
                  <div className="deals-avatar-mobile" style={{ 
                    width: 52, height: 52, borderRadius: '50%', 
                    background: 'linear-gradient(135deg, var(--brand-100), var(--brand-200))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem', fontWeight: 700, color: 'var(--brand-700)',
                    flexShrink: 0
                  }}>
                    {getInitials(selectedDeal.client_name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3 className="deals-name-mobile" style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedDeal.client_name}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'flex-start', gap: 6, fontWeight: 500 }}>
                      <Car size={14} style={{ flexShrink: 0, marginTop: 2 }} /> 
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{selectedDeal.target_vehicle || 'Vehicle details missing'}</span>
                    </div>
                  </div>
                </div>
                <div className={`badge ${selectedDeal.project_type === 'BUY' ? 'badge-buy' : 'badge-sell'}`} style={{ padding: '6px 12px', fontSize: '0.75rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {selectedDeal.project_type} DEAL
                </div>
              </div>

              {/* Details Body */}
              <div className="deals-body-mobile" style={{ flex: 1, padding: '32px 28px', overflowY: 'auto', background: 'var(--gray-50)' }}>
                
                {/* Financials Overview */}
                <div className="grid-2" style={{ gap: 20, marginBottom: 32 }}>
                  <div className="stat-card" style={{ background: 'var(--surface)', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div className="stat-card-header">
                      <span className="stat-label" style={{ fontWeight: 600 }}>Total Labor Logged</span>
                      <div className="stat-icon purple" style={{ width: 40, height: 40 }}><Clock size={18} /></div>
                    </div>
                    <div className="stat-value" style={{ fontSize: '2rem' }}>{calculateTotalTime(selectedDeal.project_labor).toFixed(1)}h</div>
                  </div>
                  <div className="stat-card" style={{ background: 'var(--surface)', border: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                    <div className="stat-card-header">
                      <span className="stat-label" style={{ fontWeight: 600 }}>Total Expenses</span>
                      <div className="stat-icon amber" style={{ width: 40, height: 40 }}><DollarSign size={18} /></div>
                    </div>
                    <div className="stat-value" style={{ fontSize: '2rem' }}>€{calculateTotalExpenses(selectedDeal.project_expenses).toFixed(2)}</div>
                  </div>
                </div>

                {/* Details Lists */}
                <div className="grid-2" style={{ gap: 24 }}>
                  
                  {/* Labor Logs */}
                  <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Labor History</h4>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowTimeModal(true)}>
                        <Plus size={14} /> Log Time
                      </button>
                    </div>
                    {(!selectedDeal.project_labor || selectedDeal.project_labor.length === 0) ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No time logged.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {selectedDeal.project_labor.map(labor => (
                          <div key={labor.id} style={{ padding: 16, background: 'var(--gray-50)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-700)' }}>{labor.hours_spent} hours</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{new Date(labor.logged_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{labor.activity_description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Expense Logs */}
                  <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Expense History</h4>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowExpenseModal(true)}>
                        <Plus size={14} /> Log Expense
                      </button>
                    </div>
                    {(!selectedDeal.project_expenses || selectedDeal.project_expenses.length === 0) ? (
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No expenses logged.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {selectedDeal.project_expenses.map(expense => (
                          <div key={expense.id} style={{ padding: 16, background: 'var(--gray-50)', borderRadius: 8 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#d97706' }}>€{expense.amount.toFixed(2)}</span>
                              <span className="badge" style={{ fontSize: '0.65rem' }}>{expense.expense_type}</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{expense.description}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 8, fontWeight: 500 }}>{new Date(expense.logged_at).toLocaleDateString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Briefcase size={48} style={{ opacity: 0.2, marginBottom: 16 }} />
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No deal selected</div>
              <div style={{ fontSize: '0.9rem', marginTop: 4 }}>Select a deal to view details and log info.</div>
            </div>
          )}
        </div>
      </div>

      {/* Time Logging Modal */}
      {showTimeModal && (
        <div className="modal-overlay" onClick={() => setShowTimeModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Time</h3>
              <button className="btn-icon" onClick={() => setShowTimeModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLogTime} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Hours Spent</label>
                  <input 
                    type="number" 
                    step="0.1" 
                    min="0"
                    className="form-input" 
                    value={timeForm.hours}
                    onChange={e => setTimeForm({...timeForm, hours: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description of Activity</label>
                  <textarea 
                    className="form-textarea" 
                    value={timeForm.description}
                    onChange={e => setTimeForm({...timeForm, description: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTimeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Time</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Logging Modal */}
      {showExpenseModal && (
        <div className="modal-overlay" onClick={() => setShowExpenseModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Expense</h3>
              <button className="btn-icon" onClick={() => setShowExpenseModal(false)}>✕</button>
            </div>
            <form onSubmit={handleLogExpense} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Amount (€)</label>
                  <input 
                    type="number" 
                    step="0.01" 
                    min="0"
                    className="form-input" 
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Expense Type</label>
                  <select 
                    className="form-select"
                    value={expenseForm.expense_type}
                    onChange={e => setExpenseForm({...expenseForm, expense_type: e.target.value})}
                  >
                    <option value="OTHER">Other</option>
                    <option value="OIL_CHANGE">Oil Change</option>
                    <option value="PAYMENT_SLIP">Payment Slip</option>
                    <option value="TUEV_INSPECTION">TÜV Inspection</option>
                    <option value="DETAILING">Detailing</option>
                    <option value="TRANSPORT">Transport</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Description</label>
                  <textarea 
                    className="form-textarea" 
                    value={expenseForm.description}
                    onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <LeadModal
        isOpen={isLeadModalOpen}
        onClose={() => setIsLeadModalOpen(false)}
        onLeadCreated={() => setIsLeadModalOpen(false)}
      />
    </div>
  );
}
