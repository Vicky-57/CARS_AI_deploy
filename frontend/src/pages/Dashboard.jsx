import { useState, useEffect } from 'react';
import {
  Users, FolderKanban, MessageSquare, Calendar,
  ArrowUpRight, ArrowRight, Clock, TrendingUp, FileText, AlertTriangle, CheckCircle, ChevronRight
} from 'lucide-react';
import { api } from '../api/api';
import { format, formatDistanceToNow } from 'date-fns';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [leads, setLeads] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [summaryRes, leadsRes, meetingsRes] = await Promise.allSettled([
          api.getPipelineSummary(),
          api.getLeads({}, 5),
          api.getMeetings({}, 5),
        ]);

        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.slice(0, 5));
        if (meetingsRes.status === 'fulfilled') setMeetings(meetingsRes.value.slice(0, 4));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const stats = summary ? [
    {
      label: 'New Leads',
      value: summary.new_leads_24h,
      icon: Users,
      color: 'orange',
      trendValue: '12%',
      trendText: 'last 24h',
      trend: 'up'
    },
    {
      label: 'Active SELL Deals',
      value: summary.active_sell_deals,
      icon: TrendingUp,
      color: 'green',
      trendValue: '4.5%',
      trendText: 'this month',
      trend: 'up'
    },
    {
      label: 'Active BUY Deals',
      value: summary.active_buy_deals,
      icon: FolderKanban,
      color: 'purple',
      trendValue: '2.1%',
      trendText: 'this month',
      trend: 'neutral'
    },
    {
      label: 'Total Active Projects',
      value: (summary.active_sell_deals || 0) + (summary.active_buy_deals || 0),
      icon: FileText,
      color: 'amber',
      trendValue: '8.4%',
      trendText: 'this year',
      trend: 'up'
    },
  ] : [
    { label: 'New Leads', value: '—', icon: Users, color: 'orange', trendValue: '', trendText: '', trend: 'neutral' },
    { label: 'Active SELL Deals', value: '—', icon: TrendingUp, color: 'green', trendValue: '', trendText: '', trend: 'neutral' },
    { label: 'Active BUY Deals', value: '—', icon: FolderKanban, color: 'purple', trendValue: '', trendText: '', trend: 'neutral' },
    { label: 'Total Active Projects', value: '—', icon: FileText, color: 'amber', trendValue: '', trendText: '', trend: 'neutral' },
  ];

  const intentBadge = (intent) => {
    if (intent === 'BUY_INTENT' || intent === 'BUY') return <span className="badge badge-buy">Buy</span>;
    if (intent === 'SELL_INTENT' || intent === 'SELL') return <span className="badge badge-sell">Sell</span>;
    return <span className="badge badge-new">New</span>;
  };

  const formatTime = (iso) => {
    try { return format(new Date(iso), 'h:mm a'); } catch { return ''; }
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
          {format(new Date(), 'EEEE, dd/MM/yyyy')}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid" style={{ gap: 20, marginBottom: 32 }}>
        {stats.map(({ label, value, icon: Icon, color, trendValue, trendText, trend }) => (
          <div key={label} className="stat-card" style={{ padding: '16px 20px' }}>
            {/* Top row: Label and Icon */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
              <span className={`stat-icon ${color}`}>
                <Icon size={16} />
              </span>
            </div>

            {/* Middle row: Value */}
            <div className="stat-value" style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '-0.5px', marginBottom: 12, color: 'var(--text-primary)' }}>
              {loading
                ? <span className="spinner" style={{ width: 24, height: 24, borderWidth: 3 }} />
                : value}
            </div>

            {/* Bottom row: Trend and Arrow button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {trendValue && (
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 2,
                    background: trend === 'up' ? '#d1fae5' : '#f3f4f6',
                    color: trend === 'up' ? '#059669' : '#6b7280',
                    padding: '2px 8px', borderRadius: '16px', fontSize: '0.75rem', fontWeight: 600
                  }}>
                    {trend === 'up' && <ArrowUpRight size={12} />}
                    {trendValue}
                  </span>
                )}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>{trendText}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="dashboard-grid">

        {/* Recent Leads */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Leads</span>
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
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leads.map((lead, idx) => (
                <div key={lead.id} style={{
                  display: 'flex', alignItems: 'center', padding: '16px 24px',
                  borderBottom: idx === leads.length - 1 ? 'none' : '1px solid var(--border)',
                  transition: 'background-color 0.2s', cursor: 'pointer',
                  backgroundColor: 'transparent'
                }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--gray-50)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--brand-50), var(--brand-100))',
                    border: '1px solid var(--brand-200)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-700)', flexShrink: 0
                  }}>
                    {getInitials(lead.name || lead.email)}
                  </div>
                  <div style={{ flex: 1, marginLeft: 16, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.name || 'Unknown Lead'}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, flexShrink: 0 }}>
                        {timeAgo(lead.created_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.email || lead.phone || 'No contact info'}
                      </span>
                      {intentBadge(lead.intent)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column (Alerts & Meetings) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Inactive Deals Alert */}
          {/* {summary && summary.inactive_deals && summary.inactive_deals.length > 0 && (
            <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <AlertTriangle size={16} color="var(--warning)" />
                  Needs Attention ({summary.inactive_deals.length})
                </span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
          )} */}

          {/* Today's Meetings */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Today's Schedule</span>
              <a href="/calendar" style={{ fontSize: '0.8rem', color: 'var(--brand-600)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
                Calendar <ChevronRight size={14} />
              </a>
            </div>
            <div className="card-body" style={{ padding: '20px' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {meetings.map((m, idx) => (
                    <div key={m.name || idx} style={{
                      display: 'flex', gap: 14, alignItems: 'center', padding: '12px 16px',
                      background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)',
                      transition: 'all 0.2s', cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand-300)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.02)'; }}
                    >
                      <div style={{
                        background: 'var(--brand-50)', borderRadius: 8,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '1px solid var(--brand-100)', flexShrink: 0, padding: '8px 12px'
                      }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--brand-700)', letterSpacing: '0.5px' }}>
                          {formatTime(m.starts_on || m.start_time)}
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>
                          {m.subject || m.title}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {(m.event_type === 'Private' || m.location_type === 'ONLINE') ? (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0284c7' }} /> Online
                            </span>
                          ) : (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d97706' }} /> Onsite
                            </span>
                          )}
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={12} style={{ opacity: 0.7 }} />
                            {formatDistanceToNow(new Date(m.starts_on || m.start_time), { addSuffix: true })}
                          </span>
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
