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

      {/* Folder Tabs */}
      <div style={{ display: 'flex', paddingLeft: 0, position: 'relative', zIndex: 10, marginBottom: 0 }}>
        {[
          { id: '', label: 'All Inquiries', icon: Users },
          { id: 'SELL', label: 'Sell Intent', icon: Tag },
          { id: 'BUY', label: 'Buy Intent', icon: ShoppingCart }
        ].map((tab) => {
          const isActive = intentFilter === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setIntentFilter(tab.id)}
              className="customer-tab-btn"
              style={{
                background: isActive ? 'var(--surface)' : 'transparent',
                border: 'none',
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                color: isActive ? 'var(--brand-600)' : 'var(--text-secondary)',
                fontWeight: isActive ? 700 : 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                position: 'relative',
                zIndex: isActive ? 2 : 1,
                boxShadow: isActive ? '0 -4px 6px -4px rgba(0,0,0,0.05)' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Leads Table */}
      <div className="card" style={{ border: 'none', borderTopLeftRadius: intentFilter === '' ? 0 : 16, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
        <div className="card-header customers-header-mobile" style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>Inquiries ({filtered.length})</span>

          <div className="customers-actions-mobile" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="search-bar customers-search-mobile" style={{ padding: '4px 12px', borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <Search size={14} color="var(--text-muted)" />
              <input
                placeholder="Search leads..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontSize: '0.85rem', border: 'none', background: 'transparent', outline: 'none', marginLeft: 8, width: '100%', minWidth: 0 }}
              />
            </div>
            <button className="btn btn-secondary btn-icon" onClick={loadLeads} style={{ padding: '6px', borderRadius: '50%' }} title="Refresh leads">
              <RefreshCw size={14} />
            </button>
          </div>
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
