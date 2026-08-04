"""
apply_supabase_schema.py — Auto-applies supabase_schema_v3.sql to Supabase DB
"""
import os
import psycopg2

DB_PASSWORD = os.getenv("SUPABASE_DB_PASSWORD", "CARS_AI2026")
PROJECT_REF = "wvzulyxzuntjnzdykstt"

# Connection strings to try (Direct vs Session Pooler vs Transaction Pooler)
CONN_STRINGS = [
    f"postgresql://postgres:{DB_PASSWORD}@db.{PROJECT_REF}.supabase.co:5432/postgres",
    f"postgresql://postgres.{PROJECT_REF}:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
    f"postgresql://postgres.{PROJECT_REF}:{DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres",
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
        print("https://supabase.com/dashboard/project/wvzulyxzuntjnzdykstt/sql/new")

if __name__ == "__main__":
    apply_schema()
