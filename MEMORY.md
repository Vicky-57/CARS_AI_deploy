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
 - Google Drive Upload            - APScheduler Automations       - Google Auth Tokens Store
 - Google Calendar Sync          - Google Calendar v3 Sync       - Meetings & Conflict Guard
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
* **Schema File:** `supabase_schema_v3.sql` *(applied to Supabase DB, includes `google_auth` table)*

### Backend Environment (`backend/.env`)
* **PORT:** `9000`
* **LOCAL_SERVICES_URL:** `http://localhost:9000`
* **ANTHROPIC_API_KEY:** Configured in `.env` (Claude 3.7 / Sonnet)
* **WHATSAPP Credentials:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
* **GOOGLE OAUTH2 Credentials:** Uses `google_auth` table in Supabase & `google_service.py` for token refresh.

### Frontend Environment (`frontend/.env`)
* **VITE_SUPABASE_URL:** `https://wvzulyxzuntjnzdykstt.supabase.co`
* **VITE_SUPABASE_ANON_KEY:** `sb_publishable_s5EKZcMXdOb6LBSF-I758A_-cS8v1Zm`
* **VITE_AI_URL:** `http://localhost:9000`

---

## 📂 Integrations Summary (Google, WhatsApp, Contracts)

* **Merged Branch:** Integrated `remotes/origin/meetings-google-sync` into `main`.
* **Google Calendar Sync & Free/Busy:** `google_service.py` handles bi-directional event creation (`create_event`, `update_event`, `delete_event`) & live `check_free_busy` checks against Google Calendar.
* **Tokens Storage:** OAuth tokens stored securely in Supabase `google_auth` table with automated refresh token management.
* **Google Drive Storage:** Approved contract PDFs saved to Google Drive under `/Customers/{Customer}/Contracts/`.
* **Primary Gmail REST API:** Queries Primary category inbox with 1-Click AI Lead Conversion.

---

## ⚡ How to Run the Project Locally

### 1. Start FastAPI Backend (Port 9000)
```powershell
cd "d:\CARS AI\backend"
python main.py
```
* Interactive Swagger Docs: `http://localhost:9000/docs` (30 API routes mounted)

### 2. Start React Portal (Port 5173)
```powershell
cd "d:\CARS AI\frontend"
npm run dev
```
* Open in browser: `http://localhost:5173`

---

## 🔄 Recent Branch & Merge History

1. **Merged `meetings-google-sync`:** Merged commit `21167aca` into `main`. Conflict resolved in `router.py` and `Calendar.jsx`.
2. **Google Calendar Features:** Added `google_service.py`, `google_auth.py`, `meetings_sync.py`, and `google_auth` table in Supabase.
3. **Verified Health:** Frontend built in 7.42s; backend initialized 30 API endpoints cleanly.
