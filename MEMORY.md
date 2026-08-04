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
