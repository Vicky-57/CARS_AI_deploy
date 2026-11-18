# Supabase Fields Mapping Cheatsheet

Use this reference to configure the **Fields to Send** section in n8n's Supabase nodes across all 6 workflows. 

> [!IMPORTANT]
> When adding these expressions inside n8n's default **Fixed/String** input fields, start directly with the double curly braces `{{` (do **not** prepend a leading `=` sign outside the braces). If you use the **Expression Editor** tab, paste the javascript code *inside* the braces directly.

---

## 📧 W1 — Email Logger
*   **Table ID / Name:** `communications_log`
*   **Mappings:**

| Field Name / Column | Field Value (Expression) |
| :--- | :--- |
| **`channel`** | `email` *(fixed string)* |
| **`sender_identifier`** | `{{ $json.email }}` |
| **`sender_name`** | `{{ $json.senderName }}` |
| **`subject`** | `{{ $json.subject }}` |
| **`message_body`** | `{{ $json.bodyText }}` |
| **`message_id`** | `{{ $json.messageId }}` |

---

## 📱 W2 — WhatsApp Logger
*   **Table ID / Name:** `communications_log`
*   **Mappings:**

| Field Name / Column | Field Value (Expression) |
| :--- | :--- |
| **`channel`** | `whatsapp` *(fixed string)* |
| **`sender_identifier`** | `{{ $json.phone }}` |
| **`sender_name`** | `{{ $json.senderName }}` |
| **`message_body`** | `{{ $json.messageText }}` |
| **`message_id`** | `{{ $json.messageId }}` |

---

## 📄 W3 — Document Generator (OCR)
*   **Table ID / Name:** `ocr_cache`
*   **Mappings:**

| Field Name / Column | Field Value (Expression) |
| :--- | :--- |
| **`vin`** | `{{ $json.vin || 'UNKNOWN_' + Math.random().toString(36).substring(2, 9).toUpperCase() }}` |
| **`manufacturer`** | `{{ $json.manufacturer }}` |
| **`model`** | `{{ $json.model }}` |
| **`mileage`** | `{{ $json.mileage || null }}` |
| **`initial_registration`** | `{{ $json.initial_registration || null }}` |
| **`color`** | `{{ $json.color }}` |

---

## 🎙️ W4 — Voice Transcriber (Whisper)
*   **Table ID / Name:** `voice_transcripts`
*   **Mappings:**

| Field Name / Column | Field Value (Expression) |
| :--- | :--- |
| **`message_id`** | `{{ $('Code — Extract Transcript').first().json.messageId || 'VOICE_' + Math.random().toString(36).substring(2, 9).toUpperCase() }}` |
| **`sender_phone`** | `{{ $json.phone }}` |
| **`raw_transcript`** | `{{ $('Code — Extract Transcript').first().json.transcript }}` |
| **`summary`** | `{{ $json.noteBody }}` |

---

## 🗓️ W5 — Daily Briefing
*   **Table ID / Name:** `briefings_archive`
*   **Mappings:**

| Field Name / Column | Field Value (Expression) |
| :--- | :--- |
| **`brief_type`** | `{{ $json.subject.includes('Weekly') ? 'weekly' : 'daily' }}` |
| **`new_leads_count`** | `{{ $json.counts.contacts }}` |
| **`overdue_tasks_count`** | `{{ $json.counts.tasks }}` |
| **`silent_deals_count`** | `{{ $json.counts.deals }}` |
| **`generated_text`** | `{{ $json.htmlBody }}` |

---

## ⚠️ W6 — Deal Inactivity Check
*   **Table ID / Name:** `inactivity_alerts`
*   **Mappings:**

| Field Name / Column | Field Value (Expression) |
| :--- | :--- |
| **`deal_id`** | `{{ $json.dealId }}` |
| **`deal_name`** | `{{ $json.dealName }}` |
| **`ai_suggested_action`** | `{{ $json.suggestion }}` |
| **`escalation_level`** | `{{ parseInt($json.followupCount || 0) + 1 }}` |
