"""
backend/run_telegram_polling.py
────────────────────────────────────────────────────────────────────────
Telegram Long-Polling Runner for Local Development & Testing

Use this script when running locally without a public domain or ngrok!
It continuously polls Telegram for new messages and routes them to our
Telegram Master Agent service.

Usage:
  python run_telegram_polling.py
────────────────────────────────────────────────────────────────────────
"""
import sys
import os
import time
import json
import urllib.request
import asyncio

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import settings
from app.services.telegram_service import dispatch_telegram_command

TELEGRAM_API = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


async def start_polling():
    print("==========================================")
    print("   CAR-AGENTS TELEGRAM MASTER BOT POLLER  ")
    print("==========================================")
    
    if not settings.TELEGRAM_BOT_TOKEN:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN is not set in .env!")
        print("Please create a bot via @BotFather and add your token to .env.")
        return

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
            print("🤖 Bot is now actively listening for messages on your phone...\n")
    except Exception as e:
        print(f"❌ Failed to connect to Telegram: {e}")
        return

    offset = 0
    while True:
        try:
            url = f"{TELEGRAM_API}/getUpdates?offset={offset}&timeout=20"
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=30) as r:
                updates = json.loads(r.read()).get("result", [])

            for u in updates:
                offset = u["update_id"] + 1
                msg = u.get("message")
                cb = u.get("callback_query")
                if cb:
                    msg = cb.get("message", {})
                    msg["text"] = cb.get("data")
                    msg["from"] = cb.get("from")
                    # Acknowledge callback query
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
            if "timed out" not in str(e).lower():
                print(f"Polling warning: {e}")
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(start_polling())
