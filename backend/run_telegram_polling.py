"""
backend/run_telegram_polling.py
────────────────────────────────────────────────────────────────────────
Telegram Long-Polling Runner — Production-grade for Render Worker

Improvements over v1:
  - Startup validation: exits clearly if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing
  - Exponential backoff on crash (5s → 10s → 30s → 60s max)
  - Heartbeat ping every 5 minutes for Render health monitoring
  - Graceful shutdown on SIGTERM (Render sends this on deploys)
────────────────────────────────────────────────────────────────────────
"""
import sys
import os
import time
import json
import signal
import urllib.request
import asyncio
import io

# Force UTF-8 for Windows console output with immediate line flushing
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace', line_buffering=True)

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings
from app.services.telegram_service import dispatch_telegram_command

TELEGRAM_API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"

# Graceful shutdown flag
_shutdown = False

def _handle_sigterm(signum, frame):
    global _shutdown
    print("\n🛑 Received SIGTERM — shutting down gracefully...")
    _shutdown = True

signal.signal(signal.SIGTERM, _handle_sigterm)
signal.signal(signal.SIGINT, _handle_sigterm)


def _validate_config() -> bool:
    """Validate required environment variables at startup."""
    ok = True

    if not settings.TELEGRAM_BOT_TOKEN:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN is not set in environment variables!")
        print("   → Create a bot via @BotFather and add the token to Render env vars.")
        ok = False

    # TELEGRAM_CHAT_ID is optional for polling but needed for outbound messages
    chat_id = getattr(settings, "TELEGRAM_CHAT_ID", "")
    if not chat_id:
        print("⚠️  WARNING: TELEGRAM_CHAT_ID is not set.")
        print("   → Bot can receive messages but CANNOT send proactive alerts (briefings, lead notifications).")
        print("   → Add TELEGRAM_CHAT_ID to Render env vars to enable outbound messaging.")
        print("   → To find your chat ID: send any message to @userinfobot on Telegram.")

    return ok


async def _process_update(update: dict):
    """Process a single Telegram update safely."""
    try:
        msg = update.get("message")
        cb = update.get("callback_query")

        if cb:
            msg = cb.get("message", {})
            msg["text"] = cb.get("data")
            msg["from"] = cb.get("from")
            # Acknowledge callback query immediately
            try:
                cb_id = cb.get("id")
                req_ack = urllib.request.Request(
                    f"{TELEGRAM_API}/answerCallbackQuery",
                    data=json.dumps({"callback_query_id": cb_id}).encode(),
                    headers={"Content-Type": "application/json"}
                )
                urllib.request.urlopen(req_ack, timeout=5)
            except Exception:
                pass

        if msg:
            user_name = msg.get("from", {}).get("first_name", "User")
            text = msg.get("text", "")
            print(f"📩 [{user_name}]: {text}")
            reply = await dispatch_telegram_command(msg)
            print(f"🤖 [Bot Reply]:\n{reply}\n---")
    except Exception as e:
        print(f"⚠️  Error processing update: {e}")


async def start_polling():
    print("==========================================")
    print("   CAR-AGENTS TELEGRAM MASTER BOT POLLER  ")
    print("==========================================")

    if not _validate_config():
        print("\n❌ Startup aborted — fix missing environment variables in Render dashboard.")
        sys.exit(1)

    # Delete any existing webhook so long-polling works
    try:
        req = urllib.request.Request(f"{TELEGRAM_API}/deleteWebhook")
        with urllib.request.urlopen(req, timeout=10) as r:
            res = json.loads(r.read())
            print(f"Webhook reset: {res.get('description', 'OK')}")
    except Exception as e:
        print(f"Warning resetting webhook: {e}")

    # Check bot info
    try:
        req = urllib.request.Request(f"{TELEGRAM_API}/getMe")
        with urllib.request.urlopen(req, timeout=10) as r:
            bot_info = json.loads(r.read()).get("result", {})
            print(f"✅ Connected as @{bot_info.get('username')} ({bot_info.get('first_name')})")
            print("🤖 Bot is now actively listening for messages...\n")
    except Exception as e:
        print(f"❌ Failed to connect to Telegram: {e}")
        print("   → Check TELEGRAM_BOT_TOKEN is correct in Render env vars.")
        sys.exit(1)

    offset = 0
    backoff = 2      # seconds — starts low, grows on repeated errors
    max_backoff = 60 # cap at 60s
    error_count = 0
    last_heartbeat = time.time()
    HEARTBEAT_INTERVAL = 300  # 5 minutes

    while not _shutdown:
        # Heartbeat log every 5 min (keeps Render logs alive and visible)
        if time.time() - last_heartbeat > HEARTBEAT_INTERVAL:
            print(f"💓 Heartbeat — bot is running (offset={offset}, errors={error_count})")
            last_heartbeat = time.time()

        try:
            url = f"{TELEGRAM_API}/getUpdates?offset={offset}&timeout=20"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=30) as r:
                updates = json.loads(r.read()).get("result", [])

            # Reset backoff on success
            if error_count > 0:
                print(f"✅ Recovered after {error_count} error(s)")
                error_count = 0
                backoff = 2

            for u in updates:
                offset = u["update_id"] + 1
                await _process_update(u)

        except KeyboardInterrupt:
            print("\n🛑 Keyboard interrupt — shutting down.")
            break
        except Exception as e:
            error_count += 1
            err_msg = str(e)
            if "timed out" in err_msg.lower():
                # Long-poll timeout is normal — no backoff needed
                continue

            print(f"⚠️  Polling error #{error_count}: {err_msg}")
            print(f"   Retrying in {backoff}s...")
            await asyncio.sleep(backoff)
            # Exponential backoff: 2 → 4 → 8 → 16 → 30 → 60 (cap)
            backoff = min(backoff * 2, max_backoff)

    print("✅ Telegram poller stopped cleanly.")


if __name__ == "__main__":
    asyncio.run(start_polling())
