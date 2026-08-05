"""
app/services/email_service.py
────────────────────────────────────────────────────────────────────────
Inbound Gmail / IMAP Listener & Email Sender Service (W1)

Functions:
  1. poll_inbound_emails() — Checks Gmail / IMAP inbox for primary emails,
     filters out bulk/newsletters, runs Claude AI intent classification, and saves into Supabase.
  2. send_email_briefing() — Sends email briefings via SMTP.
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
    Polls Gmail/IMAP inbox for unseen primary emails.
    Processes lead intent via Claude and logs into Supabase.
    """
    imap_server = getattr(settings, "IMAP_SERVER", "imap.gmail.com")
    email_user = getattr(settings, "EMAIL_USER", "") or settings.BRIEFING_EMAIL_RECIPIENT
    email_pass = getattr(settings, "EMAIL_PASSWORD", "") or os.getenv("EMAIL_PASSWORD", "")

    if not email_pass or not email_user:
        logger.debug("IMAP EMAIL_USER or EMAIL_PASSWORD not set. Skipping IMAP poll.")
        return

    try:
        # Run blocking IMAP operations in thread pool
        await asyncio.get_event_loop().run_in_executor(
            None, _process_imap_inbox, imap_server, email_user, email_pass
        )
    except Exception as e:
        logger.error(f"IMAP Email Polling error: {str(e)}")


def _process_imap_inbox(server, user, password):
    """Synchronous IMAP connection and processing with Primary filtering."""
    try:
        mail = imaplib.IMAP4_SSL(server, getattr(settings, "IMAP_PORT", 993))
        mail.login(user, password)
        mail.select("INBOX")

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

            sender = msg.get("From", "")
            precedence = msg.get("Precedence", "").lower()
            list_id = msg.get("List-Unsubscribe", "")

            # FILTER: Skip automated newsletters, bulk marketing, or noreply addresses
            if "noreply" in sender.lower() or precedence in ["bulk", "junk", "list"] or list_id:
                logger.info(f"Skipped automated/newsletter email from: {sender}")
                continue

            subject_header = decode_header(msg.get("Subject", ""))[0]
            subject = subject_header[0]
            if isinstance(subject, bytes):
                subject = subject.decode(subject_header[1] or "utf-8", errors="ignore")

            body = ""
            if msg.is_multipart():
                for part in msg.walk():
                    if part.get_content_type() == "text/plain":
                        body = part.get_payload(decode=True).decode("utf-8", errors="ignore")
                        break
            else:
                body = msg.get_payload(decode=True).decode("utf-8", errors="ignore")

            logger.info(f"New Primary Inbound Email from {sender}: {subject}")

            # Process lead asynchronously via event loop
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.create_task(_process_email_lead(sender, subject, body))
                else:
                    loop.run_until_complete(_process_email_lead(sender, subject, body))
            except Exception as ex:
                logger.error(f"Error executing email lead processor: {str(ex)}")

        mail.logout()
    except Exception as e:
        logger.error(f"IMAP fetch error: {str(e)}")


async def _process_email_lead(sender: str, subject: str, body: str):
    """Processes extracted email lead with 2-stage AI filtering, deduplication & repeat customer detection."""
    from app.services.claude_service import is_car_related_subject, summarize_email

    # Stage 1: Quick Subject Pre-filter check
    is_car_subject = is_car_related_subject(subject)
    
    clean_sender_email = sender.split("<")[-1].replace(">", "").strip() if "<" in sender else sender
    sender_name = sender.split("<")[0].strip().strip('"') if "<" in sender else sender

    existing_leads = get_all_leads()
    sender_leads = [l for l in existing_leads if l.get("email") == clean_sender_email]
    
    # Active lead check
    active_lead = next((l for l in sender_leads if l.get("status") in ["NEW", "CONTACTED", "QUALIFIED", "IN_PROGRESS"]), None)
    closed_lead = next((l for l in sender_leads if l.get("status") in ["CLOSED_WON", "CLOSED_LOST", "COMPLETED", "ARCHIVED"]), None)

    # If not a car subject AND not an existing active client follow-up, skip LLM
    if not is_car_subject and not active_lead and not closed_lead:
        logger.info(f"Skipping non-car email subject: '{subject}' from {sender}")
        return

    # Stage 2: Claude AI Deep Analysis
    res = await summarize_email(subject, body)
    if not res.get("is_valid_lead", True) and not active_lead:
        logger.info(f"Email content classified as non-lead inquiry. Skipping lead creation for: {subject}")
        return

    intent = res.get("intent", "UNKNOWN")
    summary = res.get("summary", "")
    lead_id = None
    is_repeat = False

    if active_lead:
        # CASE A: Active lead exists — DO NOT duplicate lead. Update activity & notes.
        lead_id = active_lead.get("id")
        existing_notes = active_lead.get("notes", "") or ""
        new_note = f"\n✨ Follow-up Message [{datetime.utcnow().strftime('%m-%d %H:%M')}]: {summary}"
        
        from app.services.supabase_service import update_lead
        update_lead(lead_id, {
            "notes": (existing_notes + new_note)[:1500],
            "status": active_lead.get("status", "NEW")
        })
        logger.info(f"Logged follow-up email to active lead ID {lead_id} for {clean_sender_email}")
    elif closed_lead:
        # CASE B: Closed past customer writing again — REPEAT CUSTOMER!
        is_repeat = True
        new_lead = create_lead({
            "name": sender_name,
            "email": clean_sender_email,
            "channel": "EMAIL",
            "intent": "SELL" if intent == "SELL_INTENT" else "BUY" if intent == "BUY_INTENT" else "UNKNOWN",
            "status": "NEW",
            "message": f"Subject: {subject}\n\n{body}",
            "notes": f"💜 REPEAT CLIENT (Past deal closed). New Inquiry: {summary}"
        })
        lead_id = new_lead.get("id")
        logger.info(f"Created REPEAT CLIENT lead ID {lead_id} for {clean_sender_email}")
    else:
        # CASE C: Completely new client lead
        new_lead = create_lead({
            "name": sender_name,
            "email": clean_sender_email,
            "channel": "EMAIL",
            "intent": "SELL" if intent == "SELL_INTENT" else "BUY" if intent == "BUY_INTENT" else "UNKNOWN",
            "status": "NEW",
            "message": f"Subject: {subject}\n\n{body}",
            "notes": f"AI Summary: {summary}"
        })
        lead_id = new_lead.get("id")
        logger.info(f"Created NEW lead ID {lead_id} for {clean_sender_email}")

    # Save to communications history
    save_communication({
        "lead_id": lead_id,
        "channel": "EMAIL",
        "sender_name": sender_name,
        "sender_contact": clean_sender_email,
        "subject": subject,
        "body": body,
        "is_inbound": True,
        "intent": intent,
        "ai_summary": summary
    })


def send_email_briefing(to_email: str, subject: str, html_content: str):
    """Sends HTML email briefing via SMTP."""
    smtp_server = getattr(settings, "SMTP_SERVER", "smtp.gmail.com")
    smtp_port = getattr(settings, "SMTP_PORT", 465)
    smtp_user = getattr(settings, "EMAIL_USER", "") or settings.BRIEFING_EMAIL_RECIPIENT
    smtp_pass = getattr(settings, "EMAIL_PASSWORD", "") or os.getenv("EMAIL_PASSWORD", "")

    if not smtp_pass or not smtp_user:
        logger.warning("SMTP EMAIL_USER or EMAIL_PASSWORD not configured. Email briefing skipped.")
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
