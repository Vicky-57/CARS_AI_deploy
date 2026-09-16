import { useState } from 'react';
import { X, Mail, Phone, Car, Users, Briefcase, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function timeAgo(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return '—'; }
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function Field({ label, value }) {
  return (
    <div className="crm-field">
      <div className="crm-field-label">{label}</div>
      <div className={`crm-field-value${!value ? ' muted' : ''}`}>{value || '—'}</div>
    </div>
  );
}

/**
 * ContactDetailPanel — Frappe CRM Contact profile right-side panel.
 * Props:
 *   customer  — customer object (name, email, phone, interactions: [{type, date, details}])
 *   onClose   — fn to close
 */
export default function ContactDetailPanel({ customer, onClose }) {
  if (!customer) return null;

  const initials = getInitials(customer.name);

  const leads    = (customer.interactions || []).filter(i => i.type === 'Lead');
  const projects = (customer.interactions || []).filter(i => i.type === 'Project');

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />

      <aside className="crm-detail-panel">
        {/* ── Header ── */}
        <div className="crm-detail-header">
          <div className="crm-detail-header-info">
            <div className="crm-detail-name">{customer.name || 'Unknown Contact'}</div>
            <div className="crm-detail-meta">
              {customer.email && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={11} /> {customer.email}
                </span>
              )}
              {customer.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={11} /> {customer.phone}
                </span>
              )}
            </div>
          </div>
          <div className="crm-detail-actions">
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="crm-detail-body">

          {/* Profile header */}
          <div className="contact-profile-header">
            <div className="contact-profile-avatar">{initials}</div>
            <div className="contact-profile-info">
              <div className="contact-profile-name">{customer.name || 'Unknown'}</div>
              <div className="contact-profile-contact">
                {customer.email && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Mail size={11} /> {customer.email}
                  </span>
                )}
                {customer.phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Phone size={11} /> {customer.phone}
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>
                {leads.length} Lead{leads.length !== 1 ? 's' : ''}
              </span>
              <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                {projects.length} Deal{projects.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="crm-section">
            <div className="crm-section-title"><Users size={12} /> Contact Information</div>
            <div className="crm-field-grid">
              <Field label="Full Name"   value={customer.name} />
              <Field label="Email"       value={customer.email} />
              <Field label="Phone"       value={customer.phone} />
              <Field label="Last Active" value={timeAgo(customer.last_interaction)} />
              <Field label="Total Interactions" value={String((customer.interactions || []).length)} />
            </div>
          </div>

          {/* Related Leads */}
          {leads.length > 0 && (
            <div className="crm-section">
              <div className="crm-section-title"><Users size={12} /> Related Leads ({leads.length})</div>
              <div className="crm-related-list">
                {leads.map((inter, i) => {
                  const d = inter.details || {};
                  const intent = (d.intent || '').toUpperCase().includes('SELL') ? 'Sell Side' : 'Buy Side';
                  const vehicle = d.manufacturer || d.model
                    ? `${d.manufacturer || ''} ${d.model || ''}`.trim()
                    : d.vehicle_interest || d.subject || 'General Inquiry';
                  return (
                    <div key={i} className="crm-related-item">
                      <Users size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {vehicle}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {intent} · {timeAgo(inter.date)}
                        </div>
                      </div>
                      <span className={`badge ${intent === 'Sell Side' ? 'badge-green' : 'badge-purple'}`}
                            style={{ fontSize: '0.65rem' }}>
                        {intent}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Related Deals / Projects */}
          {projects.length > 0 && (
            <div className="crm-section">
              <div className="crm-section-title"><Briefcase size={12} /> Related Deals ({projects.length})</div>
              <div className="crm-related-list">
                {projects.map((inter, i) => {
                  const d = inter.details || {};
                  return (
                    <div key={i} className="crm-related-item">
                      <Car size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)',
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.target_vehicle || d.vehicle || 'Vehicle TBD'}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          Stage: {d.current_stage || 'Intake'} · {timeAgo(inter.date)}
                        </div>
                      </div>
                      <span className={`badge ${d.status === 'COMPLETED' ? 'badge-green' : 'badge-blue'}`}
                            style={{ fontSize: '0.65rem' }}>
                        {d.status || 'Active'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No interactions at all */}
          {leads.length === 0 && projects.length === 0 && (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <Clock size={24} style={{ opacity: 0.2 }} />
              <div className="empty-state-title">No interaction history</div>
              <div className="empty-state-sub">This contact has no linked leads or deals yet.</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
