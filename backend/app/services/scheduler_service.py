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


async def generate_daily_briefing() -> str:
    """Generates rich daily executive briefing digest with Outlook schedule and new lead details."""
    try:
        leads = get_all_leads()
        projects = get_all_projects()

        yesterday = (datetime.utcnow() - timedelta(days=1)).isoformat()
        new_leads_24h = [l for l in leads if l.get("created_at", "") >= yesterday]
        active_sell = [p for p in projects if p.get("project_type") == "SELL" and p.get("status") == "ACTIVE"]
        active_buy = [p for p in projects if p.get("project_type") == "BUY" and p.get("status") == "ACTIVE"]

        # Fetch today's Outlook appointments
        events = []
        try:
            from app.services.outlook_service import get_todays_schedule
            events = await get_todays_schedule()
        except Exception as e:
            logger.warning(f"Could not fetch Outlook schedule for briefing: {e}")

        lines = [
            "☀️ *CAR-AGENTS Morning Executive Briefing*",
            f"_{datetime.utcnow().strftime('%A, %d %B %Y')}_\n"
        ]

        # Section 1: Today's Outlook Schedule
        lines.append("📅 *Today's Schedule & Appointments:*")
        if not events:
            lines.append("• _No appointments scheduled on Outlook calendar today._\n")
        else:
            for evt in events:
                time_str = evt.get("time", "All Day")
                subj = evt.get("subject", "No Subject")
                loc = f" 📍 {evt.get('location')}" if evt.get("location") else ""
                lines.append(f"• *{time_str}* — {subj}{loc}")
            lines.append("")

        # Section 2: New Leads in 24h
        lines.append(f"🆕 *New Incoming Leads ({len(new_leads_24h)} in 24h):*")
        if not new_leads_24h:
            lines.append("• _No new leads received in the last 24 hours._\n")
        else:
            for l in new_leads_24h[:5]:
                name = l.get("name", "Unknown")
                veh = l.get("vehicle_interest") or f"{l.get('manufacturer', '')} {l.get('model', '')}".strip() or "Vehicle TBD"
                phone = l.get("phone") or "N/A"
                intent = l.get("intent") or l.get("pipeline_type") or "NEW"
                lines.append(f"• *{name}* — {intent} ({veh}) | 📞 {phone}")
            lines.append("")

        # Section 3: Active Deals & Pipeline Snapshot
        lines.append("📊 *Active Pipeline Snapshot:*")
        lines.append(f"• 🏷️ Active SELL Brokerages: *{len(active_sell)}*")
        lines.append(f"• 🔍 Active BUY Procurements: *{len(active_buy)}*")
        lines.append(f"• 📋 Total Leads Pending: *{len([l for l in leads if l.get('status') == 'ACTIVE' or l.get('status') == 'NEW'])}*\n")

        lines.append("🚀 _Have a successful & productive day!_")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"Error generating briefing: {e}")
        return f"❌ Could not generate briefing: {str(e)}"


async def run_daily_briefing():
    """W5: Generates daily executive briefing digest and delivers via Telegram & Email."""
    logger.info("Executing W5 Daily Executive Briefing job...")
    try:
        text_msg = await generate_daily_briefing()

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
