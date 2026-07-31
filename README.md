# CAR-AGENTS — AI Operations & Automation System

An end-to-end AI operations and workflow automation engine designed specifically for **CAR-AGENTS**, a founder-led premium automotive brokerage in Germany.

The system automates client communication, lead logging, document OCR parsing, contract pre-filling, voice note transcription, deal inactivity tracking, and daily/weekly executive briefings.

---

## 📐 Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                                  CAR-AGENTS AI SYSTEM                             |
+-----------------------------------------------------------------------------------+
                                          |
     +------------------------------------+-----------------------------------+
     |                                    |                                   |
[ Communication Layer ]          [ Local AI Services ]           [ Workflow & CRM Engine ]
 - Inbound Email (IMAP/SMTP)      - FastAPI (Port 9000)           - n8n Automation Workflows
 - WhatsApp Cloud API             - Local Whisper (base model)    - Supabase Log Tables
 - Voice Notes (Audio)            - Tesseract OCR & pdfplumber   - HubSpot Free CRM
                                  - Claude 3.7 / Groq Llama 3.3
```

---

## ⚡ Key Workflows (W1 – W6)

### 📧 W1 — Email Logger
* **Trigger:** IMAP polling on `info@car-agents.de` (Strato custom domain).
* **Function:** Extracts sender details, subject, and body text. Matches contact in CRM/Supabase and logs the communication timeline automatically.

### 📱 W2 — WhatsApp Logger
* **Trigger:** Meta WhatsApp Business Cloud API webhook.
* **Function:** Captures incoming messages from client landline (`+49 8404 9385840`), logs conversations, and drafts AI suggested replies for founder approval.

### 📄 W3 — Document Generator & OCR Parser
* **Trigger:** Google Drive upload of vehicle documents (Fahrzeugschein Part 1 & 2, invoices, handover notes).
* **Function:** Performs local text extraction (`pdfplumber` for digital PDFs, `pytesseract` for images) and uses Claude/Llama 3.3 to structure key specs (VIN, mileage, TÜV, power, initial registration). Pre-fills Google Docs contract templates.

### 🎙️ W4 — Voice Transcriber (Whisper)
* **Trigger:** Audio file drop in Drive or WhatsApp voice note forwarding.
* **Function:** Transcribes audio locally using `faster-whisper`. Claude analyzes intent, urgency, and extracts actionable tasks directly into CRM.

### 🗓️ W5 — Daily & Weekly Executive Briefing
* **Trigger:** Scheduled cron (Daily at 07:00 CET/CEST, Weekly every Sunday at 15:00 CET/CEST).
* **Function:** Summarizes new leads, pending tasks, silent deals, and document status into a clean summary delivered via Email & WhatsApp.

### ⚠️ W6 — Deal Inactivity & Follow-up Override
* **Trigger:** Daily check on HubSpot deal stages.
* **Function:** Identifies deals with no activity beyond 24 hours (up to 3 follow-ups). Supports **Manual Date Override** to pause reminders for consultative clients who agreed to check back at a later target date.

---

## 📁 Repository Structure

```
d:\CARS AI\
├── .env                              # System environment configuration & API keys
├── dashboard.html                    # Admin & developer testing web dashboard
├── local_services_server.py          # FastAPI server (Whisper transcription & OCR API)
├── requirements.txt                  # Python dependencies
├── supabase_fields_cheatsheet.md     # Data mapping guide for n8n & Supabase tables
│
├── client_data/                      # Client provided sample documents & feedback
│   ├── CAR-AGENTS_Fahrzeug-Übergabeprotokoll.pdf
│   ├── CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf
│   ├── CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf
│   ├── Kaufvertrag-C2C-Bilingual.pdf
│   └── cars_client_followup.pdf      # Client response detailing landline & requirements
│
├── other docs/                       # Architectural specs & study documents
│   ├── CAR-AGENTS_Final_Plan.txt
│   ├── AGENTS-Detailed-Plan_extracted.txt
│   └── w3_document_generator_plan.md
│
├── W1 — Email Logger (car-agents).json       # n8n Workflow JSON Blueprint 1
├── W2 — WhatsApp Logger (car-agents).json    # n8n Workflow JSON Blueprint 2
├── W3 — Document Generator (car-agents).json # n8n Workflow JSON Blueprint 3
├── W4 — Voice Transcriber (car-agents).json  # n8n Workflow JSON Blueprint 4
├── W5 — Daily Briefing (car-agents).json     # n8n Workflow JSON Blueprint 5
└── W6 — Deal Inactivity (car-agents).json    # n8n Workflow JSON Blueprint 6
```

---

## 🛠️ Environment Setup & Local Testing

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Configure Environment (`.env`)
Ensure your `.env` contains valid credentials for Anthropic, Supabase, and local server settings:
```env
PORT=9000
WHISPER_MODEL_SIZE=base
LOCAL_SERVICES_URL=http://localhost:9000
ANTHROPIC_API_KEY=sk-ant-...
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

### 3. Launch Local AI Services Server
```bash
python local_services_server.py
```
* API will run at `http://localhost:9000`
* Swagger docs available at `http://localhost:9000/docs`

### 4. Interactive Testing Dashboard
Open `dashboard.html` in any web browser to test OCR document parsing, audio transcription, and view live Supabase logs.

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
7. **Copy Credentials to `.env`:** Once approved, copy `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_BUSINESS_ACCOUNT_ID`.

---

## 📋 Implementation Status & Checklist

### ✅ Completed
- [x] Local FastAPI AI Server (`local_services_server.py`) for Whisper & OCR.
- [x] Hybrid OCR Pipeline (`pdfplumber` + `pytesseract` + Claude Sonnet / Llama 3.3).
- [x] All 6 n8n Workflow JSON Blueprints (W1 through W6).
- [x] Supabase Database Schema & Field Mapping Cheatsheet.
- [x] Interactive Testing Dashboard (`dashboard.html`).
- [x] Requirement analysis of client response (`cars_client_followup.pdf`).

### ⏳ Remaining / Next Steps
- [ ] Meta Business Manager approval & landline voice verification (`+49 8404 9385840`).
- [ ] Create Google Docs contract templates with double-brace placeholders (`{{vin}}`, `{{mileage}}`).
- [ ] Deploy n8n workflows to production VPS and configure credentials.
- [ ] Setup custom properties in HubSpot CRM (e.g., `Custom Follow-up Target Date`).
- [ ] Perform live End-to-End User Acceptance Testing (UAT) with real vehicle documents.
