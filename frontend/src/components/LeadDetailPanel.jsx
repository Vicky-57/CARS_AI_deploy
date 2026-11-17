import { useState, useEffect } from 'react';
import {
  X, Mail, Phone, Car, User, Tag, Clock, ArrowRight, Loader2, Sparkles,
  ShieldCheck, CheckCircle, AlertCircle, ExternalLink, Copy, Check
} from 'lucide-react';
import { api } from '../api/api';
import EmailViewCard from './EmailViewCard';
import { formatDistanceToNow } from 'date-fns';
import { cleanText, formatContactName, getCleanInitials } from '../utils/textUtils';

function timeAgo(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return '—'; }
}

function Field({ label, value, fullWidth, isCode, hint }) {
  return (
    <div className={`crm-field${fullWidth ? ' full-width' : ''}`}
         style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <div className="crm-field-label">{label}</div>
      <div className={`crm-field-value${!value ? ' muted' : ''}${isCode ? ' code-text' : ''}`}>
        {value || '—'}
      </div>
      {hint && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>{hint}</div>}
    </div>
  );
}

/**
 * LeadDetailPanel — High-density, executive Frappe CRM detail panel.
 */
export default function LeadDetailPanel({ lead, onClose, onConvert, onRefresh, converting, onEdit }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Load email communications linked to this lead's email
  useEffect(() => {
    if (activeTab !== 'activity' || !lead) return;
    setEmailsLoading(true);
    api.getCommunications({ lead_id: lead.id })
      .then(data => setEmails((data || []).slice().reverse()))
      .catch(() => {
        api.getCommunications()
          .then(all => {
            const filtered = (all || []).filter(c =>
              c.sender_contact?.toLowerCase() === (lead.email || '').toLowerCase()
            );
            setEmails(filtered.reverse());
          })
          .catch(() => setEmails([]));
      })
      .finally(() => setEmailsLoading(false));
  }, [activeTab, lead?.id]);

  if (!lead) return null;

  const isSell = (lead.intent || '').toUpperCase().includes('SELL');
  const intentLabel = isSell ? 'Sell Side' : 'Buy Side';
  const intentBadge = isSell ? 'badge badge-green' : 'badge badge-purple';
  const isSpam = lead.status === 'SPAM';
  const isMobileRelay = /-mo-mo@kontakt\.mobile\.de/i.test(lead.email || '');

  const displayName = formatContactName(lead.name, lead.email, lead.vehicle_interest || lead.model);
  const initials = getCleanInitials(lead.name || lead.email);

  // Label configuration
  const labelKey = (lead.label || '').toLowerCase();
  const labelConfig = labelKey === 'hot'
    ? { icon: AlertCircle, badgeClass: 'badge-red', text: 'Hot Lead', color: 'var(--status-red-text)' }
    : labelKey === 'warm'
      ? { icon: Clock, badgeClass: 'badge-amber', text: 'Warm Lead', color: 'var(--status-amber-text)' }
      : labelKey === 'cold'
        ? { icon: CheckCircle, badgeClass: 'badge-gray', text: 'Cold Lead', color: 'var(--text-muted)' }
        : null;

  // Source configuration
  const srcRaw = (lead.source || lead.channel || 'MANUAL').toUpperCase();
  const isWhatsApp = srcRaw.includes('WHATSAPP');
  const isEmail = srcRaw.includes('EMAIL') || srcRaw.includes('STRATO');

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />

      <aside className="crm-detail-panel">
        {/* ── Top Header ── */}
        <div className="crm-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
            {/* Contact initials avatar */}
            <div className={`crm-header-avatar ${isSpam ? 'spam' : isSell ? 'sell' : 'buy'}`}>
              {initials}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="crm-header-title" title={displayName}>
                {displayName}
              </div>
              <div className="crm-header-meta-row">
                <span className={`crm-tag ${isSell ? 'crm-tag-green' : 'crm-tag-purple'}`}>
                  {intentLabel}
                </span>

                {labelConfig && (
                  <span className={`crm-tag ${labelKey === 'hot' ? 'crm-tag-red' : labelKey === 'warm' ? 'crm-tag-amber' : 'crm-tag-slate'}`}>
                    <labelConfig.icon size={11} />
                    {labelConfig.text}
                  </span>
                )}

                {isWhatsApp && (
                  <span className="crm-tag crm-tag-green">
                    <img src="/assets/whatsapp.png" alt="WhatsApp" style={{ width: 12, height: 12, objectFit: 'contain' }} />
                    WhatsApp
                  </span>
                )}

                {isEmail && (
                  <span className="crm-tag crm-tag-slate">
                    <Mail size={11} /> Email
                  </span>
                )}

                {isMobileRelay && (
                  <span className="crm-tag crm-tag-slate" style={{ fontSize: '0.68rem' }} title="Anonymized proxy relay from mobile.de">
                    mobile.de Relay
                  </span>
                )}
              </div>
            </div>
          </div>

          <button className="crm-close-btn" onClick={onClose} title="Close Panel">
            <X size={16} />
          </button>
        </div>

        {/* ── Tabs Navigation ── */}
        <div className="crm-detail-tabs">
          {[
            { key: 'overview', label: 'Overview' },
            {
              key: 'qualification',
              label: 'Qualification',
              badge: lead.qualification_answers?.length ? `${lead.qualification_answers.length}` : null
            },
            {
              key: 'activity',
              label: 'Activity',
              badge: emails.length ? `${emails.length}` : null
            },
          ].map(t => (
            <button
              key={t.key}
              className={`crm-detail-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {t.badge && (
                <span className="badge badge-gray" style={{ fontSize: '0.65rem', padding: '0 5px', minWidth: 16 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Scrollable Body ── */}
        <div className="crm-detail-body">

          {/* ───── OVERVIEW TAB ───── */}
          {activeTab === 'overview' && (
            <>
              {/* Quick Metrics Bar */}
              <div className="panel-metric-bar">
                <div className="panel-metric-card">
                  <span className="panel-metric-label">Status</span>
                  <span className="panel-metric-value">{lead.status || 'New'}</span>
                </div>
                <div className="panel-metric-card">
                  <span className="panel-metric-label">Intent</span>
                  <span className="panel-metric-value">{intentLabel}</span>
                </div>
                <div className="panel-metric-card">
                  <span className="panel-metric-label">Priority</span>
                  <span className="panel-metric-value">
                    {labelConfig ? (
                      <span style={{ color: labelConfig.color, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <labelConfig.icon size={12} /> {labelConfig.text}
                      </span>
                    ) : 'Standard'}
                  </span>
                </div>
                <div className="panel-metric-card">
                  <span className="panel-metric-label">Received</span>
                  <span className="panel-metric-value" style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                    {timeAgo(lead.created_at)}
                  </span>
                </div>
              </div>

              {/* Contact Information Card */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <User size={12} /> Contact Information
                </div>
                <div className="crm-field-grid">
                  <Field label="Client Full Name" value={displayName} />
                  <Field label="Intent Side" value={intentLabel} />

                  {/* Email with copy / mailto action */}
                  <div className="crm-field" style={{ gridColumn: isMobileRelay ? '1 / -1' : 'auto' }}>
                    <div className="crm-field-label">Email Address</div>
                    {isMobileRelay ? (
                      <div style={{ background: 'var(--bg-surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
                          <span className="badge badge-gray" style={{ fontSize: '0.65rem', fontWeight: 600 }}>via mobile.de Proxy</span>
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ padding: '2px 6px', height: 'auto', fontSize: '0.72rem' }}
                            onClick={() => copyToClipboard(lead.email, 'email')}
                          >
                            {copiedField === 'email' ? <Check size={11} color="var(--status-green-text)" /> : <Copy size={11} />}
                            {copiedField === 'email' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {lead.email}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          ℹ️ Anonymized proxy address provided by mobile.de. Outbound quotes automatically forward to customer inbox.
                        </div>
                      </div>
                    ) : lead.email ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <a href={`mailto:${lead.email}`} className="contact-interactive-chip" title="Send email">
                          <Mail size={12} color="var(--primary)" />
                          <span>{cleanText(lead.email)}</span>
                        </a>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: 4 }}
                          onClick={() => copyToClipboard(lead.email, 'email')}
                          title="Copy email"
                        >
                          {copiedField === 'email' ? <Check size={12} color="var(--status-green-text)" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ) : (
                      <span className="crm-field-value muted">—</span>
                    )}
                  </div>

                  {/* Phone with direct action */}
                  <div className="crm-field">
                    <div className="crm-field-label">Phone Number</div>
                    {lead.phone ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <a href={`tel:${lead.phone}`} className="contact-interactive-chip" title="Call number">
                          <Phone size={12} color="var(--status-green-text)" />
                          <span>{cleanText(lead.phone)}</span>
                        </a>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: 4 }}
                          onClick={() => copyToClipboard(lead.phone, 'phone')}
                          title="Copy phone"
                        >
                          {copiedField === 'phone' ? <Check size={12} color="var(--status-green-text)" /> : <Copy size={12} />}
                        </button>
                      </div>
                    ) : (
                      <span className="crm-field-value muted">—</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Vehicle / Inquiry Details Card */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <Car size={12} /> Target Vehicle / Inquiry Details
                </div>
                <div className="crm-field-grid">
                  <Field label="Manufacturer" value={lead.manufacturer} />
                  <Field label="Model / Spec" value={lead.model} />
                  <Field label="VIN" value={lead.vin} isCode={Boolean(lead.vin)} />
                  <Field label="License Plate" value={lead.license_plate} />
                  <Field label="Mileage" value={lead.mileage ? `${lead.mileage.toLocaleString()} km` : null} />
                  <Field label="Budget / Asking" value={lead.price_limit ? `€ ${Number(lead.price_limit).toLocaleString()}` : null} />
                  {lead.initial_registration && (
                    <Field label="Initial Registration" value={lead.initial_registration} />
                  )}
                  {lead.vehicle_interest && (
                    <Field label="Vehicle Interest" value={lead.vehicle_interest} fullWidth />
                  )}
                </div>
              </div>

              {/* Lead Details Card */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <Tag size={12} /> Record Metadata & Channel
                </div>
                <div className="crm-field-grid">
                  <Field label="Current Status" value={lead.status || 'New'} />
                  <div className="crm-field">
                    <div className="crm-field-label">Acquisition Channel</div>
                    <div className="crm-field-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {isWhatsApp ? (
                        <>
                          <img src="/assets/whatsapp.png" alt="WhatsApp" style={{ width: 14, height: 14, objectFit: 'contain' }} />
                          <span>WhatsApp Business</span>
                        </>
                      ) : isEmail ? (
                        <>
                          <Mail size={13} color="var(--text-secondary)" />
                          <span>Strato Email</span>
                        </>
                      ) : (
                        <span>{lead.source || lead.channel || 'Manual'}</span>
                      )}
                    </div>
                  </div>
                  <Field label="Created On" value={timeAgo(lead.created_at)} />
                  {lead.founder_alerted_at && (
                    <div className="crm-field">
                      <div className="crm-field-label">Founder Alerted</div>
                      <div className="crm-field-value" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <img src="/assets/whatsapp.png" alt="WhatsApp" style={{ width: 12, height: 12, objectFit: 'contain' }} />
                        <span>WhatsApp · {timeAgo(lead.founder_alerted_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Customer Inquiry Note Card */}
              {(lead.notes || lead.message) && (
                <div className="crm-section">
                  <div className="crm-section-title">
                    <Sparkles size={12} /> Customer Note / Message Body
                  </div>
                  <div className="inquiry-message-card">
                    {cleanText(lead.notes || lead.message)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ───── QUALIFICATION TAB ───── */}
          {activeTab === 'qualification' && (() => {
            const answers = lead.qualification_answers || [];

            if (answers.length === 0 && !lead.label) {
              return (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 'var(--radius)',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 12px',
                    boxShadow: 'var(--shadow-xs)'
                  }}>
                    <img src="/assets/whatsapp.png" alt="WhatsApp" style={{ width: 24, height: 24, objectFit: 'contain', opacity: 0.6 }} />
                  </div>
                  <div className="empty-state-title">No qualification responses yet</div>
                  <div className="empty-state-sub" style={{ maxWidth: 300, margin: '6px auto 0' }}>
                    Qualification questions are automatically triggered when this contact messages the WhatsApp business channel.
                  </div>
                </div>
              );
            }

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Scoring Assessment Card */}
                {labelConfig && (
                  <div style={{
                    padding: '14px 16px',
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    boxShadow: 'var(--shadow-xs)'
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-subtle)',
                      border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <labelConfig.icon size={16} color={labelConfig.color} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <span className={`badge ${labelConfig.badgeClass}`}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                          <labelConfig.icon size={10} />
                          {labelConfig.text}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Deterministic Score</span>
                      </div>
                      {lead.label_reason && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          {lead.label_reason}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Qualification Answers List */}
                <div className="crm-section">
                  <div className="crm-section-title" style={{ marginBottom: 12 }}>
                    <img src="/assets/whatsapp.png" alt="WhatsApp" style={{ width: 13, height: 13, objectFit: 'contain' }} />
                    Step-by-Step Qualification Flow
                  </div>

                  {answers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                      {answers.map((qa, i) => (
                        <div key={i} className="qual-answer-row" style={{ background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-surface-subtle)' }}>
                          <div className="qual-answer-q">Question {i + 1}</div>
                          <div className="qual-answer-question">{qa.question}</div>
                          <div className="qual-answer-value">
                            <ArrowRight size={13} color="var(--primary)" />
                            {qa.answer}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', padding: '12px 0' }}>
                      No direct question answers recorded yet.
                    </div>
                  )}
                </div>

                {/* Channel Follow-up Status */}
                <div className="crm-section">
                  <div className="crm-section-title">
                    <Clock size={12} /> Channel Automation Status
                  </div>
                  <div className="crm-field-grid">
                    <div className="crm-field">
                      <div className="crm-field-label">24-Hour Reminder</div>
                      <div className="crm-field-value" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {lead.reminder_sent_at ? (
                          <>
                            <CheckCircle size={12} color="var(--status-green-text)" />
                            <span>Dispatched · {timeAgo(lead.reminder_sent_at)}</span>
                          </>
                        ) : (
                          <>
                            <Clock size={12} color="var(--text-muted)" />
                            <span style={{ color: 'var(--text-muted)' }}>Not dispatched</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="crm-field">
                      <div className="crm-field-label">Founder Mobile Alert</div>
                      <div className="crm-field-value" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {lead.founder_alerted_at ? (
                          <>
                            <img src="/assets/whatsapp.png" alt="WhatsApp" style={{ width: 12, height: 12, objectFit: 'contain' }} />
                            <span>WhatsApp Alert · {timeAgo(lead.founder_alerted_at)}</span>
                          </>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Pending qualification</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ───── ACTIVITY TAB ───── */}
          {activeTab === 'activity' && (
            <>
              <div className="crm-section">
                <div className="crm-section-title">
                  <Clock size={12} /> Lifecycle History
                </div>
                <div className="activity-feed">
                  <div className="activity-item">
                    <div className="activity-icon">
                      <User size={12} color="var(--text-muted)" />
                    </div>
                    <div className="activity-content">
                      <div className="activity-title">Inbound Lead Created</div>
                      <div className="activity-sub">
                        Channel: {lead.channel || 'Manual'} · {lead.source || 'Default'}
                      </div>
                    </div>
                    <div className="activity-time">{timeAgo(lead.created_at)}</div>
                  </div>
                </div>
              </div>

              {/* Email communications */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <Mail size={12} /> Email Communications ({emails.length})
                </div>
                {emailsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    <Loader2 size={16} className="spin" style={{ marginRight: 8 }} />
                    Loading linked communications…
                  </div>
                ) : emails.length === 0 ? (
                  <div className="empty-state" style={{ padding: '20px 0' }}>
                    <Mail size={22} style={{ opacity: 0.3 }} />
                    <div className="empty-state-title" style={{ fontSize: '0.85rem' }}>No email correspondence</div>
                    <div className="empty-state-sub">Emails synchronized via Strato matching this address appear here.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {emails.map(msg => (
                      <EmailViewCard key={msg.id} msg={msg} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Fixed Footer Action Bar ── */}
        <div className="crm-detail-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!isSpam && (
            <>
              {onEdit && (
                <button className="btn btn-secondary" onClick={() => onEdit(lead)}>
                  Edit Lead
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => onConvert(lead)}
                disabled={converting}
                title="Convert this lead into a Deal & Project"
              >
                {converting ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                Convert to Deal
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
