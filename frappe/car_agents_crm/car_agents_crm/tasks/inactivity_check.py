"""
car_agents_crm/tasks/inactivity_check.py
─────────────────────────────────────────────────────────────────────────────
W6 — Deal Inactivity & Follow-up Override Monitor

Runs daily via Frappe scheduler.
Checks both BUY and SELL pipeline deals for inactivity > 24 hours.
Respects custom_followup_target_date override to pause reminders.
─────────────────────────────────────────────────────────────────────────────
"""

import frappe
from frappe.utils import add_days, today, getdate
from car_agents_crm.utils.whatsapp import send_whatsapp_message


def run_inactivity_check():
    """
    Scheduled task: fires daily.
    Identifies CRM Deals with no activity in the last 24 hours,
    and sends a WhatsApp follow-up alert for each — up to 3 reminders total.
    Skips deals where custom_followup_target_date is in the future.
    """
    cutoff = add_days(today(), -1)
    today_date = getdate(today())

    inactive_deals = frappe.db.get_all(
        "CRM Deal",
        filters={
            "modified": ["<", cutoff],
            "status": ["not in", ["Won", "Lost", "Junk"]],
        },
        fields=[
            "name", "lead_name", "custom_pipeline_type",
            "custom_followup_target_date", "custom_followup_count",
            "custom_client_phone", "modified"
        ]
    )

    recipient = frappe.conf.get("briefing_whatsapp_recipient")

    for deal in inactive_deals:
        # ── Skip if follow-up override date is in the future ────────────────
        if deal.custom_followup_target_date:
            if getdate(deal.custom_followup_target_date) > today_date:
                continue

        # ── Skip if already sent 3 reminders ────────────────────────────────
        followup_count = deal.custom_followup_count or 0
        if followup_count >= 3:
            continue

        # ── Build alert message ──────────────────────────────────────────────
        pipeline_label = "SELL (Vermittlung)" if deal.custom_pipeline_type == "sell" else "BUY (Beschaffung)"
        message = (
            f"⚠️ *CAR-AGENTS Deal Inactivity Alert*\n\n"
            f"Deal: *{deal.name}*\n"
            f"Client: {deal.lead_name}\n"
            f"Pipeline: {pipeline_label}\n"
            f"Last Activity: {deal.modified}\n"
            f"Follow-up #{followup_count + 1} of 3\n\n"
            f"Please action this deal or set a follow-up date."
        )

        # Send alert to founder WhatsApp
        if recipient:
            send_whatsapp_message(recipient, message)

        # Increment the follow-up counter on the deal
        frappe.db.set_value(
            "CRM Deal", deal.name,
            "custom_followup_count", followup_count + 1
        )

    frappe.db.commit()
