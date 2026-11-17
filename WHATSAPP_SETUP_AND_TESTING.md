# WhatsApp Integration — Setup, Authorisation & Testing

Status: **the code is ready and tested offline.** Going live depends on Meta approval and a few configuration values.

---

## 1. What was added to the project

| File | Purpose |
|---|---|
| `backend/app/services/whatsapp_service.py` | Sends messages (text, buttons, lists, documents), downloads customer files, verifies Meta's signature. Has a **dry-run mode**. |
| `backend/app/services/whatsapp_flow.py` | The **fixed question flow** (German + English) and the **Hot / Warm / Cold scoring table**. No AI. Edit this one file to change wording or scoring. |
| `backend/app/services/whatsapp_handler.py` | Routes each message: founder → commands, customer → lead capture + questions, photo/PDF → OCR. |
| `backend/app/services/whatsapp_store.py` | Database access (leads, sessions, communications) with an in-memory mode for tests. |
| `backend/app/api/v1/endpoints/webhooks.py` | Rewritten webhook: signature check, fast response, background processing, `/whatsapp/status` checklist. |
| `backend/config.py` | New settings (below). |
| `supabase_whatsapp_migration.sql` | One-time database changes. |
| `backend/test_whatsapp.py` | 10 offline tests. |

### Behaviour
- **Customer writes to the business number** → a lead is created (channel `WHATSAPP`) → fixed questions with tap buttons → Hot/Warm/Cold label → the founder gets a WhatsApp alert.
- **Customer sends a photo or PDF of the vehicle papers** → existing OCR reads it → lead fields are filled (make, model, VIN, plate, TÜV…) → the "which vehicle?" question is answered automatically → the founder is notified.
- **Founder** (a number in `WHATSAPP_OWNER_PHONES`) can send: `help`, `leads`, `deals`, `summary`, `customer <name>`, or a photo/PDF to have it read. Voice notes are transcribed and treated as a command, if Whisper is installed. Nobody else can use these commands. A customer typing "deals" is treated as a customer.
- Meta's duplicate deliveries are ignored.

### Not built yet (next phases)
Meeting scheduling by chat, 24-hour reminders, contract sending from chat, and the morning briefing on WhatsApp (the scheduler still sends it by email/Telegram).

---

## 2. Do we need WhatsApp authorisation? How long does it take?

**Yes.** The WhatsApp Business **Cloud API** only works with a Meta-registered business number. There is no way around Meta for a real customer-facing number.

| Step | Who | Typical time |
|---|---|---|
| Create/verify **Meta Business Account** (company documents, website, domain) | Client + you | **2–10 working days** (can be faster, can take longer if documents are rejected) |
| Create a Meta Developer App, add the WhatsApp product | You | 1 hour |
| Register the **business phone number** (needs a voice/SMS OTP). The number must **not already be in use on a normal WhatsApp app**, or it has to be deleted from it first | Client + you | 1 hour – 1 day. *The office landline `+49 8404 9385840` OTP is the known blocker.* |
| Create a **System User permanent access token** | You | 30 min |
| **Display name approval** | Meta | 1–3 days |
| **Message templates** (alerts, first message to a customer outside 24h) approval | Meta | Minutes to 1–2 days each |
| Webhook set-up and test with the code above | You | 1–2 hours |

**Realistic total: about 1–2 weeks**, most of it waiting for Meta. It can be 3–4 weeks if business verification is rejected or the number has problems.

### Can we test before approval?
**Yes.** Meta gives every developer app a **free test number** and lets you add up to 5 recipient phone numbers.
- It needs only a Meta developer account (no business verification) and takes about 1 hour.
- The full flow can be tested on it: questions, buttons, OCR, founder commands.
- Start with this today. The business number is a swap of two config values later.

---

## 3. Configuration (`backend/.env` and Render environment)

```
WHATSAPP_ACCESS_TOKEN=          # System User permanent token (a temporary token expires after 24 h)
WHATSAPP_PHONE_NUMBER_ID=       # From Meta > WhatsApp > API Setup
WHATSAPP_BUSINESS_ACCOUNT_ID=   # From Meta
WHATSAPP_VERIFY_TOKEN=          # Any long random string you invent; same value goes into Meta's webhook form
WHATSAPP_APP_SECRET=            # Meta App > Settings > Basic > App Secret (verifies incoming messages are really from Meta)
WHATSAPP_OWNER_PHONES=          # Founder's number(s), comma separated, e.g. 491701234567
WHATSAPP_DRY_RUN=false          # true = never contact Meta (safe testing)
```

Also run `supabase_whatsapp_migration.sql` once in the Supabase SQL editor.

**Webhook URL to enter in Meta:** `https://car-agents-backend.onrender.com/api/v1/webhooks/whatsapp`
Subscribe to the **`messages`** field.

> Security change: the old code had a hardcoded fallback verify token. It is removed, so `WHATSAPP_VERIFY_TOKEN` **must** be set. In production also set `WHATSAPP_APP_SECRET`, otherwise anyone could send fake messages to the webhook.

---

## 4. What we need to test WhatsApp

### A. Right now, offline (nothing needed)
```
cd backend
python test_whatsapp.py
```
This runs the question flow, scoring, OCR hand-off, founder commands, duplicate handling, and signature check without Meta or the database.

### B. With a Meta test number (about 1 hour of set-up)
You need:
1. A **Facebook account** and a free **Meta for Developers** account.
2. A Meta **app** with the WhatsApp product added (this gives a free test number and temporary token).
3. A **publicly reachable HTTPS URL** for the backend. Use the Render deployment, or a tunnel (e.g. ngrok) when running locally.
4. The values from section 3 filled in. A temporary token is fine for tests.
5. Up to **5 test phone numbers** added as recipients (your phone, the founder's phone).
6. The Supabase migration applied.

Then test:

| # | Test | Expected |
|---|---|---|
| 1 | Message the test number: "Hallo, ich suche einen Audi" | Greeting, consent line, urgency buttons |
| 2 | Tap Urgent → This week → a budget | Thank-you message; founder number receives a 🔥 HOT alert |
| 3 | Check the portal **Leads** page | New lead, channel WhatsApp, label Hot |
| 4 | Message "Ich möchte verkaufen", tap an option, send a **photo of a Fahrzeugschein** | Lead fields filled, price question follows, founder alerted |
| 5 | From the founder phone send `leads`, `deals`, `summary`, `customer <name>` | Correct replies |
| 6 | From a different phone send `deals` | Treated as a customer, no CRM data returned |
| 7 | Type free text instead of tapping | The same question is repeated |
| 8 | Send a message in English | English flow |
| 9 | Restart the backend mid-conversation and reply | Conversation continues (needs the `whatsapp_sessions` table) |
| 10 | Open `/api/v1/webhooks/whatsapp/status` | All values show `true` |

### C. Before the client goes live
- Business verification approved; real business number registered.
- Permanent access token (not the 24-hour test one).
- `WHATSAPP_APP_SECRET` and `WHATSAPP_OWNER_PHONES` set on Render.
- Templates approved for any message the system sends **first** (see below).
- Client has approved the question wording and the Hot/Warm/Cold rules.
- A privacy/consent note is acceptable for the client (the first message includes a consent line).

---

## 5. Important WhatsApp rules to plan around

- **24-hour window:** free-form messages and buttons can only be sent within 24 hours of the person's last message. Outside it, Meta requires an **approved template**.
  - **Customers:** fine, because they write first and the questions follow immediately.
  - **Founder alerts:** the founder must have messaged the number within 24 hours, otherwise alerts need a template. The simple fix is to have the founder send "hi" or `summary` each morning, or to approve one alert template. This is the main item to settle with the client.
- **Costs:** Meta charges per conversation. Customer-initiated conversations are cheap or free within the service window, and business-initiated template messages cost a few cents each. Confirm current pricing with Meta.
- **Number use:** a number on the Cloud API can't be used in the normal WhatsApp app at the same time.
- **Buttons:** at most 3 reply buttons, otherwise a list is used (already handled). Button titles are 20 characters max.

---

## 6. More ways WhatsApp can make life easier for the client

Ranked by effort (easiest first):

1. **Morning briefing on WhatsApp** — appointments, new leads, stale deals (the scheduler already builds it).
2. **Quick reply buttons on alerts** — "Call back", "Convert to deal", "Ignore" on every Hot-lead alert.
3. **Auto-reply outside office hours** — "We'll answer on Monday at 9" so no lead feels ignored.
4. **Log time and expenses by message** — "2h on Audi", or send a receipt photo; OCR attaches it to the deal.
5. **Meeting booking by chat** — "Meeting Müller Friday 3pm" with the existing travel-buffer check, and an automatic reminder to the customer the day before.
6. **Send contracts from chat** — "send Kaufvertrag to Müller" produces the PDF and sends it on WhatsApp for signature.
7. **Missing-document chaser** — the OCR already knows which fields are missing; the bot asks the customer for exactly those.
8. **Follow-up nudges** — a gentle reminder to Hot leads that nobody has contacted after 24 hours.
9. **Customer status updates** — when a deal moves stage, the customer gets one line ("Your car is now in inspection").
10. **Share a vehicle** — send a link or photos of a listed car in answer to an enquiry.

Items 1–3 are the best value for the effort.
