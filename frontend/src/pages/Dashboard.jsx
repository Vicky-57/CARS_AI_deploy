import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users, FolderKanban, MessageSquare, Calendar,
  ArrowUpRight, ArrowRight, Clock, TrendingUp, FileText,
  AlertTriangle, CheckCircle, ChevronRight, Plus, ExternalLink,
  Tag, Search
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
          api.getLeads({}, 6),
          api.getMeetings({}, 4),
        ]);

        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.slice(0, 6));
        if (meetingsRes.status === 'fulfilled') setMeetings(meetingsRes.value.slice(0, 4));
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const stats = [
    {
      label: 'New Inquiries (24h)',
      value: summary?.new_leads_24h ?? '—',
      icon: Users,
      trend: '+12%',
      trendUp: true,
      sub: 'vs last week'
    },
    {
      label: 'Active SELL Deals',
      value: summary?.active_sell_deals ?? '—',
      icon: Tag,
      trend: '+4.5%',
      trendUp: true,
      sub: 'Vermittlung B2C'
    },
    {
      label: 'Active BUY Deals',
      value: summary?.active_buy_deals ?? '—',
      icon: FolderKanban,
      trend: 'Steady',
      trendUp: false,
      sub: 'Beschaffung Passiv'
    },
    {
      label: 'Total Active Projects',
      value: summary ? ((summary.active_sell_deals || 0) + (summary.active_buy_deals || 0)) : '—',
      icon: TrendingUp,
      trend: '+8.4%',
      trendUp: true,
      sub: 'Active portfolio'
    },
  ];

  const intentBadge = (intent) => {
    if (intent === 'BUY_INTENT' || intent === 'BUY') {
      return <span className="badge badge-purple">Buy Intent</span>;
    }
    if (intent === 'SELL_INTENT' || intent === 'SELL') {
      return <span className="badge badge-emerald">Sell Intent</span>;
    }
    return <span className="badge badge-blue">New Lead</span>;
  };

  const formatTime = (iso) => {
    try { return format(new Date(iso), 'HH:mm'); } catch { return '—'; }
  };

  const timeAgo = (iso) => {
    try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ''; }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      {/* Frappe Workspace Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Executive Workspace</h1>
          <p className="page-subtitle">Real-time status overview of CAR-AGENTS brokerage operations.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'var(--bg-surface)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
            {format(new Date(), 'EEEE, dd. MMMM yyyy')}
          </div>
          <NavLink to="/leads" className="btn btn-primary">
            <Plus size={14} /> New Lead
          </NavLink>
        </div>
      </div>

      {/* Frappe Number Cards (Stats Grid) */}
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, trend, trendUp, sub }) => (
          <div key={label} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="stat-label">{label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 'var(--radius-xs)', background: 'var(--bg-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={14} color="var(--text-secondary)" />
              </div>
            </div>
            <div className="stat-value" style={{ marginTop: 8 }}>
              {loading ? <span style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>Loading...</span> : value}
            </div>
            <div className="stat-trend" style={{ color: trendUp ? 'var(--status-green-text)' : 'var(--text-secondary)' }}>
              {trendUp && <ArrowUpRight size={12} />}
              <span style={{ fontWeight: 600 }}>{trend}</span>
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>{sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main 2-Column Frappe Workspace Layout */}
      <div className="dashboard-main-grid">
        
        {/* Left: Recent Inbound Leads */}
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Header */}
          <div className="card-header">
            <div className="card-title">
              <MessageSquare size={15} color="var(--text-secondary)" /> Recent Inbound Inquiries
            </div>
            <NavLink to="/leads" className="btn btn-ghost btn-sm">
              View all leads <ChevronRight size={13} />
            </NavLink>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Loading recent inquiries...
            </div>
          ) : leads.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
              <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>No inquiries logged yet</div>
              <div style={{ fontSize: '0.75rem', marginTop: 4 }}>Inbound emails and WhatsApp messages will appear here.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {leads.map((lead, idx) => {
                // Truncate notes — strip HTML tags first
                const rawNote = lead.car_details || lead.notes || '';
                const cleanNote = rawNote.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                const shortNote = cleanNote.length > 80 ? cleanNote.slice(0, 80) + '…' : cleanNote;

                return (
                  <div key={lead.id} className="dashboard-lead-row">
                    {/* Avatar */}
                    <div className="dashboard-lead-col-avatar">
                      {getInitials(lead.name || lead.email)}
                    </div>

                    {/* Name + contact */}
                    <div className="dashboard-lead-col-name">
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {lead.name || 'Anonymous Lead'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                        {lead.email || lead.phone || 'No contact info'}
                      </div>
                    </div>

                    {/* Intent badge */}
                    <div className="dashboard-lead-col-intent">
                      {intentBadge(lead.intent)}
                    </div>

                    {/* Vehicle / Inquiry note */}
                    <div className="dashboard-lead-col-note">
                      {shortNote ? (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {shortNote}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </div>

                    {/* Time */}
                    <div className="dashboard-lead-col-time">
                      {timeAgo(lead.created_at)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Today's Schedule & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Today's Schedule Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Calendar size={15} color="var(--text-secondary)" /> Today's Appointments
              </div>
              <NavLink to="/calendar" className="btn btn-ghost btn-sm">
                Open Calendar <ChevronRight size={13} />
              </NavLink>
            </div>
            <div className="card-body" style={{ padding: '14px 18px' }}>
              {loading ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>Loading schedule...</div>
              ) : meetings.length === 0 ? (
                <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ fontWeight: 500, fontSize: '0.85rem' }}>No meetings scheduled for today</div>
                  <div style={{ fontSize: '0.75rem', marginTop: 4 }}>Sync with Outlook ICS in Settings to auto-import your day.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {meetings.map((m, idx) => (
                    <div
                      key={m.name || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        background: 'var(--bg-surface-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{
                        padding: '4px 8px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xs)',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                        color: 'var(--text-primary)'
                      }}>
                        {formatTime(m.starts_on || m.start_time)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {m.subject || m.title || 'Client Appointment'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {m.location || 'Mindelstetten Office'}
                        </div>
                      </div>
                      <span className="badge badge-emerald">Confirmed</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Frappe Quick Action Links Card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Quick Operations</div>
            </div>
            <div className="card-body dashboard-quick-ops">
              <NavLink
                to="/projects"
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 12px', height: 'auto', flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <FolderKanban size={14} /> Active Deals
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Kanban pipeline & stages</div>
              </NavLink>

              <NavLink
                to="/contracts"
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 12px', height: 'auto', flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <FileText size={14} /> Contracts
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>1-Click PDF generation</div>
              </NavLink>

              <NavLink
                to="/customers"
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 12px', height: 'auto', flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Users size={14} /> Customer Master
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Client profiles & history</div>
              </NavLink>

              <NavLink
                to="/profile"
                className="btn btn-secondary"
                style={{ justifyContent: 'flex-start', padding: '10px 12px', height: 'auto', flexDirection: 'column', alignItems: 'flex-start' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: 'var(--text-primary)' }}>
                  <ExternalLink size={14} /> Integrations
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Google Drive & Outlook</div>
              </NavLink>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
