import { useState, useEffect } from 'react';
import { Users, Plus, Search, RefreshCw, Mail, Phone, Car, Tag } from 'lucide-react';
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

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1>Lead Management</h1>
          <p>Inbound client inquiries from Email, WhatsApp, and Web Forms</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={14} /> New Lead (with OCR)
        </button>
      </div>

      {/* Filters & Search Bar */}
      <div className="filters-row">
        <div className="search-bar">
          <Search size={14} />
          <input
            placeholder="Search leads by name, email, or car model..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          <button
            className={`filter-chip ${intentFilter === '' ? 'active' : ''}`}
            onClick={() => setIntentFilter('')}
          >
            All Leads
          </button>
          <button
            className={`filter-chip ${intentFilter === 'SELL' ? 'active' : ''}`}
            onClick={() => setIntentFilter('SELL')}
          >
            🏷️ Sell Intent
          </button>
          <button
            className={`filter-chip ${intentFilter === 'BUY' ? 'active' : ''}`}
            onClick={() => setIntentFilter('BUY')}
          >
            🔍 Buy Intent
          </button>
        </div>

        <button className="btn btn-secondary btn-icon" onClick={loadLeads} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Leads Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">All Inquiries ({filtered.length})</span>
        </div>

        {loading ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto 12px' }} />
            <div>Loading leads from Supabase...</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <Users size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <h3>No leads found</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Click "+ New Lead" to create a record or upload a document to auto-fill.
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Client Name</th>
                  <th>Contact Info</th>
                  <th>Vehicle Requested / Owned</th>
                  <th>Pipeline Intent</th>
                  <th>Channel</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 600 }}>{lead.name || '—'}</td>
                    <td>
                      <div style={{ fontSize: '0.78rem' }}>{lead.email || '—'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lead.phone || ''}</div>
                    </td>
                    <td>
                      {lead.manufacturer || lead.model ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Car size={12} color="var(--brand-600)" />
                          <span>{lead.manufacturer} {lead.model}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                      {lead.vin && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
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
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
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
