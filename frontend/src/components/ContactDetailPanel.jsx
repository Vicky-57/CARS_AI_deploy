import { useState } from 'react';
import {
  X, Mail, Phone, Car, Users, Briefcase, Clock, Trash2, UserPlus,
  Star, ExternalLink, Copy, Check
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cleanText, formatInteractionSummary, formatContactName, getCleanInitials } from '../utils/textUtils';

function timeAgo(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return '—'; }
}

/**
 * ContactDetailPanel — Executive contact and relationship detail drawer.
 */
export default function ContactDetailPanel({ customer, getCustomerCar, onClose, onDelete, onLaunchProject, onEdit }) {
  const [copiedField, setCopiedField] = useState(null);

  if (!customer) return null;

  const vehicle = getCustomerCar ? cleanText(getCustomerCar(customer)) : null;
  const displayName = formatContactName(customer.name, customer.email, vehicle);
  const initials = getCleanInitials(displayName, customer.email);
  const isRepeat = (customer.interactions || []).length > 1;
  const leads = (customer.interactions || []).filter(i => i.type === 'Lead');
  const projects = (customer.interactions || []).filter(i => i.type === 'Project');
  const isMobileRelay = /-mo-mo@kontakt\.mobile\.de/i.test(customer.email || '');

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
            {/* Initials avatar tile */}
            <div className={`crm-header-avatar ${isRepeat ? 'contact' : 'contact-new'}`}>
              {initials}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="crm-header-title" title={displayName}>
                {displayName}
              </div>
              <div className="crm-header-meta-row">
                {isRepeat ? (
                  <span className="crm-tag crm-tag-amber">
                    <Star size={11} fill="currentColor" /> Repeat Client
                  </span>
                ) : (
                  <span className="crm-tag crm-tag-blue">
                    <UserPlus size={11} /> New Client
                  </span>
                )}
                <span className="crm-tag crm-tag-slate">
                  {(customer.interactions || []).length} Interaction{(customer.interactions || []).length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          <button className="crm-close-btn" onClick={onClose} title="Close Panel">
            <X size={16} />
          </button>
        </div>

        {/* ── Scrollable Body ── */}
        <div className="crm-detail-body">

          {/* Quick Metrics Bar */}
          <div className="panel-metric-bar">
            <div className="panel-metric-card">
              <span className="panel-metric-label">Relationship</span>
              <span className="panel-metric-value">{isRepeat ? 'Repeat' : 'New'}</span>
            </div>
            <div className="panel-metric-card">
              <span className="panel-metric-label">Deals</span>
              <span className="panel-metric-value">{projects.length}</span>
            </div>
            <div className="panel-metric-card">
              <span className="panel-metric-label">Inquiries</span>
              <span className="panel-metric-value">{leads.length}</span>
            </div>
            <div className="panel-metric-card">
              <span className="panel-metric-label">Last Active</span>
              <span className="panel-metric-value" style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                {timeAgo(customer.last_interaction)}
              </span>
            </div>
          </div>

          {/* Contact Direct Connection Card */}
          <div className="crm-section">
            <div className="crm-section-title">
              <Users size={12} /> Contact & Communication
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {/* Email Card */}
              <div style={{ padding: '12px 14px', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Email
                  </span>
                  {isMobileRelay && (
                    <span className="badge badge-gray" style={{ fontSize: '0.62rem', padding: '1px 5px', fontWeight: 600 }}>
                      mobile.de Relay
                    </span>
                  )}
                </div>
                {customer.email ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <a href={`mailto:${customer.email}`} style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Mail size={13} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <span>{cleanText(customer.email)}</span>
                    </a>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: 2 }}
                      onClick={() => copyToClipboard(customer.email, 'email')}
                      title="Copy email"
                    >
                      {copiedField === 'email' ? <Check size={11} color="var(--status-green-text)" /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</span>
                )}
              </div>

              {/* Phone Card */}
              <div style={{ padding: '12px 14px', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Phone
                  </span>
                </div>
                {customer.phone ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <a href={`tel:${customer.phone}`} style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--status-green-text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Phone size={13} color="var(--status-green-text)" style={{ flexShrink: 0 }} />
                      <span>{cleanText(customer.phone)}</span>
                    </a>
                    <button
                      className="btn btn-ghost btn-icon"
                      style={{ padding: 2 }}
                      onClick={() => copyToClipboard(customer.phone, 'phone')}
                      title="Copy phone"
                    >
                      {copiedField === 'phone' ? <Check size={11} color="var(--status-green-text)" /> : <Copy size={11} />}
                    </button>
                  </div>
                ) : (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</span>
                )}
              </div>
            </div>
          </div>

          {/* Target Vehicle Interest Banner */}
          {vehicle && (
            <div style={{
              padding: '14px 16px',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              boxShadow: 'var(--shadow-xs)'
            }}>
              <div style={{
                width: 38, height: 38,
                background: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0
              }}>
                <Car size={18} color="var(--primary)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Target Vehicle Interest
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                  {vehicle}
                </div>
              </div>
            </div>
          )}

          {/* Interaction History Card */}
          <div className="crm-section">
            <div className="crm-section-title">
              <Clock size={12} /> Client Interaction History ({customer.interactions?.length || 0})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(customer.interactions || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                  No logged interactions yet.
                </div>
              ) : (
                (customer.interactions || []).map((inter, idx) => {
                  const isProject = inter.type === 'Project' || inter.type === 'PROJECT';
                  const Icon = isProject ? Briefcase : UserPlus;
                  const d = new Date(inter.date || Date.now());
                  const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                  return (
                    <div key={idx} style={{
                      padding: '12px 14px',
                      background: 'var(--bg-surface-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span className={`badge ${isProject ? 'badge-blue' : 'badge-green'}`} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', fontSize: '0.68rem' }}>
                          <Icon size={10} /> {inter.type}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{dateStr}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', lineHeight: 1.4 }}>
                        {formatInteractionSummary(inter)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Related Deals Card */}
          {projects.length > 0 && (
            <div className="crm-section">
              <div className="crm-section-title">
                <Briefcase size={12} /> Associated Deals ({projects.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {projects.map((inter, i) => {
                  const d = inter.details || {};
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-subtle)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Car size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {d.target_vehicle || d.vehicle || 'Vehicle TBD'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            Stage: {d.current_stage || 'Intake'} · {timeAgo(inter.date)}
                          </div>
                        </div>
                      </div>
                      <span className={`badge ${d.status === 'COMPLETED' ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '0.65rem' }}>
                        {d.status || 'Active'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Related Leads Card */}
          {leads.length > 0 && (
            <div className="crm-section">
              <div className="crm-section-title">
                <Users size={12} /> Inbound Leads ({leads.length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {leads.map((inter, i) => {
                  const d = inter.details || {};
                  const intent = (d.intent || '').toUpperCase().includes('SELL') ? 'Sell Side' : 'Buy Side';
                  const veh = d.manufacturer || d.model ? `${d.manufacturer || ''} ${d.model || ''}`.trim() : d.vehicle_interest || d.subject || 'General Inquiry';
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface-subtle)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <Users size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {veh}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {intent} · {timeAgo(inter.date)}
                          </div>
                        </div>
                      </div>
                      <span className={`badge ${intent === 'Sell Side' ? 'badge-green' : 'badge-purple'}`} style={{ fontSize: '0.65rem' }}>
                        {intent}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Fixed Footer Action Bar ── */}
        <div className="crm-detail-footer" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onDelete}
            style={{ color: 'var(--status-red-text)', borderColor: 'var(--status-red-border)', gap: 6 }}
          >
            <Trash2 size={13} /> Delete
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {onEdit && (
              <button className="btn btn-secondary btn-sm" onClick={() => onEdit(customer)}>
                Edit
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
            {onLaunchProject && (
              <button className="btn btn-primary btn-sm" onClick={onLaunchProject} style={{ gap: 6 }}>
                <Briefcase size={13} /> Launch Deal
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
