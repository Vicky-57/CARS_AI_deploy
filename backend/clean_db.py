"""
backend/clean_db.py — Universal Database Sanitizer
Cleans \ufffd replacement characters, mojibake, raw UUID notes, and isolates spam leads.
"""
import os
import re
import sys

# Ensure backend root is in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import get_supabase

supabase = get_supabase()

def clean_text(text):
    if not text:
        return text
    # Remove CSS / Media blocks
    pattern = r'(?:^|\n)\s*(?:[.#a-zA-Z0-9_-]+(?:[\s,>:.a-zA-Z0-9_-]*)\s*\{[^}]*\})'
    media_pattern = r'(?:^|\n)\s*@media[^{]+\{[\s\S]*?\}\s*\}'
    prev = ''
    while text != prev:
        prev = text
        text = re.sub(pattern, '\n', text)
        text = re.sub(media_pattern, '\n', text)

    # Eradicate \ufffd characters
    text = re.sub(r'[\ufffd\uFFFD]+', ' ', text)

    # Fix German mojibake
    mojibake = {
        'Ã¤': 'ä', 'Ã„': 'Ä', 'Ã¶': 'ö', 'Ã–': 'Ö',
        'Ã¼': 'ü', 'Ãœ': 'Ü', 'ÃŸ': 'ß', 'â‚¬': '€'
    }
    for m, repl in mojibake.items():
        text = text.replace(m, repl)

    # Clean raw UUID conversion notes
    text = re.sub(r'Converted from Lead ID\s+[0-9a-fA-F-]{32,36}', 'Converted from Lead (Inquiry logged)', text)
    return text.strip()


def run_cleanup():
    print("Starting CAR-AGENTS Database Sanitation...")

    # 1. Clean email_conversations
    emails_res = supabase.table('email_conversations').select('id, subject, body_preview').execute()
    emails_cleaned = 0
    for row in (emails_res.data or []):
        body = row.get('body_preview', '')
        subj = row.get('subject', '')
        cl_body = clean_text(body)
        cl_subj = clean_text(subj)
        if cl_body != body or cl_subj != subj:
            supabase.table('email_conversations').update({
                'body_preview': cl_body,
                'subject': cl_subj
            }).eq('id', row['id']).execute()
            emails_cleaned += 1
    print(f"[OK] Cleaned {emails_cleaned} email records.")

    # 2. Clean leads
    leads_res = supabase.table('leads').select('id, name, email, notes, status').execute()
    leads_cleaned = 0
    spam_quarantined = 0
    blocked_prefixes = ('no-reply', 'noreply', 'donotreply', 'newsletter', 'mailer-daemon', 'postmaster', 'bounce')

    for row in (leads_res.data or []):
        name = row.get('name', '')
        notes = row.get('notes', '')
        email = (row.get('email') or '').lower().strip()
        status = row.get('status', 'NEW')

        cl_name = clean_text(name)
        cl_notes = clean_text(notes)
        updates = {}

        if cl_name != name:
            updates['name'] = cl_name
        if cl_notes != notes:
            updates['notes'] = cl_notes

        # Quarantine automated senders
        if any(email.startswith(pfx) for pfx in blocked_prefixes) or 'amazon.de' in email or 'sixt.com' in email:
            if status != 'SPAM':
                updates['status'] = 'SPAM'
                spam_quarantined += 1

        if updates:
            supabase.table('leads').update(updates).eq('id', row['id']).execute()
            leads_cleaned += 1

    print(f"[OK] Cleaned {leads_cleaned} lead records (quarantined {spam_quarantined} automated spam leads).")

    # 3. Clean projects
    projs_res = supabase.table('projects').select('id, client_name, target_vehicle, notes').execute()
    projs_cleaned = 0
    for row in (projs_res.data or []):
        cname = row.get('client_name', '')
        veh = row.get('target_vehicle', '')
        pnotes = row.get('notes', '')

        cl_cname = clean_text(cname)
        cl_veh = clean_text(veh)
        cl_pnotes = clean_text(pnotes)
        updates = {}

        if cl_cname != cname:
            updates['client_name'] = cl_cname
        if cl_veh != veh:
            updates['target_vehicle'] = cl_veh
        if cl_pnotes != pnotes:
            updates['notes'] = cl_pnotes

        if updates:
            supabase.table('projects').update(updates).eq('id', row['id']).execute()
            projs_cleaned += 1

    print(f"[OK] Cleaned {projs_cleaned} project records.")
    print("Database Sanitation complete.")


if __name__ == '__main__':
    run_cleanup()
