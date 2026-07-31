const API_BASE = "http://localhost:9000";

async function request(method, path, body = null) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

async function upload(path, formData) {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return res.json();
}

// Health
export const api = {
  health: () => request("GET", "/health"),

  // Leads
  getLeads: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request("GET", `/api/leads${q ? "?" + q : ""}`);
  },
  getLead: (id) => request("GET", `/api/leads/${id}`),
  createLead: (data) => request("POST", "/api/leads", data),
  updateLead: (id, data) => request("PATCH", `/api/leads/${id}`, data),

  // Projects
  getProjects: (type) => request("GET", `/api/projects${type ? "?project_type=" + type : ""}`),
  getProject: (id) => request("GET", `/api/projects/${id}`),
  createProject: (data) => request("POST", "/api/projects", data),
  updateProject: (id, data) => request("PATCH", `/api/projects/${id}`, data),
  completeMilestone: (projectId, milestoneId) =>
    request("PATCH", `/api/projects/${projectId}/milestone/${milestoneId}`),

  // Communications
  getCommunications: (channel) =>
    request("GET", `/api/communications${channel ? "?channel=" + channel : ""}`),
  getContacts: () => request("GET", "/api/communications/contacts"),
  getThread: (leadId) => request("GET", `/api/communications/lead/${leadId}`),

  // Contracts
  getTemplates: () => request("GET", "/api/contracts/templates"),
  fillContract: (data) => request("POST", "/api/contracts/fill", data),
  generatePdf: (data) => request("POST", "/api/contracts/generate-pdf", data),

  // Calendar
  getMeetings: () => request("GET", "/api/meetings"),
  checkConflict: (data) => request("POST", "/api/meetings/check-conflict", data),
  createMeeting: (data) => request("POST", "/api/meetings", data),
  cancelMeeting: (id) => request("DELETE", `/api/meetings/${id}`),

  // OCR & Voice
  parseDocument: (formData) => upload("/api/ocr/parse", formData),
  transcribeVoice: (formData) => upload("/api/voice/transcribe", formData),
};
