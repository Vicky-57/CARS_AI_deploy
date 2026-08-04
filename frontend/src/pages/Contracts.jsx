import { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle, Loader, History as HistoryIcon, ChevronDown } from 'lucide-react';
import { api } from '../api/api';

const TEMPLATES = [
  { type: 'sell_b2c',   label: 'Vermittlungsvertrag B2C Aktiv',         desc: 'Sell-side brokerage contract',         pipeline: 'sell' },
  { type: 'buy_passiv', label: 'Vermittlungsvertrag Beschaffung Passiv', desc: 'Buy-side procurement contract',         pipeline: 'buy'  },
  { type: 'kaufvertrag',label: 'Kaufvertrag C2C Bilingual',              desc: 'Bilingual C2C sales contract (DE/EN)', pipeline: 'both' },
  { type: 'handover',   label: 'Fahrzeug-Übergabeprotokoll',            desc: 'Vehicle handover protocol',            pipeline: 'both' },
];

const MOCK_HISTORY = [
  { id: '1', client_name: 'Max Mustermann', template: 'Vermittlungsvertrag B2C Aktiv', date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: '2', client_name: 'Sarah Schmidt', template: 'Kaufvertrag C2C Bilingual', date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
  { id: '3', client_name: 'John Doe', template: 'Fahrzeug-Übergabeprotokoll', date: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
];

export default function Contracts() {
  const [deals, setDeals]               = useState([]);
  const [selectedDeal, setSelectedDeal] = useState('');
  const [generating, setGenerating]     = useState('');
  const [generated, setGenerated]       = useState({});  // { type: file_url }
  const [loading, setLoading]           = useState(true);
  const [showHistory, setShowHistory]   = useState(false);

  useEffect(() => {
    api.getProjects().then(d => { setDeals(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleGenerate = async (templateType) => {
    if (!selectedDeal) { alert('Please select a deal first.'); return; }
    setGenerating(templateType);
    try {
      const result = await api.generateContract(selectedDeal, templateType);
      setGenerated(prev => ({ ...prev, [templateType]: result.file_path || result.file_url || result }));
    } catch (err) {
      alert('Contract generation failed: ' + err.message);
    } finally {
      setGenerating('');
    }
  };

  const AI_BASE = import.meta.env.VITE_AI_URL || 'http://localhost:9000';

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Documentation</h1>
          <p style={{ fontSize: '0.9rem' }}>Generate PDF contracts dynamically for your deals.</p>
        </div>
        <div>
          <button className="btn btn-secondary" onClick={() => setShowHistory(true)} style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <HistoryIcon size={14} /> View History
          </button>
        </div>
      </div>

      {/* Deal Selector */}
      <div className="card" style={{ marginBottom: 32, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
        <div className="card-header" style={{ padding: '20px 24px' }}>
          <span className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>Select Deal</span>
        </div>
        <div className="card-body" style={{ padding: '24px' }}>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /></div>
          ) : (
            <div style={{ position: 'relative', maxWidth: 480 }}>
              <select
                className="form-select"
                style={{ 
                  width: '100%', 
                  padding: '12px 16px', 
                  fontSize: '0.9rem', 
                  borderRadius: 'var(--radius)', 
                  appearance: 'none',
                  cursor: 'pointer',
                  border: '1px solid var(--gray-300)',
                  backgroundColor: 'var(--surface)',
                  color: selectedDeal ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: selectedDeal ? 500 : 400
                }}
                value={selectedDeal}
                onChange={e => { setSelectedDeal(e.target.value); setGenerated({}); }}
              >
                <option value="">— Choose a CRM Deal to generate for —</option>
                {deals.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.client_name || d.id}
                    {d.target_vehicle ? ` · ${d.target_vehicle}` : ''}
                    {` (${d.project_type?.toUpperCase() || 'Deal'})`}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} color="var(--text-muted)" style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            </div>
          )}
          {selectedDeal && (
            <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} color="var(--success)" />
              Deal fields (VIN, client name, price, etc.) will be auto-filled from Frappe CRM.
            </p>
          )}
        </div>
      </div>

      {/* Template Cards */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {TEMPLATES.map(({ type, label, desc, pipeline }) => {
          const isGenerating = generating === type;
          const fileUrl      = generated[type];

          return (
            <div key={type} className="card" style={{ padding: 16, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16, flex: 1 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: 'linear-gradient(135deg, var(--brand-50), var(--brand-100))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <FileText size={16} color="var(--brand-600)" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 2, color: 'var(--text-primary)', lineHeight: 1.2 }}>{label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{desc}</div>
                  <div style={{ marginTop: 6 }}>
                    <span className={`badge ${pipeline === 'sell' ? 'badge-sell' : pipeline === 'buy' ? 'badge-buy' : 'badge-new'}`} style={{ padding: '2px 8px', fontSize: '0.65rem' }}>
                      {pipeline === 'both' ? 'Sell & Buy' : pipeline.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {fileUrl ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', alignSelf: 'flex-start' }}>
                  <a
                    href={`${AI_BASE}/api/v1/contracts/download?path=${encodeURIComponent(fileUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                    style={{ textDecoration: 'none', padding: '6px 12px', fontSize: '0.8rem' }}
                  >
                    <Download size={13} /> Download
                  </a>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleGenerate(type)}>
                    Regenerate
                  </button>
                </div>
              ) : (
                <button
                  className="btn btn-primary"
                  style={{ alignSelf: 'flex-start', padding: '6px 16px', marginTop: 'auto', fontSize: '0.8rem' }}
                  disabled={isGenerating || !selectedDeal}
                  onClick={() => handleGenerate(type)}
                >
                  {isGenerating ? (
                    <><Loader size={13} className="spin" /> Generating…</>
                  ) : (
                    'Generate PDF'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(generated).length > 0 && (
        <div className="card" style={{ marginTop: 32, borderLeft: '4px solid var(--success)', borderTop: 'none', borderRight: 'none', borderBottom: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div className="card-header" style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.05rem', fontWeight: 700 }}>
              <CheckCircle size={18} color="var(--success)" /> Generated Contracts
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
            {Object.entries(generated).map(([type, url]) => {
              const tpl = TEMPLATES.find(t => t.type === type);
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', padding: '12px 16px', borderRadius: 8 }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{tpl?.label}</span>
                  <a href={`${AI_BASE}/api/v1/contracts/download?path=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ padding: '6px 12px' }}>
                    <Download size={14} /> Download File
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="modal-header">
              <h3 className="modal-title">Contract Generation History</h3>
              <button className="btn-icon" onClick={() => setShowHistory(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto', padding: '24px' }}>
              {MOCK_HISTORY.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <HistoryIcon size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>No history found.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Generated contracts will appear here.</p>
                </div>
              ) : (
                MOCK_HISTORY.map((item) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px', background: 'var(--surface)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--brand-50)', color: 'var(--brand-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={18} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.client_name}</div>
                        <span className="badge" style={{ fontSize: '0.65rem', background: 'var(--success)', color: 'white', padding: '2px 6px' }}>Generated</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.template}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginTop: 4 }}>
                        {new Date(item.date).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-footer" style={{ background: 'var(--surface)' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowHistory(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
