# CAR-AGENTS — System Memory & Technical Context

This file contains the complete system architecture, latest decisions, database status, business entity lifecycles, and operational guides for **CAR-AGENTS**. Use this file when starting a new chat session to immediately pick up where work left off.

---

## 📐 System Architecture Overview

```
+-----------------------------------------------------------------------------------+
|                            CAR-AGENTS SYSTEM ARCHITECTURE                         |
+-----------------------------------------------------------------------------------+
                                          |
     +------------------------------------+-----------------------------------+
     |                                    |                                   |
[ React Founder Portal ]         [ FastAPI AI Backend ]           [ Supabase Cloud DB ]
 - Vite + React 18 (Port 5173)    - Python 3.13 (Port 9000)       - PostgreSQL Schema v3.0
 - Realtime WebSockets            - Google OAuth2 & Gmail API     - Auto REST & Realtime APIs
 - Dual Buy/Sell Kanban          - 1-Click PDF Engine            - Contact & Customer Store
 - Net Profit Calculator          - Meta WhatsApp Webhooks        - Deals & Project Ledger
 - Google Drive Upload            - APScheduler Automations       - Calendar & Meetings
```

---

## 🔄 Business Entity Lifecycle (Leads → Customers → Deals → Projects)

```
┌──────────────┐      Convert      ┌──────────────────┐      Create      ┌─────────────────┐      Activate      ┌──────────────────┐
│  1. LEAD     │ ───────────────>  │  2. CUSTOMER     │ ───────────────> │  3. DEAL        │ ─────────────────> │  4. PROJECT      │
│ Inbound      │   Client        │ Onboarded Client │   Agreed        │ Commercial      │   Execution      │ Milestone &      │
│ Inquiry      │   Confirm       │ Profile (Name,   │   Vehicle &     │ Opportunity     │   Pipeline       │ Expense Tracker  │
│ (Gmail/WA)   │   Details       │ Address, ID)     │   Commission    │ (Stage & Value) │   (Buy or Sell)  │ & Net Profit     │
└──────────────┘                   └──────────────────┘                  └─────────────────┘                    └──────────────────┘
```

1. **Lead:** Inbound client inquiry received via WhatsApp, Gmail REST API (Primary Inbox filtered), or Web Form. Converted to Lead via 1-Click AI extraction.
2. **Customer:** Verified client record created when a lead confirms engagement (stores legal full name, address, ID/passport number, phone, email).
3. **Deal:** Commercial opportunity linked to a Customer & vehicle (target vehicle model, price limit, agreed price, commission, deal stage).
4. **Project:** Active operational execution of an approved deal in the **Dual Pipeline**:
   - **SELL Side (Vermittlung)**: Onboarding → Specs → Marketing → Negotiation → Contract → Handover.
   - **BUY Side (Beschaffung)**: Requirements → Contract → Sourcing → Inspection → Negotiation → Acquisition.

---

## 🛠️ Environment & Infrastructure Config

### Supabase Cloud Credentials
* **Supabase URL:** `https://wvzulyxzuntjnzdykstt.supabase.co`
* **Publishable Key:** `sb_publishable_s5EKZcMXdOb6LBSF-I758A_-cS8v1Zm`
* **Secret Key:** `sb_secret_qM2kIa6iLOXbv_JAUEXNTA_YLbxemoo`
* **Database Password:** `CARS_AI2026`
* **Schema File:** `supabase_schema_v3.sql` *(applied to Supabase DB)*

### Backend Environment (`backend/.env`)
* **PORT:** `9000`
* **LOCAL_SERVICES_URL:** `http://localhost:9000`
* **ANTHROPIC_API_KEY:** Configured in `.env` (Claude 3.7 / Sonnet)
* **WHATSAPP Credentials:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
* **GOOGLE OAUTH2 Credentials:** Uses `google_tokens.json` & Google REST APIs for Gmail and Drive.

### Frontend Environment (`frontend/.env`)
* **VITE_SUPABASE_URL:** `https://wvzulyxzuntjnzdykstt.supabase.co`
* **VITE_SUPABASE_ANON_KEY:** `sb_publishable_s5EKZcMXdOb6LBSF-I758A_-cS8v1Zm`
* **VITE_AI_URL:** `http://localhost:9000`

---

## 📂 Google Drive & Gmail REST API Integrations

* **Google OAuth2 (No Passwords Required):** Connects directly with Google permissions (`gmail.readonly`, `gmail.send`, `drive.file`).
* **Gmail Primary Filtering:** Queries Gmail REST API with `q="label:INBOX category:primary"` to filter out spam and promotional mail.
* **1-Click Convert Email to Lead:** Calls `POST /api/v1/gmail/convert-lead` to parse primary emails with Claude AI and auto-populate Supabase lead forms.
* **Conditional Drive Upload:** Uploads generated PDF contracts to `/CAR-AGENTS/Customers/{Customer Name}/Contracts/` **only after explicit client/broker approval**.

---

## ⚡ How to Run the Project Locally

### 1. Start FastAPI Backend (Port 9000)
```powershell
cd "d:\CARS AI\backend"
python main.py
```
* Interactive Swagger Docs: `http://localhost:9000/docs`

### 2. Start React Portal (Port 5173)
```powershell
cd "d:\CARS AI\frontend"
npm run dev
```
* Open in browser: `http://localhost:5173`

---

## 🔄 Recent Architectural & Feature Decisions

1. **Direct Google OAuth2 & Gmail REST API:** Replaced IMAP/SMTP password requirements with standard Google Sign-In permissions.
2. **Primary Inbox Filtering:** Direct Gmail REST API query (`label:INBOX category:primary`) with 1-Click AI Lead Conversion.
3. **Google Drive Conditional Storage:** Approved contract PDFs saved to Google Drive under `/Customers/{Customer}/Contracts/`.
4. **Voice Notes Removed:** Cleaned up `/voice` route and unused files.
5. **Git Synchronization Memory:** `MEMORY.md` automatically updated for seamless continuation across chat sessions.
