"""
app/services/scheduler_service.py
────────────────────────────────────────────────────────────────────────
APScheduler Background Automation & Cron Scheduler Engine

Runs:
  1. W1 Email IMAP Polling — Every 5 minutes
  2. W5 Executive Daily Briefing — Daily at 07:00 CET
  3. W5 Executive Weekly Summary — Every Sunday at 15:00 CET
  4. W6 Deal Inactivity Monitor — Daily check
────────────────────────────────────────────────────────────────────────
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
import asyncio
import logging
from config import settings
from app.services.supabase_service import get_all_leads, get_all_projects
from app.services.whatsapp_service import send_whatsapp_message
from app.services.email_service import poll_inbound_emails, send_email_briefing

logger = logging.getLogger("scheduler_service")

scheduler = AsyncIOScheduler()


async def run_daily_briefing():
    """W5: Generates daily executive briefing digest and delivers via WhatsApp & Email."""
    logger.info("Executing W5 Daily Executive Briefing job...")
    try:
        leads = get_all_leads()
        projects = get_all_projects()
        
        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
        new_leads_24h = [l for l in leads if l.get("created_at", "") >= yesterday]
        active_sell = [p for p in projects if p.get("project_type") == "SELL" and p.get("status") == "ACTIVE"]
        active_buy = [p for p in projects if p.get("project_type") == "BUY" and p.get("status") == "ACTIVE"]

        text_msg = (
            f"📋 *CAR-AGENTS Executive Briefing*\n"
            f"Date: {datetime.utcnow().strftime('%Y-%m-%d')}\n\n"
            f"🆕 New Leads (24h): *{len(new_leads_24h)}*\n"
            f"🏷️ Active SELL Projects: *{len(active_sell)}*\n"
            f"🔍 Active BUY Projects: *{len(active_buy)}*\n\n"
            f"Have a productive day! 🚗"
        )
        
        wa_recipient = settings.BRIEFING_WHATSAPP_RECIPIENT or "+4984049385840"
        await send_whatsapp_message(wa_recipient, text_msg)

        email_html = f"""
        <h2>CAR-AGENTS Executive Briefing</h2>
        <p><strong>Date:</strong> {datetime.utcnow().strftime('%Y-%m-%d')}</p>
        <ul>
          <li><strong>New Leads (24h):</strong> {len(new_leads_24h)}</li>
          <li><strong>Active SELL Projects (Vermittlung):</strong> {len(active_sell)}</li>
          <li><strong>Active BUY Projects (Beschaffung):</strong> {len(active_buy)}</li>
        </ul>
        """
        send_email_briefing(settings.BRIEFING_EMAIL_RECIPIENT, "CAR-AGENTS Daily Briefing", email_html)
    except Exception as e:
        logger.error(f"Error in run_daily_briefing: {str(e)}")


async def run_inactivity_check():
    """W6: Checks for deals with no activity in 24h and sends WhatsApp alerts."""
    logger.info("Executing W6 Deal Inactivity Check job...")
    try:
        projects = get_all_projects()
        cutoff = (datetime.utcnow() - timedelta(days=1)).isoformat()

        inactive = [p for p in projects if p.get("updated_at", "") < cutoff and p.get("status") == "ACTIVE"]
        
        if inactive:
            wa_recipient = settings.BRIEFING_WHATSAPP_RECIPIENT or "+4984049385840"
            for p in inactive[:5]:
                alert_msg = (
                    f"⚠️ *CAR-AGENTS Deal Inactivity Alert*\n\n"
                    f"Project: *{p.get('client_name')}*\n"
                    f"Vehicle: {p.get('target_vehicle') or 'N/A'}\n"
                    f"Pipeline: {p.get('project_type')}\n"
                    f"Last Updated: {p.get('updated_at', '')[:10]}\n\n"
                    f"Please follow up with client."
                )
                await send_whatsapp_message(wa_recipient, alert_msg)
    except Exception as e:
        logger.error(f"Error in run_inactivity_check: {str(e)}")


def start_scheduler():
    """Starts the background scheduler jobs."""
    from app.services.gmail_api_service import auto_ingest_gmail_leads

    # 1. Automated Gmail Lead Ingestion every 2 minutes (Stage 1 + Stage 2 AI Pipeline)
    scheduler.add_job(auto_ingest_gmail_leads, 'interval', minutes=2, id="auto_gmail_ingest")

    # 2. Poll Strato IMAP email inbox every 5 minutes
    scheduler.add_job(poll_inbound_emails, 'interval', minutes=5, id="poll_emails")

    # 3. W5 Daily Briefing at 07:00 UTC/CET
    scheduler.add_job(run_daily_briefing, 'cron', hour=7, minute=0, id="daily_briefing")

    # 4. W6 Inactivity Check daily at 12:00 UTC/CET
    scheduler.add_job(run_inactivity_check, 'cron', hour=12, minute=0, id="inactivity_check")

    scheduler.start()
    logger.info("APScheduler automation engine started successfully!")


def stop_scheduler():
    """Stops the scheduler cleanly."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler stopped.")
