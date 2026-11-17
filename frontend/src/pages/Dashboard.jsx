import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users, FolderKanban, Calendar,
  ArrowUpRight, TrendingUp, FileText,
  CheckCircle, ChevronRight, Plus, ExternalLink,
  Tag, WifiOff, Clock, AlertCircle, MessageCircle, Inbox
} from 'lucide-react';
import { api } from '../api/api';
import { format, formatDistanceToNow } from 'date-fns';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const intentKind = (intent) => {
  if (intent === 'BUY_INTENT' || intent === 'BUY') return 'buy';
  if (intent === 'SELL_INTENT' || intent === 'SELL') return 'sell';
  return 'new';
};

const INTENT_LABEL = { buy: 'Buy intent', sell: 'Sell intent', new: 'New lead' };

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [leads, setLeads] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState(null); // WhatsApp status

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [summaryRes, leadsRes, meetingsRes, waRes] = await Promise.allSettled([
          api.getPipelineSummary(),
          api.getLeads({}, 6),
          api.getMeetings({}, 4),
          api.getWhatsAppStatus ? api.getWhatsAppStatus() : Promise.resolve(null),
        ]);

        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (leadsRes.status === 'fulfilled') setLeads(leadsRes.value.slice(0, 6));
        if (meetingsRes.status === 'fulfilled') setMeetings(meetingsRes.value.slice(0, 4));
        if (waRes.status === 'fulfilled' && waRes.value) setWaStatus(waRes.value);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const sellDeals = summary?.active_sell_deals || 0;
  const buyDeals = summary?.active_buy_deals || 0;
  const totalDeals = sellDeals + buyDeals;
  const newLeads = summary?.new_leads_24h;

  const stats = [
    {
      label: 'New inquiries (24h)',
      value: newLeads ?? '—',
      icon: Users,
      tone: 'blue',
      trend: '+12%',
      trendUp: true,
      sub: 'vs last week',
    },
    {
      label: 'Active SELL deals',
      value: summary?.active_sell_deals ?? '—',
      icon: Tag,
      tone: 'green',
      trend: '+4.5%',
      trendUp: true,
      sub: 'Vermittlung B2C',
    },
    {
      label: 'Active BUY deals',
      value: summary?.active_buy_deals ?? '—',
      icon: FolderKanban,
      tone: 'violet',
      trend: 'Steady',
      trendUp: false,
      sub: 'Beschaffung Passiv',
    },
  ];

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

  const waConnected = waStatus?.connected === true;
  const waDown = waStatus?.connected === false;
  const hotNoReply = waStatus?.hot_no_reply || 0;

  return (
    <div className="dash">
      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="dash-hero">
        <div className="dash-hero-copy">
          <div>
            <div className="dash-hero-date">
              <Calendar size={13} />
              {format(new Date(), 'EEEE, dd. MMMM yyyy')}
            </div>
            <h1 className="dash-hero-title">{greeting()}.<span className="dash-hero-br"><br /></span>Here’s your brokerage today.</h1>
            <p className="dash-hero-sub">
              {loading ? (
                'Loading the latest numbers…'
              ) : newLeads != null ? (
                <>
                  <strong>{newLeads} new {newLeads === 1 ? 'inquiry' : 'inquiries'}</strong> in the last 24 hours
                  {meetings.length > 0 && <> and <strong>{meetings.length} {meetings.length === 1 ? 'appointment' : 'appointments'}</strong> on the calendar</>}.
                </>
              ) : (
                'Real-time status overview of CAR-AGENTS brokerage operations.'
              )}
            </p>
          </div>
          <div className="dash-hero-actions">
            <NavLink to="/leads" className="dash-btn dash-btn-primary">
              <Plus size={15} /> New lead
            </NavLink>
            <NavLink to="/projects" className="dash-btn dash-btn-secondary">
              Open pipeline <ChevronRight size={14} />
            </NavLink>
          </div>
        </div>

        <div className="dash-pipeline">
          <div className="dash-pipeline-label">Total active projects</div>
          <div className="dash-pipeline-total">
            {loading ? <span className="dash-skel" style={{ width: '2ch' }} /> : (summary ? totalDeals : '—')}
          </div>

          <div className="dash-split" role="img" aria-label={`${sellDeals} sell deals, ${buyDeals} buy deals`}>
            {totalDeals > 0 ? (
              <>
                {sellDeals > 0 && <div className="dash-split-seg sell" style={{ flexGrow: sellDeals }} />}
                {buyDeals > 0 && <div className="dash-split-seg buy" style={{ flexGrow: buyDeals }} />}
              </>
            ) : (
              <div className="dash-split-seg empty" />
            )}
          </div>

          <div className="dash-split-legend">
            <div className="dash-legend-item">
              <b><span className="dash-dot sell" />{summary ? sellDeals : '—'}</b>
              SELL · Vermittlung
            </div>
            <div className="dash-legend-item">
              <b><span className="dash-dot buy" />{summary ? buyDeals : '—'}</b>
              BUY · Beschaffung
            </div>
          </div>
        </div>
      </section>

      {/* ── Stat cards ─────────────────────────────────────────────────────── */}
      <div className="dash-stats">
        {stats.map(({ label, value, icon: Icon, tone, trend, trendUp, sub }) => (
          <div key={label} className="dash-card dash-stat">
            <div className={`dash-stat-icon ${tone}`}>
              <Icon size={20} />
            </div>
            <div className="dash-stat-body">
              <div className="dash-stat-label">{label}</div>
              <div className="dash-stat-value">
                {loading ? <span className="dash-skel" style={{ width: '2.5ch' }} /> : value}
              </div>
              <div className="dash-stat-meta">
                <span className={`dash-trend ${trendUp ? 'up' : ''}`}>
                  {trendUp && <ArrowUpRight size={11} />}
                  {trend}
                </span>
                {sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── WhatsApp channel strip ─────────────────────────────────────────── */}
      <div className="dash-card dash-channel">
        <div className="dash-channel-brand">
          <div className="dash-channel-logo">
            <img src="/assets/whatsapp.png" alt="WhatsApp" />
          </div>
          <div>
            <div className="dash-channel-name">WhatsApp channel</div>
            {waDown ? (
              <div className="dash-status bad"><WifiOff size={11} /> Not connected</div>
            ) : waConnected ? (
              <div className="dash-status ok"><span className="dash-live" /> Connected</div>
            ) : (
              <div className="dash-status"><Clock size={11} /> Pending Meta approval</div>
            )}
          </div>
        </div>

        <div className="dash-channel-item">
          <small>Morning briefing</small>
          <span className={waStatus?.briefing_sent ? 'good' : ''}>
            {waStatus?.briefing_sent
              ? <CheckCircle size={14} />
              : <Clock size={14} color="var(--text-muted)" />}
            {waStatus?.briefing_sent ? 'Sent today' : 'Pending'}
          </span>
        </div>

        <div className="dash-channel-item">
          <small>Hot leads without reply</small>
          <span className={hotNoReply > 0 ? 'warn' : ''}>
            {hotNoReply > 0
              ? <AlertCircle size={14} />
              : <CheckCircle size={14} color="var(--text-muted)" />}
            {waStatus?.hot_no_reply != null ? `${waStatus.hot_no_reply} ${waStatus.hot_no_reply === 1 ? 'lead' : 'leads'}` : '—'}
          </span>
        </div>

        <NavLink to="/leads" className="dash-link dash-channel-cta">
          <Inbox size={14} style={{ marginRight: 4 }} /> View leads <ChevronRight size={13} />
        </NavLink>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="dash-grid">
        {/* Recent inquiries */}
        <div className="dash-card" style={{ overflow: 'hidden' }}>
          <div className="dash-card-head">
            <div className="dash-card-title">
              <MessageCircle size={16} color="var(--text-secondary)" /> Recent inbound inquiries
            </div>
            <NavLink to="/leads" className="dash-link">
              View all <ChevronRight size={13} />
            </NavLink>
          </div>

          {loading ? (
            <div>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="dash-skel-row">
                  <span className="dash-skel" style={{ width: 40, height: 40, borderRadius: 12 }} />
                  <div style={{ flex: 1 }}>
                    <span className="dash-skel block" style={{ width: '40%', marginBottom: 6 }} />
                    <span className="dash-skel block" style={{ width: '65%', height: '0.8em' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="dash-empty">
              <div className="dash-empty-icon"><Users size={22} /></div>
              <div className="dash-empty-title">No inquiries yet</div>
              <div className="dash-empty-sub">Inbound emails and WhatsApp messages will show up here as they arrive.</div>
            </div>
          ) : (
            <div>
              {leads.map((lead) => {
                // Truncate notes — strip HTML tags first
                const rawNote = lead.car_details || lead.notes || '';
                const cleanNote = rawNote.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
                const shortNote = cleanNote.length > 80 ? cleanNote.slice(0, 80) + '…' : cleanNote;
                const kind = intentKind(lead.intent);

                return (
                  <NavLink
                    key={lead.id}
                    to="/leads"
                    className="dash-lead"
                    style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}
                  >
                    <div className={`dash-avatar ${kind}`}>
                      {getInitials(lead.name || lead.email)}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div className="dash-lead-name">{lead.name || 'Anonymous lead'}</div>
                      <div className="dash-lead-contact">{lead.email || lead.phone || 'No contact info'}</div>
                    </div>

                    <span className={`dash-pill ${kind}`}>{INTENT_LABEL[kind]}</span>

                    <div className="dash-lead-note">
                      {shortNote || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </div>

                    <div className="dash-lead-time">{timeAgo(lead.created_at)}</div>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="dash-col">
          {/* Today's appointments */}
          <div className="dash-card" style={{ overflow: 'hidden' }}>
            <div className="dash-card-head">
              <div className="dash-card-title">
                <Calendar size={16} color="var(--text-secondary)" /> Today’s appointments
              </div>
              <NavLink to="/calendar" className="dash-link">
                Calendar <ChevronRight size={13} />
              </NavLink>
            </div>

            {loading ? (
              <ul className="dash-agenda">
                {[0, 1].map(i => (
                  <li key={i} className="dash-meeting">
                    <span className="dash-skel" style={{ width: 44 }} />
                    <div><span className="dash-skel block" style={{ width: '70%' }} /></div>
                    <span />
                  </li>
                ))}
              </ul>
            ) : meetings.length === 0 ? (
              <div className="dash-empty">
                <div className="dash-empty-icon"><Calendar size={22} /></div>
                <div className="dash-empty-title">Nothing scheduled today</div>
                <div className="dash-empty-sub">Sync your Outlook ICS in Settings to import your day automatically.</div>
              </div>
            ) : (
              <ul className="dash-agenda">
                {meetings.map((m, idx) => (
                  <li key={m.name || idx} className="dash-meeting">
                    <div className="dash-meeting-time">{formatTime(m.starts_on || m.start_time)}</div>
                    <div style={{ minWidth: 0 }}>
                      <div className="dash-meeting-title">{m.subject || m.title || 'Client appointment'}</div>
                      <div className="dash-meeting-place">{m.location || 'Mindelstetten Office'}</div>
                    </div>
                    <span className="dash-pill ok">Confirmed</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick operations */}
          <div className="dash-card" style={{ overflow: 'hidden' }}>
            <div className="dash-card-head">
              <div className="dash-card-title">Quick operations</div>
            </div>
            <div className="dash-ops">
              <NavLink to="/projects" className="dash-op">
                <div className="dash-op-icon"><FolderKanban size={17} /></div>
                <div className="dash-op-text">
                  <div className="dash-op-title">Active deals</div>
                  <div className="dash-op-sub">Kanban pipeline &amp; stages</div>
                </div>
                <ChevronRight size={16} className="dash-op-arrow" />
              </NavLink>

              <NavLink to="/contracts" className="dash-op">
                <div className="dash-op-icon"><FileText size={17} /></div>
                <div className="dash-op-text">
                  <div className="dash-op-title">Contracts</div>
                  <div className="dash-op-sub">1-click PDF generation</div>
                </div>
                <ChevronRight size={16} className="dash-op-arrow" />
              </NavLink>

              <NavLink to="/profile" className="dash-op">
                <div className="dash-op-icon"><ExternalLink size={17} /></div>
                <div className="dash-op-text">
                  <div className="dash-op-title">Integrations</div>
                  <div className="dash-op-sub">Google Drive &amp; Outlook</div>
                </div>
                <ChevronRight size={16} className="dash-op-arrow" />
              </NavLink>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}