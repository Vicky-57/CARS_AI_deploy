/**
 * frontend/src/api/api.js
 * ─────────────────────────────────────────────────────────────────────────
 * Unified API client for CAR-AGENTS React Portal v5.0
 *
 * Architecture:
 *   - All CRM data (Leads, Deals, Contacts, Communications, Calendar)
 *     → Frappe CRM REST API  (FRAPPE_URL)
 *   - OCR extraction & Voice transcription
 *     → Local FastAPI AI Services  (AI_URL)
 * ─────────────────────────────────────────────────────────────────────────
 */

// ─── Config ──────────────────────────────────────────────────────────────────
const FRAPPE_URL  = import.meta.env.VITE_FRAPPE_URL   || "http://localhost:8080";
const AI_URL      = import.meta.env.VITE_AI_URL       || "http://localhost:9000";
const API_KEY     = import.meta.env.VITE_FRAPPE_API_KEY    || "";
const API_SECRET  = import.meta.env.VITE_FRAPPE_API_SECRET || "";

// ─── Frappe Request Helper ────────────────────────────────────────────────────
async function frappe(method, path, body = null) {
  const opts = {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `token ${API_KEY}:${API_SECRET}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${FRAPPE_URL}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.exc_type || err.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  // Frappe wraps responses in { message: ... } for method calls
  return data.message !== undefined ? data.message : data;
}

// ─── Frappe Resource Helper (CRUD shorthand) ──────────────────────────────────
const resource = (doctype) => ({
  list: (filters = {}, fields = ["name"], limit = 50) => {
    const params = new URLSearchParams({
      fields: JSON.stringify(fields),
      filters: JSON.stringify(filters),
      limit_page_length: limit,
    });
    return frappe("GET", `/api/resource/${doctype}?${params}`).then(r => r.data || []);
  },
  get: (name) => frappe("GET", `/api/resource/${doctype}/${encodeURIComponent(name)}`).then(r => r.data),
  create: (data) => frappe("POST", `/api/resource/${doctype}`, data).then(r => r.data),
  update: (name, data) => frappe("PUT", `/api/resource/${doctype}/${encodeURIComponent(name)}`, data).then(r => r.data),
  delete: (name) => frappe("DELETE", `/api/resource/${doctype}/${encodeURIComponent(name)}`),
});

// ─── AI Services Helper ───────────────────────────────────────────────────────
async function aiUpload(path, formData) {
  const res = await fetch(`${AI_URL}${path}`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`AI service error: ${res.status}`);
  return res.json();
}

async function aiRequest(method, path, body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${AI_URL}${path}`, opts);
  if (!res.ok) throw new Error(`AI service error: ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED API CLIENT
// ─────────────────────────────────────────────────────────────────────────────
export const api = {

  // ── Health Checks ───────────────────────────────────────────────────────────
  health: () => frappe("GET", "/api/method/frappe.ping"),
  aiHealth: () => aiRequest("GET", "/health"),

  // ── LEADS (CRM Lead) ────────────────────────────────────────────────────────
  getLeads: (filters = {}) => resource("CRM Lead").list(filters, [
    "name", "first_name", "last_name", "email", "mobile_no",
    "custom_client_intent", "custom_pipeline_type", "status",
    "lead_owner", "source", "creation"
  ], 100),

  getLead: (name) => resource("CRM Lead").get(name),

  createLead: (data) => resource("CRM Lead").create(data),

  updateLead: (name, data) => resource("CRM Lead").update(name, data),

  classifyIntent: (message) => frappe("POST",
    "/api/method/car_agents_crm.api.classify_lead_intent",
    { message_text: message }
  ),

  // ── DEALS / PROJECTS (CRM Deal) ─────────────────────────────────────────────
  getDeals: (pipelineType = null) => {
    const filters = pipelineType ? { custom_pipeline_type: pipelineType } : {};
    return resource("CRM Deal").list(filters, [
      "name", "lead_name", "status", "custom_pipeline_type",
      "custom_client_intent", "custom_vin", "custom_vehicle_model",
      "custom_manufacturer", "custom_ocr_status", "custom_net_profit",
      "custom_followup_target_date", "modified"
    ], 100);
  },

  getDeal: (name) => resource("CRM Deal").get(name),

  createDeal: (data) => resource("CRM Deal").create(data),

  updateDeal: (name, data) => resource("CRM Deal").update(name, data),

  getPipelineSummary: () => frappe("GET",
    "/api/method/car_agents_crm.api.get_pipeline_summary"
  ),

  // ── CONTACTS ────────────────────────────────────────────────────────────────
  getContacts: (filters = {}) => resource("CRM Contact").list(filters, [
    "name", "first_name", "last_name", "email_id", "mobile_no",
    "custom_client_role", "custom_id_number", "creation"
  ], 100),

  getContact: (name) => resource("CRM Contact").get(name),

  createContact: (data) => resource("CRM Contact").create(data),

  updateContact: (name, data) => resource("CRM Contact").update(name, data),

  // ── COMMUNICATIONS ──────────────────────────────────────────────────────────
  getCommunications: (filters = {}) => resource("CRM Communication").list(filters, [
    "name", "type", "subject", "content", "sent_or_received",
    "communication_date", "reference_docname"
  ], 100),

  logCommunication: (data) => frappe("POST",
    "/api/method/car_agents_crm.api.log_communication", data
  ),

  // ── CONTRACTS / PDF ─────────────────────────────────────────────────────────
  generateContract: (dealId, templateType) => frappe("POST",
    "/api/method/car_agents_crm.api.generate_contract_pdf",
    { deal_id: dealId, template_type: templateType }
  ),

  // ── CALENDAR / MEETINGS (Frappe Event) ──────────────────────────────────────
  getMeetings: (filters = {}) => resource("Event").list(filters, [
    "name", "subject", "starts_on", "ends_on", "event_type",
    "description", "owner"
  ], 50),

  createMeeting: (data) => resource("Event").create(data),

  deleteMeeting: (name) => resource("Event").delete(name),

  checkCalendarConflict: (startDt, endDt, isOnsite = true) => frappe("POST",
    "/api/method/car_agents_crm.api.check_calendar_conflicts",
    { proposed_start: startDt, proposed_end: endDt, is_onsite: isOnsite }
  ),

  // ── OCR (via Local FastAPI AI Services) ─────────────────────────────────────
  extractClientDetails: (formData) => aiUpload("/api/ocr/client-details", formData),

  extractVehicleSpecs: (formData) => aiUpload("/api/ocr/vehicle-specs", formData),

  // After OCR extraction, push results into Frappe via whitelisted API
  applyClientOcr: (contactName, fileUrl) => frappe("POST",
    "/api/method/car_agents_crm.api.extract_client_details",
    { file_url: fileUrl, contact_name: contactName }
  ),

  applyVehicleOcr: (dealId, fileUrl) => frappe("POST",
    "/api/method/car_agents_crm.api.extract_vehicle_specs",
    { file_url: fileUrl, deal_id: dealId }
  ),

  // ── VOICE (via Local FastAPI AI Services) ────────────────────────────────────
  transcribeVoice: (formData) => aiUpload("/api/voice/transcribe", formData),
};
