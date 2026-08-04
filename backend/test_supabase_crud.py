"""
test_supabase_crud.py — Inserts a test lead & project into Supabase
"""
import os
import httpx

SUPABASE_URL = "https://wvzulyxzuntjnzdykstt.supabase.co"
SUPABASE_SECRET_KEY = "sb_secret_qM2kIa6iLOXbv_JAUEXNTA_YLbxemoo"

headers = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def test_crud():
    print("Inserting test lead into Supabase 'leads' table...")
    lead_payload = {
        "name": "Maximilian Lorenz",
        "email": "info@car-agents.de",
        "phone": "+49 8404 9385840",
        "channel": "WHATSAPP",
        "intent": "SELL",
        "status": "NEW",
        "manufacturer": "Volkswagen",
        "model": "Multivan Comfortline",
        "vin": "WV2ZZZ7HZGH056070",
        "price_limit": 52000
    }
    
    res = httpx.post(f"{SUPABASE_URL}/rest/v1/leads", headers=headers, json=lead_payload, timeout=10.0)
    print("Lead Insert Status:", res.status_code)
    print("Created Lead:", res.text)
    
    print("\nInserting test project into Supabase 'projects' table...")
    project_payload = {
        "client_name": "Maximilian Lorenz",
        "client_email": "info@car-agents.de",
        "client_phone": "+49 8404 9385840",
        "project_type": "SELL",
        "current_stage": "Onboarding & Lead Capture",
        "target_vehicle": "VW Multivan Comfortline",
        "vin": "WV2ZZZ7HZGH056070",
        "purchase_price": 45000,
        "agreed_sale_price": 52000,
        "hourly_rate": 20
    }
    res_proj = httpx.post(f"{SUPABASE_URL}/rest/v1/projects", headers=headers, json=project_payload, timeout=10.0)
    print("Project Insert Status:", res_proj.status_code)
    print("Created Project:", res_proj.text)

if __name__ == "__main__":
    test_crud()
