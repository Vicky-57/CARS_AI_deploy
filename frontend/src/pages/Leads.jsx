import { useState, useEffect } from 'react';
import { Users, Plus, Search, RefreshCw } from 'lucide-react';
import { api } from '../api/api';

const PIPELINE_OPTS = ['', 'sell', 'buy'];
const INTENT_OPTS   = ['', 'BUY_INTENT', 'SELL_INTENT', 'UNKNOWN'];

export default function Leads() {
  const [leads, setLeads]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [pipeline, setPipeline] = useState('');
  const [search, setSearch]   = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', mobile_no: '',
    custom_client_intent: '', custom_pipeline_type: '', source: 'Manual',
  });

  const load = async () => {
    setLoading(true);
    try {
      const filters = pipeline ? { custom_pipeline_type: pipeline } : {};
      const data = await api.getLeads(filters);
      setLeads(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [pipeline]);

  const filtered = leads.filter(l => {
    const name = `${l.first_name || ''} ${l.last_name || ''}`.toLowerCase();
    return !search || name.includes(search.toLowerCase()) || (l.email || '').includes(search.toLowerCase());
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.createLead(form);
      setShowForm(false);
      setForm({ first_name: '', last_name: '', email: '', mobile_no: '',
                custom_client_intent: '', custom_pipeline_type: '', source: 'Manual' });
      load();
    } catch (err) {
      alert('Error creating lead: ' + err.message);
    }
  };

  const intentBadge = (i) => {
    if (i === 'BUY_INTENT')  return <span className="badge badge-buy">Buy</span>;
    if (i === 'SELL_INTENT') return <span className="badge badge-sell">Sell</span>;
    return <span className="badge badge-new">—</span>;
  };

  const pipelineBadge = (p) => {
    if (p === 'sell') return <span className="badge badge-sell">Sell</span>;
    if (p === 'buy')  return <span className="badge badge-buy">Buy</span>;
    return <span className="badge badge-new">Unset</span>;
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="card-header" style={{ marginBottom: 16, background: 'none', padding: 0 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: 28, width: 220 }}
              placeholder="Search name or email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="input" value={pipeline} onChange={e => setPipeline(e.target.value)} style={{ width: 140 }}>
            <option value="">All Pipelines</option>
            <option value="sell">Sell (Vermittlung)</option>
            <option value="buy">Buy (Beschaffung)</option>
          </select>
          <button className="btn-ghost" onClick={load}><RefreshCw size={14} /></button>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={14} /> New Lead
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">Create Lead</span>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>✕</button>
          </div>
          <form className="card-body" onSubmit={handleCreate}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input className="input" required value={form.first_name}
                  onChange={e => setForm({...form, first_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name</label>
                <input className="input" value={form.last_name}
                  onChange={e => setForm({...form, last_name: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input className="input" type="email" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input className="input" value={form.mobile_no}
                  onChange={e => setForm({...form, mobile_no: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Pipeline</label>
                <select className="input" value={form.custom_pipeline_type}
                  onChange={e => setForm({...form, custom_pipeline_type: e.target.value})}>
                  <option value="">Unknown</option>
                  <option value="sell">Sell (Vermittlung)</option>
                  <option value="buy">Buy (Beschaffung)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Intent</label>
                <select className="input" value={form.custom_client_intent}
                  onChange={e => setForm({...form, custom_client_intent: e.target.value})}>
                  <option value="">Unknown</option>
                  <option value="SELL_INTENT">Sell Intent</option>
                  <option value="BUY_INTENT">Buy Intent</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button type="submit" className="btn-primary">Create Lead</button>
              <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Leads <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>({filtered.length})</span></span>
        </div>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <h3>No leads found</h3>
            <p>Leads arrive automatically from Email (W1) and WhatsApp (W2).</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Pipeline</th>
                <th>Intent</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.name}>
                  <td style={{ fontWeight: 500 }}>
                    {`${l.first_name || ''} ${l.last_name || ''}`.trim() || '—'}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{l.email || '—'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>{l.mobile_no || '—'}</td>
                  <td>{pipelineBadge(l.custom_pipeline_type)}</td>
                  <td>{intentBadge(l.custom_client_intent)}</td>
                  <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{l.source || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
