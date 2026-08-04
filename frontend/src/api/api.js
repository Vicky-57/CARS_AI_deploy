/**
 * frontend/src/api/api.js
 * ─────────────────────────────────────────────────────────────────────────
 * CAR-AGENTS Portal v5.0 — API Client
 *
 * Data Layer:
 *   Supabase  → All CRM data (leads, projects, comms, meetings, expenses)
 *   FastAPI   → AI-only (OCR extraction, Whisper transcription)
 * ─────────────────────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js';

// ─── Supabase Client ──────────────────────────────────────────────────────────
const SUPABASE_URL    = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON   = import.meta.env.VITE_SUPABASE_ANON_KEY;
const AI_URL          = import.meta.env.VITE_AI_URL || 'http://localhost:9000';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ─── Local AI Service Helper ──────────────────────────────────────────────────
async function aiUpload(path, formData) {
  const res = await fetch(`${AI_URL}${path}`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`AI service error: ${res.status}`);
  return res.json();
}

async function aiPost(path, body) {
  const res = await fetch(`${AI_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI service error: ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED API
// ─────────────────────────────────────────────────────────────────────────────
export const api = {

  // ── Health ──────────────────────────────────────────────────────────────────
  health:   () => supabase.from('leads').select('id', { count: 'exact', head: true }),
  aiHealth: () => fetch(`${AI_URL}/health`).then(r => r.json()),

  // ── LEADS ───────────────────────────────────────────────────────────────────
  getLeads: async (filters = {}) => {
    let q = supabase.from('leads').select('*').order('created_at', { ascending: false });
    if (filters.intent)  q = q.eq('intent', filters.intent);
    if (filters.status)  q = q.eq('status', filters.status);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  getLead: async (id) => {
    const { data, error } = await supabase.from('leads').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  },

  createLead: async (payload) => {
    const { data, error } = await supabase.from('leads').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  updateLead: async (id, updates) => {
    const { data, error } = await supabase.from('leads').update({
      ...updates, updated_at: new Date().toISOString()
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  // ── PROJECTS (Buy & Sell Pipelines) ─────────────────────────────────────────
  getProjects: async (projectType = null) => {
    let q = supabase
      .from('projects')
      .select(`*, project_milestones(*), project_expenses(*), project_labor(*)`)
      .order('created_at', { ascending: false });
    if (projectType) q = q.eq('project_type', projectType);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  },

  getProject: async (id) => {
    const { data, error } = await supabase
      .from('projects')
      .select(`*, project_milestones(*), project_expenses(*), project_labor(*)`)
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  createProject: async (payload) => {
    const { data, error } = await supabase.from('projects').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  updateProject: async (id, updates) => {
    const { data, error } = await supabase.from('projects').update({
      ...updates, updated_at: new Date().toISOString()
    }).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  generateContract: (projectId, templateType) => aiPost('/api/v1/contracts/generate-pdf', { template_type: templateType, deal_id: projectId }),
  approveAndUploadContract: (customerName, contractFilename, filePath) => aiPost('/api/v1/contracts/approve-and-upload', { customer_name: customerName, contract_filename: contractFilename, file_path: filePath }),


  completeMilestone: async (milestoneId) => {
    const { data, error } = await supabase
      .from('project_milestones')
      .update({ is_completed: true, completed_at: new Date().toISOString() })
      .eq('id', milestoneId).select().single();
    if (error) throw error;
    return data;
  },

  // ── EXPENSES ────────────────────────────────────────────────────────────────
  addExpense: async (projectId, payload) => {
    const { data, error } = await supabase
      .from('project_expenses')
      .insert({ project_id: projectId, ...payload })
      .select().single();
    if (error) throw error;
    return data;
  },

  // ── LABOR ───────────────────────────────────────────────────────────────────
  logLabor: async (projectId, hours, description) => {
    const { data, error } = await supabase
      .from('project_labor')
      .insert({ project_id: projectId, hours_spent: hours, activity_description: description })
      .select().single();
    if (error) throw error;
    return data;
  },

  // ── COMMUNICATIONS ──────────────────────────────────────────────────────────
  getCommunications: async (filters = {}) => {
    let q = supabase.from('communications').select('*').order('timestamp', { ascending: false });
    if (filters.channel) q = q.eq('channel', filters.channel);
    if (filters.lead_id) q = q.eq('lead_id', filters.lead_id);
    const { data, error } = await q.limit(100);
    if (error) throw error;
    return data;
  },

  // ── MEETINGS / CALENDAR ─────────────────────────────────────────────────────
  getMeetings: async () => {
    const { data, error } = await supabase
      .from('meetings')
      .select('*')
      .order('start_time', { ascending: true });
    if (error) throw error;
    return data;
  },

  createMeeting: async (payload) => {
    const { data, error } = await supabase.from('meetings').insert(payload).select().single();
    if (error) throw error;
    return data;
  },

  updateMeeting: async (id, updates) => {
    const { data, error } = await supabase.from('meetings').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },

  deleteMeeting: async (id) => {
    const { error } = await supabase.from('meetings').delete().eq('id', id);
    if (error) throw error;
  },

  /**
   * Conflict engine.
   * - overlap      → hard block (same date + overlapping times)
   * - buffer_clash → warn only (onsite meetings need a 30-min travel gap)
   * - exclude_id   → ignore one meeting (used when editing itself)
   */
  checkMeetingConflicts: async ({ start_time, end_time, location_type = 'ONLINE', exclude_id = null }) => {
    const isOnsite = location_type === 'OFFLINE_ONSITE';
    const bufferMs = isOnsite ? 30 * 60 * 1000 : 0; // 30 min travel buffer
    const start = new Date(start_time);
    const end   = new Date(end_time);

    // Fetch everything inside the widened window so we can classify locally
    const checkStart = new Date(start.getTime() - bufferMs).toISOString();
    const checkEnd   = new Date(end.getTime()   + bufferMs).toISOString();
    const { data, error } = await supabase
      .from('meetings')
      .select('id, title, client_name, start_time, end_time, location_type')
      .lt('start_time', checkEnd)
      .gt('end_time', checkStart);
    if (error) throw error;

    const meetings = (data || []).filter(m => m.id !== exclude_id);
    const overlaps = [];
    const bufferClashes = [];

    for (const m of meetings) {
      const mStart = new Date(m.start_time);
      const mEnd   = new Date(m.end_time);
      const isOverlap = mStart < end && mEnd > start;
      if (isOverlap) {
        overlaps.push(m);
        continue;
      }
      // Non-overlapping but inside the buffer window → too close for onsite travel
      const withinStartBuffer = mEnd >= new Date(start.getTime() - bufferMs) && mEnd <= start;
      const withinEndBuffer   = mStart <= new Date(end.getTime() + bufferMs) && mStart >= end;
      if (isOnsite && (withinStartBuffer || withinEndBuffer)) {
        bufferClashes.push(m);
      }
    }

    return {
      has_overlap: overlaps.length > 0,
      overlapping_meetings: overlaps,
      has_buffer_clash: bufferClashes.length > 0,
      buffer_clash_meetings: bufferClashes,
      buffer_minutes: isOnsite ? 30 : 0,
    };
  },

  // ── PIPELINE SUMMARY (Dashboard) ────────────────────────────────────────────
  getPipelineSummary: async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [newLeads, sellProjects, buyProjects, allProjects] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }).gt('created_at', yesterday),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('project_type', 'SELL').neq('status', 'COMPLETED'),
      supabase.from('projects').select('id', { count: 'exact', head: true }).eq('project_type', 'BUY').neq('status', 'COMPLETED'),
      supabase.from('projects').select('id, client_name, project_type, updated_at, status').lt('updated_at', yesterday).neq('status', 'COMPLETED'),
    ]);
    return {
      new_leads_24h:      newLeads.count || 0,
      active_sell_deals:  sellProjects.count || 0,
      active_buy_deals:   buyProjects.count || 0,
      inactive_deals:     (allProjects.data || []).slice(0, 5),
    };
  },

  // ── OCR (Local FastAPI AI Services) ─────────────────────────────────────────
  extractClientDetails: (formData) => aiUpload('/api/ocr/client-details', formData),
  extractVehicleSpecs:  (formData) => aiUpload('/api/ocr/vehicle-specs', formData),
  classifyIntent:       (message)  => aiPost('/classify-intent', { message }),

  // ── VOICE (Local FastAPI AI Services) ────────────────────────────────────────
  transcribeVoice: (formData) => aiUpload('/api/voice/transcribe', formData),

  // ── GOOGLE CALENDAR SYNC (FastAPI) ───────────────────────────────────────────
  googleAuthUrl:   () => fetch(`${AI_URL}/api/v1/auth/google/url`).then(r => r.json()),
  googleAuthStatus:() => fetch(`${AI_URL}/api/v1/auth/google/status`).then(r => r.json()),
  syncMeeting:     (id) => fetch(`${AI_URL}/api/v1/meetings/${id}/sync`, { method: 'POST' }).then(r => r.json()),
  unsyncMeeting:   (id) => fetch(`${AI_URL}/api/v1/meetings/${id}/sync`, { method: 'DELETE' }).then(r => r.json()),
  checkGoogleFreeBusy: (startTime, endTime) => aiPost('/api/v1/meetings/free-busy', { start_time: startTime, end_time: endTime }),

  // ── REALTIME SUBSCRIPTIONS ───────────────────────────────────────────────────
  subscribeToLeads: (callback) =>
    supabase.channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, callback)
      .subscribe(),

  subscribeToProjects: (callback) =>
    supabase.channel('projects-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'projects' }, callback)
      .subscribe(),
};
