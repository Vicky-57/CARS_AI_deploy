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
 - Google Drive Upload            - APScheduler Automations       - public.google_auth Table
 - Supabase & Google Auth        - Google Calendar v3 Sync       - Meetings & Conflict Guard
```

---

## 🛠️ Environment & Infrastructure Config

### Authentication System (`Auth.jsx` & `App.jsx`)
* **Google 1-Click OAuth Sign-In:** Prominent "Continue with Google Account" button on login screen.
* **Supabase Email/Password Auth:** Native Supabase authentication with fallback for quick local testing.
* **Test Credentials Autofill:** 1-Click "Fill Test Account Credentials" pre-populating `vikaspurohit105@gmail.com` & password.
* **Session Persistence:** Persistent login state stored in `localStorage` (`car_agents_user`) + Supabase Auth.
* **Logout:** Sidebar footer popover supports 1-click logout returning to login screen.

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

## 🕒 Recent Updates & Log (Aug 25, 2026)

### 🤖 Telegram Bot Enhancements & Fixes
* **Inline Buttons & Stage Transitions**: Interactive inline keyboard buttons for lead/customer management and `/stage` transitions in Telegram ([`telegram_service.py`](file:///d:/CARS AI/backend/app/services/telegram_service.py), [`telegram_bot.py`](file:///d:/CARS AI/backend/app/api/v1/endpoints/telegram_bot.py)).
* **Customer Lookup & Calendar Sync**: Added `/customer` lookup and merged Outlook calendar schedules with Telegram scheduler notifications.
* **Fixes**: Stripped emoji text from query filters in search handlers and replaced invalid `tel:` URI schemes with `callback_data` handlers.

### 🎨 Frontend UI/UX Redesign
* **Theme & Styles**: Comprehensive styling overhaul across [`index.css`](file:///d:/CARS AI/frontend/src/index.css), [`Dashboard.jsx`](file:///d:/CARS AI/frontend/src/pages/Dashboard.jsx), [`Projects.jsx`](file:///d:/CARS AI/frontend/src/pages/Projects.jsx), [`Customers.jsx`](file:///d:/CARS AI/frontend/src/pages/Customers.jsx), [`Leads.jsx`](file:///d:/CARS AI/frontend/src/pages/Leads.jsx), [`Calendar.jsx`](file:///d:/CARS AI/frontend/src/pages/Calendar.jsx), [`Communications.jsx`](file:///d:/CARS AI/frontend/src/pages/Communications.jsx), [`BuyForm.jsx`](file:///d:/CARS AI/frontend/src/pages/BuyForm.jsx), and [`SellForm.jsx`](file:///d:/CARS AI/frontend/src/pages/SellForm.jsx).
* **Assets & Navigation**: Added asset images in [`frontend/public/assets/`](file:///d:/CARS AI/frontend/public/assets/) and updated [`Contracts.jsx`](file:///d:/CARS AI/frontend/src/pages/Contracts.jsx) to open contract forms in the same tab.

### 📄 PDF Engine & Master Document Templates
* **PDF Layout**: Alignment and formatting improvements in [`pdf_service.py`](file:///d:/CARS AI/backend/app/services/pdf_service.py).
* **Master Templates**: Added master PDF contract templates in `client_data/` (`Kaufvertrag-C2C-Bilingual.pdf`, `CAR-AGENTS_Fahrzeug-Übergabeprotokoll.pdf`, `CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf`, `CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf`).

### 🗓️ Outlook & Scheduler Integration
* **Calendar Sync**: Unified Outlook calendar event fetching and automated scheduler notifications in [`outlook_service.py`](file:///d:/CARS AI/backend/app/services/outlook_service.py) and [`scheduler_service.py`](file:///d:/CARS AI/backend/app/services/scheduler_service.py).

---

## 🕒 Recent Updates & Log (Aug 26, 2026)

### 🐛 Bug Fixes & API Client Updates
* **Labor Hours Logging Fix**: Added missing `addLabor` method to [`api.js`](file:///d:/CARS AI/frontend/src/api/api.js) supporting both object payloads (`{ hours_spent, activity_description }`) and standard parameter calls, fixing the `api.addLabor is not a function` error.
* **Database Persistence for Deals**: Updated [`Deals.jsx`](file:///d:/CARS AI/frontend/src/pages/Deals.jsx) to save labor logs and expenses directly to Supabase (`project_labor` & `project_expenses` tables).
* **Telegram Bot Datetime Fix**: Imported `from datetime import datetime` in [`telegram_service.py`](file:///d:/CARS AI/backend/app/services/telegram_service.py) to fix `NameError` during `/stage` transitions.
* **Stage Display Fix**: Updated `💼 Active Deals` project lookup in [`telegram_service.py`](file:///d:/CARS AI/backend/app/services/telegram_service.py) to check `current_stage` field instead of returning `N/A`.
* **Project Dates Tracking**: Auto-capturing project creation dates and stage update dates, displaying them in Kanban cards, Table view, and Project Details Drawer in [`Projects.jsx`](file:///d:/CARS AI/frontend/src/pages/Projects.jsx).
* **Google Drive Redirection Fix**: Fixed stale state bug in [`Projects.jsx`](file:///d:/CARS AI/frontend/src/pages/Projects.jsx) where switching between customers retained the previous customer's `driveUrls` during network fetch. Reset `driveUrls` state immediately on project selection, validated `project_id` matching in [`projects.py`](file:///d:/CARS AI/backend/app/api/v1/endpoints/projects.py), and added disabled `Loading Drive…` state on buttons until fresh folder URLs resolve.
* **Lead Management Filter Fix**: Updated `getLeads()` in [`api.js`](file:///d:/CARS AI/frontend/src/api/api.js) to query both `'SELL'` and `'SELL_INTENT'` (and `'BUY'` / `'BUY_INTENT'`), ensuring the "Sell Intent" tab displays all sell-side inbound leads instead of returning an empty list.
* **Communications Inbox UI & Sidebar**: Commented out the Communications navigation tab from the Sidebar in [`App.jsx`](file:///d:/CARS AI/frontend/src/App.jsx) as well as the channel filters and hero card in [`Communications.jsx`](file:///d:/CARS AI/frontend/src/pages/Communications.jsx).
* **Telegram Responses Data Enrichment**: Enhanced all Telegram bot responses in [`telegram_service.py`](file:///d:/CARS AI/backend/app/services/telegram_service.py):
  * `💼 Active Deals` & `👤 Customers`: Added direct Google Drive folder links (`📂 Drive Folder`) and formatted Creation Dates (`📅 Created: DD/MM/YYYY`).
  * `📊 Summary`: Upgraded to Executive CRM Summary showing total portfolio valuation (€), active deal counts, stage breakdown, and today's Outlook appointments.
  * `📋 Leads`: Fixed intent formatting (`SELL_INTENT` / `BUY_INTENT`) and added creation dates.
  * `/customer`: Upgraded to find ALL matching customers and render all their associated projects simultaneously (grouped by distinct customer identity/phone).
* **Telegram Bot Markdown Retry & Entity Fix**: Added automatic fallback in `send_telegram_message` in [`telegram_service.py`](file:///d:/CARS AI/backend/app/services/telegram_service.py) to immediately retry sending plain text without `parse_mode` whenever Telegram rejects a message due to Markdown entity parsing errors (HTTP 400).
* **Telegram UI Clean-Up (Removed Raw UUIDs)**: Removed internal database UUID lines (`🆔 Project ID` / `🆔 Lead ID`) from user-facing Telegram bot responses in [`telegram_service.py`](file:///d:/CARS AI/backend/app/services/telegram_service.py), making messages cleaner and human-friendly.
* **Telegram HTML Formatting & Layout Overhaul**:
  * **HTML Parse Mode**: Converted Telegram responses to `parse_mode="HTML"` (`<b>`, `<i>`, `<code>`, `<a href="...">`) in [`telegram_service.py`](file:///d:/CARS AI/backend/app/services/telegram_service.py).
  * **Clean Bold Text Numbers (`<b>1.</b>`, `<b>2.</b>`...)**: Replaced keycap emoji icons with bold text numbers (`<b>1.</b>`, `<b>2.</b>` ... `<b>10.</b>`, `<b>11.</b>` ...) across all lists (`👤 Customers`, `💼 Active Deals`, `📋 Leads`, `🚗 Cars`), ensuring 100% consistent, crisp alignment on all mobile and desktop Telegram apps regardless of list size.
  * **Clean Sub-Bullets (`   • `)**: Replaced ASCII tree elbows (`└`) with clean indented sub-bullet points.
* **Google Drive API Caching & Performance Fix**:
  * **In-Memory Cache (`_DRIVE_FOLDER_CACHE`)**: Added caching in [`gdrive_service.py`](file:///d:/CARS AI/backend/app/services/gdrive_service.py) so resolved Google Drive folder IDs take **0 ms** on repeat calls.
* **Sales Stage Synchronization & Zero-Loss Normalization**:
  * **Unified Standard 5 Sales Stages**: Synchronized sales stage names across [`telegram_service.py`](file:///d:/CARS AI/backend/app/services/telegram_service.py), [`Projects.jsx`](file:///d:/CARS AI/frontend/src/pages/Projects.jsx), and [`CreateProjectModal.jsx`](file:///d:/CARS AI/frontend/src/components/CreateProjectModal.jsx):
    1. `Intake & Onboarding`
    2. `Sourcing & Inspection`
    3. `Marketing & Listing`
    4. `Negotiation & Contract`
    5. `Completed & Delivered`
  * **Stage Normalization (`getNormalizedStage`)**: Added `getNormalizedStage()` helper in [`Projects.jsx`](file:///d:/CARS AI/frontend/src/pages/Projects.jsx) so variant stage names (e.g. `Contract Signing`, `Payment & Settlement`, `Handover & Delivered`, `Vehicle Inspection`) automatically map to standard Kanban columns, preventing deal cards from vanishing when updated in Telegram. Cleaned up existing database records in Supabase.


