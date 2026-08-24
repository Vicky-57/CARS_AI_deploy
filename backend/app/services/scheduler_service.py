"""
app/services/scheduler_service.py
────────────────────────────────────────────────────────────────────────
APScheduler Background Automation & Cron Scheduler Engine

Runs:
  1. Outlook Email Poller      — Every 5 minutes (replaces Gmail poller)
  2. W5 Daily Briefing         — Daily at 07:00 CET (via Telegram + Email)
  3. W6 Deal Inactivity Check  — Daily at 12:00 CET
────────────────────────────────────────────────────────────────────────
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from datetime import datetime, timedelta
import logging
from config import settings
from app.services.supabase_service import get_all_leads, get_all_projects

logger = logging.getLogger("scheduler_service")

scheduler = AsyncIOScheduler()


async def run_daily_briefing():
    """W5: Generates daily executive briefing digest and delivers via Telegram."""
    logger.info("Executing W5 Daily Executive Briefing job...")
    try:
        leads = get_all_leads()
        projects = get_all_projects()

        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
        new_leads_24h = [l for l in leads if l.get("created_at", "") >= yesterday]
        active_sell = [p for p in projects if p.get("project_type") == "SELL" and p.get("status") == "ACTIVE"]
        active_buy = [p for p in projects if p.get("project_type") == "BUY" and p.get("status") == "ACTIVE"]

        text_msg = (
            f"📋 *CAR-AGENTS Daily Briefing*\n"
            f"Date: {datetime.utcnow().strftime('%Y-%m-%d')}\n\n"
            f"🆕 New Leads (24h): *{len(new_leads_24h)}*\n"
            f"🏷️ Active SELL Projects: *{len(active_sell)}*\n"
            f"🔍 Active BUY Projects: *{len(active_buy)}*\n\n"
            f"Have a productive day! 🚗"
        )

        # Send via Telegram bot
        try:
            from app.services.telegram_service import send_telegram_message
            await send_telegram_message(text_msg)
        except Exception as tg_err:
            logger.warning(f"Telegram briefing send failed: {tg_err}")

        # Fallback: Email briefing via SMTP
        try:
            from app.services.email_service import send_email_briefing
            email_html = f"""
            <h2>CAR-AGENTS Daily Briefing</h2>
            <p><strong>Date:</strong> {datetime.utcnow().strftime('%Y-%m-%d')}</p>
            <ul>
              <li><strong>New Leads (24h):</strong> {len(new_leads_24h)}</li>
              <li><strong>Active SELL Projects:</strong> {len(active_sell)}</li>
              <li><strong>Active BUY Projects:</strong> {len(active_buy)}</li>
            </ul>
            """
            send_email_briefing(settings.BRIEFING_EMAIL_RECIPIENT, "CAR-AGENTS Daily Briefing", email_html)
        except Exception as email_err:
            logger.warning(f"Email briefing send failed: {email_err}")

    except Exception as e:
        logger.error(f"Error in run_daily_briefing: {str(e)}")


async def run_inactivity_check():
    """W6: Checks for projects with no activity in 24h and sends Telegram alerts."""
    logger.info("Executing W6 Deal Inactivity Check job...")
    try:
        projects = get_all_projects()
        cutoff = (datetime.utcnow() - timedelta(days=1)).isoformat()
        inactive = [
            p for p in projects
            if p.get("updated_at", "") < cutoff and p.get("status") == "ACTIVE"
        ]

        if inactive:
            try:
                from app.services.telegram_service import send_telegram_message
                for p in inactive[:5]:
                    alert_msg = (
                        f"⚠️ *Inactivity Alert*\n\n"
                        f"Project: *{p.get('client_name')}*\n"
                        f"Vehicle: {p.get('target_vehicle') or 'N/A'}\n"
                        f"Pipeline: {p.get('project_type')}\n"
                        f"Last Updated: {p.get('updated_at', '')[:10]}\n\n"
                        f"Please follow up with the client."
                    )
                    await send_telegram_message(alert_msg)
            except Exception as tg_err:
                logger.warning(f"Telegram inactivity alert failed: {tg_err}")
    except Exception as e:
        logger.error(f"Error in run_inactivity_check: {str(e)}")


async def run_outlook_email_poll():
    """Polls Outlook/Strato inbox for new inbound leads every 5 minutes."""
    logger.info("Executing Outlook inbound email poll...")
    try:
        from app.services.outlook_service import poll_outlook_inbound_emails
        await poll_outlook_inbound_emails()
    except Exception as e:
        logger.error(f"Outlook email poll error: {str(e)}")


def start_scheduler():
    """Starts all background scheduler jobs."""
    # 1. Poll Outlook inbox every 5 minutes for new leads
    scheduler.add_job(run_outlook_email_poll, "interval", minutes=5, id="poll_outlook_emails")

    # 2. W5 Daily Briefing at 07:00 CET
    scheduler.add_job(run_daily_briefing, "cron", hour=7, minute=0, id="daily_briefing")

    # 3. W6 Inactivity Check daily at 12:00 CET
    scheduler.add_job(run_inactivity_check, "cron", hour=12, minute=0, id="inactivity_check")

    scheduler.start()
    logger.info("APScheduler automation engine started — Outlook polling, briefings, inactivity checks active.")


def stop_scheduler():
    """Stops the scheduler cleanly."""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("APScheduler stopped.")
