import { X, Mail, Phone, Car, Users, Briefcase, Clock, Trash2, UserPlus, Star } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cleanText, formatInteractionSummary, formatContactName, getCleanInitials } from '../utils/textUtils';

function timeAgo(iso) {
  try { return formatDistanceToNow(new Date(iso), { addSuffix: true }); } catch { return '—'; }
}

/**
 * ContactDetailPanel — Full Frappe CRM-style right-side slide panel.
 * Props:
 *   customer        — customer object
 *   getCustomerCar  — fn(customer) => string | null
 *   onClose         — fn to close
 *   onDelete        — fn(e) to delete customer
 *   onLaunchProject — fn to open create project modal
 */
export default function ContactDetailPanel({ customer, getCustomerCar, onClose, onDelete, onLaunchProject, onEdit }) {
  if (!customer) return null;

  const vehicle = getCustomerCar ? cleanText(getCustomerCar(customer)) : null;
  const displayName = formatContactName(customer.name, customer.email, vehicle);
  const initials = getCleanInitials(displayName, customer.email);
  const isRepeat = (customer.interactions || []).length > 1;
  const leads    = (customer.interactions || []).filter(i => i.type === 'Lead');
  const projects = (customer.interactions || []).filter(i => i.type === 'Project');

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />

      <aside className="crm-detail-panel">
        {/* ── Top bar ── */}
        <div className="crm-detail-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar */}
            <div className="contact-profile-avatar" style={{ width: 42, height: 42, fontSize: '0.9rem' }}>
              {initials}
            </div>
            <div>
              <div className="crm-detail-name">{displayName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                {isRepeat ? (
                  <span className="badge badge-amber" style={{ fontSize: '0.68rem', display: 'flex', gap: 4 }}>
                    <Star size={10} fill="currentColor" /> Repeat Client
                  </span>
                ) : (
                  <span className="badge badge-blue" style={{ fontSize: '0.68rem', display: 'flex', gap: 4 }}>
                    <UserPlus size={10} /> New Client
                  </span>
                )}
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  · {(customer.interactions || []).length} interaction{(customer.interactions || []).length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="crm-detail-body">

          {/* Email & Phone cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '12px 14px', background: 'var(--bg-surface-subtle)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</span>
                {/-mo-mo@kontakt\.mobile\.de/i.test(customer.email || '') && (
                  <span className="badge badge-gray" style={{ fontSize: '0.62rem', padding: '1px 5px', fontWeight: 600 }} title="Anonymized proxy relay from mobile.de marketplace">
                    mobile.de Relay
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                <Mail size={13} color="#f47c3c" style={{ flexShrink: 0 }} />
                <span>{cleanText(customer.email || '—')}</span>
              </div>
            </div>
            <div style={{ padding: '12px 14px', background: 'var(--bg-surface-subtle)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Phone</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                <Phone size={13} color="#f47c3c" style={{ flexShrink: 0 }} />
                {cleanText(customer.phone || '—')}
              </div>
            </div>
          </div>

          {/* Vehicle interest banner */}
          {vehicle && (
            <div style={{ margin: '12px 18px', padding: '14px 16px', background: 'linear-gradient(to right, #fff7ed, #ffffff)', borderRadius: 10, border: '1px solid #ffedd5', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ padding: 10, background: '#ffedd5', borderRadius: 10, flexShrink: 0 }}>
                <Car size={20} color="#ea580c" />
              </div>
              <div>
                <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#ea580c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Vehicle / Car Interest</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1a1a1a', marginTop: 3 }}>{vehicle}</div>
              </div>
            </div>
          )}

          {/* Contact Info fields */}
          <div className="crm-section">
            <div className="crm-section-title"><Users size={12} /> Contact Information</div>
            <div className="crm-field-grid">
              <div className="crm-field">
                <span className="crm-field-label">Full Name</span>
                <span className="crm-field-value">{customer.name || '—'}</span>
              </div>
              <div className="crm-field">
                <span className="crm-field-label">Email</span>
                <span className="crm-field-value">{customer.email || '—'}</span>
              </div>
              <div className="crm-field">
                <span className="crm-field-label">Phone</span>
                <span className="crm-field-value">{customer.phone || '—'}</span>
              </div>
              <div className="crm-field">
                <span className="crm-field-label">Last Active</span>
                <span className="crm-field-value">{timeAgo(customer.last_interaction)}</span>
              </div>
              <div className="crm-field">
                <span className="crm-field-label">Total Records</span>
                <span className="crm-field-value">{(customer.interactions || []).length}</span>
              </div>
            </div>
          </div>

          {/* Interaction History */}
          <div className="crm-section">
            <div className="crm-section-title"><Clock size={12} /> Client Interaction History</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(customer.interactions || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>No interactions yet.</div>
              ) : (
                (customer.interactions || []).map((inter, idx) => {
                  const isProject = inter.type === 'Project' || inter.type === 'PROJECT';
                  const Icon = isProject ? Briefcase : UserPlus;
                  const d = new Date(inter.date || Date.now());
                  const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                  return (
                    <div key={idx} style={{ padding: '12px 14px', background: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span className={`badge ${isProject ? 'badge-blue' : 'badge-green'}`} style={{ display: 'flex', gap: 5, alignItems: 'center', fontSize: '0.68rem' }}>
                          <Icon size={11} /> {inter.type}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{dateStr}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5 }}>
                        {formatInteractionSummary(inter)}
                      </div>
                    </div>
                  );
                })
              )}
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
                  const veh = d.manufacturer || d.model ? `${d.manufacturer || ''} ${d.model || ''}`.trim() : d.vehicle_interest || d.subject || 'General Inquiry';
                  return (
                    <div key={i} className="crm-related-item">
                      <Users size={13} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{veh}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{intent} · {timeAgo(inter.date)}</div>
                      </div>
                      <span className={`badge ${intent === 'Sell Side' ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '0.65rem' }}>{intent}</span>
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
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.target_vehicle || d.vehicle || 'Vehicle TBD'}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Stage: {d.current_stage || 'Intake'} · {timeAgo(inter.date)}</div>
                      </div>
                      <span className={`badge ${d.status === 'COMPLETED' ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '0.65rem' }}>{d.status || 'Active'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer buttons ── */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FFFFFF', flexShrink: 0 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onDelete}
            style={{ color: '#ef4444', borderColor: '#fca5a5', gap: 6 }}
          >
            <Trash2 size={13} /> Delete
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => onEdit && onEdit(customer)}>Edit</button>
            <button className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            {onLaunchProject && (
              <button className="btn btn-primary btn-sm" onClick={onLaunchProject} style={{ gap: 6 }}>
                <Briefcase size={13} /> Launch Project / Deal
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
