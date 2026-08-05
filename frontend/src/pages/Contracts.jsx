import { useState, useEffect, useMemo } from 'react';
import {
  FileText, Download, CheckCircle, Loader, Copy, ExternalLink,
  FolderKanban, RefreshCw, Save, X, ShieldCheck, Eye, Plus,
} from 'lucide-react';
import { api, supabase } from '../api/api';

const PIPELINE_TEMPLATES = {
  sell: [
    { type: 'sell_b2c',    label: 'Vermittlungsvertrag B2C (Aktiv)',         desc: 'Sell-side brokerage contract' },
    { type: 'kaufvertrag', label: 'Kaufvertrag C2C (Bilingual)',             desc: 'Bilingual C2C sales contract (DE/EN)' },
    { type: 'handover',    label: 'Fahrzeug-Übergabeprotokoll',              desc: 'Vehicle handover protocol' },
  ],
  buy: [
    { type: 'buy_passiv',  label: 'Vermittlungsvertrag Beschaffung (Passiv)', desc: 'Buy-side procurement contract' },
    { type: 'kaufvertrag', label: 'Kaufvertrag C2C (Bilingual)',             desc: 'Bilingual C2C sales contract (DE/EN)' },
    { type: 'handover',    label: 'Fahrzeug-Übergabeprotokoll',              desc: 'Vehicle handover protocol' },
  ],
};

// Editable template field groups (canonical keys, shared with the PDF engine)
const EDITABLE_FIELDS = [
  { group: 'Client', keyPrefix: 'person', fields: [
    { key: 'full_name',   label: 'Full Name / Name' },
    { key: 'phone',       label: 'Phone / Telefon' },
    { key: 'email',       label: 'Email / E-Mail' },
    { key: 'street',      label: 'Street / Straße' },
    { key: 'zip_city',    label: 'ZIP, City / PLZ, Ort' },
    { key: 'id_card',     label: 'ID Type / No. (Ausweis)' },
  ]},
  { group: 'Vehicle', keyPrefix: 'vehicle', fields: [
    { key: 'manufacturer', label: 'Manufacturer / Hersteller' },
    { key: 'model',        label: 'Model / Typ' },
    { key: 'vin',          label: 'VIN / FIN' },
    { key: 'license',      label: 'License Plate / Kennzeichen' },
    { key: 'first_date',   label: 'First Registration / Erstzulassung' },
    { key: 'mileage',      label: 'Mileage (km) / Kilometerstand' },
    { key: 'power',        label: 'Power / Leistung' },
    { key: 'displacement', label: 'Displacement / Hubraum' },
    { key: 'tuev_until',   label: 'TÜV valid until / TÜV bis' },
    { key: 'owners',       label: 'Owners / Halter' },
    { key: 'color',        label: 'Color / Farbe' },
    { key: 'zb2',          label: 'Reg. Cert. Part II No. / ZB II' },
    { key: 'keys',         label: 'Keys / Schlüssel' },
    { key: 'engine_number',label: 'Engine No. / Motor-Nr.' },
  ]},
  { group: 'Price', keyPrefix: 'price', fields: [
    { key: 'min_price',    label: 'Min. Price (€) / Mindestpreis' },
    { key: 'price',        label: 'Purchase Price (€) / Kaufpreis' },
    { key: 'special_agreements', label: 'Special Agreements / Sondervereinbarungen' },
  ]},
  { group: 'Handover', keyPrefix: 'handover', fields: [
    { key: 'giving_person',   label: 'Giving Person / Übergebend' },
    { key: 'receiving_person',label: 'Receiving Person / Übernehmend' },
    { key: 'place',         label: 'Place / Ort' },
    { key: 'date',          label: 'Date / Datum' },
    { key: 'notes',         label: 'Notes / Anmerkungen' },
  ]},
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
    setCreating(true);
    try {
      const session = await api.createFormSession({
        pipeline: selectedProject.project_type?.toLowerCase(),
        project_id: selectedProject.id,
        client_name: selectedProject.client_name,
      });
      await loadAll();
      setSelectedProject(selectedProject.id);
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
    setEditor({
      sessionId: session.id,
      templateType,
      pipeline: session.pipeline,
      clientName: session.client_name,
      fieldData: { ...(session.shared_core || {}) },
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
      <div className="page-header" style={{ alignItems: 'flex-end', marginBottom: 28 }}>
        <div className="page-header-left">
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Documentation</h1>
          <p style={{ fontSize: '0.9rem' }}>
            Generate, preview and approve the 3 contracts per client, then save to Google Drive.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadAll} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Pipeline toggle */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        {(['sell', 'buy']).map(p => (
          <button
            key={p}
            onClick={() => { setPipeline(p); setSelectedProject(null); }}
            className="btn"
            style={{
              padding: '10px 28px', borderRadius: 10, fontWeight: 700, fontSize: '0.95rem',
              background: pipeline === p ? (p === 'sell' ? 'var(--brand-600,#2563eb)' : 'var(--brand-700,#1d4ed8)') : 'var(--surface,#fff)',
              color: pipeline === p ? '#fff' : 'var(--text-secondary)',
              border: pipeline === p ? 'none' : '1px solid var(--border)',
            }}
          >
            {p === 'sell' ? 'SELL / VERKAUF' : 'BUY / BESCHAFFUNG'}
          </button>
        ))}
      </div>

      {/* Project selector + create session */}
      <div className="card" style={{ marginBottom: 24, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
        <div className="card-header" style={{ padding: '18px 24px' }}>
          <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
            <FolderKanban size={16} /> {pipeline.toUpperCase()} Projects
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
                      border: `1.5px solid ${selectedProject === p.id ? 'var(--brand-600,#2563eb)' : 'var(--border)'}`,
                      borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
                      background: selectedProject === p.id ? 'var(--brand-50,#eff6ff)' : 'var(--surface,#fff)',
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{p.client_name}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                      {p.target_vehicle || p.vin || 'Vehicle not set'}
                    </div>
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      {sess ? (
                        <span className="badge badge-success" style={{ fontSize: '0.65rem', padding: '3px 8px' }}>
                          <CheckCircle size={11} /> Session ready · {sess.stage}/3
                        </span>
                      ) : (
                        <span className="badge badge-new" style={{ fontSize: '0.65rem', padding: '3px 8px' }}>No session yet</span>
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
                  <button className="btn btn-primary" onClick={() => handleCopyLink(sessionForProject(selectedProject))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
                    <Copy size={14} /> Copy Form Link
                  </button>
                  <a
                    href={publicLink(sessionForProject(selectedProject))}
                    target="_blank" rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', textDecoration: 'none' }}
                  >
                    <ExternalLink size={14} /> Open Form
                  </a>
                </>
              ) : (
                <button className="btn btn-primary" onClick={handleCreateSession} disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px' }}>
                  <Plus size={14} /> {creating ? 'Creating…' : 'Create Form Session'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Templates per selected session */}
      {selectedProject && sessionForProject(selectedProject) && (
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {templates.map(({ type, label, desc }) => {
            const sess = sessionForProject(selectedProject);
            const doc = docFor(sess.id, type);
            const status = doc?.status || 'not rendered';
            const busyKey = 'preview-' + type + 'approve-' + type;
            const isBusy = busy === 'preview-' + type || busy === 'approve-' + type;

            return (
              <div key={type} className="card" style={{ padding: 16, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, var(--brand-50), var(--brand-100))', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={16} color="var(--brand-600)" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.2 }}>{label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{desc}</div>
                    <div style={{ marginTop: 6 }}>
                      <span className={`badge ${status === 'saved' ? 'badge-success' : status === 'draft' ? 'badge-buy' : 'badge-new'}`} style={{ padding: '2px 8px', fontSize: '0.65rem' }}>
                        {status === 'saved' ? 'Saved to Drive' : status === 'draft' ? 'Rendered (draft)' : 'Not rendered'}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleOpenEditor(sess, type)}>
                    <Save size={13} /> Edit Template
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}
                    disabled={isBusy} onClick={() => handlePreview(sess, type)}>
                    {busy === 'preview-' + type ? <Loader size={13} className="spin" /> : <Eye size={13} />} Preview PDF
                  </button>
                  {doc?.drive_url ? (
                    <a href={doc.drive_url} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Download size={13} /> Drive
                    </a>
                  ) : (
                    <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5 }}
                      disabled={isBusy} onClick={() => handleApprove(sess, type)}>
                      {busy === 'approve-' + type ? <Loader size={13} className="spin" /> : <ShieldCheck size={13} />} Approve & Save
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
        <div className="modal-overlay" onClick={() => setEditor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, display: 'flex', flexDirection: 'column', flex: 1, maxHeight: '88vh', overflow: 'hidden' }}>
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ margin: 0 }}>
                  Edit Template — {templates.find(t => t.type === editor.templateType)?.label}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {editor.clientName} · {editor.pipeline.toUpperCase()} · Status: {editor.status}
                </div>
              </div>
              <button className="btn-icon" onClick={() => setEditor(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto', padding: '20px 24px' }}>
              {EDITABLE_FIELDS.map(group => (
                <div key={group.group} style={{ marginBottom: 20 }}>
                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--brand-700,#1d4ed8)', marginBottom: 10, borderBottom: '2px solid var(--brand-100,#dbeafe)', paddingBottom: 6 }}>
                    {group.group}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {group.fields.map(f => (
                      <div className="form-group" key={f.key} style={f.key.includes('agreement') || f.key === 'notes' ? { gridColumn: '1 / -1' } : undefined}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>{f.label}</label>
                        <input
                          className="form-input"
                          value={editor.fieldData[f.key] ?? ''}
                          onChange={e => setEditor(prev => ({ ...prev, fieldData: { ...prev.fieldData, [f.key]: e.target.value } }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer" style={{ background: 'var(--surface)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setEditor(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEditor} disabled={busy === 'save'} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {busy === 'save' ? <Loader size={14} className="spin" /> : <Save size={14} />} Save Template
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
    </div>
  );
}