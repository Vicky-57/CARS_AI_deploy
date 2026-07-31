import { useState, useEffect } from 'react';
import { FolderKanban, Plus, X, Check } from 'lucide-react';
import { api } from '../api/api';

const SELL_MILESTONES = [
  'Lead Capture & Contract Signing',
  'Vehicle Document OCR & Spec Extraction',
  'Marketing & Listing',
  'Buyer Inquiry & Test Drives',
  'Sales Closing & Handover',
];
const BUY_MILESTONES = [
  'Buyer Requirement Capture',
  'Power of Attorney & Procurement Contract',
  'Car Sourcing & Market Research',
  'Vehicle Inspection & Technical Check',
  'Purchase, Payment & Delivery',
];

function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    client_name: '', client_email: '', client_phone: '',
    project_type: 'SELL', target_vehicle: '', target_price: '', notes: ''
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.client_name.trim()) return;
    setSaving(true);
    try {
      await api.createProject({ ...form, target_price: form.target_price ? parseFloat(form.target_price) : null });
      onCreated();
      onClose();
    } catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">New Project</span>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Project Type *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {['SELL', 'BUY'].map(t => (
                <button key={t} className={`btn ${form.project_type === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => set('project_type', t)}>
                  {t === 'SELL' ? '🚗 Sell a Car' : '🔍 Buy a Car'}
                </button>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input className="form-input" value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Max Mustermann" />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.client_phone} onChange={e => set('client_phone', e.target.value)} placeholder="+49 151…" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.client_email} onChange={e => set('client_email', e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">{form.project_type === 'SELL' ? 'Vehicle (Make/Model)' : 'Target Vehicle'}</label>
              <input className="form-input" value={form.target_vehicle} onChange={e => set('target_vehicle', e.target.value)} placeholder="BMW 3 Series, 2020" />
            </div>
            <div className="form-group">
              <label className="form-label">{form.project_type === 'SELL' ? 'Asking Price (€)' : 'Budget Limit (€)'}</label>
              <input className="form-input" type="number" value={form.target_price} onChange={e => set('target_price', e.target.value)} placeholder="15000" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || !form.client_name.trim()}>
            {saving ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MilestoneTrack({ milestones, projectId, onUpdated }) {
  const complete = async (ms) => {
    if (ms.is_completed) return;
    try { await api.completeMilestone(projectId, ms.id); onUpdated(); }
    catch (e) { alert(e.message); }
  };

  return (
    <div className="milestones-track">
      {milestones.map((ms, i) => {
        const isDone = ms.is_completed;
        const isCurrent = !isDone && (i === 0 || milestones[i - 1]?.is_completed);
        return (
          <div
            key={ms.id}
            className="milestone-item"
            title={isCurrent ? 'Click to mark complete' : ''}
            onClick={() => isCurrent && complete(ms)}
            style={{ cursor: isCurrent ? 'pointer' : 'default' }}
          >
            <div className={`milestone-dot${isDone ? ' done' : isCurrent ? ' current' : ''}`} />
            <span className={`milestone-label${isDone ? ' done' : isCurrent ? ' current' : ''}`}>{ms.title}</span>
            {isDone && <Check size={10} color="var(--success)" style={{ marginLeft: 'auto' }} />}
          </div>
        );
      })}
    </div>
  );
}

function ProjectCard({ project, onUpdated }) {
  const [milestones, setMilestones] = useState(project.milestones || []);

  const loadMilestones = async () => {
    try {
      const p = await api.getProject(project.id);
      setMilestones(p.milestones || []);
      onUpdated();
    } catch {}
  };

  const pct = milestones.length ? Math.round((milestones.filter(m => m.is_completed).length / milestones.length) * 100) : 0;

  return (
    <div className="project-card">
      <div className="project-card-header">
        <div>
          <div className="project-client">{project.client_name}</div>
          <div className="project-vehicle">{project.target_vehicle || 'Vehicle TBD'}</div>
        </div>
        <span className={`badge ${project.project_type === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>
          {project.project_type}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: 'var(--gray-100)', borderRadius: 999, marginBottom: 4 }}>
        <div style={{ height: '100%', width: pct + '%', background: 'var(--brand-500)', borderRadius: 999, transition: 'width .4s ease' }} />
      </div>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 10 }}>{pct}% complete</div>

      <MilestoneTrack milestones={milestones} projectId={project.id} onUpdated={loadMilestones} />

      {project.target_price && (
        <div style={{ marginTop: 10, fontSize: '0.72rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--gray-100)', paddingTop: 8 }}>
          💶 {project.project_type === 'BUY' ? 'Budget' : 'Price'}: €{Number(project.target_price).toLocaleString('de-DE')}
        </div>
      )}
    </div>
  );
}

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('SELL');
  const [showNew, setShowNew] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setProjects(await api.getProjects()); }
    catch { setProjects([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filtered = projects.filter(p => p.project_type === tab);

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h1>Projects</h1>
          <p>Active buy & sell brokerage pipelines with milestone tracking.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="pipeline-tabs">
        {['SELL', 'BUY'].map(t => (
          <button key={t} className={`pipeline-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'SELL' ? '🚗 Sell Pipeline' : '🔍 Buy Pipeline'}
            <span style={{ marginLeft: 6, fontSize: '0.65rem', background: tab === t ? 'var(--brand-50)' : 'var(--gray-200)', color: tab === t ? 'var(--brand-700)' : 'var(--gray-500)', padding: '1px 6px', borderRadius: 999 }}>
              {projects.filter(p => p.project_type === t).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /><span>Loading projects…</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 64 }}>
          <FolderKanban size={36} />
          <h3>No {tab} projects yet</h3>
          <p>Create your first project to start tracking the pipeline.</p>
        </div>
      ) : (
        <div className="pipeline-grid">
          {filtered.map(p => <ProjectCard key={p.id} project={p} onUpdated={load} />)}
        </div>
      )}

      {showNew && <NewProjectModal onClose={() => setShowNew(false)} onCreated={load} />}
    </div>
  );
}
