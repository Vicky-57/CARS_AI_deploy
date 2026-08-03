"""
car_agents_crm/utils/whatsapp.py
─────────────────────────────────────────────────────────────────────────────
WhatsApp Cloud API utility for sending messages from Frappe CRM.
Used for: contract delivery, meeting reminders, deal inactivity alerts.
─────────────────────────────────────────────────────────────────────────────
"""

import frappe
import requests


def send_whatsapp_message(to_number: str, message: str, media_url: str = None) -> dict:
    """
    Sends a WhatsApp message via Meta Cloud API.

    Args:
        to_number:  Recipient phone number in E.164 format (e.g. +491234567890)
        message:    Text message body
        media_url:  Optional public URL of a PDF/image to send as document

    Returns:
        dict: Meta API response
    """
    token = frappe.conf.get("whatsapp_access_token") or \
            frappe.db.get_single_value("Car Agents Settings", "whatsapp_access_token")
    phone_id = frappe.conf.get("whatsapp_phone_number_id") or \
               frappe.db.get_single_value("Car Agents Settings", "whatsapp_phone_number_id")

    if not token or not phone_id:
        frappe.log_error("WhatsApp credentials not configured", "WhatsApp Send Error")
        return {"error": "WhatsApp credentials not configured"}

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    if media_url:
        # Send as document with caption
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "document",
            "document": {
                "link": media_url,
                "caption": message,
                "filename": "CAR-AGENTS_Contract.pdf"
            }
        }
    else:
        # Send plain text message
        payload = {
            "messaging_product": "whatsapp",
            "to": to_number,
            "type": "text",
            "text": {"body": message}
        }

    try:
        response = requests.post(
            f"https://graph.facebook.com/v19.0/{phone_id}/messages",
            headers=headers,
            json=payload,
            timeout=30
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        frappe.log_error(str(e), "WhatsApp Send Error")
        return {"error": str(e)}
