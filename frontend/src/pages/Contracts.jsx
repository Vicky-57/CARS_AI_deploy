import { useState, useEffect } from 'react';
import { FileText, Download, CheckCircle, Loader } from 'lucide-react';
import { api } from '../api/api';

const TEMPLATES = [
  { type: 'sell_b2c',   label: 'Vermittlungsvertrag B2C Aktiv',         desc: 'Sell-side brokerage contract',         pipeline: 'sell' },
  { type: 'buy_passiv', label: 'Vermittlungsvertrag Beschaffung Passiv', desc: 'Buy-side procurement contract',         pipeline: 'buy'  },
  { type: 'kaufvertrag',label: 'Kaufvertrag C2C Bilingual',              desc: 'Bilingual C2C sales contract (DE/EN)', pipeline: 'both' },
  { type: 'handover',   label: 'Fahrzeug-Übergabeprotokoll',            desc: 'Vehicle handover protocol',            pipeline: 'both' },
];

export default function Contracts() {
  const [deals, setDeals]         = useState([]);
  const [selectedDeal, setSelectedDeal] = useState('');
  const [generating, setGenerating]     = useState('');
  const [generated, setGenerated]       = useState({});  // { type: file_url }
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    api.getDeals().then(d => { setDeals(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleGenerate = async (templateType) => {
    if (!selectedDeal) { alert('Please select a deal first.'); return; }
    setGenerating(templateType);
    try {
      const result = await api.generateContract(selectedDeal, templateType);
      setGenerated(prev => ({ ...prev, [templateType]: result.file_url }));
    } catch (err) {
      alert('Contract generation failed: ' + err.message);
    } finally {
      setGenerating('');
    }
  };

  const FRAPPE_BASE = import.meta.env.VITE_FRAPPE_URL || 'http://localhost:8080';

  return (
    <div>
      {/* Deal Selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Select Deal</span>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-spinner"><div className="spinner" /></div>
          ) : (
            <select
              className="input"
              style={{ maxWidth: 420 }}
              value={selectedDeal}
              onChange={e => { setSelectedDeal(e.target.value); setGenerated({}); }}
            >
              <option value="">— Choose a CRM Deal —</option>
              {deals.map(d => (
                <option key={d.name} value={d.name}>
                  {d.lead_name || d.name}
                  {d.custom_vehicle_model ? ` · ${d.custom_manufacturer || ''} ${d.custom_vehicle_model}` : ''}
                  {` (${d.custom_pipeline_type?.toUpperCase() || 'Deal'})`}
                </option>
              ))}
            </select>
          )}
          {selectedDeal && (
            <p style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Deal fields (VIN, client name, price, etc.) will be auto-filled from Frappe CRM.
            </p>
          )}
        </div>
      </div>

      {/* Template Cards */}
      <div className="stats-grid">
        {TEMPLATES.map(({ type, label, desc, pipeline }) => {
          const isGenerating = generating === type;
          const fileUrl      = generated[type];

          return (
            <div key={type} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--surface-2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <FileText size={18} color="var(--brand-500)" />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{desc}</div>
                  <div style={{ marginTop: 4 }}>
                    <span className={`badge ${pipeline === 'sell' ? 'badge-sell' : pipeline === 'buy' ? 'badge-buy' : 'badge-new'}`}>
                      {pipeline === 'both' ? 'Sell & Buy' : pipeline.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>

              {fileUrl ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`${FRAPPE_BASE}${fileUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary"
                    style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }}
                  >
                    <Download size={13} /> Download PDF
                  </a>
                  <button className="btn-ghost" onClick={() => handleGenerate(type)}>
                    Regenerate
                  </button>
                </div>
              ) : (
                <button
                  className="btn-primary"
                  style={{ width: '100%' }}
                  disabled={isGenerating || !selectedDeal}
                  onClick={() => handleGenerate(type)}
                >
                  {isGenerating ? (
                    <><Loader size={13} className="spin" /> Generating…</>
                  ) : (
                    '1-Click Generate PDF'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {Object.keys(generated).length > 0 && (
        <div className="card" style={{ marginTop: 16, borderLeft: '3px solid var(--green-500)' }}>
          <div className="card-header">
            <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={15} color="var(--green-500)" /> Generated Contracts
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Object.entries(generated).map(([type, url]) => {
              const tpl = TEMPLATES.find(t => t.type === type);
              return (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem' }}>{tpl?.label}</span>
                  <a href={`${FRAPPE_BASE}${url}`} target="_blank" rel="noreferrer" className="btn-ghost">
                    <Download size={12} /> Download
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
