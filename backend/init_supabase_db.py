"""
init_supabase_db.py — Automated Supabase Database Initializer
Executes supabase_schema_v3.sql against Supabase PostgreSQL.
"""
import os
import httpx
import json

SUPABASE_URL = "https://wvzulyxzuntjnzdykstt.supabase.co"
SUPABASE_SECRET_KEY = "sb_secret_qM2kIa6iLOXbv_JAUEXNTA_YLbxemoo"

headers = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# Test if we can access REST API or if tables need creation
def test_connection():
    print("Testing Supabase connection...")
    try:
        res = httpx.get(f"{SUPABASE_URL}/rest/v1/leads?select=count", headers=headers, timeout=10.0)
        print("Status code:", res.status_code)
        print("Response:", res.text)
    except Exception as e:
        print("Error:", str(e))

if __name__ == "__main__":
    test_connection()
