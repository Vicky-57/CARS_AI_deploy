"""
car_agents_crm/tasks/executive_briefing.py
─────────────────────────────────────────────────────────────────────────────
W5 — Daily & Weekly Executive Briefing

Runs via Frappe scheduler:
  - Daily at 07:00 CET → sends daily briefing
  - Weekly Sunday 15:00 CET → sends weekly briefing

Delivers summary via WhatsApp and Email to the founder.
─────────────────────────────────────────────────────────────────────────────
"""

import frappe
from frappe.utils import add_days, today, now_datetime
from car_agents_crm.utils.whatsapp import send_whatsapp_message
from car_agents_crm.api import get_pipeline_summary


def send_daily_briefing():
    """Sends a concise daily briefing to the founder via WhatsApp + Email."""
    summary = get_pipeline_summary()
    recipient_wa = frappe.conf.get("briefing_whatsapp_recipient")
    recipient_email = frappe.conf.get("briefing_email_recipient", "info@car-agents.de")

    inactive_list = "\n".join([
        f"  • {d['name']} — {d['lead_name']} ({d['custom_pipeline_type'].upper()})"
        for d in summary.get("inactive_deals", [])
    ]) or "  None ✅"

    message = (
        f"📋 *CAR-AGENTS Daily Briefing* — {summary['summary_date']}\n\n"
        f"🆕 New Leads (24h): *{summary['new_leads_24h']}*\n"
        f"🚗 Active SELL Deals: *{summary['active_sell_deals']}*\n"
        f"🔍 Active BUY Deals: *{summary['active_buy_deals']}*\n"
        f"📄 Pending OCR Documents: *{summary['pending_ocr_documents']}*\n\n"
        f"⚠️ Inactive Deals:\n{inactive_list}"
    )

    if recipient_wa:
        send_whatsapp_message(recipient_wa, message)

    if recipient_email:
        frappe.sendmail(
            recipients=[recipient_email],
            subject=f"CAR-AGENTS Daily Briefing — {summary['summary_date']}",
            message=message.replace("*", "<b>").replace("\n", "<br>"),
        )


def send_weekly_briefing():
    """Sends a detailed weekly summary covering the past 7 days."""
    from frappe.utils import add_days
    week_ago = add_days(today(), -7)

    new_leads_week = frappe.db.count("CRM Lead", {"creation": [">", week_ago]})
    won_deals = frappe.db.count("CRM Deal", {
        "status": "Won",
        "modified": [">", week_ago]
    })
    lost_deals = frappe.db.count("CRM Deal", {
        "status": "Lost",
        "modified": [">", week_ago]
    })

    recipient_wa = frappe.conf.get("briefing_whatsapp_recipient")
    recipient_email = frappe.conf.get("briefing_email_recipient", "info@car-agents.de")

    message = (
        f"📊 *CAR-AGENTS Weekly Summary*\n"
        f"Week ending {today()}\n\n"
        f"🆕 New Leads This Week: *{new_leads_week}*\n"
        f"✅ Deals Won: *{won_deals}*\n"
        f"❌ Deals Lost: *{lost_deals}*\n\n"
        f"Have a great week! 🚗"
    )

    if recipient_wa:
        send_whatsapp_message(recipient_wa, message)

    if recipient_email:
        frappe.sendmail(
            recipients=[recipient_email],
            subject=f"CAR-AGENTS Weekly Summary — {today()}",
            message=message.replace("*", "<b>").replace("\n", "<br>"),
        )
