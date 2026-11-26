import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import {
  Sparkles, CheckCircle2, Clock, FileText, ShieldAlert, Briefcase,
  Send, RefreshCw, Search, Mail, AlertCircle, Tag, Check, X, ArrowRight,
  Car, Calendar, ShieldCheck, Zap, ChevronLeft, MessageSquare, Phone
} from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { cleanText, formatContactName, getCleanInitials } from '../utils/textUtils';

const CATEGORY_OPTIONS = [
  { value: 'seller', label: 'Vehicle Seller (§3)' },
  { value: 'sourcing', label: 'Vehicle Sourcing (§5)' },
  { value: 'sell_and_source', label: 'Combined Sell + Source (§6)' },
  { value: 'advertised_buyer', label: 'Advertised Vehicle Buyer (§4)' },
  { value: 'marketplace', label: 'Marketplace Buyer (mobile.de / AS24)' },
  { value: 'b2b_cooperation', label: 'B2B Cooperation Inquiry (§7)' },
  { value: 'b2b_offer', label: 'B2B Service Offer (§7)' },
  { value: 'b2b_advertising', label: 'B2B Advertising' },
  { value: 'invoice', label: 'Invoice / Financial Document (§7)' },
  { value: 'other', label: 'Other / Unclear Inquiry' },
  { value: 'spam', label: 'Flagged: Suspected Spam / Phishing (§7)' },
];

const CATEGORY_SHORT_LABELS = {
  seller: 'Seller',
  sourcing: 'Sourcing',
  sell_and_source: 'Sell + Source',
  advertised_buyer: 'Advertised Buyer',
  marketplace: 'Marketplace',
  lead_buy: 'Buy Lead',
  lead_sell: 'Sell Lead',
  lead_other: 'Lead',
  b2b_cooperation: 'B2B Coop',
  b2b_offer: 'B2B Offer',
  b2b_solicitation: 'B2B Solicitation',
  b2b_advertising: 'B2B Ad',
  invoice: 'Invoice',
  other: 'Other',
  spam: 'Spam',
  automated: 'Automated',
  marketing: 'Marketing',
};

const PARAM_LABELS = {
  manufacturer_model: 'Vehicle / Model',
  first_registration: 'First Reg. / Year',
  mileage: 'Mileage',
  price_or_budget: 'Price / Voluntary Budget',
  timeframe: 'Timeframe',
  location: 'Location / Region',
  phone: 'Telephone',
  preferred_channel: 'Preferred Channel',
  intended_use: 'Intended Use',
  viewing_requested: 'Viewing Requested',
  reservation_requested: 'Reservation Requested',
  availability_question: 'Availability Check',
  payment_deadline: 'Payment Deadline',
};

function isCustomerCategory(cat) {
  return ['seller', 'sourcing', 'sell_and_source', 'advertised_buyer', 'marketplace', 'lead_buy', 'lead_sell', 'lead_other', 'other'].includes(cat);
}

function isB2BCategory(cat, decision) {
  return decision === 'b2b' || ['b2b_cooperation', 'b2b_offer', 'b2b_solicitation'].includes(cat);
}

function isFlaggedCategory(cat, decision) {
  return decision === 'drop' || ['spam', 'automated', 'marketing', 'b2b_advertising'].includes(cat);
}

function cleanMultilineText(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/(\\+u[fF]{3}[dD]|[\ufffd\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F])+/gi, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function TodayInquiries() {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL_LEADS'); // ALL_LEADS | QUALIFIED | NEEDS_INFO | B2B | INVOICES | FLAGGED
  const [dateScope, setDateScope] = useState('ALL'); // TODAY | ALL
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailTab, setDetailTab] = useState('SPECS'); // SPECS | MESSAGE
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const tabsBarRef = useRef(null);
  const tabBtnRefs = useRef({});
  const [tabIndicator, setTabIndicator] = useState({ left: 0, width: 0, ready: false });

  const scopeSwitchRef = useRef(null);
  const scopeBtnRefs = useRef({});
  const [scopeIndicator, setScopeIndicator] = useState({ left: 0, width: 0, ready: false });

  const selectRow = (row, openMobileDetail = false) => {
    setSelected(row);
    setDraftSubject(row?.draft_subject || `Re: ${cleanText(row?.subject) || 'Ihre Anfrage bei CAR-AGENTS'}`);
    setDraftBody(row?.draft_reply || '');
    setEditCategory(row?.category || 'sourcing');
    const hasStructured = Object.keys(row?.extracted_params || {}).length > 0 || (row?.missing_fields || []).length > 0;
    setDetailTab(hasStructured ? 'SPECS' : 'MESSAGE');
    if (openMobileDetail) setMobileShowDetail(true);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const rows = await api.getInquiries(200);
      setInquiries(rows);
      if (rows.length && !selected) {
        const firstLead = rows.find(r => !isFlaggedCategory(r.category, r.decision)) || rows[0];
        selectRow(firstLead);
      } else if (selected) {
        const refreshed = rows.find(r => r.id === selected.id);
        if (refreshed) selectRow(refreshed);
      }
    } catch (err) {
      toast.error('Failed to load inquiries: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await api.triggerEmailPoll();
      toast.success(`Strato Sync finished (${res.processed || 0} new message(s)).`);
      loadData();
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleAutoReply = async () => {
    const next = !autoReply;
    setAutoReply(next);
    try {
      await api.toggleEmailAutoReply(next);
      toast.success(next ? 'Email Auto-Reply enabled (Seller/Sourcing)' : 'Phase 1 Draft-Only Mode active (Owner approval required)');
    } catch {
      toast.success(next ? 'Auto-Reply toggled ON' : 'Draft-Only Mode ON');
    }
  };

  const handleCategoryChange = async (newCat) => {
    setEditCategory(newCat);
    if (!selected) return;
    try {
      const isSpam = ['spam', 'automated', 'b2b_advertising'].includes(newCat);
      const isB2B = ['b2b_cooperation', 'b2b_offer'].includes(newCat);
      const nextDecision = isSpam ? 'drop' : isB2B ? 'b2b' : newCat === 'invoice' ? 'invoice' : 'lead';
      const updated = await api.updateInquiry(selected.id, { category: newCat, decision: nextDecision });
      toast.success(`Classification updated to "${CATEGORY_SHORT_LABELS[newCat] || newCat}"`);
      selectRow(updated);
      setInquiries(prev => prev.map(r => (r.id === updated.id ? updated : r)));
    } catch (err) {
      toast.error('Could not update classification: ' + err.message);
    }
  };

  const handleApproveAndSend = async (sendEmail) => {
    if (!selected) return;
    setSubmitting(true);
    try {
      await api.approveInquiry(selected.id, {
        send_draft: sendEmail,
        draft_subject: draftSubject,
        draft_reply: draftBody,
        category: editCategory,
      });
      toast.success(
        sendEmail
          ? `Approved! Lead created in CRM & response sent to ${selected.reply_to || selected.sender_email}.`
          : 'Approved! Lead created in CRM without sending an email.'
      );
      await loadData();
    } catch (err) {
      toast.error('Approval failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFlagAsSpam = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const updated = await api.updateInquiry(selected.id, {
        decision: 'drop',
        category: 'spam',
        resolution: 'no',
        resolved_at: new Date().toISOString(),
      });
      toast.success('Moved to Flagged Spam (retained for audit, hidden from leads).');
      setInquiries(prev => prev.map(r => (r.id === updated.id ? updated : r)));
      selectRow(updated);
    } catch (err) {
      toast.error('Failed to flag inquiry: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateB2BFromInquiry = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const email = selected.reply_to || selected.sender_email || '';
      const domainCompany = email.includes('@') ? email.split('@')[1].split('.')[0].toUpperCase() : 'Partner';
      await api.createB2BDeal({
        triage_id: selected.id,
        company_name: selected.sender_name || domainCompany,
        contact_name: selected.sender_name || email,
        contact_email: email,
        b2b_type: selected.category === 'b2b_cooperation' ? 'cooperation' : 'general_offer',
        subject: selected.subject,
        offer_summary: selected.reason || selected.body_preview,
        status: 'NEW',
        notes: selected.body_preview,
      });
      toast.success('Created B2B Deal in B2B & Partners!');
      navigate('/b2b');
    } catch (err) {
      toast.error('Could not create B2B deal: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Date & tab filtering
  const todayStr = new Date().toISOString().slice(0, 10);
  const filterByScope = (rows, scope) => rows.filter(r => {
    if (scope !== 'TODAY') return true;
    const dt = (r.email_date || r.created_at || '').slice(0, 10);
    return dt === todayStr;
  });

  const getTabSlices = (rows) => {
    const all = rows.filter(r => !isFlaggedCategory(r.category, r.decision) && !isB2BCategory(r.category, r.decision) && r.category !== 'invoice');
    return {
      ALL_LEADS: all,
      QUALIFIED: all.filter(r => r.is_qualified),
      NEEDS_INFO: all.filter(r => !r.is_qualified),
      B2B: rows.filter(r => isB2BCategory(r.category, r.decision)),
      INVOICES: rows.filter(r => r.category === 'invoice' || r.decision === 'invoice'),
      FLAGGED: rows.filter(r => isFlaggedCategory(r.category, r.decision)),
    };
  };

  const todayCount = inquiries.filter(r => (r.email_date || r.created_at || '').slice(0, 10) === todayStr).length;
  const dateFiltered = filterByScope(inquiries, dateScope);
  const tabSlices = getTabSlices(dateFiltered);
  const allLeads = tabSlices.ALL_LEADS;
  const qualifiedLeads = tabSlices.QUALIFIED;
  const needsInfoLeads = tabSlices.NEEDS_INFO;
  const b2bList = tabSlices.B2B;
  const invoiceList = tabSlices.INVOICES;
  const flaggedList = tabSlices.FLAGGED;

  const matchesSearch = (r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.sender_name || '').toLowerCase().includes(q) ||
      (r.sender_email || '').toLowerCase().includes(q) ||
      (r.subject || '').toLowerCase().includes(q) ||
      (r.body_preview || '').toLowerCase().includes(q) ||
      JSON.stringify(r.extracted_params || {}).toLowerCase().includes(q)
    );
  };

  const activeList = (tabSlices[activeTab] || allLeads).filter(matchesSearch);

  const selectedVehicle = cleanText((selected?.extracted_params || {}).manufacturer_model || '');

  // Keep detail selection synced cleanly when switching tabs or date scope
  const syncSelectionFor = (tabId, scope) => {
    const nextSlices = getTabSlices(filterByScope(inquiries, scope));
    const targetList = (nextSlices[tabId] || []).filter(matchesSearch);
    if (targetList.length === 0) {
      setSelected(null);
      setMobileShowDetail(false);
    } else if (!selected || !targetList.some(item => item.id === selected.id)) {
      selectRow(targetList[0]);
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    syncSelectionFor(tabId, dateScope);
  };

  const handleScopeChange = (nextScope) => {
    setDateScope(nextScope);
    syncSelectionFor(activeTab, nextScope);
  };

  // Measure and glide the active tab & scope pill indicators
  useLayoutEffect(() => {
    const updateIndicators = () => {
      const activeTabEl = tabBtnRefs.current[activeTab];
      if (activeTabEl) {
        setTabIndicator({
          left: activeTabEl.offsetLeft,
          width: activeTabEl.offsetWidth,
          ready: true,
        });
      }
      const activeScopeEl = scopeBtnRefs.current[dateScope];
      if (activeScopeEl) {
        setScopeIndicator({
          left: activeScopeEl.offsetLeft,
          width: activeScopeEl.offsetWidth,
          ready: true,
        });
      }
    };

    updateIndicators();
    const activeTabEl = tabBtnRefs.current[activeTab];
    if (activeTabEl?.scrollIntoView) {
      activeTabEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }

    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateIndicators);
      if (tabsBarRef.current) ro.observe(tabsBarRef.current);
      if (scopeSwitchRef.current) ro.observe(scopeSwitchRef.current);
    }
    window.addEventListener('resize', updateIndicators);
    return () => {
      window.removeEventListener('resize', updateIndicators);
      if (ro) ro.disconnect();
    };
  }, [activeTab, dateScope, inquiries.length]);

  return (
    <div className="today-page">
      {/* Clean Single-Row Header */}
      <header className="today-hero">
        <div className="today-hero-left">
          <div className="today-hero-meta">
            <Calendar size={12} />
            <span>{format(new Date(), 'EEEE, dd. MMMM yyyy')}</span>
            <span className="today-meta-dot" aria-hidden="true">&middot;</span>
            <span>Phase 1 AI Triage</span>
          </div>
          <h1 className="today-title">Today&rsquo;s Inquiries</h1>
        </div>

        <div className="today-hero-actions">
          <div className="today-scope-switch" ref={scopeSwitchRef} role="group" aria-label="Date scope">
            {scopeIndicator.ready && (
              <span
                className="today-scope-indicator"
                aria-hidden="true"
                style={{
                  width: scopeIndicator.width,
                  transform: `translateX(${scopeIndicator.left}px)`,
                }}
              />
            )}
            {[
              { id: 'TODAY', label: 'Today', count: todayCount },
              { id: 'ALL', label: 'All', count: inquiries.length },
            ].map(sc => (
              <button
                key={sc.id}
                ref={el => { scopeBtnRefs.current[sc.id] = el; }}
                onClick={() => handleScopeChange(sc.id)}
                className={`today-scope-btn${dateScope === sc.id ? ' active' : ''}`}
              >
                <span>{sc.label}</span>
                <span className="today-scope-count">{sc.count}</span>
              </button>
            ))}
          </div>

          <button
            className={`today-mode-btn${autoReply ? ' auto' : ''}`}
            onClick={handleToggleAutoReply}
            title="Phase 1 default: Draft-Only (Owner approves every message)"
          >
            {autoReply ? <Zap size={13} /> : <ShieldCheck size={13} />}
            <span>{autoReply ? 'Auto-Reply: ON' : 'Draft & Approve'}</span>
          </button>

          <div className="today-action-group">
            <button className="today-sync-btn" onClick={handleSync} disabled={syncing}>
              <Mail size={13} />
              <span>{syncing ? 'Syncing…' : 'Sync Strato'}</span>
            </button>
            <button
              className="today-refresh-btn"
              onClick={loadData}
              disabled={loading}
              title="Refresh inquiries"
              aria-label="Refresh inquiries"
            >
              <RefreshCw size={13} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Segmented Category Tabs */}
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
          { id: 'ALL_LEADS', label: 'All Inquiries', count: allLeads.length, icon: <Sparkles size={13} /> },
          { id: 'QUALIFIED', label: 'Qualified', count: qualifiedLeads.length, icon: <CheckCircle2 size={13} /> },
          { id: 'NEEDS_INFO', label: 'Needs Info', count: needsInfoLeads.length, icon: <Clock size={13} /> },
          { id: 'B2B', label: 'B2B Offers', count: b2bList.length, icon: <Briefcase size={13} /> },
          { id: 'INVOICES', label: 'Invoices', count: invoiceList.length, icon: <FileText size={13} /> },
          { id: 'FLAGGED', label: 'Spam', count: flaggedList.length, icon: <ShieldAlert size={13} /> },
        ].map(t => (
          <button
            key={t.id}
            ref={el => { tabBtnRefs.current[t.id] = el; }}
            role="tab"
            aria-selected={activeTab === t.id}
            onClick={() => handleTabChange(t.id)}
            className={`today-tab${activeTab === t.id ? ' active' : ''}`}
          >
            {t.icon}
            <span>{t.label}</span>
            <span className="today-tab-count">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Split Workspace */}
      <div className={`today-workspace${mobileShowDetail && selected ? ' has-selection' : ''}`}>
        {/* Left Queue */}
        <div className="today-queue">
          <div className="today-queue-top">
            <div className="today-search-box">
              <Search size={14} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customer, vehicle, parameter…"
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
            <div className="today-queue-meta">
              <span>{activeList.length} {activeList.length === 1 ? 'inquiry' : 'inquiries'} shown</span>
              <span>{dateScope === 'TODAY' ? 'Today' : 'All time'}</span>
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner">
              <div className="spinner spinner-dark" />
            </div>
          ) : activeList.length === 0 ? (
            <div className="empty-state" style={{ flex: 1, justifyContent: 'center' }}>
              <Sparkles size={26} style={{ opacity: 0.35 }} />
              <div className="empty-state-title">No inquiries in this view</div>
              <div className="empty-state-sub">
                {dateScope === 'TODAY'
                  ? 'Switch to "All Inquiries" to review earlier messages.'
                  : 'Click Sync Strato to fetch new incoming messages.'}
              </div>
            </div>
          ) : (
            <div className="today-queue-list" key={`${activeTab}-${dateScope}`}>
              {activeList.map((r, idx) => {
                const isSelected = selected?.id === r.id;
                const params = r.extracted_params || {};
                const veh = cleanText(params.manufacturer_model || '');
                const flagged = isFlaggedCategory(r.category, r.decision);
                const b2b = isB2BCategory(r.category, r.decision);
                const displayName = formatContactName(r.sender_name || r.sender_email, r.sender_email, veh);
                const initials = getCleanInitials(r.sender_name || r.sender_email, r.sender_email);
                const dtStr = (() => {
                  try { return format(new Date(r.email_date || r.created_at), 'dd.MM · HH:mm'); } catch { return ''; }
                })();
                const avatarTone = flagged ? 'flagged' : b2b ? 'b2b' : r.is_qualified ? 'qualified' : 'needs-info';
                const isLeadItem = !flagged && !b2b && r.category !== 'invoice';

                return (
                  <div
                    key={r.id}
                    className={`today-item${isSelected ? ' active' : ''}`}
                    style={{ '--i': Math.min(idx, 10) }}
                    onClick={() => selectRow(r, true)}
                  >
                    <div className={`today-item-avatar ${avatarTone}`}>
                      {initials}
                    </div>

                    <div className="today-item-body">
                      <div className="today-item-top">
                        <span className="today-item-sender">{displayName}</span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {r.priority === 'HIGH' && (
                            <span className="today-pill today-pill-high">HIGH</span>
                          )}
                          <span className="today-item-time">{dtStr}</span>
                        </div>
                      </div>

                      <div className="today-item-subject">
                        {cleanText(r.subject) || '(No Subject)'}
                      </div>

                      <div className="today-item-footer">
                        {veh ? (
                          <span className="today-pill today-pill-car" title={veh}>
                            <Car size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
                            <span>{veh}</span>
                          </span>
                        ) : (
                          <span className="today-pill today-pill-cat">
                            {CATEGORY_SHORT_LABELS[r.category] || r.category}
                          </span>
                        )}

                        {isLeadItem && (
                          <span className={`today-pill ${r.is_qualified ? 'today-pill-qualified' : 'today-pill-needs'}`}>
                            {r.is_qualified ? <CheckCircle2 size={10} /> : <Clock size={10} />}
                            {r.is_qualified ? 'Qualified' : 'Needs Info'}
                          </span>
                        )}

                        {r.resolution === 'ok' && (
                          <span className="today-pill today-pill-approved">
                            <Check size={10} />
                            Sent
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Detail & Approval Studio */}
        <div className="today-detail">
          {!selected ? (
            <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
              <Sparkles size={30} style={{ opacity: 0.25 }} />
              <div className="empty-state-title">Select an inquiry</div>
              <div className="empty-state-sub">
                Inspect extracted vehicle parameters, missing requirements, customer message, and approve the AI draft reply.
              </div>
            </div>
          ) : (
            <div className="today-detail-stack" key={selected.id}>
              <button
                type="button"
                className="today-mobile-back"
                onClick={() => setMobileShowDetail(false)}
              >
                <ChevronLeft size={14} />
                Back to inquiries
              </button>

              {/* 1. Focus Summary Card */}
              <div className="today-card">
                <div className="today-card-body">
                  <div className="today-detail-top">
                    <div className="today-detail-head-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                        {!isFlaggedCategory(selected.category, selected.decision) && !isB2BCategory(selected.category, selected.decision) && selected.category !== 'invoice' && (
                          <span className={`today-pill ${selected.is_qualified ? 'today-pill-qualified' : 'today-pill-needs'}`}>
                            {selected.is_qualified ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                            {selected.is_qualified ? 'Qualified' : 'Needs Info'}
                          </span>
                        )}

                        {selected.priority === 'HIGH' && (
                          <span className="today-pill today-pill-high">HIGH</span>
                        )}

                        {selected.resolution === 'ok' && (
                          <span className="today-pill today-pill-approved">
                            <Check size={11} />
                            Approved
                          </span>
                        )}

                        <span className="today-id-chip">#{String(selected.id).slice(0, 6)}</span>
                      </div>

                      <h2 className="today-detail-subject">
                        {cleanText(selected.subject) || '(No Subject)'}
                      </h2>

                      <div className="today-detail-sender">
                        <strong>{formatContactName(selected.sender_name || selected.sender_email, selected.sender_email, selectedVehicle)}</strong>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {selected.reply_to || selected.sender_email}
                        </span>
                      </div>
                    </div>

                    {/* Owner Classification Override (§2) */}
                    <div className="today-override-box">
                      <Tag size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <select
                        className="today-override-select"
                        value={editCategory}
                        onChange={e => handleCategoryChange(e.target.value)}
                        aria-label="Classification Override"
                      >
                        {CATEGORY_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Key Facts Glance Strip */}
                  {(() => {
                    const p = selected.extracted_params || {};
                    const facts = [
                      selectedVehicle && { icon: <Car size={14} strokeWidth={2} />, label: 'Vehicle', value: selectedVehicle },
                      p.price_or_budget && { icon: <Tag size={13} />, label: 'Budget / Price', value: cleanText(String(p.price_or_budget)) },
                      (p.first_registration || p.mileage) && {
                        icon: <Clock size={13} />,
                        label: p.first_registration && p.mileage ? 'Year · Mileage' : p.first_registration ? 'First Reg.' : 'Mileage',
                        value: [p.first_registration, p.mileage].filter(Boolean).map(v => cleanText(String(v))).join(' · '),
                      },
                      (p.phone || p.location) && {
                        icon: <Phone size={13} />,
                        label: p.phone ? 'Phone' : 'Location',
                        value: cleanText(String(p.phone || p.location)),
                      },
                    ].filter(Boolean);

                    if (facts.length === 0) return null;
                    return (
                      <div className="today-facts-grid">
                        {facts.map(f => (
                          <div key={f.label} className="today-fact-tile">
                            <span className="today-fact-icon">{f.icon}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className="today-fact-label">{f.label}</div>
                              <div className="today-fact-value" title={f.value}>{f.value}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {selected.reason && (
                    <div className="today-ai-line">
                      <Sparkles size={13} style={{ flexShrink: 0, color: 'var(--text-primary)' }} />
                      <span>
                        {cleanText(selected.reason)}
                        {selected.priority_reason ? ` · ${cleanText(selected.priority_reason)}` : ''}
                      </span>
                    </div>
                  )}

                  {selected.payment_deadline && (
                    <div className="today-deadline-banner">
                      <Calendar size={14} style={{ flexShrink: 0 }} />
                      <span>Payment Deadline (§7): {cleanText(selected.payment_deadline)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Tabbed Inspector Card: Specs & Missing Info | Original Message */}
              <div className="today-card">
                <div className="today-inspector-bar">
                  <div className="today-inspector-tabs" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={detailTab === 'SPECS'}
                      className={`today-inspector-tab${detailTab === 'SPECS' ? ' active' : ''}`}
                      onClick={() => setDetailTab('SPECS')}
                    >
                      <CheckCircle2 size={13} />
                      <span>Specs &amp; Checklist</span>
                      {(selected.missing_fields || []).length > 0 && (
                        <span className="today-inspector-badge warn">
                          {(selected.missing_fields || []).length} missing
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={detailTab === 'MESSAGE'}
                      className={`today-inspector-tab${detailTab === 'MESSAGE' ? ' active' : ''}`}
                      onClick={() => setDetailTab('MESSAGE')}
                    >
                      <MessageSquare size={13} />
                      <span>Original Message</span>
                    </button>
                  </div>
                </div>

                <div className="today-card-body">
                  {detailTab === 'SPECS' ? (
                    <div className="today-inspector-split" key={`specs-${selected.id}`}>
                      {/* Extracted Parameters */}
                      <div>
                        <div className="today-section-kicker">Extracted Details</div>
                        {Object.keys(selected.extracted_params || {}).length === 0 ? (
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            No structured parameters detected yet.
                          </div>
                        ) : (
                          <div className="today-param-list">
                            {Object.entries(selected.extracted_params || {}).map(([k, v]) => (
                              <div key={k} className="today-param-row">
                                <span className="today-param-label">
                                  {k === 'manufacturer_model' && <Car size={12} strokeWidth={2} style={{ color: 'var(--text-primary)' }} />}
                                  <span>{PARAM_LABELS[k] || k}</span>
                                </span>
                                <span className="today-param-val">{cleanText(String(v))}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Missing Info Chips */}
                      <div>
                        <div className="today-section-kicker">
                          Missing Info ({(selected.missing_fields || []).length})
                        </div>
                        {(selected.missing_fields || []).length === 0 ? (
                          <div className="today-complete-note">
                            <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
                            <span>All key fields present. Ready to call or reply.</span>
                          </div>
                        ) : (
                          <div className="today-missing-chips">
                            {(selected.missing_fields || []).map((m, idx) => (
                              <span key={idx} className="today-missing-chip">
                                <AlertCircle size={11} style={{ flexShrink: 0 }} />
                                <span>{cleanText(m)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="today-message-box" key={`msg-${selected.id}`}>
                      {cleanMultilineText(selected.body_preview) || '(Empty message body)'}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar for B2B Inquiries */}
              {isB2BCategory(editCategory, selected.decision) && (
                <div className="today-card today-b2b-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 'var(--radius)',
                        background: '#EFF6FF',
                        color: '#2563EB',
                        border: '1px solid #BFDBFE',
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Briefcase size={16} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        B2B Cooperation / Service Offer (§7)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                        Convert this message into a B2B Deal in B2B &amp; Partners.
                      </div>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleCreateB2BFromInquiry} disabled={submitting}>
                    <Briefcase size={13} />
                    <span>Create B2B Deal</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* 3. Owner-Approved Draft Response Editor (§1, §3, §4, §5) */}
              {isCustomerCategory(editCategory) && (
                <div className="today-card">
                  <div className="today-card-head">
                    <div className="today-card-title">
                      <Mail size={15} style={{ color: 'var(--text-secondary)' }} />
                      <span>Draft Reply</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>
                        &middot; Sent only on approval
                      </span>
                    </div>
                    <span className="today-pill today-pill-approved" style={{ textTransform: 'capitalize' }}>
                      {selected.draft_status || 'pending'}
                    </span>
                  </div>

                  <div className="today-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>Subject</label>
                      <input
                        className="input"
                        value={draftSubject}
                        onChange={e => setDraftSubject(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="form-label" style={{ display: 'block', marginBottom: 4 }}>
                        Message
                      </label>
                      <textarea
                        className="textarea"
                        rows={6}
                        value={draftBody}
                        onChange={e => setDraftBody(e.target.value)}
                        style={{ lineHeight: 1.55 }}
                      />
                    </div>

                    <div className="today-draft-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => handleApproveAndSend(true)}
                        disabled={submitting}
                      >
                        <Send size={13} />
                        <span>Approve &amp; Send Reply</span>
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => handleApproveAndSend(false)}
                        disabled={submitting}
                      >
                        <Check size={13} />
                        <span>Approve Only (No Email)</span>
                      </button>

                      <button
                        className="btn btn-danger today-spam-btn"
                        onClick={handleFlagAsSpam}
                        disabled={submitting}
                      >
                        <X size={13} />
                        <span>Mark as Spam</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
