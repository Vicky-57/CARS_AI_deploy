"""Quick helper to dump all FIELD_MAP keys per template."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from app.services.pdf_service import FIELD_MAP, SELL_B2C_TOKEN_KEY, TEMPLATE_LABELS

print("\n=== sell_b2c (token-based) ===")
keys = sorted(set(SELL_B2C_TOKEN_KEY.values()))
print(", ".join(keys))

for tpl in ("buy_passiv", "kaufvertrag", "handover"):
    print(f"\n=== {tpl} — {TEMPLATE_LABELS[tpl]} ===")
    keys = [entry["key"] for entry in FIELD_MAP.get(tpl, [])]
    print(", ".join(keys))
