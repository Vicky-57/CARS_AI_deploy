import { useState, useEffect } from 'react';
import {
  Users, FolderKanban, MessageSquare, Calendar,
  ArrowUpRight, Clock, TrendingUp, FileText, AlertTriangle, CheckCircle
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
      sub: 'Last 24 hours',
    },
    {
      label: 'Active SELL Deals',
      value: summary.active_sell_deals,
      icon: TrendingUp,
      color: 'green',
      sub: 'Vermittlung pipeline',
    },
    {
      label: 'Active BUY Deals',
      value: summary.active_buy_deals,
      icon: FolderKanban,
      color: 'purple',
      sub: 'Beschaffung pipeline',
    },
    {
      label: 'Active Projects',
      value: (summary.active_sell_deals || 0) + (summary.active_buy_deals || 0),
      icon: FileText,
      color: 'amber',
      sub: 'Total across pipelines',
    },
  ] : [
    { label: 'New Leads (24h)',    value: '—', icon: Users,      color: 'blue',   sub: '' },
    { label: 'Active SELL Deals',  value: '—', icon: TrendingUp, color: 'green',  sub: '' },
    { label: 'Active BUY Deals',   value: '—', icon: FolderKanban, color: 'purple', sub: '' },
    { label: 'Pending OCR Docs',   value: '—', icon: FileText,   color: 'amber',  sub: '' },
  ];

  const intentBadge = (intent) => {
    if (intent === 'BUY_INTENT' || intent === 'BUY')  return <span className="badge badge-buy">Buy</span>;
    if (intent === 'SELL_INTENT' || intent === 'SELL') return <span className="badge badge-sell">Sell</span>;
    return <span className="badge badge-new">New</span>;
  };

  const pipelineBadge = (type) => {
    if (type === 'SELL' || type === 'sell') return <span className="badge badge-sell">Sell</span>;
    if (type === 'BUY'  || type === 'buy')  return <span className="badge badge-buy">Buy</span>;
    return null;
  };

  const formatTime = (iso) => {
    try { return format(new Date(iso), 'HH:mm'); } catch { return ''; }
  };

  const timeAgo = (iso) => {
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ''; }
  };

  return (
    <div>
      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-header">
              <span className={`stat-icon ${color}`}><Icon size={18} /></span>
              <ArrowUpRight size={14} color="var(--text-muted)" />
            </div>
            <div className="stat-value">
              {loading
                ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                : value}
            </div>
            <div className="stat-label">{label}</div>
            {sub && <div className="stat-change">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid-2">

        {/* Recent Leads */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Recent Leads</span>
            <a href="/leads" style={{ fontSize: '0.72rem', color: 'var(--brand-600)' }}>View all →</a>
          </div>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : leads.length === 0 ? (
            <div className="empty-state">
              <Users size={28} />
              <h3>No leads yet</h3>
              <p>Leads from Email & WhatsApp will appear here.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Pipeline</th>
                  <th>Intent</th>
                  <th>Received</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 500 }}>
                      {lead.name || lead.email || '—'}
                    </td>
                    <td>{pipelineBadge(lead.intent)}</td>
                    <td>{intentBadge(lead.intent)}</td>
                    <td style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {timeAgo(lead.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inactive Deals Alert + Today's Meetings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Inactive Deals */}
          {summary && summary.inactive_deals && summary.inactive_deals.length > 0 && (
            <div className="card" style={{ borderLeft: '3px solid var(--amber-500)' }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={15} color="var(--amber-500)" />
                  Inactive Deals ({summary.inactive_deals.length})
                </span>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {summary.inactive_deals.slice(0, 3).map(deal => (
                  <div key={deal.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 0', borderBottom: '1px solid var(--border)'
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.82rem' }}>{deal.client_name || deal.id}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {deal.project_type} · Last activity {timeAgo(deal.updated_at)}
                      </div>
                    </div>
                    {pipelineBadge(deal.project_type)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Meetings */}
          <div className="card" style={{ flex: 1 }}>
            <div className="card-header">
              <span className="card-title">Today's Meetings</span>
              <a href="/calendar" style={{ fontSize: '0.72rem', color: 'var(--brand-600)' }}>Calendar →</a>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="loading-spinner"><div className="spinner" /></div>
              ) : meetings.length === 0 ? (
                <div className="empty-state">
                  <Calendar size={28} />
                  <h3>No meetings today</h3>
                  <p>Book a meeting in the Calendar section.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {meetings.map(m => (
                    <div key={m.name} className="meeting-card">
                      <Clock size={14} color="var(--text-muted)" style={{ marginTop: 2 }} />
                      <div>
                        <div className="meeting-time">
                          {formatTime(m.starts_on)} – {formatTime(m.ends_on)}
                        </div>
                        <div className="meeting-title">{m.subject}</div>
                        <div className="meeting-detail">
                          {m.event_type === 'Private' ? '💻 Online' : '📍 Onsite'}
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
