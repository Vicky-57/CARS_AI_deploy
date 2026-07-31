# CAR-AGENTS — AI Operations System: New Scope & Feature Enhancements Document

**Document Version:** v3.0 — Comprehensive Scope Upgrade  
**Prepared For:** Senior Leadership & Stakeholders  
**Project:** CAR-AGENTS AI Operations & Brokerage Management System  

---

## 1. Executive Summary & Business Context

CAR-AGENTS is a founder-led premium **automotive brokerage** in Germany. Unlike traditional car dealerships that buy and hold vehicle inventory, CAR-AGENTS acts as a specialized broker operating across two distinct client lifecycles:
1. **Sell Side (Vermittlung):** Selling a client's vehicle on their behalf.
2. **Buy Side (Beschaffung):** Locating, inspecting, negotiating, and purchasing a target vehicle on a buyer's behalf.

This document outlines the expanded scope required to transform the system from basic communication logging and text summaries into a complete **Automated Brokerage Operations Engine & Founder Portal**.

---

## 2. Core New Scope Requirements & Architectural Modules

### 2.1 Dual Pipeline Lifecycle Engine (Buy vs. Sell Intent)

The system must manage two distinct deal structures, each with its own sequential milestones and document requirements:

```
+-----------------------------------------------------------------------------------+
|                            CAR-AGENTS DUAL PIPELINES                              |
+-----------------------------------------------------------------------------------+
                                          |
     +------------------------------------+-----------------------------------+
     |                                                                        |
[ SELL SIDE: Vermittlung (Vehicle Sale) ]            [ BUY SIDE: Beschaffung (Vehicle Procurement) ]
 1. Lead Capture & Intent Identification               1. Buyer Requirement Capture (e.g. BMW 320i)
 2. Onboarding & Contract signing                     2. Procurement Contract & Power of Attorney
 3. Vehicle Document OCR & Spec Extraction             3. Car Sourcing & Market Research
 4. Marketing, Presentation & Listing                 4. Vehicle Inspection & Technical Check
 5. Buyer Inquiry & Test Drive Management              5. Price Negotiation & Contract Pre-filling
 6. Sales Closing & Handover                          6. Vehicle Delivery & Final Payout
 (Ends when vehicle is successfully sold)             (Ends when vehicle is acquired for buyer)
```

* **Automated Intent Classification:** Inbound leads from Email (W1) and WhatsApp (W2) are automatically categorized as `BUY_INTENT` or `SELL_INTENT` and routed to the appropriate project pipeline.

---

### 2.2 OCR Form Pre-Filling & 1-Click Contract Generation

* **From Text Summaries to Interactive Form Pre-filling:** Currently, OCR generates a basic text summary. Under the new scope, when vehicle documents (Fahrzeugschein Part 1 & 2, TÜV report, service records) are scanned, the OCR engine extracts exact fields directly into an **interactive web form**.
* **Extracted Fields Include:**
  * Vehicle Specs: VIN (17-digit), Manufacturer, Model, Initial Registration (`Erstzulassung`), License Plate (`Kennzeichen`), Engine Power (kW/PS), Displacement (ccm), TÜV Expiry Date, Document ZB II Number.
  * Client Details: Name, Address, Phone, Email, ID Number.
* **1-Click PDF Contract Pre-filling:** The verified form data automatically populates double-brace placeholders (`{{vin}}`, `{{mileage}}`, `{{price_limit}}`) across official PDF templates:
  * [CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf](file:///d:/CARS%20AI/client_data/CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf) *(Sell Side Contract)*
  * [CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf](file:///d:/CARS%20AI/client_data/CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf) *(Buy Side Contract)*
  * [Kaufvertrag-C2C-Bilingual.pdf](file:///d:/CARS%20AI/client_data/Kaufvertrag-C2C-Bilingual.pdf) *(Bilingual Sales Contract)*

---

### 2.3 Expense, Time Tracking & Net Profit Calculator

Brokers incur expenses and invest manual time during vehicle procurement or sales. The system will provide itemized financial tracking and an automated profit calculator:

* **Itemized Expense Logging:** Allows uploading/logging payment slips, oil changes, detailing costs, TÜV inspection fees, transport/towing, and administrative expenses per project.
* **Broker Labor Time Tracking:** Log manual hours spent on a project (e.g. 4.5 hours).
  * **Labor Rate:** Defaults to **€20/hour**, but remains fully **editable per project**.
* **Financial Profit Formula:**
  $$\text{Total Expenses} = \sum \text{Receipt Amounts}$$
  $$\text{Labor Cost} = \text{Labor Hours} \times \text{Hourly Rate (Default €20/h)}$$
  $$\text{Total Project Investment} = \text{Vehicle Purchase Price} + \text{Total Expenses} + \text{Labor Cost}$$
  $$\text{Net Broker Profit} = \text{Agreed Final Sale Price} - \text{Total Project Investment} - \text{Third-party Fees}$$

---

### 2.4 Calendar Sync & Meeting Conflict Prevention

* **Dual Calendar Synchronization:** Full bi-directional integration with **Google Calendar** and **Microsoft Outlook**.
* **Onsite / Offline Meeting Conflict Guard:** Prevents double-booking by checking existing appointments (including a 30-minute travel buffer for offline/onsite meetings) before confirming a new booking.
* **Instant WhatsApp Notifications:** Sends automated meeting reminders and schedule digests directly to the broker's WhatsApp via Meta Cloud API.

---

### 2.5 Recommended Architecture: Custom CAR-AGENTS Portal vs. HubSpot

| Evaluation Metric | HubSpot Free CRM | Dedicated CAR-AGENTS Operations Portal | Recommended Choice |
| :--- | :--- | :--- | :--- |
| **Dual Buy/Sell Pipelines** | Basic deal stages only | Custom step-by-step sub-project checklists | **Custom Portal** |
| **OCR Document Form-Filling** | Not supported | Integrated 1-click form pre-filling & PDF generation | **Custom Portal** |
| **Financial & Labor Profit Calculator** | Requires Enterprise custom formulas | Built-in real-time formula calculator | **Custom Portal** |
| **Meeting Conflict Guard** | Basic calendar view | Real-time offline travel buffer & overlap detection | **Custom Portal** |
| **Contact Store & Email Logging** | Excellent | Lightweight sync with HubSpot | **HubSpot (Synced)** |

**Strategic Recommendation:** Use a **Custom CAR-AGENTS Founder Operations Portal** (web app powered by FastAPI & Supabase) as the primary daily workspace, maintaining background contact synchronization with HubSpot CRM.

---

## 3. Workflow Audit & Adjustments (W1 – W6)

| Workflow | Status | Required Scope Adjustment |
| :--- | :--- | :--- |
| **W1 — Email Logger** | **Keep & Upgrade** | Add AI Intent Classifier (`BUY_INTENT` vs `SELL_INTENT`). |
| **W2 — WhatsApp Logger** | **Keep & Upgrade** | Add Intent Classifier & automated appointment scheduling parser. |
| **W3 — Document Generator & OCR** | **Upgrade Core** | Transition from text summary to **Interactive Form Pre-Filling & PDF Contract Generation**. |
| **W4 — Voice Transcriber** | **Keep** | Continues transcribing meeting audio & auto-creating CRM tasks. |
| **W5 — Executive Daily Briefing** | **Keep & Upgrade** | Add **Today's Bookings Digest** (Google/Outlook calendar meetings) & document checklists. |
| **W6 — Deal Inactivity** | **Keep & Upgrade** | Monitor inactive deals across both Buy and Sell project pipelines. |

---

## 4. Summary of Key Decisions

1. **Labor Rate Standard:** Default is **€20/hour**, but editable on a per-project basis.
2. **Calendar Integration:** Bi-directional sync with **Google Calendar** & **Outlook**, coupled with **WhatsApp instant notifications** for the broker.
3. **Primary Operating Hub:** Dedicated CAR-AGENTS Founder Portal with 1-click OCR form pre-filling, profit calculator, and calendar conflict protection.
