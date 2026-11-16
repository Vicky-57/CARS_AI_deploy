# Frontend Work — WhatsApp-First Plan

> **Purpose:** What the frontend needs to change to support the WhatsApp-First plan.
> The portal becomes a back-office view — work is minimal (badges, filters, one new tab).

---

## 1. Sidebar — Hide Unused Pages

**File:** `frontend/src/App.jsx` → `NAV` array (lines 25–48)

| Page | Action |
|---|---|
| Dashboard | ✅ Keep |
| Leads | ✅ Keep |
| Deals & Projects | ✅ Keep |
| Documentation / Contracts | ✅ Keep |
| Calendar | ✅ Keep |
| Customers | ❌ Hide |
| Communications | ❌ Hide (WhatsApp replaces this) |

**What to do:** Remove `Customers` and `Communications` entries from the `NAV` array and their `<Route>` entries in `AppRoutes`.

---

## 2. Leads Page — New Badges & Filters

**File:** `frontend/src/pages/Leads.jsx`

The plan adds two new fields to every lead that the backend will populate:

| New Field | Backend Key | Values |
|---|---|---|
| Qualification label | `label` | 🔥 Hot / 🟡 Warm / ❄️ Cold |
| Lead source | `source` | `WhatsApp` / `Email` / `Manual` |

### 2.1 — Add label badge to each lead row
Show next to or instead of the existing status badge:

```
🔥 Hot     ← red badge
🟡 Warm    ← yellow badge
❄️ Cold    ← gray/blue badge
```

### 2.2 — Add source badge to each lead row
```
💬 WhatsApp   ← green badge
📧 Email      ← blue badge
✍️ Manual     ← gray badge
```

### 2.3 — Add filter dropdown for label
Add a **"Label"** dropdown next to existing filters:
- Options: All · Hot · Warm · Cold
- Filters the lead list client-side (or passes as a query param)

### 2.4 — Default sort
Hot leads sorted to the top by default.

---

## 3. Lead Detail Panel — Label & Source in Overview

**File:** `frontend/src/components/LeadDetailPanel.jsx`

Inside the existing **"Lead Details"** section (around line 174–184), add two new `<Field>` entries:

```jsx
<Field label="Label"  value={lead.label || '—'} />   // 🔥 Hot / 🟡 Warm / ❄️ Cold
<Field label="Source" value={lead.source || lead.channel || 'Manual'} />
```

Also add:
- **"Alert sent"** — whether the founder was notified on WhatsApp for this lead (`lead.founder_alerted_at`)

---

## 4. Lead Detail Panel — New "Qualification" Tab

**File:** `frontend/src/components/LeadDetailPanel.jsx`

Currently has 2 tabs: `Overview | Activity`

### Add a third tab:

```
Overview | Qualification | Activity
```

### Qualification tab content:

```
┌─────────────────────────────────────────┐
│  🎯 Qualification Answers               │
│                                         │
│  Q1. What best describes you?           │
│  → I want to buy soon                   │
│                                         │
│  Q2. When do you want to buy?           │
│  → Within a month                       │
│                                         │
│  Q3. What is your budget?               │
│  → €20–50k                              │
│                                         │
│  Label:   🔥 Hot                        │
│  Reason:  Buy soon + budget provided    │
│  Last reply: 2 hours ago                │
│  Reminder sent: No                      │
└─────────────────────────────────────────┘
```

**Data source:** Read from `lead.qualification_answers` (array of `{ question, answer }`) and `lead.label`, `lead.label_reason`, `lead.reminder_sent_at`.

**Empty state:** If no data yet → show:
> *"No qualification responses yet. The customer will be asked when they message the WhatsApp number."*

---

## 5. Dashboard — WhatsApp Status Card *(Phase 4 / Optional)*

**File:** `frontend/src/pages/Dashboard.jsx`

A small status card:

```
┌──────────────────────────────┐
│  💬 WhatsApp                 │
│  🟢 Connected                │
│                              │
│  Today's briefing   ✅ Sent  │
│  Hot leads (no reply)   3    │
└──────────────────────────────┘
```

**Data source:** New API endpoint `/api/whatsapp/status` (backend provides this).

---

## Priority Order

| Priority | Task | File | Effort |
|---|---|---|---|
| 🔴 **1** | Add Hot/Warm/Cold badge to leads table | `Leads.jsx` | Tiny |
| 🔴 **2** | Add Source (WhatsApp/Email) badge to leads table | `Leads.jsx` | Tiny |
| 🔴 **3** | Add Label filter dropdown to leads filter bar | `Leads.jsx` | Small |
| 🟡 **4** | Show label + source in Lead Detail overview tab | `LeadDetailPanel.jsx` | Small |
| 🟡 **5** | Add Qualification tab to Lead Detail Panel | `LeadDetailPanel.jsx` | Medium |
| 🟢 **6** | Hide Customers + Communications from sidebar | `App.jsx` | 2 lines |
| ⚪ **7** | WhatsApp status widget on Dashboard | `Dashboard.jsx` | Medium |

---

## Key Notes

- Items 1–6 are **pure display changes** — just reading new fields the backend populates.
- **No new API endpoints** needed from the frontend side for items 1–6; just handle `label`, `source`, `qualification_answers` on the existing lead object.
- Item 7 (Dashboard widget) needs a new backend endpoint.
- Keep all existing pages functional — only the sidebar hides them, routes still work via direct URL.

---

## New Fields Expected from Backend (on lead objects)

| Field | Type | Description |
|---|---|---|
| `label` | `string` | `"Hot"` / `"Warm"` / `"Cold"` |
| `label_reason` | `string` | Human-readable reason for the label |
| `source` | `string` | `"WhatsApp"` / `"Email"` / `"Manual"` |
| `qualification_answers` | `array` | `[{ question: string, answer: string }]` |
| `founder_alerted_at` | `ISO timestamp` | When the founder was last notified |
| `reminder_sent_at` | `ISO timestamp` | When the 24hr reminder was sent |

