import { useState } from 'react';
import { X, DollarSign, Plus, Calculator, Receipt, Clock, CheckCircle2 } from 'lucide-react';
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

  // Real-time calculation
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
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calculator size={18} />
              <span>Project Financials & Margin</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
              DocType: <strong>{project.client_name}</strong> &mdash; {project.project_type} ({project.target_vehicle || 'Vehicle'})
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* KPI Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div className="kpi-card">
              <div className="kpi-title">Sale Price</div>
              <div className="kpi-value" style={{ fontSize: '1.1rem' }}>
                €{salePrice ? parseFloat(salePrice).toLocaleString() : '0'}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Expenses</div>
              <div className="kpi-value" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                €{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-title">Labor Cost</div>
              <div className="kpi-value" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                €{totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="kpi-card" style={{ background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', borderColor: netProfit >= 0 ? '#bbf7d0' : '#fecaca' }}>
              <div className="kpi-title" style={{ color: netProfit >= 0 ? '#166534' : '#991b1b' }}>Net Profit</div>
              <div className="kpi-value" style={{ fontSize: '1.1rem', color: netProfit >= 0 ? '#166534' : '#991b1b' }}>
                €{netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          {/* Pricing Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, background: 'var(--bg-canvas)', padding: 12, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Agreed Sale Price (€)</label>
              <input
                type="number"
                className="form-input"
                value={salePrice}
                onChange={e => setSalePrice(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Vehicle Purchase Price (€)</label>
              <input
                type="number"
                className="form-input"
                value={purchasePrice}
                onChange={e => setPurchasePrice(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem' }}>Labor Rate (€/hr)</label>
              <input
                type="number"
                className="form-input"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
              />
            </div>
          </div>

          {/* Itemized Expenses Section */}
          <div className="card">
            <div className="card-header" style={{ justifyContent: 'space-between', padding: '8px 12px' }}>
              <span className="card-title" style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Receipt size={14} /> Itemized Receipts & Invoices
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Subtotal: €{totalExpenses.toFixed(2)}</span>
            </div>
            <div className="card-body" style={{ padding: 12 }}>
              <form onSubmit={handleAddExpense} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
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
                  placeholder="Receipt description…"
                  style={{ flex: 1 }}
                  value={newExpDesc}
                  onChange={e => setNewExpDesc(e.target.value)}
                />
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  placeholder="Amount €"
                  style={{ width: 95 }}
                  value={newExpAmount}
                  onChange={e => setNewExpAmount(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-sm"><Plus size={13} /> Add</button>
              </form>

              {expenses.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>No itemized expenses recorded.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {expenses.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.62rem' }}>{item.expense_type}</span>
                        <span>{item.description}</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>€{parseFloat(item.amount).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Labor Time Tracking */}
          <div className="card">
            <div className="card-header" style={{ justifyContent: 'space-between', padding: '8px 12px' }}>
              <span className="card-title" style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} /> Labor Hours Log
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total: {totalLaborHours.toFixed(1)}h (€{totalLaborCost.toFixed(2)})</span>
            </div>
            <div className="card-body" style={{ padding: 12 }}>
              <form onSubmit={handleLogLabor} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  placeholder="Hours"
                  style={{ width: 80 }}
                  value={newLaborHours}
                  onChange={e => setNewLaborHours(e.target.value)}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Work activity description…"
                  style={{ flex: 1 }}
                  value={newLaborDesc}
                  onChange={e => setNewLaborDesc(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-sm"><Plus size={13} /> Log</button>
              </form>

              {laborLogs.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>No labor logged.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {laborLogs.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem' }}>
                      <span>{item.activity_description}</span>
                      <span style={{ fontWeight: 600 }}>{item.hours_spent}h</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveProject}>
            <CheckCircle2 size={13} /> Save Calculations
          </button>
        </div>
      </div>
    </div>
  );
}
