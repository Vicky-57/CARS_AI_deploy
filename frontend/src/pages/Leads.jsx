import { useState, useEffect } from 'react';
import { Users, Plus, Search, RefreshCw, Mail, Phone, Car, Tag, ShoppingCart } from 'lucide-react';
import { api } from '../api/api';
import LeadModal from '../components/LeadModal';

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const filters = intentFilter ? { intent: intentFilter } : {};
      const data = await api.getLeads(filters);
      setLeads(data || []);
    } catch (err) {
      console.error('Failed to load leads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeads();

    // Subscribe to realtime changes in Supabase!
    const sub = api.subscribeToLeads(() => {
      loadLeads();
    });
    return () => {
      if (sub) sub.unsubscribe();
    };
  }, [intentFilter]);

  const filtered = leads.filter(l => {
    const query = search.toLowerCase();
    const name = (l.name || '').toLowerCase();
    const email = (l.email || '').toLowerCase();
    const vehicle = `${l.manufacturer || ''} ${l.model || ''}`.toLowerCase();
    return !search || name.includes(query) || email.includes(query) || vehicle.includes(query);
  });

  const intentBadge = (i) => {
    if (i === 'BUY' || i === 'BUY_INTENT') return <span className="badge badge-buy">Buy Intent</span>;
    if (i === 'SELL' || i === 'SELL_INTENT') return <span className="badge badge-sell">Sell Intent</span>;
    return <span className="badge badge-new">New</span>;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Lead Management</h1>
          <p style={{ fontSize: '0.9rem' }}>Inbound client inquiries from Email, WhatsApp, and Web Forms</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '10px 16px' }}>
          <Plus size={16} /> New Lead (with OCR)
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="filters-row" style={{ gap: 16, marginBottom: 24 }}>
        <div className="search-bar" style={{ maxWidth: 280, padding: '6px 12px', borderRadius: 9999 }}>
          <Search size={14} />
          <input
            placeholder="Search leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: '0.8rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className={`filter-chip ${intentFilter === '' ? 'active' : ''}`}
            onClick={() => setIntentFilter('')}
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={14} /> All Leads
          </button>
          <button
            className={`filter-chip ${intentFilter === 'SELL' ? 'active' : ''}`}
            onClick={() => setIntentFilter('SELL')}
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Tag size={14} /> Sell Intent
          </button>
          <button
            className={`filter-chip ${intentFilter === 'BUY' ? 'active' : ''}`}
            onClick={() => setIntentFilter('BUY')}
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ShoppingCart size={14} /> Buy Intent
          </button>
        </div>

        <button className="btn btn-secondary btn-icon" onClick={loadLeads} style={{ marginLeft: 'auto', padding: '10px' }} title="Refresh leads">
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Leads Table */}
      <div className="card" style={{ border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
        <div className="card-header" style={{ padding: '20px 24px' }}>
          <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>All Inquiries ({filtered.length})</span>
        </div>

        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 60 }}>
            <div className="spinner" style={{ margin: '0 auto 16px', width: 28, height: 28, borderWidth: 3 }} />
            <div style={{ color: 'var(--text-muted)' }}>Loading leads from Supabase...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 80 }}>
            <div style={{ width: 64, height: 64, background: 'var(--gray-50)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Users size={32} color="var(--gray-400)" />
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>No leads found</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: 300, margin: '0 auto' }}>
              Click "+ New Lead" to create a record or upload a document to auto-fill.
            </p>
          </div>
        ) : (
          <div className="table-wrap" style={{ border: 'none', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)', boxShadow: 'none' }}>
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24, paddingTop: 16, paddingBottom: 16 }}>Client</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Vehicle Requested / Owned</th>
                  <th>Pipeline Intent</th>
                  <th>Channel</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ paddingLeft: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                          width: 40, height: 40, borderRadius: '50%', 
                          background: 'linear-gradient(135deg, var(--gray-100), var(--gray-200))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.85rem', fontWeight: 700, color: 'var(--gray-600)'
                        }}>
                          {getInitials(lead.name || lead.email)}
                        </div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{lead.name || 'Unknown Lead'}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                        <Mail size={12} color="var(--text-muted)" />
                        {lead.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem' }}>
                        <Phone size={12} color="var(--text-muted)" />
                        {lead.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      {lead.manufacturer || lead.model ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                          <Car size={14} color="var(--brand-600)" />
                          <span>{lead.manufacturer} {lead.model}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                      {lead.vin && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 4 }}>
                          VIN: {lead.vin}
                        </div>
                      )}
                    </td>
                    <td>{intentBadge(lead.intent)}</td>
                    <td>
                      <span className={`badge ${lead.channel === 'WHATSAPP' ? 'badge-whatsapp' : lead.channel === 'EMAIL' ? 'badge-email' : 'badge-manual'}`}>
                        {lead.channel || 'Manual'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {lead.created_at ? new Date(lead.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onLeadCreated={loadLeads}
      />
    </div>
  );
}
