import { useState } from 'react';
import { X, DollarSign, Plus, Trash2, Calculator, Save, CheckCircle2 } from 'lucide-react';
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
    <div className="modal-overlay">
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calculator size={18} color="var(--brand-600)" />
              Financials & Net Profit Calculator
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Project: <strong>{project.client_name}</strong> ({project.project_type})
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
          
          {/* Formula Display Panel */}
          <div style={{
            background: 'linear-gradient(135deg, #1e293b, #0f172a)',
            borderRadius: 'var(--radius-lg)',
            padding: 16, color: 'white', marginBottom: 20
          }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.8px', color: '#94a3b8', marginBottom: 12 }}>
              💶 Real-Time Financial Formula Summary
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Sale Price</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#38bdf8' }}>
                  € {salePrice ? parseFloat(salePrice).toLocaleString() : '0'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Total Expenses</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f43f5e' }}>
                  € {totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Labor ({totalLaborHours}h @ €{hourlyRate}/h)</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24' }}>
                  € {totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Net Broker Profit</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: netProfit >= 0 ? '#4ade80' : '#f43f5e' }}>
                  € {netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div className="form-group">
              <label className="form-label">Agreed Sale Price (€)</label>
              <input
                type="number"
                className="form-input"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Vehicle Purchase Price (€)</label>
              <input
                type="number"
                className="form-input"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Hourly Labor Rate (€/hr)</label>
              <input
                type="number"
                className="form-input"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
              />
            </div>
          </div>

          {/* Receipt Expenses Table & Form */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>🧾 Itemized Receipt Expenses</span>
              <span style={{ color: 'var(--text-muted)' }}>Total: €{totalExpenses.toFixed(2)}</span>
            </div>
            
            <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select className="form-select" style={{ width: 140 }} value={newExpType} onChange={e => setNewExpType(e.target.value)}>
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
                style={{ width: 100 }}
                value={newExpAmount}
                onChange={e => setNewExpAmount(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0 12px' }}>
                <Plus size={14} /> Add
              </button>
            </form>

            {expenses.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No expenses logged yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((exp, idx) => (
                      <tr key={exp.id || idx}>
                        <td><span className="badge badge-manual">{exp.expense_type}</span></td>
                        <td>{exp.description}</td>
                        <td style={{ fontWeight: 600 }}>€ {parseFloat(exp.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Labor Time Tracker */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span>⏱️ Broker Labor Hours Logged</span>
              <span style={{ color: 'var(--text-muted)' }}>Total: {totalLaborHours}h (€{totalLaborCost.toFixed(2)})</span>
            </div>

            <form onSubmit={handleLogLabor} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                type="number"
                step="0.5"
                className="form-input"
                placeholder="Hours e.g. 2.5"
                style={{ width: 110 }}
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
              <button type="submit" className="btn btn-secondary" style={{ padding: '0 12px' }}>
                <Plus size={14} /> Log Labor
              </button>
            </form>

            {laborLogs.length === 0 ? (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No labor hours logged yet.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Hours</th>
                      <th>Activity</th>
                      <th>Cost (@ €{hourlyRate}/h)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laborLogs.map((log, idx) => (
                      <tr key={log.id || idx}>
                        <td style={{ fontWeight: 600 }}>{log.hours_spent} hrs</td>
                        <td>{log.activity_description}</td>
                        <td>€ {(parseFloat(log.hours_spent) * hourlyRate).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleSaveProject}>
            <CheckCircle2 size={14} /> Save Financial Updates
          </button>
        </div>
      </div>
    </div>
  );
}
