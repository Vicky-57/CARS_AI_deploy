import { useState, useEffect } from 'react';
import {
  X, Car, User, Mail, Phone, Tag, ChevronRight, Loader2,
  ExternalLink, Folder, FileText, ShieldCheck, Receipt, Sparkles,
  CheckCircle2, Clock, Check, Copy, ArrowUpRight
} from 'lucide-react';
import { api } from '../api/api';
import toast from 'react-hot-toast';
import EmailViewCard from './EmailViewCard';
import { format } from 'date-fns';
import { STAGES, getNormalizedStage } from '../utils/stageUtils';
import { cleanText } from '../utils/textUtils';

function formatDate(d) {
  try { return format(new Date(d), 'dd/MM/yyyy'); } catch { return '—'; }
}

function Field({ label, value, isCode, fullWidth }) {
  return (
    <div className={`crm-field${fullWidth ? ' full-width' : ''}`}
      style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <div className="crm-field-label">{label}</div>
      <div className={`crm-field-value${!value ? ' muted' : ''}${isCode ? ' code-text' : ''}`}>
        {cleanText(value) || '—'}
      </div>
    </div>
  );
}

/**
 * DealDetailPanel — Executive deal detail right-side panel with financial tracking & Drive integration.
 */
export default function DealDetailPanel({ project, onClose, onAdvance, advancing, onUpdate }) {
  const [activeTab, setActiveTab] = useState('details');
  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [driveUrls, setDriveUrls] = useState(null);
  const [driveLoading, setDriveLoading] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Financials State
  const [expenseForm, setExpenseForm] = useState({ expense_type: 'OTHER', description: '', amount: '' });
  const [laborForm, setLaborForm] = useState({ hours_spent: '', activity_description: '' });
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showLaborModal, setShowLaborModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Drive State
  const [uploadTargetFolder, setUploadTargetFolder] = useState('1. OCR');
  const [uploadingDriveFile, setUploadingDriveFile] = useState(false);
  const [uploadedFileResult, setUploadedFileResult] = useState(null);

  const stage = getNormalizedStage(project?.current_stage);
  const stageIndex = STAGES.indexOf(stage);
  const isLastStage = stageIndex === STAGES.length - 1;
  const nextStage = !isLastStage ? STAGES[stageIndex + 1] : null;

  const isSell = (project?.project_type || '').toUpperCase() === 'SELL';
  const typeLabel = isSell ? 'Sell Side (Vermittlung)' : 'Buy Side (Beschaffung)';
  const typeBadge = isSell ? 'badge badge-green' : 'badge badge-purple';

  // Load emails when Activity tab is opened
  useEffect(() => {
    if (activeTab !== 'activity' || !project) return;
    setEmailsLoading(true);
    const clientEmail = (project.client_email || '').trim();
    if (!clientEmail) {
      setEmails([]);
      setEmailsLoading(false);
      return;
    }

    api.getCommunications({ project_id: project.id, client_email: clientEmail })
      .then(data => setEmails((data || []).slice().reverse()))
      .catch(() => setEmails([]))
      .finally(() => setEmailsLoading(false));
  }, [activeTab, project?.id, project?.client_email]);

  // Load Drive URLs when Documents tab is opened
  useEffect(() => {
    if (activeTab !== 'documents' || !project || driveUrls) return;
    setDriveLoading(true);
    api.getProjectDriveFolders(project.id, project.client_name)
      .then(data => {
        if (data && data.success) setDriveUrls(data);
        else setDriveUrls({});
      })
      .catch(() => setDriveUrls({}))
      .finally(() => setDriveLoading(false));
  }, [activeTab, project?.id]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.addExpense(project.id, {
        expense_type: expenseForm.expense_type,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount) || 0
      });
      setShowExpenseModal(false);
      setExpenseForm({ expense_type: 'OTHER', description: '', amount: '' });
      toast.success('Expense recorded');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('Error adding expense: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddLabor = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const hrs = parseFloat(laborForm.hours_spent);
      if (isNaN(hrs) || hrs <= 0) {
        toast.error('Please enter a valid positive number of labor hours.');
        setSubmitting(false);
        return;
      }
      await api.addLabor(project.id, {
        hours_spent: hrs,
        activity_description: laborForm.activity_description
      });
      setShowLaborModal(false);
      setLaborForm({ hours_spent: '', activity_description: '' });
      toast.success('Labor hours recorded');
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('Error logging labor: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUploadToDrive = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDriveFile(true);
    setUploadedFileResult(null);

    try {
      const res = await api.uploadFileToProjectDrive(
        project.id,
        project.client_name,
        file,
        uploadTargetFolder
      );

      if (res && res.success) {
        setUploadedFileResult(res);
        toast.success(`Successfully uploaded to "${uploadTargetFolder}"!`);
      } else {
        toast.error('Upload failed: ' + (res?.message || 'Unknown error'));
      }
    } catch (err) {
      toast.error('Drive upload error: ' + err.message);
    } finally {
      setUploadingDriveFile(false);
      e.target.value = '';
    }
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 1800);
  };

  if (!project) return null;

  const vehicleTitle = project.target_vehicle || project.vehicle || 'Deal Project';
  const expenses = project.project_expenses || [];
  const laborLogs = project.project_labor || [];

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />

      <aside className="crm-detail-panel">
        {/* ── Top Header ── */}
        <div className="crm-panel-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
            <div className={`crm-header-avatar ${isSell ? 'sell' : 'buy'}`}>
              <Car size={20} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="crm-header-title" title={vehicleTitle}>
                {vehicleTitle}
              </div>
              <div className="crm-header-meta-row">
                <span className={`crm-tag ${isSell ? 'crm-tag-green' : 'crm-tag-purple'}`}>
                  {typeLabel}
                </span>
                <span className="crm-tag crm-tag-slate">
                  {stage}
                </span>
                {project.client_name && (
                  <span className="crm-tag crm-tag-slate">
                    <User size={11} /> {project.client_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {nextStage && (
              <button
                className="btn btn-primary btn-sm"
                onClick={() => onAdvance(project)}
                disabled={advancing}
                title={`Advance to ${nextStage}`}
                style={{ gap: 5 }}
              >
                {advancing ? <Loader2 size={13} className="spin" /> : <ChevronRight size={13} />}
                <span>Advance</span>
              </button>
            )}
            <button className="crm-close-btn" onClick={onClose} title="Close Panel">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Stage Progress Stepper ── */}
        <div style={{ padding: '14px 20px 12px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="deal-stage-track">
            {STAGES.map((s, i) => (
              <div
                key={s}
                className={`deal-stage-step${i < stageIndex ? ' done' : i === stageIndex ? ' active' : ''}`}
                title={s}
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

        {/* ── Navigation Tabs ── */}
        <div className="crm-detail-tabs">
          {[
            { key: 'details', label: 'Stage & Overview' },
            {
              key: 'financials',
              label: 'Financials',
              badge: expenses.length + laborLogs.length ? `${expenses.length + laborLogs.length}` : null
            },
            {
              key: 'activity',
              label: 'Activity',
              badge: emails.length ? `${emails.length}` : null
            },
            { key: 'documents', label: 'Drive Cloud' },
          ].map(t => (
            <button
              key={t.key}
              className={`crm-detail-tab ${activeTab === t.key ? 'active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
              {t.badge && (
                <span className="badge badge-gray" style={{ fontSize: '0.65rem', padding: '0 5px' }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="crm-detail-body">

          {/* ───── DETAILS TAB ───── */}
          {activeTab === 'details' && (
            <>
              {/* Sales Stage Spotlight Card */}
              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '16px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'var(--shadow-xs)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 'var(--radius-sm)',
                    background: 'var(--status-green-bg)',
                    border: '1px solid var(--status-green-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <ShieldCheck size={18} color="var(--status-green-text)" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Current Sales Stage ({stageIndex + 1} of {STAGES.length})
                    </div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
                      {stage}
                    </div>
                  </div>
                </div>

                {nextStage && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onAdvance(project)}
                    disabled={advancing}
                  >
                    {advancing ? <Loader2 size={13} className="spin" /> : 'Next: ' + nextStage.split(' ')[0]}
                  </button>
                )}
              </div>

              {/* Vehicle Specifications Card */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <Car size={12} /> Vehicle Information & Specs
                </div>
                <div className="crm-field-grid">
                  <Field label="Target Vehicle" value={project.target_vehicle || project.vehicle} />
                  <Field label="Brokerage Side" value={typeLabel} />

                  <div className="crm-field">
                    <div className="crm-field-label">VIN / Chassis</div>
                    {project.vin ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="crm-field-value code-text">{project.vin}</span>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: 2 }}
                          onClick={() => copyToClipboard(project.vin, 'vin')}
                          title="Copy VIN"
                        >
                          {copiedField === 'vin' ? <Check size={11} color="var(--status-green-text)" /> : <Copy size={11} />}
                        </button>
                      </div>
                    ) : (
                      <span className="crm-field-value muted">—</span>
                    )}
                  </div>

                  <Field label="License Plate" value={project.license_plate} />
                  <Field label="Project Status" value={project.status || 'ACTIVE'} />
                  <Field label="Onboarded" value={formatDate(project.created_at)} />
                </div>
              </div>

              {/* Client Contact Card */}
              <div className="crm-section">
                <div className="crm-section-title">
                  <User size={12} /> Client Contact Details
                </div>
                <div className="crm-field-grid">
                  <Field label="Client Name" value={project.client_name} />

                  <div className="crm-field">
                    <div className="crm-field-label">Email Address</div>
                    {project.client_email ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <a href={`mailto:${project.client_email}`} className="contact-interactive-chip" title="Send email">
                          <Mail size={12} color="var(--primary)" />
                          <span>{cleanText(project.client_email)}</span>
                        </a>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: 2 }}
                          onClick={() => copyToClipboard(project.client_email, 'client_email')}
                          title="Copy email"
                        >
                          {copiedField === 'client_email' ? <Check size={11} color="var(--status-green-text)" /> : <Copy size={11} />}
                        </button>
                      </div>
                    ) : (
                      <span className="crm-field-value muted">—</span>
                    )}
                  </div>

                  <div className="crm-field">
                    <div className="crm-field-label">Phone Number</div>
                    {project.client_phone ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <a href={`tel:${project.client_phone}`} className="contact-interactive-chip" title="Call client">
                          <Phone size={12} color="var(--status-green-text)" />
                          <span>{cleanText(project.client_phone)}</span>
                        </a>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ padding: 2 }}
                          onClick={() => copyToClipboard(project.client_phone, 'client_phone')}
                          title="Copy phone"
                        >
                          {copiedField === 'client_phone' ? <Check size={11} color="var(--status-green-text)" /> : <Copy size={11} />}
                        </button>
                      </div>
                    ) : (
                      <span className="crm-field-value muted">—</span>
                    )}
                  </div>

                  <Field label="Contract Assigned" value={project.contract_type || 'Kaufvertrag'} />
                </div>
              </div>

              {/* Notes Card */}
              {project.notes && (
                <div className="crm-section">
                  <div className="crm-section-title">
                    <Tag size={12} /> Project Notes & Instructions
                  </div>
                  <div className="inquiry-message-card">
                    {cleanText(project.notes)}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ───── FINANCIALS TAB ───── */}
          {activeTab === 'financials' && (() => {
            const hourlyRate = project.hourly_rate || 20;
            const totalExpenses = expenses.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
            const totalLaborHours = laborLogs.reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
            const totalLaborCost = totalLaborHours * hourlyRate;
            const netProfit = (project.agreed_sale_price || 0) - (project.purchase_price || 0) - totalExpenses - totalLaborCost;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* 3 Metrics Cards */}
                <div className="financials-metric-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                  <div className="panel-metric-card">
                    <span className="panel-metric-label">Expenses</span>
                    <span className="panel-metric-value" style={{ color: 'var(--status-amber-text)' }}>
                      €{totalExpenses.toFixed(2)}
                    </span>
                  </div>

                  <div className="panel-metric-card">
                    <span className="panel-metric-label">Labor ({totalLaborHours}h)</span>
                    <span className="panel-metric-value">
                      €{totalLaborCost.toFixed(2)}
                    </span>
                  </div>

                  <div className="panel-metric-card" style={{
                    background: netProfit >= 0 ? 'var(--status-green-bg)' : 'var(--status-red-bg)',
                    borderColor: netProfit >= 0 ? 'var(--status-green-border)' : 'var(--status-red-border)'
                  }}>
                    <span className="panel-metric-label" style={{ color: netProfit >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                      Net Margin
                    </span>
                    <span className="panel-metric-value" style={{ color: netProfit >= 0 ? 'var(--status-green-text)' : 'var(--status-red-text)' }}>
                      €{netProfit.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="financials-action-row" style={{ display: 'flex', gap: 10 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowExpenseModal(true)} style={{ gap: 6 }}>
                    <Receipt size={13} /> Log Expense / Receipt
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowLaborModal(true)} style={{ gap: 6 }}>
                    <Clock size={13} /> Log Labor Hours
                  </button>
                </div>

                {/* Logged Expenses Section */}
                <div className="crm-section">
                  <div className="crm-section-title">
                    <Receipt size={12} /> Logged Expenses ({expenses.length})
                  </div>
                  {expenses.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No expenses recorded yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {expenses.map(ex => (
                        <div key={ex.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-surface-subtle)'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{ex.description || ex.expense_type}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDate(ex.created_at)}</div>
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--status-amber-text)' }}>
                            €{parseFloat(ex.amount).toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Labor Log Section */}
                <div className="crm-section">
                  <div className="crm-section-title">
                    <Clock size={12} /> Broker Labor Hours ({laborLogs.length})
                  </div>
                  {laborLogs.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', padding: '8px 0' }}>No labor hours logged yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {laborLogs.map(lb => (
                        <div key={lb.id} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-surface-subtle)'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600 }}>{lb.activity_description}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{formatDate(lb.created_at)}</div>
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{lb.hours_spent} hrs</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ───── ACTIVITY TAB ───── */}
          {activeTab === 'activity' && (
            emailsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--text-muted)' }}>
                <Loader2 size={16} className="spin" style={{ marginRight: 8 }} /> Loading communications…
              </div>
            ) : emails.length === 0 ? (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <Mail size={24} style={{ opacity: 0.25 }} />
                <div className="empty-state-title">No email activity</div>
                <div className="empty-state-sub">Emails synchronized matching {project.client_email || 'this deal'} appear here.</div>
              </div>
            ) : (
              <div className="crm-section">
                <div className="crm-section-title" style={{ marginBottom: 12 }}>
                  <Mail size={12} /> Client Communications ({emails.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {emails.map(msg => (
                    <EmailViewCard
                      key={msg.id}
                      msg={msg}
                      toAddress={project.client_email || 'info@car-agents.de'}
                    />
                  ))}
                </div>
              </div>
            )
          )}

          {/* ───── DOCUMENTS / DRIVE TAB ───── */}
          {activeTab === 'documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {driveLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <Loader2 size={16} className="spin" style={{ marginRight: 8 }} /> Loading Drive folders…
                </div>
              ) : !driveUrls || Object.keys(driveUrls).length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                  <Folder size={24} style={{ opacity: 0.25 }} />
                  <div className="empty-state-title">No Drive folders found</div>
                  <div className="empty-state-sub">Ensure Google Drive sync is configured in Integrations.</div>
                </div>
              ) : (
                <div className="crm-section">
                  <div className="crm-section-title">
                    <Folder size={12} /> Cloud Drive Folders
                  </div>
                  <div className="drive-folder-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {Object.entries(driveUrls).filter(([k]) => k !== 'success' && k !== 'project_id').map(([folder, url]) => (
                      <a
                        key={folder}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="contact-interactive-chip"
                        style={{ padding: '12px 14px', height: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}
                      >
                        <img src="/assets/google-drive (1).png" alt="Drive" style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{folder}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Open in Drive</div>
                        </div>
                        <ExternalLink size={12} color="var(--text-muted)" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Upload Card */}
              <div className="crm-section" style={{ borderStyle: 'dashed' }}>
                <div className="crm-section-title">
                  <Sparkles size={12} /> Upload Document to Drive
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                  Select target category folder and attach PDF documents or images for automatic cloud sync.
                </div>

                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="form-select"
                    value={uploadTargetFolder}
                    onChange={(e) => setUploadTargetFolder(e.target.value)}
                    style={{ flex: 1, minWidth: 160 }}
                    disabled={uploadingDriveFile}
                  >
                    <option value="1. OCR">1. OCR (Vehicle Docs)</option>
                    <option value="2. Contract">2. Contracts</option>
                    <option value="3. General">3. General Files</option>
                  </select>

                  <label
                    className="btn btn-primary"
                    style={{ margin: 0, gap: 6, display: 'inline-flex', alignItems: 'center', cursor: uploadingDriveFile ? 'not-allowed' : 'pointer' }}
                  >
                    {uploadingDriveFile ? <Loader2 size={13} className="spin" /> : <Folder size={13} />}
                    <span>{uploadingDriveFile ? 'Uploading…' : 'Select File'}</span>
                    <input
                      type="file"
                      accept="image/*,video/*,application/pdf"
                      onChange={handleFileUploadToDrive}
                      disabled={uploadingDriveFile}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>

                {uploadedFileResult && (
                  <div style={{ marginTop: 14, padding: 12, background: 'var(--status-green-bg)', border: '1px solid var(--status-green-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--status-green-text)' }}>
                    <div style={{ fontWeight: 700, marginBottom: 2 }}>Upload Successful</div>
                    <div>File: <strong>{uploadedFileResult.filename}</strong></div>
                    <a href={uploadedFileResult.drive_url} target="_blank" rel="noreferrer" style={{ color: 'var(--status-green-text)', textDecoration: 'underline', marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      View in Google Drive <ExternalLink size={11} />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Fixed Footer Action Bar ── */}
        <div className="crm-detail-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          {nextStage && (
            <button
              className="btn btn-primary"
              onClick={() => onAdvance(project)}
              disabled={advancing}
            >
              {advancing ? <Loader2 size={14} className="spin" /> : <ChevronRight size={14} />}
              Advance to {nextStage.split(' ')[0]}
            </button>
          )}
        </div>
      </aside>

      {/* EXPENSE LOG MODAL */}
      {showExpenseModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Expense / Receipt</h3>
              <button className="btn-icon" onClick={() => setShowExpenseModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Expense Category</label>
                  <select
                    className="form-select"
                    value={expenseForm.expense_type}
                    onChange={e => setExpenseForm({ ...expenseForm, expense_type: e.target.value })}
                  >
                    <option value="DETAILING">Vehicle Detailing</option>
                    <option value="TUEV_INSPECTION">TÜV Inspection</option>
                    <option value="TRANSPORT">Vehicle Transport</option>
                    <option value="OIL_CHANGE">Oil Change / Service</option>
                    <option value="ADMIN">Administrative / Legal</option>
                    <option value="OTHER">Other Expense</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount (€) *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    required
                    placeholder="150.00"
                    value={expenseForm.amount}
                    onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description / Vendor</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. TÜV Süd Inspection fee"
                    value={expenseForm.description}
                    onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowExpenseModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Save Expense</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LABOR HOURS LOG MODAL */}
      {showLaborModal && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 className="modal-title">Log Broker Labor Hours</h3>
              <button className="btn-icon" onClick={() => setShowLaborModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleAddLabor}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Hours Spent (0.25h increments) *</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.25"
                    min="0.25"
                    required
                    placeholder="0.5"
                    value={laborForm.hours_spent}
                    onChange={e => setLaborForm({ ...laborForm, hours_spent: e.target.value })}
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Mandatory: minimum 0.25h in 15-min increments (0.25, 0.50, 0.75, 1.00…).
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Activity Description *</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. On-site vehicle inspection & photo shoot"
                    value={laborForm.activity_description}
                    onChange={e => setLaborForm({ ...laborForm, activity_description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowLaborModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>Save Labor Hours</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
