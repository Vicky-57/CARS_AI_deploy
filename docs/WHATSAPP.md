# CAR-AGENTS WhatsApp Assistant Guide

Single reference for WhatsApp architecture, Twilio/Meta setup, founder commands, scheduling, and document workflows.

## 1. Endpoints & Config
- **Twilio Sandbox / Webhook:** `POST /api/v1/webhooks/whatsapp/twilio` (returns TwiML `<Response>`).
- **Meta / Auto-Detect Webhook:** `GET /api/v1/webhooks/whatsapp` (handshake) & `POST /api/v1/webhooks/whatsapp`.
- **Health Check:** `GET /api/v1/webhooks/whatsapp/status`.
- **Twilio Sandbox Join:** Send `join whispered-difference` to `+1 415 523 8886` (72h window per participant).
- **Important Env Vars:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_CONTENT_ENABLED` (`false` on Trial accounts, `true` on upgraded Twilio accounts for Content API quick-reply buttons), `WHATSAPP_OWNER_PHONES`.

## 2. Buttons Behavior (Twilio Trial vs Production)
- **Meta Cloud API & Upgraded Twilio (`TWILIO_CONTENT_ENABLED=true`):** Sends native interactive quick-reply buttons (`<=3` items) and list-pickers (`4..10` items). Inbound `ButtonPayload` / `ListId` is parsed into `reply_id`.
- **Twilio Trial Sandbox (`TWILIO_CONTENT_ENABLED=false`):** Twilio Content API returns `401 / 20003` on Trial accounts, so options fall back cleanly to numbered replies (`*1.*`, `*2.*`, ...) **only when interactive choices are shown**.
- Normal founder replies (`summary`, `leads`, `deals`, alerts) do **not** attach any menu footer. Only `help` renders the selectable command menu.

## 3. Customer Flows
- **Qualification Funnel (`whatsapp_flow.py`):** Zero-LLM 3-step German/English flow (Buy: Urgency -> Timeline -> Budget; Sell: Urgency -> Vehicle -> Asking Price). Scores `HOT / WARM / COLD`, stores Q&A + GDPR timestamp in Supabase `leads`, and sends a plain-text alert to the founder.
- **Post-Qualification:** Subsequent customer text gets a polite confirmation and alerts the founder (TwiML caller isolation ensures founder alerts never leak to customers). Subsequent customer files are stored directly via `document_service.store_uploaded_document` without OCR.

## 4. Founder Commands (`whatsapp_owner.py`)
Type `help` for the interactive menu, or send any command directly:
- `summary` — KPI snapshot & deal stage breakdown
- `leads` — 10 latest leads with temperature tags
- `deals` — Active Kanban deals
- `customer <name | phone | email>` — Unified CRM lookup across leads & deals; shows a disambiguation picker if multiple customers share a name
- `convert <lead>` / `stage <client> <stage>` — Promote lead to deal or move Kanban stage
- `schedule` — Pick customer (phone/name/email or recent list) -> auto-fills name, phone, car & BUY/SELL -> pick working day (`09:00–18:00 Mon–Sat`, `Europe/Berlin`) -> pick free slot (conflicts & `30m` offline travel buffer excluded) -> Offline/Online -> Confirm booking (+ `.ics` invite email when SMTP is configured)
- `meetings` / `cancel meeting` / `reschedule` — View, cancel, or move appointments
- `upload` — Store personalized customer documents (`id_card`, `contract`, `vehicle_papers`, `photos`, `other`) to Google Drive (or Supabase Storage fallback) **with zero OCR**
- `scan` / `ocr` — Extract fields (`Fahrzeugschein`, `ID Card`, `Other`) via Claude Vision -> preview -> save confirmed values into Lead, Deal & Contract Template (`client_form_sessions.shared_core`)
- `reset` — Clear current WhatsApp session

## 5. Offline Test Suite
```powershell
python backend/tests/test_whatsapp.py
```
