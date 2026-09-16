import { useState, useEffect } from 'react';
import {
  X, Car, User, Mail, Phone, Tag, ChevronRight, Loader2,
  ExternalLink, Folder, FileText
} from 'lucide-react';
import { api } from '../api/api';
import EmailViewCard from './EmailViewCard';
import { format } from 'date-fns';
import { STAGES, getNormalizedStage } from '../pages/Projects';

function formatDate(d) {
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '—'; }
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
 * DealDetailPanel — Frappe CRM Deal detail right-side panel.
 * Replaces the full-screen modal previously used in Projects.jsx.
 *
 * Props:
 *   project       — project / deal object
 *   onClose       — fn to close the panel
 *   onAdvance     — fn(project) to advance stage
 *   advancing     — boolean
 */
export default function DealDetailPanel({ project, onClose, onAdvance, advancing }) {
  const [activeTab,    setActiveTab]    = useState('details');
  const [emails,       setEmails]       = useState([]);
  const [emailsLoading,setEmailsLoading]= useState(false);
  const [driveUrls,    setDriveUrls]    = useState(null);
  const [driveLoading, setDriveLoading] = useState(false);

  const stage      = getNormalizedStage(project?.current_stage);
  const stageIndex = STAGES.indexOf(stage);
  const isLastStage = stageIndex === STAGES.length - 1;
  const nextStage   = !isLastStage ? STAGES[stageIndex + 1] : null;

  // Load emails when Activity tab is opened
  useEffect(() => {
    if (activeTab !== 'activity' || !project) return;
    setEmailsLoading(true);
    api.getCommunications({ project_id: project.id })
      .catch(() =>
        api.getCommunications().then(all =>
          (all || []).filter(c =>
            c.sender_contact?.toLowerCase() === (project.client_email || '').toLowerCase()
          )
        )
      )
      .then(data => setEmails((data || []).slice().reverse()))
      .catch(() => setEmails([]))
      .finally(() => setEmailsLoading(false));
  }, [activeTab, project?.id]);

  // Load Drive URLs when Documents tab is opened
  useEffect(() => {
    if (activeTab !== 'documents' || !project || driveUrls) return;
    setDriveLoading(true);
    api.getDriveUrls(project.id)
      .then(data => setDriveUrls(data))
      .catch(() => setDriveUrls({}))
      .finally(() => setDriveLoading(false));
  }, [activeTab, project?.id]);

  if (!project) return null;

  const isSell  = (project.project_type || '').toUpperCase() === 'SELL';
  const typeBadge = isSell ? 'badge badge-green' : 'badge badge-purple';
  const typeLabel = isSell ? 'Sell Side' : 'Buy Side';

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />

      <aside className="crm-detail-panel" style={{ width: 520 }}>
        {/* ── Header ── */}
        <div className="crm-detail-header">
          <div className="crm-detail-header-info">
            <div className="crm-detail-name">
              {project.target_vehicle || project.vehicle || 'Deal Details'}
            </div>
            <div className="crm-detail-meta">
              <span className={typeBadge}>{typeLabel}</span>
              <span className="badge badge-gray">{stage}</span>
              {project.client_name && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <User size={10} /> {project.client_name}
                </span>
              )}
            </div>
          </div>

          <div className="crm-detail-actions">
            {nextStage && (
              <button
                className="stage-advance-btn"
                onClick={() => onAdvance(project)}
                disabled={advancing}
                title={`Advance to ${nextStage}`}
              >
                {advancing
                  ? <Loader2 size={12} className="spin" />
                  : <ChevronRight size={12} />
                }
                {nextStage.split(' ')[0]}
              </button>
            )}
            <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        {/* Stage progress track */}
        <div style={{ padding: '10px 18px 0', flexShrink: 0 }}>
          <div className="deal-stage-track">
            {STAGES.map((s, i) => (
              <div
                key={s}
                className={`deal-stage-step${i < stageIndex ? ' done' : i === stageIndex ? ' active' : ''}`}
              />
            ))}
          </div>
          <div className="deal-stage-labels">
            {STAGES.map((s, i) => (
              <div
                key={s}
                className={`deal-stage-label${i === stageIndex ? ' active' : ''}`}
              >
                {s.split(' ')[0]}
              </div>
            ))}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="crm-detail-tabs">
          {[
            { key: 'details',   label: 'Details'   },
            { key: 'activity',  label: 'Activity'  },
            { key: 'documents', label: 'Documents' },
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

          {/* ── DETAILS TAB ── */}
          {activeTab === 'details' && (
            <>
              <div className="crm-section">
                <div className="crm-section-title"><Car size={12} /> Vehicle Information</div>
                <div className="crm-field-grid">
                  <Field label="Vehicle"        value={project.target_vehicle || project.vehicle} />
                  <Field label="Type"           value={typeLabel} />
                  <Field label="VIN"            value={project.vin} />
                  <Field label="Stage"          value={stage} />
                  <Field label="Status"         value={project.status} />
                  <Field label="License Plate"  value={project.license_plate} />
                </div>
              </div>

              <div className="crm-section">
                <div className="crm-section-title"><User size={12} /> Client Contact</div>
                <div className="crm-field-grid">
                  <Field label="Client Name"  value={project.client_name} />
                  <Field label="Email"        value={project.client_email} />
                  <Field label="Phone"        value={project.client_phone} />
                  <Field label="Created"      value={formatDate(project.created_at)} />
                </div>
              </div>

              {project.notes && (
                <div className="crm-section">
                  <div className="crm-section-title"><Tag size={12} /> Notes</div>
                  <div className="crm-field-grid single">
                    <div className="crm-field" style={{ gridColumn: '1/-1' }}>
                      <div className="crm-field-value"
                           style={{ fontSize: '0.82rem', fontWeight: 400, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {project.notes}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── ACTIVITY / EMAILS TAB ── */}
          {activeTab === 'activity' && (
            emailsLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding: 40, color:'var(--text-muted)' }}>
                <Loader2 size={18} className="spin" style={{ marginRight: 8 }} /> Loading…
              </div>
            ) : emails.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <Mail size={28} style={{ opacity: 0.2 }} />
                <div className="empty-state-title">No email activity</div>
                <div className="empty-state-sub">Emails linked to this deal will appear here.</div>
              </div>
            ) : (
              <>
                <div className="crm-section-title" style={{ marginBottom: 10 }}>
                  <Mail size={12} /> Emails ({emails.length})
                </div>
                {emails.map(msg => (
                  <EmailViewCard
                    key={msg.id}
                    msg={msg}
                    toAddress={project.client_email || 'info@car-agents.de'}
                  />
                ))}
              </>
            )
          )}

          {/* ── DOCUMENTS / DRIVE TAB ── */}
          {activeTab === 'documents' && (
            driveLoading ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding: 40, color:'var(--text-muted)' }}>
                <Loader2 size={18} className="spin" style={{ marginRight: 8 }} /> Loading Drive…
              </div>
            ) : !driveUrls || Object.keys(driveUrls).length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <Folder size={28} style={{ opacity: 0.2 }} />
                <div className="empty-state-title">No Drive documents</div>
                <div className="empty-state-sub">Google Drive folders for this deal will appear here.</div>
              </div>
            ) : (
              <div className="crm-related-list">
                {Object.entries(driveUrls).map(([folder, url]) => (
                  <a
                    key={folder}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="crm-related-item"
                    style={{ textDecoration: 'none', cursor: 'pointer' }}
                  >
                    <Folder size={14} color="#2490ef" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, fontWeight: 500, color: 'var(--text-primary)' }}>{folder}</div>
                    <ExternalLink size={12} color="var(--text-muted)" />
                  </a>
                ))}
              </div>
            )
          )}
        </div>
      </aside>
    </>
  );
}
