"""
apply_supabase_schema.py — Auto-applies supabase_schema_v3.sql to Supabase DB
"""
import os
import psycopg2
from urllib.parse import quote_plus

# Load SUPABASE_DB_PASSWORD (and other vars) from backend/.env so no real
# secret is hardcoded in this tracked file.
from dotenv import load_dotenv
_load = load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD", "CHANGE_ME_IN_ENV")
ENCODED_PW = quote_plus(DB_PASSWORD)
PROJECT_REF = os.getenv("SUPABASE_PROJECT_REF", "qeyoucnldpxshmonjryk")
REGION = "ap-south-1"

# Connection strings to try (Direct vs Session Pooler vs Transaction Pooler)
CONN_STRINGS = [
    f"postgresql://postgres:{ENCODED_PW}@db.{PROJECT_REF}.supabase.co:5432/postgres",
    f"postgresql://postgres.{PROJECT_REF}:{ENCODED_PW}@aws-0-{REGION}.pooler.supabase.com:6543/postgres",
    f"postgresql://postgres.{PROJECT_REF}:{ENCODED_PW}@aws-0-{REGION}.pooler.supabase.com:5432/postgres",
]

def apply_schema():
    sql_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "supabase_schema_v3.sql"))
    with open(sql_path, "r", encoding="utf-8") as f:
        sql_script = f.read()

    connected = False
    for conn_str in CONN_STRINGS:
        print(f"Trying connection string: {conn_str.split('@')[1]}...")
        try:
            conn = psycopg2.connect(conn_str, connect_timeout=10)
            conn.autocommit = True
            cursor = conn.cursor()
            print("Connected to Supabase PostgreSQL! Executing schema v3.0...")
            cursor.execute(sql_script)
            print("SUCCESS: All tables (leads, projects, expenses, labor, meetings, communications) created in Supabase!")
            cursor.close()
            conn.close()
            connected = True
            break
        except Exception as e:
            print("Failed with string:", str(e))

    if not connected:
        print("\nCould not connect directly via Postgres port. You can copy-paste the SQL script below into Supabase SQL Editor:")
        print(f"https://supabase.com/dashboard/project/{PROJECT_REF}/sql/new")

if __name__ == "__main__":
    apply_schema()
