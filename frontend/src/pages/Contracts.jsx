import { useState, useEffect } from 'react';
import { FileText, Check, ChevronRight } from 'lucide-react';
import { api } from '../api/api';

const STEPS = ['Select Client', 'Select Template', 'Review & Generate'];

function WizardSteps({ step }) {
  return (
    <div className="wizard-steps">
      {STEPS.map((label, i) => (
        <div key={label} className={`wizard-step${i < step ? ' done' : i === step ? ' active' : ''}`}>
          <div className="wizard-step-num">
            {i < step ? <Check size={12} /> : i + 1}
          </div>
          <span className="wizard-step-label">{label}</span>
          {i < STEPS.length - 1 && <div className={`wizard-connector${i < step ? ' done' : ''}`} />}
        </div>
      ))}
    </div>
  );
}

export default function Contracts() {
  const [step, setStep] = useState(0);
  const [leads, setLeads] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [fields, setFields] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchLead, setSearchLead] = useState('');

  useEffect(() => {
    api.getLeads({ limit: 200 }).then(setLeads).catch(() => setLeads([]));
    api.getTemplates().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  const filteredLeads = leads.filter(l =>
    !searchLead || (l.name || '').toLowerCase().includes(searchLead.toLowerCase()) ||
    (l.email || '').toLowerCase().includes(searchLead.toLowerCase())
  );

  const pickTemplate = async (tpl) => {
    setSelectedTemplate(tpl);
    setStep(2);
    setLoading(true);
    try {
      const res = await api.fillContract({ lead_id: selectedLead.id, template_name: tpl.id });
      setFields(res.fields || {});
    } catch (e) {
      alert('Could not fetch client data: ' + e.message);
    } finally { setLoading(false); }
  };

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api.generatePdf({ lead_id: selectedLead.id, template_name: selectedTemplate.id, fields });
      alert('✅ ' + (res.message || 'PDF generated!'));
    } catch (e) { alert('Error: ' + e.message); }
    finally { setLoading(false); }
  };

  const reset = () => { setStep(0); setSelectedLead(null); setSelectedTemplate(null); setFields({}); };

  const FieldInput = ({ k }) => (
    <div className="form-group">
      <label className="form-label">{k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</label>
      <input className="form-input" value={fields[k] ?? ''} onChange={e => setFields(f => ({ ...f, [k]: e.target.value }))} />
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Contract Generator</h1>
          <p>Select a client and template — fields are auto-filled from the database.</p>
        </div>
        {step > 0 && <button className="btn btn-secondary" onClick={reset}>Start Over</button>}
      </div>

      <div className="card">
        <div className="card-header">
          <WizardSteps step={step} />
        </div>
        <div className="card-body">
          {/* Step 0: Select Client */}
          {step === 0 && (
            <div>
              <div className="form-group" style={{ maxWidth: 400 }}>
                <label className="form-label">Search Client / Lead</label>
                <input className="form-input" value={searchLead} onChange={e => setSearchLead(e.target.value)} placeholder="Type name or email…" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                {filteredLeads.length === 0 && (
                  <div className="empty-state" style={{ padding: 32 }}>
                    <FileText size={24} />
                    <h3>No leads found</h3>
                    <p>Add leads first in the Leads section.</p>
                  </div>
                )}
                {filteredLeads.map(lead => (
                  <div
                    key={lead.id}
                    onClick={() => { setSelectedLead(lead); setStep(1); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                      cursor: 'pointer', transition: 'all var(--transition)',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--brand-500)'; e.currentTarget.style.background = 'var(--brand-50)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{lead.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{lead.email || lead.phone || '—'}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${lead.intent === 'BUY' ? 'badge-buy' : lead.intent === 'SELL' ? 'badge-sell' : 'badge-new'}`}>{lead.intent}</span>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 1: Select Template */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--brand-50)', borderRadius: 'var(--radius)', fontSize: '0.8rem' }}>
                ✅ Client: <strong>{selectedLead?.name}</strong> — {selectedLead?.email || selectedLead?.phone}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {templates.map(tpl => (
                  <div
                    key={tpl.id}
                    onClick={() => pickTemplate(tpl)}
                    style={{
                      padding: '16px', border: '2px solid var(--border)', borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer', transition: 'all var(--transition)',
                    }}
                    onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--brand-500)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
                    onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📄</div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 4 }}>{tpl.name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 8 }}>{tpl.description}</div>
                    <span className={`badge ${tpl.type === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>{tpl.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Review & Generate */}
          {step === 2 && (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20, padding: '12px 14px', background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
                <div style={{ fontSize: '0.8rem' }}>
                  <strong>Client:</strong> {selectedLead?.name}
                </div>
                <div style={{ color: 'var(--border)' }}>|</div>
                <div style={{ fontSize: '0.8rem' }}>
                  <strong>Template:</strong> {selectedTemplate?.name}
                </div>
              </div>

              {loading ? (
                <div className="loading-spinner"><div className="spinner" /><span>Fetching client data…</span></div>
              ) : (
                <>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Review and edit the pre-filled fields below before generating the PDF.
                  </p>
                  <div className="grid-2">
                    {Object.keys(fields).filter(k => fields[k] !== null && fields[k] !== undefined).map(k => (
                      <FieldInput key={k} k={k} />
                    ))}
                    {Object.keys(fields).filter(k => fields[k] === null || fields[k] === undefined).map(k => (
                      <FieldInput key={k} k={k} />
                    ))}
                  </div>
                  <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-primary" onClick={generate} disabled={loading}>
                      <FileText size={14} /> Generate PDF
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
