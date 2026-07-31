import { useState, useEffect } from 'react';
import { Users, FolderKanban, MessageSquare, Calendar, TrendingUp, Clock, ArrowUpRight } from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';

const MOCK_STATS = [
  { label: 'Total Leads', value: '—', icon: Users, color: 'blue', change: '' },
  { label: 'Active Projects', value: '—', icon: FolderKanban, color: 'green', change: '' },
  { label: 'Messages Today', value: '—', icon: MessageSquare, color: 'purple', change: '' },
  { label: "Today's Meetings", value: '—', icon: Calendar, color: 'amber', change: '' },
];

export default function Dashboard() {
  const [stats, setStats] = useState(MOCK_STATS);
  const [leads, setLeads] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [leadsData, projectsData, commsData, meetingsData] = await Promise.allSettled([
          api.getLeads({ limit: 5 }),
          api.getProjects(),
          api.getCommunications(),
          api.getMeetings(),
        ]);

        const l = leadsData.status === 'fulfilled' ? leadsData.value : [];
        const p = projectsData.status === 'fulfilled' ? projectsData.value : [];
        const c = commsData.status === 'fulfilled' ? commsData.value : [];
        const m = meetingsData.status === 'fulfilled' ? meetingsData.value : [];

        const today = new Date().toDateString();
        const todayComms = c.filter(x => new Date(x.timestamp).toDateString() === today);
        const todayMeetings = m.filter(x => new Date(x.start_time).toDateString() === today);

        setStats([
          { label: 'Total Leads', value: l.length || 0, icon: Users, color: 'blue', change: 'All time' },
          { label: 'Active Projects', value: p.filter(x => x.status === 'ACTIVE').length || 0, icon: FolderKanban, color: 'green', change: `${p.length} total` },
          { label: 'Messages Today', value: todayComms.length, icon: MessageSquare, color: 'purple', change: 'Email + WhatsApp' },
          { label: "Today's Meetings", value: todayMeetings.length, icon: Calendar, color: 'amber', change: todayMeetings.length > 0 ? 'Scheduled' : 'None scheduled' },
        ]);
        setLeads(l.slice(0, 5));
        setMeetings(m.slice(0, 4));
      } catch {
        // API offline — show defaults
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const formatTime = (iso) => {
    try { return format(new Date(iso), 'HH:mm'); } catch { return ''; }
  };

  const intentBadge = (intent) => {
    if (intent === 'BUY') return <span className="badge badge-buy">Buy</span>;
    if (intent === 'SELL') return <span className="badge badge-sell">Sell</span>;
    return <span className="badge badge-new">New</span>;
  };

  const channelBadge = (ch) => {
    if (ch === 'WHATSAPP') return <span className="badge badge-whatsapp">WhatsApp</span>;
    if (ch === 'EMAIL') return <span className="badge badge-email">Email</span>;
    return <span className="badge badge-manual">Manual</span>;
  };

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, color, change }) => (
          <div key={label} className="stat-card">
            <div className="stat-card-header">
              <span className={`stat-icon ${color}`}><Icon size={18} /></span>
              <ArrowUpRight size={14} color="var(--text-muted)" />
            </div>
            <div className="stat-value">
              {loading ? <span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> : value}
            </div>
            <div className="stat-label">{label}</div>
            {change && <div className="stat-change">{change}</div>}
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
                  <th>Channel</th>
                  <th>Intent</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead.id}>
                    <td style={{ fontWeight: 500 }}>{lead.name || '—'}</td>
                    <td>{channelBadge(lead.channel)}</td>
                    <td>{intentBadge(lead.intent)}</td>
                    <td><span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{lead.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Today's Meetings */}
        <div className="card">
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
                <h3>No meetings scheduled</h3>
                <p>Book a meeting in the Calendar section.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meetings.map(m => (
                  <div key={m.id} className={`meeting-card${m.is_onsite ? ' onsite' : ''}`}>
                    <Clock size={14} color="var(--text-muted)" style={{ marginTop: 2 }} />
                    <div>
                      <div className="meeting-time">{formatTime(m.start_time)} – {formatTime(m.end_time)}</div>
                      <div className="meeting-title">{m.title}</div>
                      <div className="meeting-detail">
                        {m.is_onsite ? '📍 Onsite' : '💻 Online'}
                        {m.attendee_name ? ` · ${m.attendee_name}` : ''}
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
  );
}
