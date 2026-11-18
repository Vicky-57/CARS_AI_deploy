import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Users, FolderKanban, Calendar,
  ArrowUpRight, TrendingUp, FileText,
  CheckCircle, ChevronRight, Plus, ExternalLink,
  Tag, WifiOff, Clock, AlertCircle, MessageCircle, Inbox,
  Flame, Phone, Sunrise
} from 'lucide-react';
import { api } from '../api/api';
import { format, formatDistanceToNow } from 'date-fns';
import { cleanText, isAutomatedSpam, formatContactName, getCleanInitials } from '../utils/textUtils';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const intentKind = (intent) => {
  const upper = (intent || '').toUpperCase();
  if (upper.includes('BUY')) return 'buy';
  if (upper.includes('SELL')) return 'sell';
  return 'new';
};

const INTENT_LABEL = { buy: 'Buy intent', sell: 'Sell intent', new: 'New lead' };

const getLeadVehicle = (lead) => {
  if (lead.vehicle_interest) return cleanText(lead.vehicle_interest);
  if (lead.vehicle) return cleanText(lead.vehicle);
  if (lead.manufacturer || lead.model) return cleanText(`${lead.manufacturer || ''} ${lead.model || ''}`.trim());
  const text = `${lead.subject || ''} ${lead.message || ''} ${lead.notes || ''}`;
  const carMatch = text.match(/(Porsche\s+[\w\d.\s()-]+|BMW\s+[\w\d.\s-]+|Audi\s+[\w\d.\s-]+|Mercedes-?Benz?\s+[\w\d.\s-]+|VW\s+[\w\d.\s-]+|Volkswagen\s+[\w\d.\s-]+)/i);
  if (carMatch) return cleanText(carMatch[0].split('\n')[0].split('-')[0].trim().slice(0, 35));
  return null;
};

const isWhatsAppHotLead = (lead) => {
  if (!lead) return false;
  const isSpam = lead.status === 'SPAM' || isAutomatedSpam(lead);
  if (isSpam) return false;
  const srcRaw = (lead.source || lead.channel || '').toUpperCase();
  const labelKey = (lead.label || lead.lead_label || '').toLowerCase();
  return srcRaw.includes('WHATSAPP') && labelKey === 'hot';
};

const formatPhoneDisplay = (raw) => {
  if (!raw) return '';
  const str = cleanText(raw);
  if (str.includes('@')) return str;
  const digits = str.replace(/\D/g, '');
  if (digits.length < 7) return str;
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.startsWith('49') && digits.length >= 11) {
    return `+49 ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 ${digits.slice(1, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }
  return str.startsWith('+') ? str : `+${digits}`;
};

const shortTimeAgo = (iso) => {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true }).replace(/^about\s+/i, '');
  } catch {
    return '';
  }
};

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [allLeads, setAllLeads] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [waStatus, setWaStatus] = useState(null); // WhatsApp status

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [summaryRes, leadsRes, meetingsRes, waRes] = await Promise.allSettled([
          api.getPipelineSummary(),
          api.getLeads({}),
          api.getMeetings({}, 4),
          api.getWhatsAppStatus ? api.getWhatsAppStatus() : Promise.resolve(null),
        ]);

        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value);
        if (leadsRes.status === 'fulfilled') setAllLeads(Array.isArray(leadsRes.value) ? leadsRes.value : []);
        if (meetingsRes.status === 'fulfilled') setMeetings(meetingsRes.value.slice(0, 4));
        if (waRes.status === 'fulfilled' && waRes.value) setWaStatus(waRes.value);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();

    const sub = api.subscribeToLeads
      ? api.subscribeToLeads(async () => {
        try {
          const latestLeads = await api.getLeads({});
          if (Array.isArray(latestLeads)) setAllLeads(latestLeads);
        } catch { /* ignore background refresh errors */ }
      })
      : null;
    return () => { if (sub) sub.unsubscribe(); };
  }, []);

  const leads = allLeads.slice(0, 6);
  const whatsappHotLeads = allLeads.filter(isWhatsAppHotLead);

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
  const hotCount = whatsappHotLeads.length;

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

      {/* ── WhatsApp channel panel ─────────────────────────────────────────── */}
      <section className="wa-panel">
        <header className="wa-head">
          <div className="wa-brand">
            <div className="wa-logo">
              <img src="/assets/whatsapp.png" alt="WhatsApp" />
            </div>
            <div>
              <div className="wa-title">WhatsApp channel</div>
              {waDown ? (
                <span className="wa-chip bad"><WifiOff size={11} /> Not connected</span>
              ) : waConnected ? (
                <span className="wa-chip ok"><span className="dash-live" /> Connected</span>
              ) : (
                <span className="wa-chip"><Clock size={11} /> Pending Meta approval</span>
              )}
            </div>
          </div>

          <div className="wa-head-right">
            <div className={`wa-briefing ${waStatus?.briefing_sent ? 'done' : ''}`}>
              <div className="wa-briefing-icon">
                {waStatus?.briefing_sent ? <CheckCircle size={15} /> : <Sunrise size={15} />}
              </div>
              <div>
                <small>Morning briefing</small>
                <strong>{waStatus?.briefing_sent ? 'Sent today' : 'Pending'}</strong>
              </div>
            </div>

            <NavLink to="/leads?source=WHATSAPP" className="wa-cta">
              <Inbox size={14} /> <span><span className="wa-cta-long">View </span>hot leads</span> <ChevronRight size={13} />
            </NavLink>
          </div>
        </header>

        <div className="wa-body">
          <div className="wa-list-head">
            <div className="wa-list-title">
              <span className="wa-flame"><Flame size={12} /></span>
              Hot leads
              {!loading && <span className="wa-count">{hotCount}</span>}
            </div>
            {!loading && hotCount > 5 && (
              <NavLink to="/leads?source=WHATSAPP" className="dash-link">
                View all {hotCount} <ChevronRight size={13} />
              </NavLink>
            )}
          </div>

          {loading ? (
            <div className="wa-list">
              {[0, 1].map(i => (
                <div key={i} className="wa-lead wa-lead-skel">
                  <span className="dash-skel" style={{ width: 44, height: 44, borderRadius: '50%' }} />
                  <div>
                    <span className="dash-skel block" style={{ width: '60%', marginBottom: 6 }} />
                    <span className="dash-skel block" style={{ width: '40%', height: '0.8em' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : hotCount === 0 ? (
            <div className="wa-empty">
              <CheckCircle size={18} />
              <div>
                <div className="wa-empty-title">No hot leads right now</div>
                <div className="wa-empty-sub">New hot WhatsApp enquiries will appear here as they arrive.</div>
              </div>
            </div>
          ) : (
            <div className="wa-list">
              {whatsappHotLeads.slice(0, 5).map((lead, idx) => {
                const vehicle = getLeadVehicle(lead);
                const kind = intentKind(lead.intent);
                const rawReason = lead.label_reason || lead.car_details || lead.notes || lead.message || '';
                const cleanReason = cleanText(rawReason.replace(/<[^>]*>/g, ''));
                const shortReason = cleanReason.length > 80 ? cleanReason.slice(0, 80) + '…' : cleanReason;
                const showVehicle = Boolean(vehicle && (!shortReason || !shortReason.toLowerCase().includes(vehicle.toLowerCase())));
                const contactLabel = formatPhoneDisplay(lead.phone || lead.email) || 'WhatsApp';

                return (
                  <NavLink
                    key={lead.id}
                    to={`/leads?source=WHATSAPP&lead=${lead.id}`}
                    className="wa-lead"
                    style={{ '--i': idx }}
                  >
                    <div className="wa-avatar-wrap">
                      <div className={`dash-avatar ${kind} wa-avatar`}>
                        {getCleanInitials(lead.name, lead.email)}
                      </div>
                      <span className="wa-avatar-flag" title="Hot lead"><Flame size={9} /></span>
                    </div>

                    <div className="wa-lead-main">
                      <div className="wa-lead-top">
                        <span className="wa-name">{formatContactName(lead.name, lead.email, vehicle)}</span>
                        <span className="wa-hot-badge"><Flame size={10} /> Hot</span>
                        <span className={`dash-pill ${kind}`}>{INTENT_LABEL[kind]}</span>
                      </div>

                      <div className="wa-lead-sub">
                        <span className="wa-phone">
                          <Phone size={11} /> {contactLabel}
                        </span>
                        {showVehicle && (
                          <>
                            <span className="wa-sep" aria-hidden="true" />
                            <span className="wa-vehicle">{vehicle}</span>
                          </>
                        )}
                        {shortReason && (
                          <>
                            <span className="wa-sep" aria-hidden="true" />
                            <span className="wa-reason">{shortReason}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="wa-lead-end">
                      <span className="wa-lead-time">
                        <Clock size={11} /> {shortTimeAgo(lead.created_at)}
                      </span>
                      <span className="wa-arrow-pill">
                        <ChevronRight size={14} className="wa-arrow" />
                      </span>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </section>

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