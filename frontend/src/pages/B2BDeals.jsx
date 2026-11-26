import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Briefcase, Plus, Mail, Check, Trash2, RefreshCw, Search,
  ArrowUpRight, X, Building2, CheckCircle2, Clock, Inbox,
  Layers, FilePlus2, MailCheck, MessageSquare, Archive, Info
} from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { cleanText, formatContactName, getCleanInitials } from '../utils/textUtils';

const B2B_STAGES = [
  { value: 'NEW', label: 'New Offer', icon: FilePlus2, tone: 'new' },
  { value: 'CONTACTED', label: 'Contacted', icon: MailCheck, tone: 'contacted' },
  { value: 'IN_DISCUSSION', label: 'In Discussion', icon: MessageSquare, tone: 'discussion' },
  { value: 'ACTIVE_PARTNER', label: 'Active Partner', icon: CheckCircle2, tone: 'active' },
  { value: 'ARCHIVED', label: 'Archived', icon: Archive, tone: 'archived' },
];

const STAGE_META = Object.fromEntries(B2B_STAGES.map(s => [s.value, s]));

const B2B_TYPES = [
  { value: 'cooperation', label: 'Cooperation (§7)' },
  { value: 'general_offer', label: 'Service Offer (§7)' },
  { value: 'advertising', label: 'Advertising / Marketing' },
];

const B2B_TYPE_LABELS = {
  cooperation: 'Cooperation',
  general_offer: 'Service Offer',
  advertising: 'Advertising',
  b2b_cooperation: 'Cooperation',
  b2b_offer: 'Service Offer',
  b2b_solicitation: 'B2B Outreach',
  b2b_advertising: 'Advertising',
};

export default function B2BDeals() {
  const [deals, setDeals] = useState([]);
  const [b2bEmails, setB2bEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('DEALS'); // DEALS | INBOX
  const [stageFilter, setStageFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    company_name: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    b2b_type: 'cooperation',
    subject: '',
    offer_summary: '',
    status: 'NEW',
    notes: '',
  });

  const tabsBarRef = useRef(null);
  const tabBtnRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, ready: false });

  const stageBarRef = useRef(null);
  const stageBtnRefs = useRef({});
  const [stageIndicator, setStageIndicator] = useState({ left: 0, width: 0, ready: false });

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dealRows, inqRows] = await Promise.all([
        api.getB2BDeals().catch(() => []),
        api.getInquiries(200).catch(() => []),
      ]);
      setDeals(dealRows);
      setB2bEmails(
        inqRows.filter(
          r => r.decision === 'b2b' || ['b2b_cooperation', 'b2b_offer', 'b2b_solicitation', 'b2b_advertising'].includes(r.category)
        )
      );
    } catch (err) {
      toast.error('Failed to load B2B data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useLayoutEffect(() => {
    const updateIndicators = () => {
      const el = tabBtnRefs.current[activeTab];
      if (el) {
        setTabIndicator({ left: el.offsetLeft, width: el.offsetWidth, ready: true });
      }
      const stEl = stageBtnRefs.current[stageFilter];
      if (stEl) {
        setStageIndicator({ left: stEl.offsetLeft, width: stEl.offsetWidth, ready: true });
      }
    };
    updateIndicators();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateIndicators);
      if (tabsBarRef.current) ro.observe(tabsBarRef.current);
      if (stageBarRef.current) ro.observe(stageBarRef.current);
    }
    window.addEventListener('resize', updateIndicators);
    return () => {
      window.removeEventListener('resize', updateIndicators);
      if (ro) ro.disconnect();
    };
  }, [activeTab, stageFilter, deals.length, b2bEmails.length]);

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    if (!form.company_name || !form.contact_email) {
      toast.error('Company name and contact email are required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.createB2BDeal(form);
      toast.success(`B2B Deal created for ${form.company_name}`);
      setShowModal(false);
      setForm({
        company_name: '', contact_name: '', contact_email: '', contact_phone: '',
        b2b_type: 'cooperation', subject: '', offer_summary: '', status: 'NEW', notes: '',
      });
      loadAll();
    } catch (err) {
      toast.error('Error creating B2B deal: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePromoteEmail = async (mail) => {
    try {
      const email = mail.reply_to || mail.sender_email || '';
      const company = cleanText(mail.sender_name) || (email.includes('@') ? email.split('@')[1] : 'B2B Partner');
      await api.createB2BDeal({
        triage_id: mail.id,
        company_name: company,
        contact_name: cleanText(mail.sender_name) || email,
        contact_email: email,
        b2b_type: mail.category === 'b2b_cooperation' ? 'cooperation' : mail.category === 'b2b_advertising' ? 'advertising' : 'general_offer',
        subject: cleanText(mail.subject),
        offer_summary: cleanText(mail.reason || mail.subject),
        status: 'NEW',
        notes: mail.body_preview,
      });
      toast.success(`Converted "${company}" into an active B2B Deal!`);
      loadAll();
    } catch (err) {
      toast.error('Conversion failed: ' + err.message);
    }
  };

  const handleStatusChange = async (dealId, newStatus) => {
    try {
      const updated = await api.updateB2BDeal(dealId, { status: newStatus });
      setDeals(prev => prev.map(d => (d.id === dealId ? updated : d)));
      const label = B2B_STAGES.find(s => s.value === newStatus)?.label || newStatus;
      toast.success(`Moved to ${label}`);
    } catch (err) {
      toast.error('Failed to update status: ' + err.message);
    }
  };

  const handleDelete = async (dealId) => {
    try {
      await api.deleteB2BDeal(dealId);
      setDeals(prev => prev.filter(d => d.id !== dealId));
      toast.success('B2B deal removed');
    } catch (err) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  const existingDealEmails = new Set(deals.map(d => (d.contact_email || '').toLowerCase()));
  const pendingEmailsCount = b2bEmails.filter(m => !existingDealEmails.has((m.reply_to || m.sender_email || '').toLowerCase())).length;

  const activeDealsCount = deals.filter(d => d.status !== 'ARCHIVED').length;
  const activePartnersCount = deals.filter(d => d.status === 'ACTIVE_PARTNER').length;
  const inDiscussionCount = deals.filter(d => ['CONTACTED', 'IN_DISCUSSION'].includes(d.status)).length;

  const filteredDeals = deals.filter(d => {
    if (stageFilter !== 'ALL' && (d.status || 'NEW') !== stageFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (d.company_name || '').toLowerCase().includes(q) ||
      (d.contact_name || '').toLowerCase().includes(q) ||
      (d.contact_email || '').toLowerCase().includes(q) ||
      (d.subject || '').toLowerCase().includes(q) ||
      (d.offer_summary || '').toLowerCase().includes(q)
    );
  });

  const filteredEmails = b2bEmails.filter(m => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (m.sender_name || '').toLowerCase().includes(q) ||
      (m.sender_email || '').toLowerCase().includes(q) ||
      (m.subject || '').toLowerCase().includes(q) ||
      (m.reason || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="b2b-page">
      {/* Clean Single-Row Header */}
      <header className="today-hero">
        <div className="today-hero-left">
          <div className="today-hero-meta">
            <Briefcase size={12} />
            <span>CRM &middot; Partner Network (§7)</span>
          </div>
          <h1 className="today-title">B2B &amp; Partners</h1>
        </div>

        <div className="today-hero-actions">
          <div className="b2b-search-box">
            <Search size={13} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search partner, email, offer…"
            />
            {search && (
              <button
                type="button"
                className="today-search-clear"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <button className="btn btn-primary b2b-new-btn" onClick={() => setShowModal(true)}>
            <Plus size={14} />
            <span>New Partner Deal</span>
          </button>

          <button
            className="b2b-refresh-btn"
            onClick={loadAll}
            disabled={loading}
            title="Refresh B2B data"
            aria-label="Refresh B2B data"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </header>

      {/* Compact KPI Strip */}
      <div className="b2b-stats">
        <div className="b2b-stat-card">
          <div className="b2b-stat-icon">
            <Briefcase size={16} />
          </div>
          <div>
            <div className="b2b-stat-label">Active Deals</div>
            <div className="b2b-stat-value">{loading ? '—' : activeDealsCount}</div>
          </div>
        </div>

        <div className="b2b-stat-card">
          <div className="b2b-stat-icon green">
            <CheckCircle2 size={16} />
          </div>
          <div>
            <div className="b2b-stat-label">Active Partners</div>
            <div className="b2b-stat-value">{loading ? '—' : activePartnersCount}</div>
          </div>
        </div>

        <div className="b2b-stat-card">
          <div className="b2b-stat-icon blue">
            <Clock size={16} />
          </div>
          <div>
            <div className="b2b-stat-label">In Discussion</div>
            <div className="b2b-stat-value">{loading ? '—' : inDiscussionCount}</div>
          </div>
        </div>

        <button
          type="button"
          className={`b2b-stat-card b2b-stat-clickable${activeTab === 'INBOX' ? ' active' : ''}`}
          onClick={() => setActiveTab('INBOX')}
        >
          <div className="b2b-stat-icon amber">
            <Inbox size={16} />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div className="b2b-stat-label">Unconverted Offers</div>
            <div className="b2b-stat-value">{loading ? '—' : pendingEmailsCount}</div>
          </div>
        </button>
      </div>

      {/* Smooth Sliding Tabs + Stage Filters */}
      <div className="b2b-toolbar">
        <div className="today-tabs-bar" ref={tabsBarRef} role="tablist">
          {tabIndicator.ready && (
            <span
              className="today-tab-indicator"
              aria-hidden="true"
              style={{
                width: tabIndicator.width,
                transform: `translateX(${tabIndicator.left}px)`,
              }}
            />
          )}
          {[
            { id: 'DEALS', label: 'Partner Deals', count: deals.length, icon: <Building2 size={13} /> },
            { id: 'INBOX', label: 'Incoming B2B Emails', count: b2bEmails.length, icon: <Mail size={13} /> },
          ].map(t => (
            <button
              key={t.id}
              ref={el => { tabBtnRefs.current[t.id] = el; }}
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={`today-tab${activeTab === t.id ? ' active' : ''}`}
            >
              {t.icon}
              <span>{t.label}</span>
              <span className="today-tab-count">{t.count}</span>
            </button>
          ))}
        </div>

        {activeTab === 'DEALS' && (
          <div className="b2b-stage-bar" ref={stageBarRef} role="tablist" aria-label="Filter deals by stage">
            {stageIndicator.ready && (
              <span
                className="b2b-stage-indicator"
                aria-hidden="true"
                style={{
                  width: stageIndicator.width,
                  transform: `translateX(${stageIndicator.left}px)`,
                }}
              />
            )}
            <button
              type="button"
              ref={el => { stageBtnRefs.current.ALL = el; }}
              role="tab"
              aria-selected={stageFilter === 'ALL'}
              className={`b2b-stage-tab${stageFilter === 'ALL' ? ' active' : ''}`}
              onClick={() => setStageFilter('ALL')}
            >
              <Layers size={12} className="b2b-stage-icon" />
              <span>All</span>
              <span className="b2b-stage-count">{deals.length}</span>
            </button>
            {B2B_STAGES.map(st => {
              const cnt = deals.filter(d => (d.status || 'NEW') === st.value).length;
              const StageIcon = st.icon;
              return (
                <button
                  key={st.value}
                  type="button"
                  ref={el => { stageBtnRefs.current[st.value] = el; }}
                  role="tab"
                  aria-selected={stageFilter === st.value}
                  className={`b2b-stage-tab${stageFilter === st.value ? ' active' : ''}${cnt === 0 ? ' empty' : ''}`}
                  onClick={() => setStageFilter(st.value)}
                >
                  <StageIcon size={12} className={`b2b-stage-icon ${st.tone}`} />
                  <span>{st.label}</span>
                  <span className="b2b-stage-count">{cnt}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="b2b-empty-card">
          <div className="loading-spinner"><div className="spinner spinner-dark" /></div>
        </div>
      ) : activeTab === 'DEALS' ? (
        <div className="b2b-tab-panel" key={`deals-${stageFilter}`}>
          {filteredDeals.length === 0 ? (
            <div className="b2b-empty-card">
              <div className="empty-state">
                <Briefcase size={28} style={{ opacity: 0.25 }} />
                <div className="empty-state-title">No partner deals match this view</div>
                <div className="empty-state-sub">
                  {b2bEmails.length > 0
                    ? 'Switch to "Incoming B2B Emails" to convert an offer, or create a new partner deal.'
                    : 'Click "New Partner Deal" to add a workshop, appraiser, or cooperation partner.'}
                </div>
              </div>
            </div>
          ) : (
            <div className="b2b-grid">
              {filteredDeals.map((d, idx) => {
                const company = cleanText(d.company_name) || 'Partner';
                const contact = cleanText(d.contact_name);
                const subject = cleanText(d.subject);
                const summary = cleanText(d.offer_summary);
                const stageInfo = STAGE_META[d.status || 'NEW'] || STAGE_META.NEW;
                const CardStageIcon = stageInfo.icon;

                return (
                  <article
                    key={d.id}
                    className="b2b-card"
                    style={{ '--i': Math.min(idx, 10) }}
                  >
                    <div className="b2b-card-top">
                      <div className="b2b-card-identity">
                        <div className="b2b-avatar">
                          {getCleanInitials(company, d.contact_email)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <h3 className="b2b-company">{company}</h3>
                          <div className="b2b-contact">
                            {contact && contact !== company ? `${contact} · ` : ''}{d.contact_email}
                          </div>
                        </div>
                      </div>
                      <span className="b2b-type-pill">
                        {B2B_TYPE_LABELS[d.b2b_type] || d.b2b_type || 'Partner'}
                      </span>
                    </div>

                    {(subject || summary) && (
                      <div className="b2b-card-body">
                        {subject && <div className="b2b-card-subject">{subject}</div>}
                        {summary && <div className="b2b-card-summary">{summary}</div>}
                      </div>
                    )}

                    <div className="b2b-card-footer">
                      <div className="b2b-stage-select-wrap">
                        <CardStageIcon size={13} className={`b2b-stage-icon ${stageInfo.tone}`} />
                        <select
                          className="b2b-stage-select"
                          value={d.status || 'NEW'}
                          onChange={e => handleStatusChange(d.id, e.target.value)}
                          aria-label={`Stage for ${company}`}
                        >
                          {B2B_STAGES.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="b2b-card-actions">
                        {d.contact_email && (
                          <a
                            href={`mailto:${d.contact_email}`}
                            className="btn-icon"
                            title={`Email ${d.contact_email}`}
                            aria-label={`Email ${company}`}
                          >
                            <Mail size={14} />
                          </a>
                        )}
                        <button
                          type="button"
                          className="btn-icon b2b-delete-btn"
                          onClick={() => handleDelete(d.id)}
                          title="Delete B2B Deal"
                          aria-label={`Delete ${company}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="b2b-tab-panel" key="inbox">
          {filteredEmails.length === 0 ? (
            <div className="b2b-empty-card">
              <div className="empty-state">
                <Mail size={28} style={{ opacity: 0.25 }} />
                <div className="empty-state-title">No incoming B2B emails</div>
                <div className="empty-state-sub">
                  Cooperation requests and service offers triaged by AI appear here automatically.
                </div>
              </div>
            </div>
          ) : (
            <div className="b2b-mail-list">
              {filteredEmails.map((m, idx) => {
                const emailAddr = m.reply_to || m.sender_email || '';
                const alreadyDeal = existingDealEmails.has(emailAddr.toLowerCase());
                const senderTitle = formatContactName(m.sender_name || emailAddr, emailAddr);
                const dtStr = (() => {
                  try { return format(new Date(m.email_date || m.created_at), 'dd.MM.yyyy · HH:mm'); } catch { return ''; }
                })();
                const preview = cleanText(m.reason || m.body_preview || '');

                return (
                  <div
                    key={m.id}
                    className="b2b-mail-row"
                    style={{ '--i': Math.min(idx, 10) }}
                  >
                    <div className="b2b-avatar mail">
                      {getCleanInitials(m.sender_name || emailAddr, emailAddr)}
                    </div>

                    <div className="b2b-mail-main">
                      <div className="b2b-mail-top">
                        <span className="b2b-mail-sender">{senderTitle}</span>
                        <span className="b2b-mail-email">&lt;{emailAddr}&gt;</span>
                        <span className="b2b-type-pill">
                          {B2B_TYPE_LABELS[m.category] || m.category}
                        </span>
                        <span className="b2b-mail-time">{dtStr}</span>
                      </div>

                      <div className="b2b-mail-subject">
                        {cleanText(m.subject) || '(No Subject)'}
                      </div>

                      {preview && (
                        <div className="b2b-mail-preview">
                          {m.reason && <Info size={11} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />}
                          <span>{preview}</span>
                        </div>
                      )}
                    </div>

                    <div className="b2b-mail-action">
                      {alreadyDeal ? (
                        <span className="today-pill today-pill-qualified" style={{ padding: '5px 10px', fontSize: '0.73rem' }}>
                          <Check size={12} />
                          <span>In B2B Deals</span>
                        </span>
                      ) : (
                        <button className="btn btn-primary btn-sm" onClick={() => handlePromoteEmail(m)}>
                          <ArrowUpRight size={13} />
                          <span>Create B2B Deal</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Manual B2B Deal Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <div className="modal-title">New B2B Partner Deal</div>
              <button type="button" className="btn-icon" onClick={() => setShowModal(false)} aria-label="Close modal">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateDeal}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label required">Company / Partner Name</label>
                  <input
                    className="input"
                    placeholder="e.g. AutoCheck Bayern GmbH"
                    value={form.company_name}
                    onChange={e => setForm({ ...form, company_name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Contact Person</label>
                    <input
                      className="input"
                      placeholder="Full name"
                      value={form.contact_name}
                      onChange={e => setForm({ ...form, contact_name: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Contact Email</label>
                    <input
                      className="input"
                      type="email"
                      placeholder="partner@company.de"
                      value={form.contact_email}
                      onChange={e => setForm({ ...form, contact_email: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select
                      className="select"
                      value={form.b2b_type}
                      onChange={e => setForm({ ...form, b2b_type: e.target.value })}
                    >
                      {B2B_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Initial Stage</label>
                    <select
                      className="select"
                      value={form.status}
                      onChange={e => setForm({ ...form, status: e.target.value })}
                    >
                      {B2B_STAGES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Subject / Offer Title</label>
                  <input
                    className="input"
                    placeholder="Short title of the cooperation or offer"
                    value={form.subject}
                    onChange={e => setForm({ ...form, subject: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Summary &amp; Notes</label>
                  <textarea
                    className="textarea"
                    rows={3}
                    placeholder="Key terms, services offered, or follow-up notes…"
                    value={form.offer_summary}
                    onChange={e => setForm({ ...form, offer_summary: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving…' : 'Save B2B Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
