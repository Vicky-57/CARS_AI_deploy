import { useState, useEffect } from 'react';
import {
  Sparkles, CheckCircle2, Clock, FileText, ShieldAlert, Briefcase,
  Send, RefreshCw, Search, Mail, AlertCircle, Tag, Check, X, ArrowRight
} from 'lucide-react';
import { api } from '../api/api';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

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

export default function TodayInquiries() {
  const navigate = useNavigate();
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ALL_LEADS'); // ALL_LEADS | QUALIFIED | NEEDS_INFO | B2B | INVOICES | FLAGGED
  const [dateScope, setDateScope] = useState('ALL'); // TODAY | ALL
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [autoReply, setAutoReply] = useState(false);
  const [syncing, setSyncing] = useState(false);

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

  const selectRow = (row) => {
    setSelected(row);
    setDraftSubject(row?.draft_subject || `Re: ${row?.subject || 'Ihre Anfrage bei CAR-AGENTS'}`);
    setDraftBody(row?.draft_reply || '');
    setEditCategory(row?.category || 'sourcing');
  };

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
      toast.success(`Classification updated to "${newCat}"`);
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
      const res = await api.approveInquiry(selected.id, {
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
  const dateFiltered = inquiries.filter(r => {
    if (dateScope !== 'TODAY') return true;
    const dt = (r.email_date || r.created_at || '').slice(0, 10);
    return dt === todayStr;
  });

  const allLeads = dateFiltered.filter(r => !isFlaggedCategory(r.category, r.decision) && !isB2BCategory(r.category, r.decision) && r.category !== 'invoice');
  const qualifiedLeads = allLeads.filter(r => r.is_qualified);
  const needsInfoLeads = allLeads.filter(r => !r.is_qualified);
  const b2bList = dateFiltered.filter(r => isB2BCategory(r.category, r.decision));
  const invoiceList = dateFiltered.filter(r => r.category === 'invoice' || r.decision === 'invoice');
  const flaggedList = dateFiltered.filter(r => isFlaggedCategory(r.category, r.decision));

  const activeList = (
    activeTab === 'ALL_LEADS' ? allLeads :
    activeTab === 'QUALIFIED' ? qualifiedLeads :
    activeTab === 'NEEDS_INFO' ? needsInfoLeads :
    activeTab === 'B2B' ? b2bList :
    activeTab === 'INVOICES' ? invoiceList :
    flaggedList
  ).filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.sender_name || '').toLowerCase().includes(q) ||
      (r.sender_email || '').toLowerCase().includes(q) ||
      (r.subject || '').toLowerCase().includes(q) ||
      (r.body_preview || '').toLowerCase().includes(q) ||
      JSON.stringify(r.extracted_params || {}).toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div className="page-header-left">
          <h1 className="page-title">Phase 1 — AI Inquiry Triage & Qualification</h1>
          <p className="page-subtitle">
            All customer inquiries (qualified & missing info) with extracted parameters, requirements & owner-approved draft replies
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Today vs All Time Toggle */}
          <div style={{ display: 'inline-flex', background: 'var(--border)', padding: 2, borderRadius: 'var(--radius-sm)' }}>
            {[
              { id: 'TODAY', label: 'Today Only' },
              { id: 'ALL', label: 'All Inquiries' },
            ].map(sc => (
              <button
                key={sc.id}
                onClick={() => setDateScope(sc.id)}
                style={{
                  padding: '5px 10px', borderRadius: 4, fontWeight: 600, fontSize: '0.73rem',
                  border: 'none', cursor: 'pointer',
                  background: dateScope === sc.id ? 'var(--surface)' : 'transparent',
                  color: dateScope === sc.id ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {sc.label}
              </button>
            ))}
          </div>

          <button
            className={`btn btn-sm ${autoReply ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleToggleAutoReply}
            title="Phase 1 default: Draft-Only (Owner approves every message)"
          >
            {autoReply ? '⚡ Auto-Reply: ON' : '🛡️ Mode: Draft & Approve (Phase 1)'}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={handleSync} disabled={syncing}>
            <Mail size={13} />
            {syncing ? 'Syncing…' : 'Sync Strato'}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={loadData}>
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {[
          { id: 'ALL_LEADS', label: `All Customer Inquiries (${allLeads.length})`, icon: <Sparkles size={13} /> },
          { id: 'QUALIFIED', label: `Qualified (${qualifiedLeads.length})`, icon: <CheckCircle2 size={13} /> },
          { id: 'NEEDS_INFO', label: `Needs Info / Unqualified (${needsInfoLeads.length})`, icon: <Clock size={13} /> },
          { id: 'B2B', label: `B2B Offers (${b2bList.length})`, icon: <Briefcase size={13} /> },
          { id: 'INVOICES', label: `Invoices & Receipts (${invoiceList.length})`, icon: <FileText size={13} /> },
          { id: 'FLAGGED', label: `Flagged Spam (${flaggedList.length})`, icon: <ShieldAlert size={13} /> },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`btn btn-sm ${activeTab === t.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Split Workspace */}
      <div className="split-panel" style={{ flex: 1, minHeight: 0 }}>
        {/* Left List */}
        <div className="split-left">
          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div className="search-bar" style={{ maxWidth: '100%' }}>
              <Search size={13} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search customer, vehicle, parameter, or query…"
              />
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : activeList.length === 0 ? (
            <div className="empty-state">
              <Sparkles size={24} />
              <h3>No inquiries in this view</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {dateScope === 'TODAY' ? 'Switch to "All Inquiries" to see historical items.' : 'Click Sync Strato to fetch new messages.'}
              </p>
            </div>
          ) : (
            activeList.map(r => {
              const isSelected = selected?.id === r.id;
              const params = r.extracted_params || {};
              const veh = params.manufacturer_model || '';
              const dtStr = (() => {
                try { return format(new Date(r.email_date || r.created_at), 'dd.MM · HH:mm'); } catch { return ''; }
              })();
              return (
                <div
                  key={r.id}
                  className={`contact-item${isSelected ? ' active' : ''}`}
                  onClick={() => selectRow(r)}
                >
                  <div className="contact-info" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span className="contact-name" style={{ fontWeight: 600 }}>
                        {r.sender_name || r.sender_email}
                      </span>
                      <span style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>{dtStr}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span className="badge badge-info" style={{ fontSize: '0.62rem' }}>{r.category}</span>
                      {!isFlaggedCategory(r.category, r.decision) && (
                        <span
                          className="badge"
                          style={{
                            fontSize: '0.62rem',
                            background: r.is_qualified ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                            color: r.is_qualified ? '#059669' : '#d97706',
                          }}
                        >
                          {r.is_qualified ? '✓ Qualified' : '⏳ Needs Info'}
                        </span>
                      )}
                      {r.priority === 'HIGH' && (
                        <span className="badge" style={{ fontSize: '0.62rem', background: 'rgba(239,68,68,0.15)', color: '#dc2626' }}>
                          🔥 HIGH
                        </span>
                      )}
                      {veh && (
                        <span className="badge" style={{ fontSize: '0.62rem', background: 'var(--bg-muted)' }}>
                          🚗 {veh}
                        </span>
                      )}
                      {r.resolution === 'ok' && (
                        <span className="badge" style={{ fontSize: '0.62rem', background: 'rgba(59,130,246,0.15)', color: '#2563eb' }}>
                          Approved
                        </span>
                      )}
                    </div>

                    <div className="contact-preview" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                      {(r.subject || '(No Subject)').slice(0, 62)}
                    </div>
                    <div className="contact-preview" style={{ fontSize: '0.73rem' }}>
                      {(r.reason || r.body_preview || '').slice(0, 75)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Detail & Approval Pane */}
        <div className="split-right" style={{ overflowY: 'auto', padding: 20 }}>
          {!selected ? (
            <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
              <Sparkles size={32} style={{ opacity: 0.2 }} />
              <h3>Select an inquiry</h3>
              <p>Inspect extracted parameters, missing requirements, customer query, and approve the AI draft reply.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Top Bar: Sender, Classification Override & Quick Actions */}
              <div className="card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{selected.subject || '(No Subject)'}</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      From: <strong>{selected.sender_name || selected.sender_email}</strong> &lt;{selected.reply_to || selected.sender_email}&gt;
                      {' · '}ID: <code>#{String(selected.id).slice(0, 6)}</code>
                    </div>
                    {selected.reason && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: 6, fontWeight: 500 }}>
                        🤖 {selected.reason}
                        {selected.priority_reason ? ` — Priority (${selected.priority}): ${selected.priority_reason}` : ''}
                      </div>
                    )}
                  </div>

                  {/* Owner Classification Override (§2) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={14} style={{ color: 'var(--text-muted)' }} />
                    <select
                      className="input"
                      value={editCategory}
                      onChange={e => handleCategoryChange(e.target.value)}
                      style={{ fontSize: '0.78rem', padding: '5px 10px', minWidth: 220 }}
                    >
                      {CATEGORY_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {selected.payment_deadline && (
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 6, background: 'rgba(245,158,11,0.14)', color: '#b45309', fontSize: '0.82rem', fontWeight: 600 }}>
                    📅 Highlighted Payment Deadline (§7): {selected.payment_deadline}
                  </div>
                )}
              </div>

              {/* Parameters & Missing Information Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                {/* Extracted Parameters */}
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={15} style={{ color: '#059669' }} />
                    Extracted Parameters & Requirements
                  </div>
                  {Object.keys(selected.extracted_params || {}).length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      No structured vehicle/contact parameters detected yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {Object.entries(selected.extracted_params || {}).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', borderBottom: '1px dashed var(--border)', paddingBottom: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{PARAM_LABELS[k] || k}:</span>
                          <strong style={{ textAlign: 'right' }}>{String(v)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Missing Qualification Fields */}
                <div className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={15} style={{ color: (selected.missing_fields || []).length ? '#d97706' : '#059669' }} />
                    Missing Information Checklist
                  </div>
                  {(selected.missing_fields || []).length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 500 }}>
                      ✓ All initial Phase 1 fields present (or concise listing inquiry). Ready for personal call / response.
                    </div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {(selected.missing_fields || []).map((m, idx) => (
                        <li key={idx} style={{ color: 'var(--text-primary)' }}>{m}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Customer Original Query */}
              <div className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 8 }}>
                  💬 Customer Query / Message Content
                </div>
                <div style={{
                  fontSize: '0.83rem',
                  whiteSpace: 'pre-wrap',
                  background: 'var(--bg-muted)',
                  padding: 12,
                  borderRadius: 6,
                  maxHeight: 200,
                  overflowY: 'auto',
                  lineHeight: 1.5,
                }}>
                  {selected.body_preview || '(Empty message body)'}
                </div>
              </div>

              {/* Action Bar for B2B Inquiries */}
              {isB2BCategory(editCategory, selected.decision) && (
                <div className="card" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>🤝 B2B Cooperation / Service Offer (§7)</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Convert this B2B message into a manual B2B Deal on the dedicated B2B & Partners page.
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={handleCreateB2BFromInquiry} disabled={submitting}>
                    <Briefcase size={13} />
                    Create B2B Deal <ArrowRight size={13} />
                  </button>
                </div>
              )}

              {/* Owner-Approved Draft Response Editor (§1, §3, §4, §5) */}
              {isCustomerCategory(editCategory) && (
                <div className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                      ✉️ Prepared Draft Response (Sent only upon your approval)
                    </div>
                    <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>
                      Status: {selected.draft_status || 'pending'}
                    </span>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)' }}>Subject</label>
                    <input
                      className="input"
                      value={draftSubject}
                      onChange={e => setDraftSubject(e.target.value)}
                      style={{ width: '100%', marginTop: 3, fontSize: '0.82rem' }}
                    />
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Draft Message (Editable before approval)
                    </label>
                    <textarea
                      className="input"
                      rows={8}
                      value={draftBody}
                      onChange={e => setDraftBody(e.target.value)}
                      style={{ width: '100%', marginTop: 3, fontSize: '0.82rem', fontFamily: 'inherit', lineHeight: 1.45 }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleApproveAndSend(true)}
                      disabled={submitting}
                    >
                      <Send size={13} />
                      Approve Lead & Send Draft Reply
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleApproveAndSend(false)}
                      disabled={submitting}
                    >
                      <Check size={13} />
                      Approve Lead Only (Call Personally / No Email)
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleFlagAsSpam}
                      disabled={submitting}
                      style={{ marginLeft: 'auto', color: '#dc2626' }}
                    >
                      <X size={13} />
                      Flag as Spam
                    </button>
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
