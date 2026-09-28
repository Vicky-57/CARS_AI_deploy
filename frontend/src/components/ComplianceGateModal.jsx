import { useState, useEffect } from 'react';
import { X, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, FileText, Lock } from 'lucide-react';
import { parseCompliance, serializeCompliance, checkStageTransitionGates } from '../utils/complianceUtils';
import { api } from '../api/api';
import toast from 'react-hot-toast';

export default function ComplianceGateModal({ isOpen, project, targetStage, onClose, onAdvanceApproved }) {
  const [checklist, setChecklist] = useState({
    setup_fee_paid: false,
    gdpr_consent: false,
    agb_signed: false,
    fairplay_checked: false,
    waiver_signed: false,
    aml_verified: false
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      const parsed = parseCompliance(project.notes);
      setChecklist({
        setup_fee_paid: !!parsed.setup_fee_paid,
        gdpr_consent: !!parsed.gdpr_consent,
        agb_signed: !!parsed.agb_signed,
        fairplay_checked: !!parsed.fairplay_checked,
        waiver_signed: !!parsed.waiver_signed,
        aml_verified: !!parsed.aml_verified
      });
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const gateEvaluation = checkStageTransitionGates({ ...project, notes: serializeCompliance(project.notes, checklist) }, targetStage);
  const price = Math.max(
    parseFloat(project.target_price || 0),
    parseFloat(project.purchase_price || 0),
    parseFloat(project.agreed_sale_price || 0)
  );
  const isAmlRequired = price >= 10000;

  const handleToggle = (key) => {
    setChecklist(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const updatedCompliance = {
        ...checklist,
        verified_at: nowIso,
        verified_by: 'Authorized Broker'
      };
      const updatedNotes = serializeCompliance(project.notes, updatedCompliance);

      const updated = await api.updateProject(project.id, {
        notes: updatedNotes,
        current_stage: targetStage,
        updated_at: nowIso
      });

      toast.success(`Compliance verified! Deal advanced to ${targetStage}`);
      if (onAdvanceApproved) onAdvanceApproved(updated);
      onClose();
    } catch (err) {
      toast.error('Failed to advance project: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const allGatesPassed = gateEvaluation.missingGates.length === 0;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
        
        {/* Header */}
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: '#fef3c7', color: '#d97706',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <div className="modal-title" style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                Compliance Hard Gate Verification
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Enforcing CA-001 & German Consumer / GwG Legal Standards
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Target Transition Details */}
          <div style={{
            padding: '12px 14px', background: 'var(--bg-canvas)',
            border: '1px solid var(--border)', borderRadius: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {project.client_name} • {project.target_vehicle || 'Vehicle TBD'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Current: <span style={{ fontWeight: 600 }}>{project.current_stage}</span> ➔ Target: <strong style={{ color: 'var(--primary)' }}>{targetStage}</strong>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {price > 0 ? `€${price.toLocaleString('de-DE')}` : 'Price TBD'}
              </div>
              <span className={`badge ${project.project_type === 'SELL' ? 'badge-green' : 'badge-blue'}`} style={{ fontSize: '0.65rem' }}>
                {project.project_type === 'SELL' ? 'Sell Mandate' : 'Buy Mandate'}
              </span>
            </div>
          </div>

          {/* GwG / AML Alert for large deals */}
          {isAmlRequired && (
            <div style={{
              padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a',
              borderRadius: 8, color: '#92400e', fontSize: '0.78rem', lineHeight: 1.4,
              display: 'flex', gap: 10, alignItems: 'flex-start'
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>GwG Regulatory Notice (Deal ≥ €10,000):</strong> Under the German Money Laundering Act (GwG), source-of-funds documentation is mandatory before closing. Cash transactions are strictly capped at <strong>€9,999</strong>.
              </div>
            </div>
          )}

          {/* Checklist */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', marginBottom: 8 }}>
              Required Compliance Checkpoints
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              
              {/* Setup Fee */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${checklist.setup_fee_paid ? '#bbf7d0' : 'var(--border)'}`,
                background: checklist.setup_fee_paid ? '#f0fdf4' : 'var(--bg-surface)', cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={checklist.setup_fee_paid}
                  onChange={() => handleToggle('setup_fee_paid')}
                  style={{ marginTop: 3 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Setup Fee Acknowledged / Paid (€349)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Mandatory fee acceptance before initiating procurement research or inspection labor.
                  </div>
                </div>
              </label>

              {/* GDPR */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${checklist.gdpr_consent ? '#bbf7d0' : 'var(--border)'}`,
                background: checklist.gdpr_consent ? '#f0fdf4' : 'var(--bg-surface)', cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={checklist.gdpr_consent}
                  onChange={() => handleToggle('gdpr_consent')}
                  style={{ marginTop: 3 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    GDPR Consent Recorded (Art. 6(1)(b) DSGVO)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Data processing agreement for vehicle search & client broker communications.
                  </div>
                </div>
              </label>

              {/* AGB */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${checklist.agb_signed ? '#bbf7d0' : 'var(--border)'}`,
                background: checklist.agb_signed ? '#f0fdf4' : 'var(--bg-surface)', cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={checklist.agb_signed}
                  onChange={() => handleToggle('agb_signed')}
                  style={{ marginTop: 3 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    AGB (General Brokerage Terms) Executed
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Signed Vermittlungsvertrag (B2C aktiv / Beschaffung passiv) confirmed.
                  </div>
                </div>
              </label>

              {/* Fairplay-Check */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${checklist.fairplay_checked ? '#bbf7d0' : 'var(--border)'}`,
                background: checklist.fairplay_checked ? '#f0fdf4' : 'var(--bg-surface)', cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={checklist.fairplay_checked}
                  onChange={() => handleToggle('fairplay_checked')}
                  style={{ marginTop: 3 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Fairplay-Check Completed
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Market valuation, damage disclosure, and transparent pricing established.
                  </div>
                </div>
              </label>

              {/* Widerrufsverzicht */}
              <label style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                borderRadius: 8, border: `1px solid ${checklist.waiver_signed ? '#bbf7d0' : 'var(--border)'}`,
                background: checklist.waiver_signed ? '#f0fdf4' : 'var(--bg-surface)', cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={checklist.waiver_signed}
                  onChange={() => handleToggle('waiver_signed')}
                  style={{ marginTop: 3 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    14-Day Immediate-Start Waiver (Widerrufsverzicht)
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Consumer consent for immediate broker execution prior to statutory 14-day expiry.
                  </div>
                </div>
              </label>

              {/* AML / Source-of-funds (if >= 10k) */}
              {isAmlRequired && (
                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  borderRadius: 8, border: `1px solid ${checklist.aml_verified ? '#bbf7d0' : 'var(--border)'}`,
                  background: checklist.aml_verified ? '#f0fdf4' : 'var(--bg-surface)', cursor: 'pointer'
                }}>
                  <input
                    type="checkbox"
                    checked={checklist.aml_verified}
                    onChange={() => handleToggle('aml_verified')}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      AML / GwG Mittelherkunftsnachweis (Source of Funds)
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Customer ID copy & bank fund provenance verified. No cash exceeding €9,999.
                    </div>
                  </div>
                </label>
              )}

            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleApprove}
            disabled={saving || !allGatesPassed}
            style={{
              gap: 6,
              opacity: allGatesPassed ? 1 : 0.6,
              cursor: allGatesPassed ? 'pointer' : 'not-allowed'
            }}
          >
            {saving ? <ShieldCheck size={14} className="spin" /> : allGatesPassed ? <CheckCircle2 size={14} /> : <Lock size={14} />}
            <span>{allGatesPassed ? `Verify & Advance to ${targetStage}` : 'Complete Missing Gates to Advance'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
