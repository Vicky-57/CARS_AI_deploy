import { useState, useEffect } from 'react';
import {
  X, Car, User, Mail, Phone, Tag, ChevronRight, Loader2,
  ExternalLink, Folder, FileText, ShieldCheck, Receipt, Sparkles, CheckCircle2, Clock
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

function Field({ label, value }) {
  return (
    <div className="crm-field">
      <div className="crm-field-label">{label}</div>
      <div className={`crm-field-value${!value ? ' muted' : ''}`}>{cleanText(value) || '—'}</div>
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
export default function DealDetailPanel({ project, onClose, onAdvance, advancing, onUpdate }) {
  const [activeTab,    setActiveTab]    = useState('details');
  const [emails,       setEmails]       = useState([]);
  const [emailsLoading,setEmailsLoading]= useState(false);
  const [driveUrls,    setDriveUrls]    = useState(null);
  const [driveLoading, setDriveLoading] = useState(false);

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

  const stage      = getNormalizedStage(project?.current_stage);
  const stageIndex = STAGES.indexOf(stage);
  const isLastStage = stageIndex === STAGES.length - 1;
  const nextStage   = !isLastStage ? STAGES[stageIndex + 1] : null;

  // Load emails when Activity tab is opened (STRICTLY SCOPED TO THIS CLIENT - CA-002)
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
      
      // Enforce 0.25-hour increment rule (CA-020: 0.25, 0.50, 0.75, 1.00, 1.25...)
      const quarterUnits = Math.round(hrs * 4);
      if (Math.abs(hrs - quarterUnits / 4) > 0.001) {
        toast.error('Labor hours must be in 0.25-hour increments (e.g. 0.25, 0.50, 0.75, 1.00, 1.25…). Freeform decimals are not permitted.');
        setSubmitting(false);
        return;
      }

      await api.addLabor(project.id, {
        hours_spent: hrs,
        activity_description: cleanText(laborForm.activity_description)
      });
      setShowLaborModal(false);
      setLaborForm({ hours_spent: '', activity_description: '' });
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error('Error adding labor hours: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUploadToDrive = async (e) => {
    const file = e.target.files[0];
    if (!file || !project) return;

    setUploadingDriveFile(true);
    setUploadedFileResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('client_name', project.client_name || 'Customer');
    formData.append('target_folder', uploadTargetFolder);

    try {
      const res = await api.uploadFileToProjectDrive(project.id, formData);
      if (res && res.success) {
        setUploadedFileResult(res);
        toast.success(`Successfully uploaded "${file.name}" to Google Drive!`);
      } else {
        toast.error('Upload error: ' + (res.error || 'Could not upload to Drive'));
      }
    } catch (err) {
      toast.error('Upload error: ' + err.message);
    } finally {
      setUploadingDriveFile(false);
    }
  };

  if (!project) return null;

  const isSell  = (project.project_type || '').toUpperCase() === 'SELL';
  const typeBadge = isSell ? 'badge badge-green' : 'badge badge-purple';
  const typeLabel = isSell ? 'Sell Side' : 'Buy Side';

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />

      <aside className="crm-detail-panel" style={{ width: '100%', maxWidth: 520 }}>
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
        <div style={{ padding: '16px 18px 16px', flexShrink: 0 }}>
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
            { key: 'details',   label: 'Stage & Overview' },
            { key: 'financials',label: 'Financials' },
            { key: 'activity',  label: 'Activity'  },
            { key: 'documents', label: 'Drive Cloud' },
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
              {/* Current Stage Card */}
              <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-200)', borderRadius: 8, padding: 16, marginBottom: 20, margin: '16px 16px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-700)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      <ShieldCheck size={14} /> Current Sales Stage
                    </div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--brand-900)', marginTop: 4 }}>
                      {stage}
                    </div>
                  </div>
                  {nextStage && (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onAdvance(project)}
                      disabled={advancing}
                    >
                      {advancing ? <Loader2 size={14} className="spin" /> : 'Advance Stage'}
                    </button>
                  )}
                </div>
              </div>

              <div className="crm-section">
                <div className="crm-section-title"><Car size={12} /> Vehicle Information</div>
                <div className="crm-field-grid">
                  <Field label="Vehicle"        value={project.target_vehicle || project.vehicle} />
                  <Field label="Type"           value={typeLabel} />
                  <Field label="VIN"            value={project.vin} />
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

          {/* ── FINANCIALS TAB ── */}
          {activeTab === 'financials' && (() => {
            const expenses = project.project_expenses || [];
            const laborLogs = project.project_labor || [];
            const hourlyRate = project.hourly_rate || 20;

            const totalExpenses = expenses.reduce((s, x) => s + (parseFloat(x.amount) || 0), 0);
            const totalLaborHours = laborLogs.reduce((s, x) => s + (parseFloat(x.hours_spent) || 0), 0);
            const totalLaborCost = totalLaborHours * hourlyRate;
            const netProfit = (project.agreed_sale_price || 0) - (project.purchase_price || 0) - totalExpenses - totalLaborCost;
            
            return (
              <div style={{ padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Total Expenses</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>€{totalExpenses.toFixed(2)}</div>
                  </div>
                  <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Labor ({totalLaborHours}h @ €{hourlyRate}/h)</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>€{totalLaborCost.toFixed(2)}</div>
                  </div>
                  <div style={{ background: netProfit >= 0 ? '#f0fdf4' : '#fef2f2', border: `1px solid ${netProfit >= 0 ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: 16 }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: netProfit >= 0 ? '#166534' : '#991b1b' }}>Net Broker Profit</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: netProfit >= 0 ? '#15803d' : '#b91c1c', marginTop: 4 }}>€{netProfit.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowExpenseModal(true)}>
                    <Receipt size={14} /> Log Receipt / Expense
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowLaborModal(true)}>
                    <Clock size={14} /> Log Labor Hours
                  </button>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Logged Expenses</h4>
                  {expenses.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No expenses logged yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {expenses.map(ex => (
                        <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{ex.description || ex.expense_type}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(ex.created_at)}</div>
                          </div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f59e0b' }}>€{parseFloat(ex.amount).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 12, color: 'var(--text-primary)' }}>Broker Labor Log</h4>
                  {laborLogs.length === 0 ? (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No labor hours logged yet.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {laborLogs.map(lb => (
                        <div key={lb.id} style={{ display: 'flex', justifyContent: 'space-between', padding: 12, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-surface)' }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{lb.activity_description}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(lb.created_at)}</div>
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
              <div style={{ padding: 16 }}>
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
              </div>
            )
          )}

          {/* ── DOCUMENTS / DRIVE TAB ── */}
          {activeTab === 'documents' && (
            <div style={{ padding: 16 }}>
              {driveLoading ? (
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                  {Object.entries(driveUrls).filter(([k]) => k !== 'success' && k !== 'project_id').map(([folder, url]) => (
                    <a
                      key={folder}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="crm-related-item"
                      style={{ textDecoration: 'none', cursor: 'pointer', background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: 12, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <img src="/assets/google-drive (1).png" alt="Drive" style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }} />
                      <div style={{ flex: 1, fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{folder}</div>
                      <ExternalLink size={12} color="var(--text-muted)" />
                    </a>
                  ))}
                </div>
              )}

              {/* Upload Section */}
              <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12, padding: 24 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>Upload Document to Drive</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 16 }}>Select a folder and upload PDFs or images. They will be immediately available in Google Drive.</div>
                
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <select
                    className="form-select"
                    value={uploadTargetFolder}
                    onChange={(e) => setUploadTargetFolder(e.target.value)}
                    style={{ flex: 1, height: 38 }}
                    disabled={uploadingDriveFile}
                  >
                    <option value="1. OCR">1. OCR (Vehicle Docs)</option>
                    <option value="2. Contract">2. Contracts</option>
                    <option value="3. General">3. General Files</option>
                  </select>
                  
                  <label 
                    className="btn btn-primary" 
                    style={{ height: 38, margin: 0, padding: '0 16px', gap: 8, display: 'flex', alignItems: 'center', cursor: uploadingDriveFile ? 'not-allowed' : 'pointer' }}
                  >
                    {uploadingDriveFile ? <Sparkles size={16} className="spin" /> : <Folder size={16} />}
                    <span>{uploadingDriveFile ? 'Uploading…' : 'Select & Upload'}</span>
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
                  <div style={{ marginTop: 16, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, fontSize: '0.8rem', color: '#166534', textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ Upload Successful!</div>
                    <div>File: <strong>{uploadedFileResult.filename}</strong></div>
                    <a href={uploadedFileResult.drive_url} target="_blank" rel="noreferrer" style={{ color: '#15803d', textDecoration: 'underline', marginTop: 4, display: 'inline-block', fontWeight: 600 }}>
                      View File on Google Drive <ExternalLink size={12} />
                    </a>
                  </div>
                )}
              </div>
            </div>
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
