import { useState, useEffect } from 'react';
import { X, Mail, Phone, Car, User, Tag, Clock, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { api } from '../api/api';
import EmailViewCard from './EmailViewCard';
import { formatDistanceToNow } from 'date-fns';

function timeAgo(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return ''; }
}

function Field({ label, value, fullWidth }) {
  return (
    <div className={`crm-field${fullWidth ? ' full-width' : ''}`}
         style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <div className="crm-field-label">{label}</div>
      <div className={`crm-field-value${!value ? ' muted' : ''}`}>
        {value || '—'}
      </div>
    </div>
  );
}

/**
 * LeadDetailPanel — Frappe CRM "Inside a Lead" right-side panel.
 * Props:
 *   lead         — lead object
 *   onClose      — fn to close panel
 *   onConvert    — fn(lead) to convert to project
 *   onRefresh    — fn to reload leads list
 *   converting   — boolean
 */
export default function LeadDetailPanel({ lead, onClose, onConvert, onRefresh, converting }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [emails,    setEmails]    = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);

  // Load email communications linked to this lead's email
  useEffect(() => {
    if (activeTab !== 'activity' || !lead) return;
    setEmailsLoading(true);
    api.getCommunications({ lead_id: lead.id })
      .then(data => setEmails((data || []).slice().reverse()))
      .catch(() => {
        // fallback: filter by sender email
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

  return (
    <>
      {/* Dim backdrop so user can click away */}
      <div className="panel-backdrop" onClick={onClose} />

      <aside className="crm-detail-panel">
        {/* ── Header ── */}
        <div className="crm-detail-header">
          <div className="crm-detail-header-info">
            <div className="crm-detail-name">{lead.name || 'Anonymous Lead'}</div>
            <div className="crm-detail-meta">
              {lead.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={11} /> {lead.email}
                </span>
              )}
              {lead.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={11} /> {lead.phone}
                </span>
              )}
              <span className={intentBadge}>{intentLabel}</span>
            </div>
          </div>

          <div className="crm-detail-actions">
            {!isSpam && (
              <button
                className="stage-advance-btn"
                onClick={() => onConvert(lead)}
                disabled={converting}
                title="Convert this lead to a Deal & Project"
              >
                {converting ? <Loader2 size={12} className="spin" /> : <ArrowRight size={12} />}
                Convert to Deal
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="crm-detail-tabs">
          {[
            { key: 'overview',  label: 'Overview'  },
            { key: 'activity',  label: 'Activity'  },
          ].map(t => (
            <button
              key={t.key}
              className={`crm-detail-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="crm-detail-body">

          {/* ───── OVERVIEW TAB ───── */}
          {activeTab === 'overview' && (
            <>
              {/* Contact Information */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <User size={12} /> Contact Information
                </div>
                <div className="crm-field-grid">
                  <Field label="Full Name"  value={lead.name} />
                  <Field label="Intent"     value={intentLabel} />
                  <Field label="Email"      value={lead.email} />
                  <Field label="Phone"      value={lead.phone} />
                </div>
              </div>

              {/* Vehicle / Inquiry Details */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <Car size={12} /> Vehicle / Inquiry Details
                </div>
                <div className="crm-field-grid">
                  <Field label="Manufacturer"    value={lead.manufacturer} />
                  <Field label="Model"           value={lead.model} />
                  <Field label="VIN"             value={lead.vin} />
                  <Field label="License Plate"   value={lead.license_plate} />
                  <Field label="Mileage (km)"    value={lead.mileage ? `${lead.mileage.toLocaleString()} km` : null} />
                  <Field label="Budget / Limit"  value={lead.price_limit ? `€ ${Number(lead.price_limit).toLocaleString()}` : null} />
                  {lead.initial_registration && (
                    <Field label="Initial Reg." value={lead.initial_registration} />
                  )}
                  {lead.vehicle_interest && (
                    <Field label="Interest" value={lead.vehicle_interest} fullWidth />
                  )}
                </div>
              </div>

              {/* Lead Metadata */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <Tag size={12} /> Lead Details
                </div>
                <div className="crm-field-grid">
                  <Field label="Status"  value={lead.status || 'New'} />
                  <Field label="Source"  value={lead.channel || 'Manual'} />
                  <Field label="Created" value={timeAgo(lead.created_at)} />
                </div>
              </div>

              {/* Notes */}
              {(lead.notes || lead.message) && (
                <div className="crm-section">
                  <div className="crm-section-title">
                    <Sparkles size={12} /> Notes / Message
                  </div>
                  <div className="crm-field-grid single">
                    <div className="crm-field" style={{ gridColumn: '1 / -1' }}>
                      <div
                        className="crm-field-value"
                        style={{ fontSize: '0.82rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', fontWeight: 400 }}
                      >
                        {lead.notes || lead.message}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ───── ACTIVITY TAB ───── */}
          {activeTab === 'activity' && (
            <>
              {/* Created event */}
              <div className="activity-feed">
                <div className="activity-item">
                  <div className="activity-icon">
                    <User size={12} color="var(--text-muted)" />
                  </div>
                  <div className="activity-content">
                    <div className="activity-title">Lead Created</div>
                    <div className="activity-sub">
                      {lead.channel || 'Manual'} · {lead.source || ''}
                    </div>
                  </div>
                  <div className="activity-time">{timeAgo(lead.created_at)}</div>
                </div>
              </div>

              {/* Email communications */}
              {emailsLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, color: 'var(--text-muted)' }}>
                  <Loader2 size={18} className="spin" style={{ marginRight: 8 }} />
                  Loading communications…
                </div>
              ) : emails.length === 0 ? (
                <div className="empty-state" style={{ padding: '24px 0' }}>
                  <Mail size={24} style={{ opacity: 0.25 }} />
                  <div className="empty-state-title">No email history</div>
                  <div className="empty-state-sub">Emails linked to this lead will appear here.</div>
                </div>
              ) : (
                <div>
                  <div className="crm-section-title" style={{ marginBottom: 10 }}>
                    <Mail size={12} /> Email Communications ({emails.length})
                  </div>
                  {emails.map(msg => (
                    <EmailViewCard key={msg.id} msg={msg} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}
