import { useState, useEffect } from 'react';
import { FolderKanban, RefreshCw, Euro, Car, FileText } from 'lucide-react';
import { api } from '../api/api';

const STAGES_SELL = ['Lead','Onboarding','Vehicle Docs','Marketing','Negotiation','Closed'];
const STAGES_BUY  = ['Lead','Requirements','Contract','Sourcing','Inspection','Acquired'];

export default function Projects() {
  const [tab, setTab]         = useState('sell');
  const [deals, setDeals]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getDeals(tab);
      setDeals(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); setSelected(null); }, [tab]);

  const stages = tab === 'sell' ? STAGES_SELL : STAGES_BUY;

  const byStage = (stage) => deals.filter(d => (d.status || 'Lead') === stage);

  const ocrBadge = (s) => {
    if (s === 'Verified')  return <span className="badge badge-whatsapp">Verified</span>;
    if (s === 'Processed') return <span className="badge badge-email">Processed</span>;
    return <span className="badge badge-new">Pending OCR</span>;
  };

  return (
    <div>
      {/* Pipeline Tab Switch */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {['sell','buy'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={tab === t ? 'btn-primary' : 'btn-ghost'}
            style={{ textTransform: 'capitalize' }}
          >
            {t === 'sell' ? '🏷️ SELL — Vermittlung' : '🔍 BUY — Beschaffung'}
          </button>
        ))}
        <button className="btn-ghost" style={{ marginLeft: 'auto' }} onClick={load}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
          {stages.map(stage => (
            <div key={stage} style={{ minWidth: 200, flex: '0 0 200px' }}>
              <div style={{
                fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                marginBottom: 8, padding: '0 4px'
              }}>
                {stage} <span style={{ fontWeight: 400 }}>({byStage(stage).length})</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byStage(stage).length === 0 ? (
                  <div style={{
                    border: '2px dashed var(--border)', borderRadius: 8,
                    padding: 12, textAlign: 'center',
                    fontSize: '0.72rem', color: 'var(--text-muted)'
                  }}>
                    Empty
                  </div>
                ) : byStage(stage).map(deal => (
                  <div
                    key={deal.name}
                    className="card"
                    style={{ cursor: 'pointer', padding: 12, margin: 0,
                             border: selected?.name === deal.name ? '2px solid var(--brand-500)' : undefined }}
                    onClick={() => setSelected(selected?.name === deal.name ? null : deal)}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: 4 }}>
                      {deal.lead_name || deal.name}
                    </div>
                    {deal.custom_vehicle_model && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: 4, alignItems: 'center' }}>
                        <Car size={11} /> {deal.custom_manufacturer} {deal.custom_vehicle_model}
                      </div>
                    )}
                    <div style={{ marginTop: 6 }}>{ocrBadge(deal.custom_ocr_status)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Deal Detail Panel */}
      {selected && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-title">{selected.lead_name}</span>
            <button className="btn-ghost" onClick={() => setSelected(null)}>✕</button>
          </div>
          <div className="card-body">
            <div className="form-grid">
              {[
                ['VIN',              selected.custom_vin],
                ['Manufacturer',     selected.custom_manufacturer],
                ['Model',            selected.custom_vehicle_model],
                ['OCR Status',       selected.custom_ocr_status],
                ['Net Profit',       selected.custom_net_profit ? `€ ${selected.custom_net_profit}` : '—'],
                ['Follow-up Date',   selected.custom_followup_target_date || '—'],
              ].map(([label, val]) => (
                <div key={label} className="form-group">
                  <label className="form-label">{label}</label>
                  <div style={{ padding: '6px 0', fontWeight: 500, fontSize: '0.88rem' }}>{val || '—'}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
              <a href={`http://localhost:8080/crm/deals/${selected.name}`}
                 target="_blank" rel="noreferrer" className="btn-primary">
                Open in Frappe CRM ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
