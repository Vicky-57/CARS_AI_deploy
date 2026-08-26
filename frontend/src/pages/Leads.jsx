import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Search, RefreshCw, Mail, Phone, Car, Tag, ShoppingCart, Sparkles } from 'lucide-react';
import { api } from '../api/api';
import LeadModal from '../components/LeadModal';

function getLeadVehicleDisplay(lead) {
  if (lead.vehicle_interest) return lead.vehicle_interest;
  if (lead.vehicle) return lead.vehicle;
  if (lead.manufacturer || lead.model) return `${lead.manufacturer || ''} ${lead.model || ''}`.trim();

  // Smart extraction from subject, message, or notes
  const text = `${lead.subject || ''} ${lead.message || ''} ${lead.notes || ''}`;
  const carMatch = text.match(/(Porsche\s+[\w\d\.\s\(\)\-]+|BMW\s+[\w\d\.\s\-]+|Audi\s+[\w\d\.\s\-]+|Mercedes-?Benz?\s+[\w\d\.\s\-]+|VW\s+[\w\d\.\s\-]+|Volkswagen\s+[\w\d\.\s\-]+)/i);
  if (carMatch) {
    return carMatch[0].split('\n')[0].split('-')[0].trim().slice(0, 35);
  }

  return null;
}

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [intentFilter, setIntentFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [convertingId, setConvertingId] = useState(null);

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

  const handleConvertLeadToProject = async (lead) => {
    setConvertingId(lead.id);
    try {
      const vehicleName = getLeadVehicleDisplay(lead) || 'Vehicle TBD';
      const pType = (lead.intent || '').toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
      
      // 1. Create project in projects table
      await api.createProject({
        client_name: lead.name || 'Client Lead',
        client_email: lead.email,
        client_phone: lead.phone,
        project_type: pType,
        target_vehicle: vehicleName,
        vin: lead.vin,
        status: 'ACTIVE',
        current_stage: 'Intake & Onboarding',
        notes: lead.notes || lead.message || `Converted from Lead ID ${lead.id}`
      });

      // 2. Remove converted lead from leads table so client officially moves to Customers & Projects
      await api.deleteLead(lead.id).catch(() => {});

      alert(`Successfully converted ${lead.name || 'Lead'} into an official Client & active Project!`);
      navigate('/projects');
    } catch (err) {
      alert('Failed to convert lead to project: ' + err.message);
    } finally {
      setConvertingId(null);
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

  const intentBadge = (l) => {
    const i = l.intent || '';
    const notes = l.notes || '';
    const isRepeat = notes.includes('REPEAT CLIENT') || notes.includes('Repeat Client');
    const isFollowup = notes.includes('Follow-up Message');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
        {i === 'BUY' || i === 'BUY_INTENT' ? (
          <span className="badge badge-buy">Buy Intent</span>
        ) : i === 'SELL' || i === 'SELL_INTENT' ? (
          <span className="badge badge-sell">Sell Intent</span>
        ) : (
          <span className="badge badge-new">New Inquiry</span>
        )}
        {isRepeat && (
          <span className="badge" style={{ background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 }}>
            ⭐ Repeat Client
          </span>
        )}
        {isFollowup && (
          <span className="badge" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.3)', fontWeight: 600 }}>
            ✨ New Activity
          </span>
        )}
      </div>
    );
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
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a', margin: '0 0 6px 0' }}>Lead Management</h1>
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
                  <th>Contact Info</th>
                  <th>Vehicle</th>
                  <th>Pipeline Intent</th>
                  <th>Channel</th>
                  <th>Created</th>
                  <th style={{ textAlign: 'right', paddingRight: 24 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
                  <tr key={lead.id} style={{ transition: 'background-color 0.2s', cursor: 'pointer' }}>
                    <td style={{ paddingLeft: 24, paddingVertical: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div className="notranslate" style={{
                          width: 44, height: 44, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #fff3ec, #ffe4d6)',
                          border: '1px solid #fed7aa',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.9rem', fontWeight: 800, color: '#ea580c',
                          boxShadow: '0 2px 8px rgba(234, 88, 12, 0.1)', flexShrink: 0
                        }}>
                          {getInitials(lead.name || lead.email)}
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{lead.name || 'Unknown Lead'}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                          <Mail size={14} color="#f47c3c" flexShrink={0} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {lead.email || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
                          <Phone size={14} color="#f47c3c" flexShrink={0} />
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>
                            {lead.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {(() => {
                        const vDisplay = getLeadVehicleDisplay(lead);
                        return vDisplay ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: '#1a1a1a' }}>
                            <Car size={16} color="#f47c3c" />
                            <span>{vDisplay}</span>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        );
                      })()}
                      {lead.vin && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 6, fontWeight: 500 }}>
                          VIN: {lead.vin}
                        </div>
                      )}
                    </td>
                    <td>{intentBadge(lead)}</td>
                    <td>
                      <span className={`badge ${lead.channel === 'WHATSAPP' ? 'badge-whatsapp' : lead.channel === 'EMAIL' ? 'badge-email' : 'badge-manual'}`}>
                        {lead.channel || 'Manual'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {lead.created_at ? (() => {
                        const d = new Date(lead.created_at);
                        const day = String(d.getDate()).padStart(2, '0');
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        return `${day}/${month}/${d.getFullYear()}`;
                      })() : '—'}
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 24 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleConvertLeadToProject(lead)}
                        disabled={convertingId === lead.id}
                        style={{ padding: '6px 12px', fontSize: '0.78rem', gap: 6 }}
                      >
                        <Sparkles size={13} /> Convert to Project
                      </button>
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
