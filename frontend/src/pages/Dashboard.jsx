import { useState, useEffect } from 'react';
import {
  Users, FolderKanban, MessageSquare, Calendar,
  ArrowUpRight, Clock, TrendingUp, FileText, AlertTriangle, CheckCircle, ChevronRight
} from 'lucide-react';
import { api } from '../api/api';
import { format, formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [summary, setSummary]   = useState(null);
  const [leads, setLeads]       = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [summaryRes, leadsRes, meetingsRes] = await Promise.allSettled([
          api.getPipelineSummary(),
          api.getLeads({}, 5),
          api.getMeetings({}, 5),
        ]);

        if (summaryRes.status === 'fulfilled')  setSummary(summaryRes.value);
        if (leadsRes.status   === 'fulfilled')  setLeads(leadsRes.value.slice(0, 5));
        if (meetingsRes.status === 'fulfilled') setMeetings(meetingsRes.value.slice(0, 4));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const stats = summary ? [
    {
      label: 'New Leads (24h)',
      value: summary.new_leads_24h,
      icon: Users,
      color: 'blue',
      sub: '+12% from yesterday',
      trend: 'up'
    },
    {
      label: 'Active SELL Deals',
      value: summary.active_sell_deals,
      icon: TrendingUp,
      color: 'green',
      sub: 'In Vermittlung pipeline',
      trend: 'neutral'
    },
    {
      label: 'Active BUY Deals',
      value: summary.active_buy_deals,
      icon: FolderKanban,
      color: 'purple',
      sub: 'In Beschaffung pipeline',
      trend: 'neutral'
    },
    {
      label: 'Total Active Projects',
      value: (summary.active_sell_deals || 0) + (summary.active_buy_deals || 0),
      icon: FileText,
      color: 'amber',
      sub: 'Across all pipelines',
      trend: 'neutral'
    },
  ] : [
    { label: 'New Leads (24h)',    value: '—', icon: Users,      color: 'blue',   sub: '' },
    { label: 'Active SELL Deals',  value: '—', icon: TrendingUp, color: 'green',  sub: '' },
    { label: 'Active BUY Deals',   value: '—', icon: FolderKanban, color: 'purple', sub: '' },
    { label: 'Total Active Projects', value: '—', icon: FileText,   color: 'amber',  sub: '' },
  ];

  const intentBadge = (intent) => {
    if (intent === 'BUY_INTENT' || intent === 'BUY')  return <span className="badge badge-buy">Buy</span>;
    if (intent === 'SELL_INTENT' || intent === 'SELL') return <span className="badge badge-sell">Sell</span>;
    return <span className="badge badge-new">New</span>;
  };

  const formatTime = (iso) => {
    try { return format(new Date(iso), 'HH:mm'); } catch { return ''; }
  };

  const timeAgo = (iso) => {
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ''; }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ alignItems: 'flex-end' }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Overview</h1>
          <p style={{ fontSize: '0.9rem' }}>Here's what's happening in your brokerage today.</p>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {format(new Date(), 'EEEE, MMMM do, yyyy')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ gap: 20, marginBottom: 32 }}>
        {stats.map(({ label, value, icon: Icon, color, sub, trend }) => (
          <div key={label} className="stat-card" style={{ padding: '24px' }}>
            <div className="stat-card-header" style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className={`stat-icon ${color}`} style={{ width: 42, height: 42 }}>
                  <Icon size={20} />
                </span>
                <span className="stat-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>{label}</span>
              </div>
            </div>
            <div className="stat-value" style={{ fontSize: '2rem', letterSpacing: '-1px' }}>
              {loading
                ? <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
                : value}
            </div>
            {sub && (
              <div className="stat-change" style={{ color: trend === 'up' ? 'var(--success)' : 'var(--text-muted)', fontSize: '0.75rem', marginTop: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                {trend === 'up' && <ArrowUpRight size={12} />}
                {sub}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 24, alignItems: 'flex-start' }}>

        {/* Recent Leads */}
        <div className="card" style={{ border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
          <div className="card-header" style={{ padding: '20px 24px' }}>
            <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>Recent Leads</span>
            <a href="/leads" style={{ fontSize: '0.8rem', color: 'var(--brand-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              View all <ChevronRight size={14} />
            </a>
          </div>
          {loading ? (
            <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : leads.length === 0 ? (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ width: 48, height: 48, background: 'var(--gray-50)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Users size={24} color="var(--gray-400)" />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No leads yet</h3>
              <p style={{ fontSize: '0.85rem' }}>Leads from Email & WhatsApp will appear here automatically.</p>
            </div>
          ) : (
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ paddingLeft: 24 }}>Lead</th>
                  <th>Intent</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ paddingLeft: 24 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ 
                          width: 36, height: 36, borderRadius: '50%', 
                          background: 'linear-gradient(135deg, var(--gray-100), var(--gray-200))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.75rem', fontWeight: 700, color: 'var(--gray-600)'
                        }}>
                          {getInitials(lead.name || lead.email)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{lead.name || 'Unknown Lead'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.email || lead.phone || 'No contact info'}</div>
                        </div>
                      </div>
                    </td>
                    <td>{intentBadge(lead.intent)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {timeAgo(lead.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right Column (Alerts & Meetings) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Inactive Deals Alert */}
          {summary && summary.inactive_deals && summary.inactive_deals.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid var(--warning)', borderTop: 'none', borderRight: 'none', borderBottom: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div className="card-header" style={{ padding: '16px 20px', background: 'var(--surface)' }}>
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--gray-900)' }}>
                  <AlertTriangle size={16} color="var(--warning)" />
                  Needs Attention ({summary.inactive_deals.length})
                </span>
              </div>
              <div className="card-body" style={{ padding: '0 20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {summary.inactive_deals.slice(0, 3).map(deal => (
                  <div key={deal.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--warning)', marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {deal.client_name || deal.id}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Stale for {timeAgo(deal.updated_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Meetings */}
          <div className="card" style={{ border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <div className="card-header" style={{ padding: '20px' }}>
              <span className="card-title" style={{ fontSize: '1rem', fontWeight: 700 }}>Today's Schedule</span>
              <a href="/calendar" style={{ fontSize: '0.8rem', color: 'var(--brand-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                Calendar <ChevronRight size={14} />
              </a>
            </div>
            <div className="card-body" style={{ padding: '0 20px 20px' }}>
              {loading ? (
                <div style={{ padding: 20, display: 'flex', justifyContent: 'center' }}>
                  <div className="spinner" />
                </div>
              ) : meetings.length === 0 ? (
                <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ width: 40, height: 40, background: 'var(--brand-50)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Calendar size={20} color="var(--brand-500)" />
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>Your day is clear!</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {meetings.map(m => (
                    <div key={m.name} style={{ display: 'flex', gap: 12 }}>
                      <div style={{ 
                        width: 48, background: 'var(--gray-50)', borderRadius: 8, 
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        padding: '6px 0', border: '1px solid var(--border)'
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--gray-500)' }}>
                          {formatTime(m.starts_on).split(':')[0]}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--gray-400)' }}>
                          {formatTime(m.starts_on).split(':')[1]}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.subject}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                          {m.event_type === 'Private' ? (
                            <><div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--info)' }} /> Online</>
                          ) : (
                            <><div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--brand-500)' }} /> Onsite</>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
