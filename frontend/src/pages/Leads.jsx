import { useState, useEffect, useMemo } from 'react';
import { Users, Search, Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';

const CHANNELS = ['ALL', 'EMAIL', 'WHATSAPP', 'MANUAL'];
const INTENTS = ['ALL', 'BUY', 'SELL', 'UNKNOWN'];

function NewLeadModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', channel: 'MANUAL', intent: 'UNKNOWN', message: '' });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await api.createLead(form);
      onCreated();
      onClose();
    } catch (e) {
      alert('Error: ' + e.message);
    } finally { setSaving(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New Lead</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="Max Mustermann" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+49 151 …" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="max@example.de" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Channel</label>
              <select className="form-select" value={form.channel} onChange={e => set('channel', e.target.value)}>
                <option>EMAIL</option><option>WHATSAPP</option><option>MANUAL</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Intent</label>
              <select className="form-select" value={form.intent} onChange={e => set('intent', e.target.value)}>
                <option>BUY</option><option>SELL</option><option>UNKNOWN</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Initial Message</label>
            <textarea className="form-textarea" value={form.message} onChange={e => set('message', e.target.value)} placeholder="What did the customer say?" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>
            {saving ? 'Saving…' : 'Create Lead'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState('ALL');
  const [intent, setIntent] = useState('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ col: 'created_at', dir: 'desc' });
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setLeads(await api.getLeads({ limit: 200 })); }
    catch { setLeads([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let l = leads;
    if (channel !== 'ALL') l = l.filter(x => x.channel === channel);
    if (intent !== 'ALL') l = l.filter(x => x.intent === intent);
    if (search) {
      const s = search.toLowerCase();
      l = l.filter(x => (x.name || '').toLowerCase().includes(s) || (x.email || '').toLowerCase().includes(s) || (x.phone || '').includes(s));
    }
    return [...l].sort((a, b) => {
      const va = a[sort.col] || '';
      const vb = b[sort.col] || '';
      return sort.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }, [leads, channel, intent, search, sort]);

  const toggleSort = (col) => setSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));

  const Th = ({ col, children }) => (
    <th onClick={() => toggleSort(col)} style={{ position: 'relative' }}>
      {children}
      {sort.col === col && (sort.dir === 'asc' ? <ChevronUp size={12} style={{ display: 'inline', marginLeft: 2 }} /> : <ChevronDown size={12} style={{ display: 'inline', marginLeft: 2 }} />)}
    </th>
  );

  const badge = (type, val) => {
    if (type === 'intent') {
      if (val === 'BUY') return <span className="badge badge-buy">Buy</span>;
      if (val === 'SELL') return <span className="badge badge-sell">Sell</span>;
      return <span className="badge badge-new">Unknown</span>;
    }
    if (val === 'WHATSAPP') return <span className="badge badge-whatsapp">WhatsApp</span>;
    if (val === 'EMAIL') return <span className="badge badge-email">Email</span>;
    return <span className="badge badge-manual">Manual</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Leads</h1>
          <p>Inbound contacts from Email, WhatsApp, and manual entry.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> New Lead
        </button>
      </div>

      <div className="filters-row">
        <div className="search-bar">
          <Search size={14} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone…" />
        </div>
        {CHANNELS.map(c => (
          <button key={c} className={`filter-chip${channel === c ? ' active' : ''}`} onClick={() => setChannel(c)}>
            {c === 'ALL' ? 'All Channels' : c}
          </button>
        ))}
        <span style={{ color: 'var(--border)', fontSize: '1.2rem' }}>|</span>
        {INTENTS.map(i => (
          <button key={i} className={`filter-chip${intent === i ? ' active' : ''}`} onClick={() => setIntent(i)}>
            {i === 'ALL' ? 'All Intents' : i}
          </button>
        ))}
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /><span>Loading leads…</span></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users size={32} />
            <h3>No leads found</h3>
            <p>Adjust filters or add a new lead manually.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <Th col="name">Name</Th>
                <Th col="channel">Channel</Th>
                <Th col="intent">Intent</Th>
                <th>Contact</th>
                <Th col="status">Status</Th>
                <Th col="created_at">Date</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(lead => (
                <tr key={lead.id}>
                  <td style={{ fontWeight: 600 }}>{lead.name || '—'}</td>
                  <td>{badge('channel', lead.channel)}</td>
                  <td>{badge('intent', lead.intent)}</td>
                  <td style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {lead.email || lead.phone || '—'}
                  </td>
                  <td>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 500,
                      color: lead.status === 'NEW' ? 'var(--warning)' : lead.status === 'CONVERTED' ? 'var(--success)' : 'var(--text-secondary)'
                    }}>{lead.status}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                    {lead.created_at ? format(new Date(lead.created_at), 'dd.MM.yy HH:mm') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showNew && <NewLeadModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}
