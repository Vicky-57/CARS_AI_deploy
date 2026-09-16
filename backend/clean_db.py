import os
import re
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()
url = os.getenv('SUPABASE_URL')
key = os.getenv('SUPABASE_PUBLISHABLE_KEY')
supabase = create_client(url, key)

def clean(text):
    if not text: return text
    # Only match very strict CSS blocks to avoid matching arbitrary text
    pattern = r'(?:^|\n)\s*(?:[.#a-zA-Z0-9_-]+(?:[\s,>:.a-zA-Z0-9_-]*)\s*\{[^}]*\})'
    media_pattern = r'(?:^|\n)\s*@media[^{]+\{[\s\S]*?\}\s*\}'
    
    prev = ''
    while text != prev:
        prev = text
        text = re.sub(pattern, '\n', text)
        text = re.sub(media_pattern, '\n', text)
    return text.strip()

res = supabase.table('email_conversations').select('id, subject, body_preview').execute()
cleaned_count = 0
for row in res.data:
    body = row.get('body_preview', '')
    if body and '{' in body:
        cl = clean(body)
        if cl != body:
            supabase.table('email_conversations').update({'body_preview': cl}).eq('id', row['id']).execute()
            cleaned_count += 1
print(f'Cleaned {cleaned_count} emails.')
