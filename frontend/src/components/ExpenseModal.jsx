import { useState } from 'react';
import { X, DollarSign, Plus, Calculator, CheckCircle2, Receipt, Clock } from 'lucide-react';
import { api } from '../api/api';

export default function ExpenseModal({ isOpen, onClose, project, onExpensesUpdated }) {
  const [purchasePrice, setPurchasePrice] = useState(project?.purchase_price || 0);
  const [salePrice, setSalePrice] = useState(project?.agreed_sale_price || 0);
  const [hourlyRate, setHourlyRate] = useState(project?.hourly_rate || 20);

  const [expenses, setExpenses] = useState(project?.project_expenses || []);
  const [laborLogs, setLaborLogs] = useState(project?.project_labor || []);

  const [newExpDesc, setNewExpDesc] = useState('');
  const [newExpAmount, setNewExpAmount] = useState('');
  const [newExpType, setNewExpType] = useState('OTHER');

  const [newLaborHours, setNewLaborHours] = useState('');
  const [newLaborDesc, setNewLaborDesc] = useState('');

  if (!isOpen || !project) return null;

  // Calculate formula values in real-time
  const totalExpenses = expenses.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const totalLaborHours = laborLogs.reduce((sum, item) => sum + (parseFloat(item.hours_spent) || 0), 0);
  const totalLaborCost = totalLaborHours * (parseFloat(hourlyRate) || 20);
  const totalInvestment = (parseFloat(purchasePrice) || 0) + totalExpenses + totalLaborCost;
  const netProfit = (parseFloat(salePrice) || 0) - totalInvestment;

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpAmount || !newExpDesc) return;
    try {
      const added = await api.addExpense(project.id, {
        description: newExpDesc,
        amount: parseFloat(newExpAmount),
        expense_type: newExpType,
      });
      setExpenses([...expenses, added]);
      setNewExpDesc('');
      setNewExpAmount('');
    } catch (err) {
      alert('Error adding expense: ' + err.message);
    }
  };

  const handleLogLabor = async (e) => {
    e.preventDefault();
    if (!newLaborHours || !newLaborDesc) return;
    try {
      const logged = await api.logLabor(
        project.id,
        parseFloat(newLaborHours),
        newLaborDesc
      );
      setLaborLogs([...laborLogs, logged]);
      setNewLaborHours('');
      setNewLaborDesc('');
    } catch (err) {
      alert('Error logging labor: ' + err.message);
    }
  };

  const handleSaveProject = async () => {
    try {
      await api.updateProject(project.id, {
        purchase_price: parseFloat(purchasePrice) || 0,
        agreed_sale_price: parseFloat(salePrice) || 0,
        hourly_rate: parseFloat(hourlyRate) || 20,
      });
      if (onExpensesUpdated) onExpensesUpdated();
      onClose();
    } catch (err) {
      alert('Failed to save project updates: ' + err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 780, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ background: 'var(--brand-50)', padding: 6, borderRadius: 8 }}>
                <Calculator size={18} color="var(--brand-600)" />
              </div>
              Financials & Net Profit Calculator
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Project: <strong style={{ color: 'var(--text-primary)' }}>{project.client_name}</strong> ({project.project_type})
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24, padding: 24 }}>
          
          {/* Formula Display Panel */}
          <div style={{
            background: 'var(--gray-900)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 24px', color: 'white',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--gray-400)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={14} /> Real-Time Financial Summary
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>Sale Price</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'white' }}>
                  € {salePrice ? parseFloat(salePrice).toLocaleString() : '0'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>Total Expenses</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fca5a5' }}>
                  € {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>Labor Cost</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fcd34d' }}>
                  € {totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ borderLeft: '1px solid var(--gray-700)', paddingLeft: 16 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--gray-400)', marginBottom: 4 }}>Net Broker Profit</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: netProfit >= 0 ? '#4ade80' : '#f87171' }}>
                  € {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Agreed Sale Price (€)</label>
              <input
                type="number"
                className="form-input"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
                style={{ height: 40 }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Vehicle Purchase Price (€)</label>
              <input
                type="number"
                className="form-input"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
                style={{ height: 40 }}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Hourly Labor Rate (€/hr)</label>
              <input
                type="number"
                className="form-input"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
                style={{ height: 40 }}
              />
            </div>
          </div>

          {/* Grid for Expenses & Labor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
            {/* Receipt Expenses */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Receipt size={16} color="var(--brand-500)" /> Itemized Receipt Expenses</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total: €{totalExpenses.toFixed(2)}</span>
              </div>
              
              <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <select className="form-select" style={{ width: 150 }} value={newExpType} onChange={e => setNewExpType(e.target.value)}>
                  <option value="TUEV_INSPECTION">TÜV Inspection</option>
                  <option value="DETAILING">Detailing</option>
                  <option value="OIL_CHANGE">Oil Change</option>
                  <option value="TRANSPORT">Transport</option>
                  <option value="PAYMENT_SLIP">Payment Slip</option>
                  <option value="ADMIN">Admin</option>
                  <option value="OTHER">Other</option>
                </select>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Description e.g. TÜV Rheinland Fee"
                  style={{ flex: 1 }}
                  value={newExpDesc}
                  onChange={e => setNewExpDesc(e.target.value)}
                />
                <input
                  type="number"
                  className="form-input"
                  placeholder="Amount €"
                  style={{ width: 110 }}
                  value={newExpAmount}
                  onChange={e => setNewExpAmount(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0 16px' }}>
                  <Plus size={16} /> Add
                </button>
              </form>

              {expenses.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', background: 'var(--gray-50)', borderRadius: 8 }}>No expenses logged yet.</div>
              ) : (
                <div className="table-wrap" style={{ margin: 0 }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Description</th>
                        <th style={{ textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenses.map((exp, idx) => (
                        <tr key={exp.id || idx}>
                          <td><span className="badge" style={{ background: 'var(--gray-200)', color: 'var(--text-primary)' }}>{exp.expense_type}</span></td>
                          <td>{exp.description}</td>
                          <td style={{ fontWeight: 600, textAlign: 'right' }}>€ {parseFloat(exp.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Labor Tracker */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={16} color="var(--brand-500)" /> Broker Labor Hours Logged</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total: {totalLaborHours}h (€{totalLaborCost.toFixed(2)})</span>
              </div>

              <form onSubmit={handleLogLabor} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  type="number"
                  step="0.5"
                  className="form-input"
                  placeholder="Hours e.g. 2.5"
                  style={{ width: 120 }}
                  value={newLaborHours}
                  onChange={e => setNewLaborHours(e.target.value)}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Activity e.g. Vehicle Inspection & Handover"
                  style={{ flex: 1 }}
                  value={newLaborDesc}
                  onChange={e => setNewLaborDesc(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary" style={{ padding: '0 16px' }}>
                  <Plus size={16} /> Log
                </button>
              </form>

              {laborLogs.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0', background: 'var(--gray-50)', borderRadius: 8 }}>No labor hours logged yet.</div>
              ) : (
                <div className="table-wrap" style={{ margin: 0 }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Hours</th>
                        <th>Activity</th>
                        <th style={{ textAlign: 'right' }}>Cost (@ €{hourlyRate}/h)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {laborLogs.map((log, idx) => (
                        <tr key={log.id || idx}>
                          <td style={{ fontWeight: 600 }}>{log.hours_spent} hrs</td>
                          <td>{log.activity_description}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500 }}>€ {(parseFloat(log.hours_spent) * hourlyRate).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="modal-footer" style={{ background: 'var(--surface)', padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleSaveProject} style={{ padding: '8px 20px' }}>
            <CheckCircle2 size={16} /> Save Financial Updates
          </button>
        </div>
      </div>
    </div>
  );
}
