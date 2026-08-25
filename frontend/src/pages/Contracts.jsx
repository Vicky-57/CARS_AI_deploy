import { useState, useEffect, useMemo } from 'react';
import {
  FileText, Download, CheckCircle, Loader, Copy, ExternalLink,
  FolderKanban, RefreshCw, Save, X, ShieldCheck, Eye, Plus,
} from 'lucide-react';
import { api, supabase } from '../api/api';

const PIPELINE_TEMPLATES = {
  sell: [
    { type: 'sell_b2c', label: 'Vermittlungsvertrag B2C (Aktiv)', desc: 'Sell-side brokerage contract' },
    { type: 'kaufvertrag', label: 'Kaufvertrag C2C (Bilingual)', desc: 'Bilingual C2C sales contract (DE/EN)' },
    { type: 'handover', label: 'Fahrzeug-Übergabeprotokoll', desc: 'Vehicle handover protocol' },
  ],
  buy: [
    { type: 'buy_passiv', label: 'Vermittlungsvertrag Beschaffung (Passiv)', desc: 'Buy-side procurement contract' },
    { type: 'kaufvertrag', label: 'Kaufvertrag C2C (Bilingual)', desc: 'Bilingual C2C sales contract (DE/EN)' },
    { type: 'handover', label: 'Fahrzeug-Übergabeprotokoll', desc: 'Vehicle handover protocol' },
  ],
};

// Editable template field groups (canonical keys, shared with the PDF engine)
const EDITABLE_FIELDS = [
  {
    group: 'Client', keyPrefix: 'person', fields: [
      { key: 'full_name', label: 'Full Name / Name' },
      { key: 'phone', label: 'Phone / Telefon' },
      { key: 'email', label: 'Email / E-Mail' },
      { key: 'street', label: 'Street / Straße' },
      { key: 'zip_city', label: 'ZIP, City / PLZ, Ort' },
      { key: 'id_card', label: 'ID Type / No. (Ausweis)' },
    ]
  },
  {
    group: 'Vehicle', keyPrefix: 'vehicle', fields: [
      { key: 'manufacturer', label: 'Manufacturer / Hersteller' },
      { key: 'model', label: 'Model / Typ' },
      { key: 'vin', label: 'VIN / FIN' },
      { key: 'license', label: 'License Plate / Kennzeichen' },
      { key: 'first_date', label: 'First Registration / Erstzulassung' },
      { key: 'mileage', label: 'Mileage (km) / Kilometerstand' },
      { key: 'power', label: 'Power / Leistung' },
      { key: 'displacement', label: 'Displacement / Hubraum' },
      { key: 'tuev_until', label: 'TÜV valid until / TÜV bis' },
      { key: 'owners', label: 'Owners / Halter' },
      { key: 'color', label: 'Color / Farbe' },
      { key: 'zb2', label: 'Reg. Cert. Part II No. / ZB II' },
      { key: 'keys', label: 'Keys / Schlüssel' },
      { key: 'engine_number', label: 'Engine No. / Motor-Nr.' },
    ]
  },
  {
    group: 'Price', keyPrefix: 'price', fields: [
      { key: 'min_price', label: 'Min. Price (€) / Mindestpreis' },
      { key: 'price', label: 'Purchase Price (€) / Kaufpreis' },
      { key: 'special_agreements', label: 'Special Agreements / Sondervereinbarungen' },
    ]
  },
  {
    group: 'Handover', keyPrefix: 'handover', fields: [
      { key: 'giving_person', label: 'Giving Person / Übergebend' },
      { key: 'receiving_person', label: 'Receiving Person / Übernehmend' },
      { key: 'place', label: 'Place / Ort' },
      { key: 'date', label: 'Date / Datum' },
      { key: 'notes', label: 'Notes / Anmerkungen' },
    ]
  },
];

export default function Contracts() {
  const [pipeline, setPipeline] = useState('sell');
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);         // client_form_sessions rows
  const [documents, setDocuments] = useState([]);       // documents rows
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [selectedProject, setSelectedProject] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [editor, setEditor] = useState(null);           // { templateType, fieldData, status, drive_url }
  const [previewing, setPreviewing] = useState(null);
  const [embedFormUrl, setEmbedFormUrl] = useState(null);
  const [busy, setBusy] = useState('');                 // busy action key

  const loadAll = async () => {
    setLoading(true);
    try {
      const [proj, sess, docs] = await Promise.all([
        api.getProjects(),
        supabase.from('client_form_sessions').select('*').order('created_at', { ascending: false }),
        supabase.from('documents').select('*').order('created_at', { ascending: false }),
      ]);
      setProjects(proj || []);
      setSessions(sess.data || []);
      setDocuments(docs.data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  const pipelinedProjects = useMemo(
    () => (projects || []).filter(p => p.project_type?.toUpperCase() === pipeline.toUpperCase()),
    [projects, pipeline]
  );

  const sessionForProject = (projectId) =>
    (sessions || []).find(s => s.project_id === projectId) || null;

  const docFor = (sessionId, templateType) =>
    (documents || []).find(d => d.session_id === sessionId && d.template_type === templateType) || null;

  const publicLink = (session) => {
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '');
    const scheme = base.startsWith('http') ? '' : 'http://localhost:5173';
    return `${scheme}/form/${session?.pipeline || pipeline}?token=${session?.form_link_token}`;
  };

  const handleCreateSession = async () => {
    if (!selectedProject) return;
    const projObj = (projects || []).find(p => p.id === selectedProject);
    if (!projObj) return;

    setCreating(true);
    try {
      await api.createFormSession({
        pipeline: (projObj.project_type || pipeline).toLowerCase(),
        project_id: projObj.id,
        client_name: projObj.client_name || 'Client',
      });
      await loadAll();
    } catch (e) {
      alert('Could not create session: ' + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (session) => {
    const link = publicLink(session);
    try {
      await navigator.clipboard.writeText(link);
      alert(`Form link copied to clipboard:\n${link}`);
    } catch {
      alert(`Form link:\n${link}`);
    }
  };

  const handleOpenEditor = (session, templateType) => {
    const doc = docFor(session.id, templateType);
    const sub = (session.submissions || []).find(s => s.template_type === templateType);
    const mergedData = {
      ...(session.shared_core || {}),
      ...(sub?.field_data || {})
    };
    setEditor({
      sessionId: session.id,
      templateType,
      pipeline: session.pipeline,
      clientName: session.client_name,
      fieldData: mergedData,
      status: doc?.status || 'not rendered',
      drive_url: doc?.drive_url || '',
    });
  };

  const handleSaveEditor = async () => {
    if (!editor) return;
    setBusy('save');
    try {
      // persist edited fields as shared_core + a stage submission for the template
      await api.saveFormStage(editor.sessionId, {
        stage: 2,
        template_type: editor.templateType,
        field_data: editor.fieldData,
        shared_core: editor.fieldData,
      });
      await loadAll();
      alert('Template data saved. Now click Preview PDF.');
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      setBusy('');
    }
  };

  const handlePreview = async (session, templateType) => {
    setBusy('preview-' + templateType);
    try {
      const res = await api.renderTemplate(session.id, templateType);
      setPreviewing({ url: api.downloadPdf(res.file_path), label: templateType, client: session.client_name });
      await loadAll();
    } catch (e) {
      alert('Preview failed: ' + e.message);
    } finally {
      setBusy('');
    }
  };

  const handleApprove = async (session, templateType) => {
    setBusy('approve-' + templateType);
    try {
      const res = await api.approveTemplate(session.id, templateType);
      await loadAll();
      alert(`Approved & saved to Google Drive:\n${res.folder_path || res.drive_url || 'Drive'}`);
    } catch (e) {
      alert('Approval/upload failed: ' + e.message);
    } finally {
      setBusy('');
    }
  };

  const templates = PIPELINE_TEMPLATES[pipeline] || PIPELINE_TEMPLATES.sell;

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 32 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.5px', color: '#0f172a', margin: '0 0 6px 0' }}>
            Documentation
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500, margin: 0, lineHeight: 1.5 }}>
            Generate, preview, and approve contracts per client, then save them directly to Google Drive.
          </p>
        </div>
        <button className="btn" onClick={loadAll} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: '#ffffff', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Pipeline toggle */}
      <div style={{ display: 'inline-flex', gap: 4, marginBottom: 24, background: '#f1f5f9', padding: 4, borderRadius: 12 }}>
        {(['sell', 'buy']).map(p => (
          <button
            key={p}
            onClick={() => { setPipeline(p); setSelectedProject(null); }}
            className="btn"
            style={{
              padding: '8px 24px', borderRadius: 8, fontWeight: 800, fontSize: '0.85rem',
              background: pipeline === p ? '#0f172a' : 'transparent',
              color: pipeline === p ? '#fff' : '#64748b',
              border: 'none',
              boxShadow: pipeline === p ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            {p === 'sell' ? 'SELL / VERKAUF' : 'BUY / BESCHAFFUNG'}
          </button>
        ))}
      </div>

      {/* Project selector + create session */}
      <div className="card" style={{ marginBottom: 24, border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.04)', borderRadius: 16, overflow: 'hidden' }}>
        <div className="card-header" style={{ padding: '18px 24px', background: '#ffffff', borderBottom: '1px solid #e2e8f0' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, color: '#0f172a' }}>
            <FolderKanban size={18} color="#ea580c" /> {pipeline.toUpperCase()} Projects
          </span>
        </div>
        <div className="card-body" style={{ padding: 24 }}>
          {loading ? (
            <div className="loading-spinner"><div className="spinner" style={{ width: 24, height: 24, borderWidth: 2 }} /></div>
          ) : pipelinedProjects.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No {pipeline.toUpperCase()} projects yet. Create one in the Projects page first.
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
              {pipelinedProjects.map(p => {
                const sess = sessionForProject(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedProject(p.id)}
                    style={{
                      border: `1.5px solid ${selectedProject === p.id ? '#ea580c' : '#e2e8f0'}`,
                      borderRadius: 14, padding: '16px 20px', cursor: 'pointer',
                      background: selectedProject === p.id ? '#fffaf5' : '#ffffff',
                      boxShadow: selectedProject === p.id ? '0 4px 16px rgba(234, 88, 12, 0.12)' : '0 2px 4px rgba(0,0,0,0.02)',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{p.client_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4, fontWeight: 500 }}>
                      {p.target_vehicle || p.vin || 'Vehicle not set'}
                    </div>
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {sess ? (
                        <span className="badge" style={{ fontSize: '0.65rem', padding: '4px 10px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 20 }}>
                          <CheckCircle size={12} /> Session ready · {sess.stage}/3
                        </span>
                      ) : (
                        <span className="badge" style={{ fontSize: '0.65rem', padding: '4px 10px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 20 }}>No session yet</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedProject && (
            <div style={{ marginTop: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {sessionForProject(selectedProject) ? (
                <>
                  <button className="btn" onClick={() => handleCopyLink(sessionForProject(selectedProject))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
                    <Copy size={14} /> Copy Form Link
                  </button>
                  <button
                    onClick={() => setEmbedFormUrl(publicLink(sessionForProject(selectedProject)))}
                    className="btn"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#ffffff', color: '#ea580c', border: '1.5px solid #fed7aa', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    Open Form
                  </button>
                </>
              ) : (
                <button className="btn" onClick={handleCreateSession} disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#0f172a', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
                  <Plus size={14} /> {creating ? 'Creating…' : 'Create Form Session'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Templates per selected session */}
      {selectedProject && sessionForProject(selectedProject) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {templates.map(({ type, label, desc }) => {
            const sess = sessionForProject(selectedProject);
            const doc = docFor(sess.id, type);
            const status = doc?.status || 'not rendered';
            const isBusy = busy === 'preview-' + type || busy === 'approve-' + type;

            return (
              <div key={type} style={{ padding: 20, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16, boxShadow: '0 4px 12px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16, flex: 1 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, #fff3ec, #ffe4d6)', border: '1px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={18} color="#ea580c" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.2 }}>{label}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, lineHeight: 1.3, marginTop: 4 }}>{desc}</div>
                    <div style={{ marginTop: 8 }}>
                      {status === 'saved' ? (
                        <span style={{ fontSize: '0.65rem', padding: '4px 10px', background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', borderRadius: 20, fontWeight: 700 }}>Saved to Drive</span>
                      ) : status === 'draft' ? (
                        <span style={{ fontSize: '0.65rem', padding: '4px 10px', background: '#e0e7ff', color: '#3730a3', border: '1px solid #c7d2fe', borderRadius: 20, fontWeight: 700 }}>Rendered (Draft)</span>
                      ) : (
                        <span style={{ fontSize: '0.65rem', padding: '4px 10px', background: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 20, fontWeight: 700 }}>Not Rendered</span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button className="btn" style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleOpenEditor(sess, type)}>
                    <Save size={14} /> Edit Template
                  </button>
                  <button className="btn" style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, background: '#f8fafc', border: '1px solid #e2e8f0', color: '#475569', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }} disabled={isBusy} onClick={() => handlePreview(sess, type)}>
                    {busy === 'preview-' + type ? <Loader size={14} className="spin" /> : <Eye size={14} />} Preview PDF
                  </button>
                  {doc?.drive_url ? (
                    <a href={doc.drive_url} target="_blank" rel="noreferrer" className="btn" style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Download size={14} /> View in Drive
                    </a>
                  ) : (
                    <button className="btn" style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 800, background: '#0f172a', color: '#ffffff', border: 'none', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} disabled={isBusy} onClick={() => handleApprove(sess, type)}>
                      {busy === 'approve-' + type ? <Loader size={14} className="spin" /> : <ShieldCheck size={14} />} Approve & Save
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editable template modal */}
      {editor && (
        <div className="modal-overlay" onClick={() => setEditor(null)} style={{ background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', flex: 1, maxHeight: '88vh', overflow: 'hidden', background: '#ffffff', borderRadius: 24, boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid #e2e8f0', padding: '24px 28px 20px', background: '#ffffff' }}>
              <div>
                <h3 className="modal-title" style={{ margin: 0, fontWeight: 800, fontSize: '1.25rem', color: '#0f172a' }}>
                  Edit Template — {templates.find(t => t.type === editor.templateType)?.label}
                </h3>
                <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 500, marginTop: 6 }}>
                  {editor.clientName} · {editor.pipeline.toUpperCase()} · Status: {editor.status}
                </div>
              </div>
              <button className="btn-icon" onClick={() => setEditor(null)} style={{ background: '#f1f5f9', color: '#64748b', borderRadius: '50%', padding: 6 }}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '24px 28px' }}>
              {EDITABLE_FIELDS.map(group => (
                <div key={group.group} style={{ marginBottom: 28 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', marginBottom: 16, borderBottom: '2px solid #fed7aa', paddingBottom: 8, display: 'inline-block' }}>
                    {group.group}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {group.fields.map(f => (
                      <div className="form-group" key={f.key} style={f.key.includes('agreement') || f.key === 'notes' ? { gridColumn: '1 / -1' } : undefined}>
                        <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>{f.label}</label>
                        <input
                          className="form-input"
                          style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', color: '#0f172a', fontSize: '0.9rem', width: '100%', background: '#f8fafc', transition: 'all 0.2s', outline: 'none' }}
                          onFocus={e => { e.target.style.borderColor = '#ea580c'; e.target.style.background = '#ffffff'; e.target.style.boxShadow = '0 0 0 3px rgba(234, 88, 12, 0.1)'; }}
                          onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.background = '#f8fafc'; e.target.style.boxShadow = 'none'; }}
                          value={editor.fieldData[f.key] ?? ''}
                          onChange={e => setEditor(prev => ({ ...prev, fieldData: { ...prev.fieldData, [f.key]: e.target.value } }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer" style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '20px 28px', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn" style={{ padding: '10px 20px', background: '#ffffff', color: '#475569', border: '1.5px solid #e2e8f0', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem' }} onClick={() => setEditor(null)}>Cancel</button>
              <button className="btn" onClick={handleSaveEditor} disabled={busy === 'save'} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', boxShadow: '0 4px 12px rgba(234, 88, 12, 0.25)' }}>
                {busy === 'save' ? <Loader size={16} className="spin" /> : <Save size={16} />} Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewing && (
        <div className="modal-overlay" onClick={() => setPreviewing(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 900, width: '100%', height: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ margin: 0 }}>
                Preview — {templates.find(t => t.type === previewing.label)?.label} · {previewing.client}
              </h3>
              <button className="btn-icon" onClick={() => setPreviewing(null)}><X size={18} /></button>
            </div>
            <iframe src={previewing.url} title="Contract Preview" style={{ flex: 1, border: 'none', width: '100%' }} />
          </div>
        </div>
      )}

      {/* Embed Form modal */}
      {embedFormUrl && (
        <div className="modal-overlay" onClick={() => setEmbedFormUrl(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 1100, width: '100%', height: '95vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              <h3 className="modal-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                Client Intake Form
              </h3>
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn-icon" onClick={() => setEmbedFormUrl(null)}><X size={18} /></button>
              </div>
            </div>
            <iframe src={embedFormUrl} title="Client Intake Form" style={{ flex: 1, border: 'none', width: '100%', background: 'var(--bg)' }} />
          </div>
        </div>
      )}
    </div>
  );
}