"""
app/services/email_service.py
────────────────────────────────────────────────────────────────────────
Inbound Email IMAP Listener & Email Sender Service (W1)

Functions:
  1. poll_inbound_emails() — Checks Strato IMAP inbox for info@car-agents.de,
     parses new emails, runs Claude AI intent classification, and saves into Supabase.
  2. send_email() — Sends email briefings via SMTP.
────────────────────────────────────────────────────────────────────────
"""
import os
import imaplib
import email
from email.header import decode_header
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import asyncio
from config import settings
from app.services.claude_service import summarize_email
from app.services.supabase_service import save_communication, create_lead, get_all_leads

logger = logging.getLogger("email_service")


async def poll_inbound_emails():
    """
    Polls Strato IMAP inbox (info@car-agents.de) for unseen emails.
    Processes lead intent via Claude and logs into Supabase.
    """
    imap_server = os.getenv("IMAP_SERVER", "imap.strato.de")
    email_user = settings.BRIEFING_EMAIL_RECIPIENT or "info@car-agents.de"
    email_pass = os.getenv("EMAIL_PASSWORD", "")

    if not email_pass:
        logger.debug("IMAP EMAIL_PASSWORD not set. Skipping IMAP poll.")
        return

    try:
        # Run blocking IMAP operations in thread pool
        await asyncio.get_event_loop().run_in_executor(
            None, _process_imap_inbox, imap_server, email_user, email_pass
        )
    except Exception as e:
        logger.error(f"IMAP Email Polling error: {str(e)}")


def _process_imap_inbox(server, user, password):
    """Synchronous IMAP connection and processing."""
    try:
        mail = imaplib.IMAP4_SSL(server)
        mail.login(user, password)
        mail.select("inbox")

        status, messages = mail.search(None, 'UNSEEN')
        if status != "OK" or not messages[0]:
            mail.logout()
            return

        for num in messages[0].split():
            status, data = mail.fetch(num, '(RFC822)')
            if status != "OK":
                continue

            raw_email = data[0][1]
            msg = email.message_from_bytes(raw_email)

            subject, encoding = decode_header(msg["Subject"])[0]
            if isinstance(subject, bytes):
                subject = subject.decode(encoding or "utf-8")

            sender = msg.get("From")
            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        break
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

            logger.info(f"New Inbound Email from {sender}: {subject}")

            # Run Claude email summariser and intent classifier
            asyncio.run(_process_email_lead(sender, subject, body))

        mail.logout()
    except Exception as e:
        logger.error(f"IMAP fetch error: {str(e)}")


async def _process_email_lead(sender: str, subject: str, body: str):
    """Processes extracted email lead and updates Supabase."""
    res = await summarize_email(subject, body)
    intent = res.get("intent", "UNKNOWN")
    summary = res.get("summary", "")

    existing_leads = get_all_leads()
    matched_lead = next((l for l in existing_leads if l.get("email") in sender), None)
    lead_id = matched_lead.get("id") if matched_lead else None

    if not lead_id:
        new_lead = create_lead({
            "name": sender.split("<")[0].strip() if "<" in sender else sender,
            "email": sender.split("<")[-1].replace(">", "").strip() if "<" in sender else sender,
            "channel": "EMAIL",
            "intent": "SELL" if intent == "SELL_INTENT" else "BUY" if intent == "BUY_INTENT" else "UNKNOWN",
            "status": "NEW",
            "message": f"Subject: {subject}\n\n{body[:500]}",
            "notes": f"AI Summary: {summary}"
        })
        lead_id = new_lead.get("id")

    save_communication({
        "lead_id": lead_id,
        "channel": "EMAIL",
        "sender_name": sender,
        "sender_contact": sender,
        "subject": subject,
        "body": body,
        "is_inbound": True,
        "intent": intent,
        "ai_summary": summary
    })


def send_email_briefing(to_email: str, subject: str, html_content: str):
    """Sends HTML email briefing via SMTP."""
    smtp_server = os.getenv("SMTP_SERVER", "smtp.strato.de")
    smtp_port = int(os.getenv("SMTP_PORT", 465))
    smtp_user = settings.BRIEFING_EMAIL_RECIPIENT or "info@car-agents.de"
    smtp_pass = os.getenv("EMAIL_PASSWORD", "")

    if not smtp_pass:
        logger.warning("SMTP EMAIL_PASSWORD not configured. Email briefing skipped.")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = smtp_user
        msg["To"] = to_email

        part = MIMEText(html_content, "html")
        msg.attach(part)

        with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, [to_email], msg.as_string())
        logger.info(f"Email briefing sent to {to_email}")
    except Exception as e:
        logger.error(f"Failed to send email briefing to {to_email}: {str(e)}")
