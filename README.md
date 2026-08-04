# CAR-AGENTS — AI Operations & Brokerage Management System

An end-to-end AI operations, contract pre-filling, document OCR parsing, and dual-pipeline brokerage management system designed specifically for **CAR-AGENTS**, a founder-led premium automotive brokerage in Germany.

The system automates client communication, lead intent classification (`BUY` vs `SELL`), document OCR parsing (*Fahrzeugdatenträger* / *Fahrzeugschein*), 1-click contract pre-filling (4 templates), voice note transcription, real-time expense & net profit calculation, deal inactivity alerts, and daily/weekly executive briefings.

---

## 📐 Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                            CAR-AGENTS SYSTEM ARCHITECTURE                         |
+-----------------------------------------------------------------------------------+
                                          |
     +------------------------------------+-----------------------------------+
     |                                    |                                   |
[ React Founder Portal ]         [ FastAPI AI Backend ]           [ Supabase Cloud DB ]
 - Vite + React 18 (Port 5173)    - Python 3.13 (Port 9000)       - PostgreSQL Schema v3.0
 - Realtime WebSockets            - Document OCR & Whisper        - Auto REST & Realtime APIs
 - Dual Buy/Sell Kanban          - 1-Click PDF Engine            - Contact & Lead Store
 - Net Profit Calculator          - Meta WhatsApp Webhooks        - Project & Expense Ledger
 - 4 Contract Templates           - APScheduler Automations       - Calendar & Meetings
```

---

## ⚡ Core Functional Workflows (W1 – W6)

### 📧 W1 — Inbound Email Logger & Intent Classifier
* **Trigger:** Async background listener polling `info@car-agents.de` (Strato IMAP) every 5 minutes.
* **Function:** Extracts sender details, subject, and body text. Runs Claude AI intent classification (`BUY_INTENT` vs `SELL_INTENT`), auto-creates/updates lead records, logs interaction history, and drafts suggested replies in Supabase.

### 📱 W2 — Meta WhatsApp Business Cloud API Receiver
* **Trigger:** Meta Webhook receiver (`POST /api/v1/webhooks/whatsapp`).
* **Function:** Captures incoming messages from official office landline (`+49 8404 9385840`), logs conversations into Supabase unified inbox timeline, and runs intent routing.

### 📄 W3 — Document OCR Parser & Vehicle Spec Extractor
* **Trigger:** Drag-and-drop document upload in the React Portal or API call (`POST /api/v1/ocr/vehicle-specs` & `/client-details`).
* **Function:** Uses a hybrid extraction pipeline (`pdfplumber` + `pytesseract` + Claude Sonnet) to extract 17-digit VIN, Manufacturer, Model, Engine Power (kW/PS), Displacement (ccm), EZ (Initial Registration), TÜV expiry, Transmission/Paint codes, and client personal details directly into form fields.

### 📝 Contract Pre-Filling & PDF Generator (4 Templates)
* **Trigger:** 1-Click action on the Contracts page or API call (`POST /api/v1/contracts/generate-pdf`).
* **Function:** Pre-fills dynamic placeholders across **4 official PDF contract templates**:
  1. `sell_b2c` — Vermittlungsvertrag B2C Aktiv *(Sell Side Contract)*
  2. `buy_passiv` — Vermittlungsvertrag Beschaffung Passiv *(Buy Side Contract)*
  3. `kaufvertrag` — Kaufvertrag C2C Bilingual *(DE/EN Sales Contract)*
  4. `handover` — Fahrzeug-Übergabeprotokoll *(Vehicle Handover & Condition Protocol)*

### 🎙️ W4 — Voice Transcriber & Action Item Parser
* **Trigger:** Audio file drop in React Portal or API call (`POST /api/v1/voice/transcribe`).
* **Function:** Transcribes voice notes locally using `faster-whisper` (CPU int8). Claude analyzes intent, urgency, and extracts structured CRM task titles and action items.

### 🗓️ W5 — Daily & Weekly Executive Briefings
* **Trigger:** `APScheduler` cron (Daily at 07:00 CET, Weekly every Sunday at 15:00 CET) or manual API trigger.
* **Function:** Summarizes new 24h leads, active SELL/BUY pipeline stats, and inactive deals into a clean digest delivered via WhatsApp Cloud API & Email.

### ⚠️ W6 — Deal Inactivity Monitor & Follow-up Override
* **Trigger:** Daily check on project timestamps (`updated_at < NOW() - 24 hours`).
* **Function:** Identifies deals with no activity beyond 24 hours and sends WhatsApp reminders. Respects **Manual Date Override** to pause alerts for consultative clients who agreed to check back at a later target date.

### 💶 Real-Time Financials & Net Broker Profit Calculator
* **Formula:**
  $$\text{Total Expenses} = \sum \text{Receipt Amounts}$$
  $$\text{Labor Cost} = \text{Labor Hours} \times \text{Hourly Rate (Default €20/hr)}$$
  $$\text{Total Project Investment} = \text{Vehicle Purchase Price} + \text{Total Expenses} + \text{Labor Cost}$$
  $$\text{Net Broker Profit} = \text{Agreed Final Sale Price} - \text{Total Project Investment}$$

---

## 📁 Project Directory Structure

```
d:\CARS AI\
├── MEMORY.md                             # System architecture memory for AI sessions
├── README.md                             # System documentation & setup guide (this file)
├── supabase_schema_v3.sql                # PostgreSQL database schema
├── supabase_fields_cheatsheet.md         # Field mapping cheatsheet
│
├── backend/                              # 100% Pure FastAPI AI & Automation Backend
│   ├── main.py                           # App entry point with Swagger docs (/docs) & lifespan scheduler
│   ├── config.py                         # Pydantic environment configuration
│   ├── database.py                       # Supabase client connection singleton
│   ├── requirements.txt                  # Backend Python dependencies
│   ├── apply_supabase_schema.py          # Script that applied schema v3 to Supabase DB
│   │
│   └── app/                              # Modular FastAPI Application
│       ├── api/v1/
│       │   ├── router.py                 # Combined v1 API Router
│       │   └── endpoints/
│       │       ├── ocr.py                # Document OCR & Fahrzeugdatenträger spec extraction
│       │       ├── voice.py              # Whisper voice transcription & action parser
│       │       ├── classify.py           # BUY_INTENT vs SELL_INTENT AI classifier
│       │       ├── contracts.py          # 1-Click PDF contract generator (4 templates)
│       │       ├── projects.py           # Net Broker Profit Calculator API
│       │       ├── webhooks.py           # Meta WhatsApp Cloud API webhook handler (W2)
│       │       └── briefings.py          # On-demand executive briefing triggers
│       │
│       ├── schemas/                      # Pydantic Request/Response Models
│       │   ├── ocr.py                    # ClientDetailsResponse & VehicleSpecsResponse
│       │   ├── contract.py               # ContractGenerateRequest & Response
│       │   ├── meeting.py                # ConflictCheckRequest (30-min buffer)
│       │   └── project.py                # NetProfitCalculation, ExpenseCreate, LaborLog
│       │
│       └── services/                     # Business Logic & AI Engines
│           ├── claude_service.py         # Claude Sonnet AI calls & email summarisation
│           ├── whisper_service.py        # Local faster-whisper CPU audio transcriber
│           ├── pdf_service.py            # pdfplumber + pytesseract text extractor & PDF filler
│           ├── calculator_service.py     # CAR-AGENTS Net Profit formula calculator
│           ├── whatsapp_service.py       # Meta WhatsApp Cloud API messaging & PDF delivery
│           ├── email_service.py          # Strato IMAP email listener (W1) & SMTP sender
│           ├── scheduler_service.py      # APScheduler background cron jobs (W5, W6)
│           └── supabase_service.py       # Supabase database query helper
│
├── frontend/                             # React Operations Portal (Vite + React 18)
│   ├── package.json
│   ├── vite.config.js
│   ├── .env                              # Frontend environment config
│   └── src/
│       ├── App.jsx                       # Navigation layout with sidebar & routes
│       ├── index.css                     # Premium design system stylesheet
│       ├── api/api.js                    # Unified Supabase JS client & AI API bridge
│       ├── components/
│       │   ├── LeadModal.jsx             # New lead creation with OCR document drag-and-drop
│       │   └── ExpenseModal.jsx          # Itemized receipt logging & real-time Net Profit calculator
│       └── pages/
│           ├── Dashboard.jsx             # Real-time metrics, inactive deal alerts, today's bookings
│           ├── Leads.jsx                 # Lead management with intent badges & search
│           ├── Projects.jsx              # Dual Buy/Sell Kanban pipeline board
│           ├── Contracts.jsx             # 1-Click contract PDF generator for 4 templates
│           ├── Calendar.jsx              # Appointment scheduler with 30-min travel conflict guard
│           ├── Communications.jsx        # Email & WhatsApp unified inbox timeline
│           └── VoiceNotes.jsx            # Voice recorder & Whisper audio transcriber
│
└── client_data/                          # Contract reference PDFs & sample docs
    ├── CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf
    ├── CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf
    ├── Kaufvertrag-C2C-Bilingual.pdf
    ├── CAR-AGENTS_Fahrzeug-Übergabeprotokoll.pdf
    ├── cars_client_followup.pdf          # Reference doc for OCR client details
    └── input image.jpeg                  # Reference image for OCR vehicle specs
```

---

## 🛠️ Environment Setup & Local Testing

### 1. Backend Setup & Launch (Port 9000)
```powershell
cd "d:\CARS AI\backend"
pip install -r requirements.txt
python main.py
```
* **API Server:** `http://localhost:9000`
* **Interactive Swagger Docs:** `http://localhost:9000/docs`

### 2. Frontend Web Portal Launch (Port 5173)
```powershell
cd "d:\CARS AI\frontend"
npm install
npm run dev
```
* **Web Portal:** `http://localhost:5173`

---

## 📞 WhatsApp Business API (WABA) Landline Verification Guide

The official office landline **`+49 8404 9385840`** CAN be converted to WhatsApp Business API.

### Verification Steps:
1. **Meta Business Manager:** Access Meta Business Settings (`business.facebook.com`).
2. **Add Phone Number:** Navigate to **WhatsApp Accounts > Add Phone Number**. Enter `+49 8404 9385840` (Germany `+49`).
3. **Display Name:** Set to legal business name `CAR-AGENTS`.
4. **Choose Verification Method:** Select **Voice Call (Phone Call)** — *Do NOT select SMS for a landline!*
5. **Receive Call & Enter OTP:** Meta's automated phone system will call `+49 8404 9385840` and speak a 6-digit verification code. Enter this code into Meta Manager.
6. **Business Verification:** Upload `Gewerbeanmeldung` for **CAR-AGENTS, Maxim Lorenz, Lerchenweg 7, 93349 Mindelstetten**.
7. **Copy Credentials to `.env`:** Copy `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_VERIFY_TOKEN`.

---

## 📋 System Checklist & Verification Status

### ✅ Completed & Live
- [x] 100% Pure FastAPI Backend (`main.py`) with Swagger docs at `/docs`.
- [x] Supabase Database Schema v3.0 applied and active (`leads`, `projects`, `project_expenses`, `project_labor`, `meetings`, `communications`).
- [x] Document OCR & Fahrzeugdatenträger Spec Extractor (`app/api/v1/endpoints/ocr.py`).
- [x] Local Whisper Audio Transcriber (`app/services/whisper_service.py`).
- [x] 1-Click Contract Pre-filling for all 4 Contract Templates (`app/api/v1/endpoints/contracts.py`).
- [x] Net Broker Profit & Financial Formula Calculator (`app/services/calculator_service.py`).
- [x] Meta WhatsApp Cloud API Webhook Handler (`app/api/v1/endpoints/webhooks.py`).
- [x] Strato IMAP Inbound Email Listener (`app/services/email_service.py`).
- [x] APScheduler Automation Engine for W5 Executive Briefings & W6 Inactivity Alerts.
- [x] React Operations Portal (7 pages) with Realtime Supabase WebSockets & Glassmorphic UI.
- [x] `MEMORY.md` file created for AI context persistence across chat sessions.

### ⏳ Remaining Setup Steps
- [ ] Complete Meta landline voice verification for `+49 8404 9385840` to get Meta Access Token.
- [ ] Connect Google Calendar OAuth2 / Outlook OAuth2 client keys for live bi-directional sync.
