# CAR-AGENTS — AI Operations & Brokerage Management System

An end-to-end AI operations, contract generation, document OCR parsing, and dual-pipeline brokerage management platform engineered specifically for **CAR-AGENTS**, a founder-led premium automotive brokerage in Germany.

The platform streamlines client inquiries, automated lead classification (`BUY` vs `SELL`), document OCR parsing (*Fahrzeugdatenträger* / *Fahrzeugschein*), 1-click contract generation across 4 legal templates, real-time expense and net profit calculations, German legal compliance hard gates (GwG AML checks), and a mobile **Telegram Operations Bot** companion.

---

## 🌐 Live Production Deployments

* **Frontend Operations Portal (Vercel):** [https://car-agents-omega.vercel.app/](https://car-agents-omega.vercel.app/)
  * *SPA client-side routing rewrites configured via `frontend/vercel.json`.*
* **AI Operations Backend (Render):** [https://car-agents-backend.onrender.com](https://car-agents-backend.onrender.com)
  * *FastAPI service with interactive Swagger documentation at `/docs`.*
* **Telegram Operations Companion:** [@car_agents_bot](https://t.me/car_agents_bot)
  * *Real-time mobile cockpit with inline buttons, `/stage` transitions, and executive CRM summaries.*
* **Cloud Database (Supabase):** PostgreSQL Schema v3.0 (`wvzulyxzuntjnzdykstt.supabase.co`)
  * *Direct REST and Realtime WebSocket events.*

---

## 📐 System Architecture Overview

```
+-----------------------------------------------------------------------------------------------+
|                                CAR-AGENTS SYSTEM ARCHITECTURE                                 |
+-----------------------------------------------------------------------------------------------+
                                                |
         +--------------------------------------+--------------------------------------+
         |                                      |                                      |
[ React Founder Portal ]              [ FastAPI AI Backend ]                 [ Cloud Database & APIs ]
 - Vite + React 18 (Vercel)            - Python 3.13 (Render)                 - Supabase PostgreSQL v3.0
 - Realtime WebSockets                 - Claude 3.5 Sonnet Engine             - Strato IMAP/SMTP Service
 - Dual Buy/Sell Kanban Board          - 1-Click PDF Contract Engine          - Google Drive Cloud Storage
 - Deal Financials & Net Profit        - Inbound Strato Mail Poller           - Google & Outlook Calendars
 - Compliance Hard Gates (GwG AML)     - Telegram Bot Polling Engine          - Telegram Bot API
 - mobile.de Proxy Relay Handling      - In-Memory Drive Cache (0ms)          - Universal REST Fallback
```

---

## ⚡ Core Operational Modules & Workflows

### 🤖 1. Telegram Mobile Operations Companion (`@car_agents_bot`)
Acts as the founder’s pocket CRM for field operations, car inspections, and rapid client follow-ups:
* **Interactive Controls:** Persistent reply keyboards and inline button actions for instant interaction.
* **Pipeline Management:** `/stage` transitions to advance deals through the 5 sales stages without opening a computer.
* **Customer & Car Lookup:** `/customer` command finds all matching client profiles, vehicle requests, and linked Google Drive folders.
* **Instant Inbound Alerts:** Push notifications for new email inquiries with 1-click **[Convert to Deal]** actions.
* **Executive CRM Summary:** Live snapshot of total portfolio valuation (€), active deal counts, stage breakdown, and today’s appointments.
* **Resilient Messaging:** Structured HTML parsing with automatic plain-text retry fallback if character parsing errors occur.

### 📧 2. Inbound Email Intelligence & Lead Classifier
* **Live Inbound Poller:** Background listener polling `info@car-agents.de` via Strato IMAP (`mail.strato.de:993`).
* **Claude AI Intent Classifier:** Classifies incoming inquiries into `BUY_INTENT` or `SELL_INTENT`, creates lead records, and preserves original German/English content.
* **mobile.de Proxy Relay Handling:** Automatically identifies German automotive marketplace proxy emails (`*-mo-mo@kontakt.mobile.de`), cleans client display names, formats friendly titles (e.g. `mobile.de Prospect (Mercedes-Benz C63)`), and attaches explanatory privacy badges.
* **Spam & Phishing Isolation:** Quarantines automated newsletters (Doctolib, Deutsche Bahn, banking notifications) from polluting the customer directory.

### 🗂️ 3. Dual Buy/Sell Kanban & Standardized Sales Stages
Synchronized 5-stage lifecycle across frontend, backend, and Telegram bot:
1. `Intake & Onboarding` — Initial client contact, criteria definition, and compliance setup.
2. `Sourcing & Inspection` — Market search, vehicle condition verification, and history checks.
3. `Marketing & Listing` — Vehicle preparation, photography, and multi-channel listing.
4. `Negotiation & Contract` — Buyer negotiation, agreement drafting, and compliance gating.
5. `Completed & Delivered` — Payment settlement, vehicle handover, and warranty signing.

* **Stage Normalization:** Centralized helper (`getNormalizedStage`) prevents deals from vanishing due to legacy naming differences.

### ⚖️ 4. German Compliance & Legal Hard Gates
Guarantees strict compliance with German automotive brokerage laws before a deal advances:
* **Mandatory Gate Modal:** Intercepts stage progression to verify:
  1. **Setup-Fee Payment Receipt** (Bank wire or Stripe confirmation).
  2. **AGB & GDPR Consent** (Terms of service signature & privacy consent timestamp).
  3. **Fairplay-Check & 14-Day Consumer Waiver** (Statutory right-of-withdrawal acknowledgment).
  4. **GwG AML Source-of-Funds Check:** Mandatory trigger for deals $\ge$ €10,000, enforcing the statutory **€9,999 cash transaction ceiling**.
* **Audit Trail:** Serializes compliance timestamps into deal records for legal verification.

### 📝 5. 1-Click Bilingual Contract Pre-Filling & PDF Engine
Pre-fills dynamic placeholders across **4 official legal contract templates**:
1. `sell_b2c` — Vermittlungsvertrag B2C Aktiv *(Sell Side Brokerage Contract)*
2. `buy_passiv` — Vermittlungsvertrag Beschaffung Passiv *(Buy Side Sourcing Contract)*
3. `kaufvertrag` — Kaufvertrag C2C Bilingual *(German/English Sales Agreement)*
4. `handover` — Fahrzeug-Übergabeprotokoll *(Condition & Handover Protocol)*
* **Auto-Render Fallback:** Dynamic on-the-fly rendering on `/approve` endpoints prevents HTTP 409 conflicts on ephemeral container deployments.
* **Google Drive Sync:** Automatically creates client/project folders and stores signed PDFs.

### 💶 6. Real-Time Net Broker Profit Calculator
Live financial ledger tracking exact project margins:
$$\text{Total Expenses} = \sum \text{Receipt Amounts}$$
$$\text{Labor Cost} = \text{Labor Hours} \times \text{Hourly Rate (Default €20/hr)}$$
$$\text{Total Project Investment} = \text{Vehicle Purchase Price} + \text{Total Expenses} + \text{Labor Cost}$$
$$\text{Net Broker Profit} = \text{Agreed Final Sale Price} - \text{Total Project Investment}$$

* **Labor Billing Enforcement:** Enforces strict **0.25h increments** (`hours % 0.25 === 0`) across UI and backend APIs.

### 📄 7. Document OCR Spec Extractor
* Hybrid extraction pipeline (`pdfplumber` + `pytesseract` + Claude Sonnet) extracting 17-digit VIN, Manufacturer, Model, Engine Power (kW/PS), Displacement (ccm), First Registration (*EZ*), TÜV expiry, and client details from uploaded vehicle registration papers (*Fahrzeugdatenträger* / *Fahrzeugschein*).

### 🗓️ 8. Calendar & Appointment Scheduler
* Native CRM calendar with unified Google Calendar and Outlook Calendar synchronization.
* **Travel Conflict Guard:** Automatically enforces a mandatory 30-minute travel buffer between physical vehicle viewings and appointments.

---

## 🛡️ Data Sanitation & Quality Engine

Following the Independent Validation Audit (resolving findings **CA-001 through CA-030**):
* **Mojibake & Encoding Remediation:** Universal regex sanitizers (`textUtils.js` and `clean_db.py`) eradicate literal `\ufffd` corruption and restore German umlauts (`ä, ö, ü, ß`) and currency symbols (`€`).
* **UUID Elimination:** Raw database IDs (e.g. `Converted from Lead ID 632437...`) are replaced with clean, human-readable descriptions.
* **Scoped Activity Feeds:** Project activity feeds are strictly isolated to `project.client_email`, eliminating global mailbox leakage.
* **Strict ISO 3779 VIN Validation:** Enforces 17-character alphanumeric format (rejecting invalid characters `I`, `O`, `Q`) with real-time feedback.
* **Mandatory Contact Channels:** Every lead and customer record requires at least one verified contact method (Email or Phone).

---

## 📁 Project Directory Structure

```
d:\CARS AI\
├── README.md                             # System documentation (this file)
├── render.yaml                           # Render cloud deployment blueprint
├── docs/
│   ├── WHATSAPP.md                       # WhatsApp v2 architecture, commands, meetings & OCR/Upload guide
│   ├── db/
│   │   ├── supabase_schema_v3.sql        # PostgreSQL database schema v3.0
│   │   ├── supabase_whatsapp_migration.sql
│   │   ├── supabase_v3_2_whatsapp_v2.sql # Schema v3.2 (meetings slots + customer_documents)
│   │   └── supabase_fields_cheatsheet.md # Field mapping cheatsheet
│   └── archive/                          # Historical scope docs, audit reports & specs
│
├── backend/                              # FastAPI Python Backend Service
│   ├── main.py                           # App entry point & lifespan scheduler
│   ├── config.py                         # Pydantic environment configuration
│   ├── database.py                       # Supabase client singleton & Universal REST fallback
│   ├── requirements.txt                  # Python dependencies
│   ├── scripts/
│   │   └── clean_db.py                   # One-off DB utilities & sanitizers
│   ├── tests/
│   │   └── test_whatsapp.py              # Offline WhatsApp unit & flow suite
│   │
│   └── app/
│       ├── api/v1/
│       │   ├── router.py                 # Combined v1 API Router
│       │   └── endpoints/
│       │       ├── telegram_bot.py       # Telegram webhook & command endpoints
│       │       ├── meetings.py           # Free-slot calendar & clash-guarded booking APIs
│       │       ├── ocr.py                # Vehicle specs & document OCR
│       │       ├── contracts.py          # Contract pre-filling & PDF generation
│       │       ├── forms.py              # Customer form sessions & PDF approval engine
│       │       ├── projects.py           # Deals, expenses & net profit calculations
│       │       ├── classify.py           # AI intent classification
│       │       ├── webhooks.py           # WhatsApp webhooks (Meta + Twilio)
│       │       └── briefings.py          # Executive briefing generator
│       │
│       └── services/
│           ├── crm_service.py            # Unified customer search, disambiguation & conversions
│           ├── meeting_service.py        # Free slots, clash prevention & .ics email invites
│           ├── document_service.py       # Separate Upload storage vs OCR template extraction
│           ├── whatsapp_handler.py       # WhatsApp inbound router & qualification intake
│           ├── whatsapp_owner.py         # Founder cockpit, Help menu & interactive wizards
│           ├── whatsapp_buttons.py       # Twilio Content API buttons registry + fallback
│           ├── telegram_service.py       # Telegram Bot polling, keyboards & message engine
│           ├── outlook_service.py        # Strato IMAP email poller & spam filter
│           ├── email_service.py          # Strato SMTP briefing & alert sender
│           ├── gdrive_service.py         # Google Drive folder creation & cached sync
│           ├── pdf_service.py            # PDF document generator & template pre-filling
│           ├── calculator_service.py     # Net profit & financial margin calculator
│           ├── claude_service.py         # Anthropic Claude AI & Vision client
│           └── scheduler_service.py      # APScheduler automated cron jobs
│
├── frontend/                             # React Operations Portal (Vite + React 18)
│   ├── vercel.json                       # Vercel SPA client-side routing rewrites
│   ├── package.json
│   ├── vite.config.js
│   │
│   └── src/
│       ├── App.jsx                       # Navigation layout, sidebar & route definitions
│       ├── index.css                     # Premium dark glassmorphism design system
│       ├── api/api.js                    # Unified API client & Supabase bridge
│       │
│       ├── components/
│       │   ├── ComplianceGateModal.jsx   # GwG AML & statutory compliance checkpoint modal
│       │   ├── LeadModal.jsx             # Lead creation with ISO 3779 VIN validation
│       │   ├── CreateProjectModal.jsx    # Deal creation with customer selection
│       │   ├── ExpenseModal.jsx          # Receipt logging & real-time profit preview
│       │   ├── DealDetailPanel.jsx       # Scoped deal activity, expenses & 0.25h labor ledger
│       │   ├── LeadDetailPanel.jsx       # Lead inspection with mobile.de relay badges
│       │   └── ContactDetailPanel.jsx    # Customer profile with project history & Drive links
│       │
│       ├── pages/
│       │   ├── Dashboard.jsx             # Executive metrics, active alerts & appointments
│       │   ├── Deals.jsx                 # Brokerage deal financial overview
│       │   ├── Projects.jsx              # Dual Buy/Sell Kanban board
│       │   ├── Leads.jsx                 # Inbound lead inbox with spam quarantine filter
│       │   ├── Customers.jsx             # Customer directory with vehicle associations
│       │   ├── Contracts.jsx             # 1-Click legal contract generator
│       │   ├── Calendar.jsx              # Appointment scheduler with travel conflict guard
│       │   ├── Communications.jsx        # Unified email timeline
│       │   └── Auth.jsx                  # Google 1-Click OAuth & Supabase authentication
│       │
│       └── utils/
│           ├── textUtils.js              # Universal text sanitization, mojibake & spam helper
│           ├── complianceUtils.js        # German compliance gate validation logic
│           └── stageUtils.js             # Standardized 5 sales stages & normalization
│
└── client_data/                          # Master official contract PDF templates
    ├── CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf
    ├── CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf
    ├── Kaufvertrag-C2C-Bilingual.pdf
    └── CAR-AGENTS_Fahrzeug-Übergabeprotokoll.pdf
```

---

## 🛠️ Local Development & Running

### 1. Backend Setup (Port 9000)
```powershell
cd "d:\CARS AI\backend"
pip install -r requirements.txt
python main.py
```
* **API Server:** `http://localhost:9000`
* **Interactive Swagger Documentation:** `http://localhost:9000/docs`

### 2. Database Sanitizer (Optional Utility)
```powershell
cd "d:\CARS AI\backend"
python scripts/clean_db.py
```
* Scans live Supabase records, cleans corrupted umlauts, removes raw UUID strings, and quarantines spam.

### 3. Frontend Web Portal (Port 5173)
```powershell
cd "d:\CARS AI\frontend"
npm install
npm run dev
```
* **Web Portal:** `http://localhost:5173`

---

## 🚀 Deployment Guide

### Frontend Deployment (Vercel)
* **Root Directory:** `frontend`
* **Build Command:** `npm run build`
* **Output Directory:** `dist`
* **Configuration:** Pre-configured with `frontend/vercel.json` for SPA URL rewrites.

### Backend Deployment (Render)
* **Build Command:** `pip install -r backend/requirements.txt`
* **Start Command:** `cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT` (or via `render.yaml`)
* **Environment Variables:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `TELEGRAM_BOT_TOKEN`, `IMAP_USER`, `IMAP_PASSWORD`, `SMTP_USER`, `SMTP_PASSWORD`.

---

## 📋 Project Status & Verification Matrix

### ✅ Phase 1: Completed & Deployed
- [x] **Production Hosting:** Live deployments on Vercel (Frontend) and Render (Backend).
- [x] **Telegram Operations Bot (`@car_agents_bot`):** Inline action buttons, `/stage` transitions, `/customer` search, and real-time deal alerts.
- [x] **Strato Inbound Email Poller:** Live IMAP ingestion with Claude AI intent classification (`BUY` vs `SELL`).
- [x] **mobile.de Proxy Relay Handling:** Name extraction, vehicle association, and broker badges.
- [x] **Spam Quarantine Engine:** Automatic filtering of non-automotive receipts and newsletters.
- [x] **German Compliance Hard Gates:** GwG AML source of funds checks ($\ge$ €10k), €9,999 cash ceiling, AGB/GDPR timestamping, and 14-day waiver.
- [x] **Dual Buy/Sell Kanban:** Normalized 5 sales stages with drag-and-drop and stage transition gating.
- [x] **1-Click PDF Contract Engine:** Pre-fills all 4 bilingual templates with dynamic auto-render recovery.
- [x] **Google Drive Integration:** Automatic folder creation per deal/customer with in-memory caching.
- [x] **Net Broker Profit Calculator:** Itemized expense logging and 0.25h billable labor enforcement.
- [x] **Data Sanitation:** Eradication of `\ufffd` mojibake, German umlaut restoration, and human-friendly notes (zero raw UUIDs).
- [x] **Strict ISO 3779 VIN Validation:** 17-character validation with live feedback counter.

### ⏳ Phase 2: Roadmap & Deferred
- [ ] **Meta WhatsApp Business API (WABA):** Onboard official office landline (`+49 8404 9385840`) once voice OTP and Meta Business verification are completed *(Telegram Bot currently serves as the operational mobile alternative)*.
- [ ] **Automated EBICS / PSD2 Bank Feed:** Direct real-time bank reconciliation for incoming setup fees and final settlements.
- [ ] **Multi-Tenant Enterprise RBAC & Hardware WebAuthn MFA:** Multi-broker partitioning and hardware key authentication.
