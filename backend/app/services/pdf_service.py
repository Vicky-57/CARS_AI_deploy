"""
app/services/pdf_service.py
────────────────────────────────────────────────────────────────────────
1. Text Extraction from PDFs and Images (pdfplumber + pytesseract).
2. Document / Contract Pre-filling & PDF Generation for the 4 CAR-AGENTS
   templates using a PyMuPDF (fitz) box-fit fill engine:

      sell_b2c   → Vermittlungsvertrag B2C (Aktiv)         [token template]
      buy_passiv → Vermittlungsvertrag Beschaffung (Passiv)
      kaufvertrag→ Kaufvertrag C2C (Bilingual)
      handover   → Fahrzeug-Übergabeprotokoll

   Fill strategy (approved "Option A"):
     - sell_b2c  : tokens like [Kunde_Name_Vorname] are auto-detected at
                   runtime and the value is re-drawn box-fitted.
     - buy_passiv, kaufvertrag, handover: The templates ship with blank
                   underscore lines / check-boxes (no [tokens]), so we use an
                   explicit FIELD_MAP (coordinates) that the Documentation
                   editor can tweak. Any field without a box is skipped.
────────────────────────────────────────────────────────────────────────
"""
import os
import shutil
import tempfile
import pdfplumber
from PIL import Image
from typing import List

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:  # pragma: no cover
    fitz = None
    PYMUPDF_AVAILABLE = False

try:
    import pytesseract
    if os.name == "nt":
        tesseract_path = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(tesseract_path):
            pytesseract.pytesseract.tesseract_cmd = tesseract_path
    OCR_AVAILABLE = True
except ImportError:
    pytesseract = None
    OCR_AVAILABLE = False

# ─── Template registry ────────────────────────────────────────────────────────

TEMPLATE_FILES = {
    "sell_b2c": "CAR-AGENTS_Vermittlungsvertrag_B2C_aktiv.pdf",
    "buy_passiv": "CAR-AGENTS_Vermittlungsvertrag_Beschaffung_Final__passiv.pdf",
    "kaufvertrag": "Kaufvertrag-C2C-Bilingual.pdf",
    "handover": "CAR-AGENTS_Fahrzeug-Übergabeprotokoll.pdf",
}

TEMPLATE_LABELS = {
    "sell_b2c": "Vermittlungsvertrag B2C (Aktiv)",
    "buy_passiv": "Vermittlungsvertrag Beschaffung (Passiv)",
    "kaufvertrag": "Kaufvertrag C2C (Bilingual)",
    "handover": "Fahrzeug-Übergabeprotokoll",
}

TEMPLATE_PIPELINE = {
    "sell_b2c": "sell",
    "buy_passiv": "buy",
    "kaufvertrag": "sell",
    "handover": "sell",
}

SAFE_FONT = "helv"

def _client_data_dir() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "client_data"))

# ─── sell_b2c token → canonical field key ────────────────────────────────────
# Engines fill values by canonical key. The UI / forms / API all agree on these
# canonical keys. sell_b2c placeholders are mapped here; the manual templates
# define the same keys against coordinates in FIELD_MAP below.
SELL_B2C_TOKEN_KEY = {
    "Kunde_Name_Vorname": "full_name",
    "Kunde_Telefon": "phone",
    "Kunde_Strasse": "street",
    "Kunde_Email": "email",
    "Kunde_PLZ_Ort": "zip_city",
    "Kunde_Ausweis_Nr": "id_card",
    "Fahrzeug_Hersteller": "manufacturer",
    "Fahrzeug_Typ": "model",
    "Fahrzeug_VIN": "vin",
    "Fahrzeug_Kennzeichen": "license",
    "Fahrzeug_Erstzulassung": "first_date",
    "Fahrzeug_KM_Stand": "mileage",
    "Fahrzeug_Leistung": "power",
    "Fahrzeug_Hubraum": "displacement",
    "Fahrzeug_TUEV": "tuev_until",
    "Fahrzeug_Halter_Anzahl": "owners",
    "Fahrzeug_Farbe": "color",
    "Fahrzeug_ZB2_Nr": "zb2",
    "Fahrzeug_Gaspruefung": "gas_until",
    "Anzahl_Schluessel": "keys",
    "Anzahl_Schlüssel": "keys",
    "Anzahl_Schl\ufffdssel": "keys",
    "Sonstiges": "misc",
    "Tausch_KM": "engine_mileage",
    "Tausch_Datum": "engine_date",
    "Fahrzeug_Rechte_DritterDetails": "reimport",
    "Fahrzeug_Maengel_Vorschaeden": "accident_details",
    "Fahrzeug_Sonderausstattung": "special_equipment",
    "Fahrzeug_Preis_Untergrenze": "min_price",
    "Fahrzeug_Schluessel_Anzahl": "keys",
    "Sondervereinbarung_Freitext_Block": "special_agreements",
    "Vollmacht_Freitext": "reimport",
    "XP_Freitext_Instandsetzung": "repair_service",
    "XP_Freitext_Instandhaltung": "maintenance_service",
    "XP_Freitext_Pflege": "care_service",
}

# XA_Kosten_* (Anlage A internal service prices) and XP_Kosten_1..3 (external)
# are token placeholders whose box is auto-detected too (GET page 5).
PRICE_TOKEN_KEYS = {
    "XA_Kosten_04": "price_1", "XA_Kosten_05": "price_2", "XA_Kosten_06": "price_3",
    "XA_Kosten_07": "price_4", "XA_Kosten_08": "price_5", "XA_Kosten_So": "price_6",
    "XA_Kosten_12": "price_7", "XA_Kosten_S2": "price_8", "XA_Kosten_14": "price_9",
    "XA_Kosten_16": "price_10", "XA_Kosten_17": "price_11",
    "XP_Kosten_1": "repair_price", "XP_Kosten_2": "maintenance_price", "XP_Kosten_3": "care_price",
}

# ─── AcroForm widget name → canonical key map (sell_b2c template) ─────────────
# The sell_b2c PDF uses interactive AcroForm text fields whose names differ from
# the [Token] placeholder text. This map fills each widget by canonical key.
# Widget names with special characters (ü, ß, ö …) are stored as-is from the PDF.
SELL_B2C_WIDGET_KEY: dict = {
    # Page 1 — client info
    "Kunde_Vorname_Name":          "full_name",
    "Kunde_Stra\u00dfe_Hausnummer":    "street",   # ß
    "Kunde_Stra\ufffd\ufffd_Hausnummer": "street",  # mojibake variant
    "Kunde_Stra\ufffd_Hausnummer":     "street",   # single-char mojibake
    "Kunde_PLZ_Ort":               "zip_city",
    "Kunde_Telefonnummer":         "phone",
    "Kunde_E-Mail-Adresse":        "email",
    "Kunde_Ausweis-Art_Nummer":    "id_card",
    # Page 1 — vehicle info
    "Fahrzeug_Hersteller":         "manufacturer",
    "Fahrzeug_Modell_Typ":         "model",
    "Fahrzeug_FIN":                "vin",
    "Fahrzeug_Kennzeichen":        "license",
    "Fahrzeug_Erstzulassung":      "first_date",
    "Fahrzeug_Kilometerstand":     "mileage",
    "Fahrzeug_Leistung":           "power",
    "Fahrzeug_Hubraum":            "displacement",
    "Fahrzeug_HU_AU":              "tuev_until",
    "Fahrzeug_Anzahl_Halter":      "owners",
    "Fahrzeug_Farbe_Lackart":      "color",
    "Fahrzeug_ZSBII_Nr":           "zb2",
    "Fahrzeug_Gaspr\u00fcfung":       "gas_until",   # ü
    "Fahrzeug_Gaspr\ufffd\ufffdung":   "gas_until",  # mojibake
    "Fahrzeug_Gaspr\ufffdung":        "gas_until",
    "Fahrzeug_Anzahl_Schl\u00fcssel": "keys",        # ü
    "Fahrzeug_Anzahl_Schl\ufffd\ufffdssel": "keys",
    "Fahrzeug_Anzahl_Schl\ufffdssel": "keys",
    "Sonstiges":                   "misc",
    # Page 2 — condition / history
    "ATM_Kilometerstand":          "engine_mileage",
    "Textfeld1":                   "engine_date",
    "Textfeld2":                   "reimport",
    "Unfallbeschreibung":          "accident_details",
    "Bekannte_M\u00e4ngel":            "accident_details",   # ä
    "Bekannte_M\ufffd\ufffdngel":       "accident_details",
    "Bekannte_M\ufffdngel":            "accident_details",
    "Sonderausstattung_Zubeh\u00f6r": "special_equipment",  # ö
    "Sonderausstattung_Zubeh\ufffd\uffdfr": "special_equipment",
    "Textfeld3":                   "min_price",
    # Page 3 — Sondervereinbarungen
    "Sondervereinbarungen & Nebenabreden": "special_agreements",
    "Fahrzeug_SB_TK":              "tuev_until",
    "Fahrzeug_SB_VK":              "gas_until",
    "Fahrzeug_Anzahl_Schl\u00fcssel": "keys",
    # Page 5 — Anlage A price slots (Textfeld4..14 = XA_Kosten, Textfeld15..17 = XP)
    "Freitext":                    "repair_service",
    "Textfeld4":  "price_1",  "Textfeld5":  "price_2",  "Textfeld6":  "price_3",
    "Textfeld7":  "price_4",  "Textfeld8":  "price_5",  "Textfeld9":  "price_6",
    "Textfeld10": "price_7",  "Textfeld11": "price_8",  "Textfeld12": "price_9",
    "Textfeld13": "price_10", "Textfeld14": "price_11",
    "Textfeld15": "repair_service",  "Textfeld16": "maintenance_service",
    "Textfeld17": "care_service",
    "Textfeld18": "repair_price", "Textfeld19": "maintenance_price",
    "Textfeld20": "care_price",
    "Textfeld21": "price_1",  "Textfeld22": "price_2",
    # Page 7 — Vollmacht / Appendix (mirror of p1 fields)
    "Vollmacht_Sonstiges":         "reimport",
}


# ── Manual field maps for token-less templates ───────────────────────────────
# box = [page, x0, y0, x1, y1]  (page is 1-based). fontsize per field.
FIELD_MAP = {
    "buy_passiv": [
        # page 1 (index 0 in layout)
        {"key": "full_name", "box": [1, 130, 270, 400, 288], "size": 9.0},
        {"key": "phone", "box": [1, 350, 268, 570, 286]},
        {"key": "street", "box": [1, 130, 294, 400, 310]},
        {"key": "email", "box": [1, 350, 292, 570, 310]},
        {"key": "zip_city", "box": [1, 100, 319, 400, 335]},
        {"key": "id_card", "box": [1, 390, 319, 570, 335]},
        {"key": "salutation", "box": [1, 54, 270, 130, 286]},
        # search profile p1
        {"key": "manufacturer", "box": [1, 120, 672, 290, 688]},
        {"key": "model", "box": [1, 365, 672, 570, 688]},
        {"key": "fuel", "box": [1, 120, 692, 290, 708]},
        {"key": "gearbox", "box": [1, 360, 692, 570, 708]},
        {"key": "first_date", "box": [1, 130, 716, 290, 732]},
        {"key": "max_km", "box": [1, 400, 716, 570, 732]},
        {"key": "power", "box": [1, 170, 737, 290, 753]},
        {"key": "displacement", "box": [1, 390, 737, 570, 753]},
        {"key": "tuev_until", "box": [1, 110, 762, 290, 778]},
        {"key": "owners", "box": [1, 420, 762, 570, 778]},
        {"key": "wanted_colors", "box": [1, 175, 783, 290, 800]},
        {"key": "other_req", "box": [1, 365, 783, 570, 800]},
        # page 2 requirements
        {"key": "must_haves", "box": [2, 50, 130, 540, 168]},
        {"key": "nice_haves", "box": [2, 50, 260, 540, 300]},
        {"key": "no_gos", "box": [2, 50, 400, 540, 412]},
        {"key": "max_damage", "box": [2, 125, 447, 540, 460]},
        # page 3 sondervereinbarungen free text
        {"key": "special_agreements", "box": [3, 55, 300, 540, 430]},
        # page 5 services — repair/maintenance/care (Anlage A Teil 2)
        {"key": "repair_service", "box": [5, 90, 550, 340, 566]},
        {"key": "repair_price", "box": [5, 404, 556, 424, 572]},
        {"key": "maintenance_service", "box": [5, 90, 583, 340, 599]},
        {"key": "maintenance_price", "box": [5, 404, 590, 424, 606]},
        {"key": "care_service", "box": [5, 90, 617, 340, 633]},
        {"key": "care_price", "box": [5, 404, 623, 424, 639]},
        # optional internal service prices (Anlage A Teil 1) top 11 slots
        {"key": "price_1", "box": [5, 306, 199, 384, 214]},
        {"key": "price_2", "box": [5, 306, 221, 384, 236]},
        {"key": "price_3", "box": [5, 306, 243, 384, 258]},
        {"key": "price_4", "box": [5, 306, 264, 384, 279]},
        {"key": "price_5", "box": [5, 306, 287, 384, 302]},
        {"key": "price_6", "box": [5, 306, 309, 384, 324]},
        {"key": "price_7", "box": [5, 306, 330, 384, 345]},
        {"key": "price_8", "box": [5, 306, 352, 384, 367]},
        {"key": "price_9", "box": [5, 306, 374, 384, 389]},
        {"key": "price_10", "box": [5, 306, 396, 384, 411]},
        {"key": "price_11", "box": [5, 306, 418, 384, 433]},
        # Ort Datum p5 / p7 handled by handover/dates
        {"key": "place", "box": [5, 70, 674, 300, 690]},
        {"key": "date", "box": [5, 120, 674, 300, 690]},
    ],
    "kaufvertrag": [
        # p1 intermediary / Vermittler (label y=134, single wide box y=146-176).
        # The intermediary is the broker (CAR-AGENTS), NOT the client. It is
        # prefilled from the CAR_AGENTS_BROKER constant in the merge, so it must
        # have a distinct key and must not be fed by the unprefixed person keys
        # (full_name/etc.) which would collide with the Verkäufer block below.
        {"key": "intermediary", "box": [1, 55, 150, 540, 172]},
        # p1 seller (label "Verkäufer" y=209) — fields at y=246 (Name) / 287 / 328
        {"key": "seller_name", "box": [1, 42, 255, 250, 273]},
        {"key": "seller_street", "box": [1, 42, 295, 250, 313]},
        {"key": "seller_zip_city", "box": [1, 298, 295, 560, 313]},
        {"key": "seller_phone", "box": [1, 42, 335, 250, 353]},
        {"key": "seller_email", "box": [1, 298, 335, 560, 353]},
        # p1 buyer (label "Käufer" y=380) — fields at y=417 / 458 / 499
        {"key": "buyer_name", "box": [1, 42, 426, 300, 444]},
        {"key": "buyer_street", "box": [1, 42, 466, 300, 484]},
        {"key": "buyer_zip_city", "box": [1, 298, 466, 560, 484]},
        {"key": "buyer_phone", "box": [1, 42, 506, 300, 524]},
        {"key": "buyer_email", "box": [1, 298, 506, 560, 524]},
        {"key": "price", "box": [1, 180, 730, 280, 748], "align": "center"},
        # p2 vehicle details
        {"key": "manufacturer", "box": [2, 48, 110, 280, 128]},
        {"key": "model", "box": [2, 302, 110, 560, 128]},
        {"key": "color", "box": [2, 48, 146, 280, 164]},
        {"key": "vin", "box": [2, 302, 146, 560, 164]},
        {"key": "license", "box": [2, 48, 182, 280, 200]},
        {"key": "first_date", "box": [2, 302, 182, 560, 200]},
        {"key": "displacement", "box": [2, 48, 218, 280, 236]},
        {"key": "power", "box": [2, 302, 218, 560, 236]},
        {"key": "mileage", "box": [2, 48, 254, 280, 272]},
        {"key": "owners", "box": [2, 302, 254, 560, 272]},
        {"key": "zb2", "box": [2, 48, 289, 280, 307]},
        {"key": "tuev_until", "box": [2, 302, 305, 560, 323]},
        {"key": "gas_until", "box": [2, 302, 331, 560, 349]},
        # p3 tread depths
        {"key": "tread_vl", "box": [3, 281, 294, 360, 310]},
        {"key": "tread_vr", "box": [3, 384, 294, 438, 310]},
        {"key": "tread_hl", "box": [3, 281, 320, 360, 336]},
        {"key": "tread_hr", "box": [3, 384, 320, 440, 336]},
        {"key": "engine_number", "box": [3, 337, 403, 500, 419]},
        {"key": "engine_mileage", "box": [3, 252, 438, 540, 456]},
        # p4 keys + other
        {"key": "keys", "box": [4, 330, 374, 380, 392]},
        {"key": "buyer_other", "box": [4, 140, 407, 500, 420]},
        {"key": "place", "box": [4, 60, 640, 250, 660]},
        {"key": "date", "box": [4, 120, 640, 250, 660]},
    ],
    "handover": [
        # ── People (p1) ──────────────────────────────────────────────────────
        # "Übergebende Person:" label is at y=246-259.
        # The underline "____" is at y=261-273. Draw value ON the underline.
        {"key": "giving_person",    "box": [1, 28,  261, 566, 273]},
        # "Übernehmende Person:" label at y=299-312, underline at y=314-326.
        {"key": "receiving_person", "box": [1, 28,  314, 566, 326]},

        # ── Vehicle data (p1) ────────────────────────────────────────────────
        # "Hersteller: ____" — label ends at x=83, underline is x=83–272, y=377-390
        {"key": "manufacturer", "box": [1,  83, 378, 272, 390]},
        # "Modell: ________" — label ends at x=319, underline x=319–566
        {"key": "model",        "box": [1, 319, 378, 566, 390]},

        # "Amtl. Kennzeichen: ____" — label ends at x=130, underline x=130–274, y=396-409
        {"key": "license",      "box": [1, 130, 397, 274, 409]},
        # "Fahrgestellnr.: ______" — label ends at x=356, underline x=356–567
        {"key": "vin",          "box": [1, 356, 397, 566, 409]},

        # "Kilometerstand laut Anzeige: ___" — label ends at x=180, underline x=180–275, y=415-428
        {"key": "mileage",      "box": [1, 180, 416, 275, 428]},
        # "HU/AU gültig bis: _____" — label ends at x=374, underline x=374–566
        {"key": "tuev_until",   "box": [1, 374, 416, 566, 428]},

        # ── Keys (p1) ────────────────────────────────────────────────────────
        # "Fahrzeugschlüssel: _____ Stück" — underline x=131–162, y=591-603
        {"key": "keys",         "box": [1, 131, 592, 162, 603]},

        # ── Notes / Freitext (p2) ────────────────────────────────────────────
        # "Sonstige Mängel / Fehlermeldungen" label at y=228-240.
        # Draw free-text below the label.
        {"key": "notes",        "box": [2,  28, 245, 540, 280]},

        # ── Signature block (p2) ─────────────────────────────────────────────
        # "Ort, Datum, Uhrzeit" section at y=787-800 (x=28-129).
        # Place and date go together in the first column.
        {"key": "place",        "box": [2,  28, 788, 130, 800]},
        {"key": "date",         "box": [2, 135, 788, 280, 800]},
    ],
}


# ─── Drawing helpers ──────────────────────────────────────────────────────────

def _wrap_words(text: str, box_w: float, fs: float) -> List[str]:
    lines, cur = [], ""
    for word in text.split():
        trial = (cur + " " + word).strip()
        if fitz.get_text_length(trial, fontname=SAFE_FONT, fontsize=fs) <= box_w:
            cur = trial
        else:
            if cur:
                lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def _draw_fitted(page, x0: float, y0: float, x1: float, y1: float, value: str,
                 fontsize: float = 9.0, align: str = "left") -> None:
    """Draw `value` into the box, wrapping words and auto-shrinking the font so
    it never exceeds the box's right edge (x1). If it cannot fit on one line we
    let it wrap; the box height is a soft limit (we keep the given baseline)."""
    if not value or not str(value).strip():
        return
    text = " ".join(str(value).split())
    box_w = (x1 - x0) or 40.0

    fs = fontsize
    # shrink until the widest line fits one box width going down to 6pt
    while fs > 6.0:
        if all(fitz.get_text_length(l, SAFE_FONT, fs) <= box_w for l in _wrap_words(text, box_w, fs)):
            break
        fs -= 0.5
    lines = _wrap_words(text, box_w, fs)

    if align == "center":
        for i, line in enumerate(lines):
            w = fitz.get_text_length(line, SAFE_FONT, fs)
            xx = x0 + max(0, (box_w - w) / 2)
            page.insert_text((xx, y0 + (i + 1) * fs), line, fontname=SAFE_FONT, fontsize=fs, color=(0, 0, 0))
    else:
        for i, line in enumerate(lines):
            y = y0 + (i + 1) * fs
            if y > y1 + 6:
                break
            page.insert_text((x0, y), line, fontname=SAFE_FONT, fontsize=fs, color=(0, 0, 0))


_LEGACY_TOKEN_KEYS = ({**SELL_B2C_TOKEN_KEY, **PRICE_TOKEN_KEYS})


def _fill_token_document(doc, data: dict) -> None:
    """Fill the sell_b2c AcroForm PDF by writing values into form widgets.

    The sell_b2c template is an interactive AcroForm PDF — the fillable cells
    are PDF form widgets (text fields, checkboxes), NOT plain text spans.

    Steps:
      1. Collect every checkbox widget rect + checked-state before baking
         (bake() destroys the AcroForm structure, making checkboxes invisible).
      2. Fill all text fields via widget.field_value + widget.update().
      3. bake() the form so text-field values are baked into static page content.
      4. Redraw each checkbox as a crisp drawn square (empty or with X).
    """
    # ── Step 1: catalogue every checkbox position before baking ──────────────
    # (pno, fitz.Rect, is_checked)
    checkbox_infos: list[tuple[int, fitz.Rect, bool]] = []
    for pno in range(len(doc)):
        page = doc[pno]
        for widget in page.widgets():
            if widget.field_type_string == "CheckBox":
                val = widget.field_value or ""
                is_checked = val.strip() not in ("", "Off")
                checkbox_infos.append((pno, fitz.Rect(widget.rect), is_checked))

    # ── Step 2: fill text fields ──────────────────────────────────────────────
    filled = 0
    for pno in range(len(doc)):
        page = doc[pno]
        for widget in page.widgets():
            if widget.field_type_string == "CheckBox":
                continue  # handled separately above
            fname = widget.field_name or ""
            # Exact match first, then case-insensitive fallback.
            key = SELL_B2C_WIDGET_KEY.get(fname)
            if not key:
                fname_lower = fname.lower()
                for wname, wkey in SELL_B2C_WIDGET_KEY.items():
                    if wname.lower() == fname_lower:
                        key = wkey
                        break
            if not key:
                continue
            val = data.get(key)
            if val is None or str(val).strip() == "":
                continue
            widget.field_value = str(val).strip()
            widget.update()
            filled += 1

    # ── Step 3: flatten / bake the AcroForm ──────────────────────────────────
    try:
        doc.bake()
    except AttributeError:
        pass  # Older PyMuPDF — no bake(); form fields render via viewer

    # ── Step 4: redraw checkboxes as visible drawn squares ────────────────────
    # bake() removes all widget appearances. We redraw each checkbox position
    # as a small outlined square so the boxes remain visible in the PDF.
    BLACK = (0, 0, 0)
    for pno, rect, is_checked in checkbox_infos:
        page = doc[pno]
        # Inset slightly so we don't clip the border
        box = rect + fitz.Rect(0.5, 0.5, -0.5, -0.5)
        # White fill + black border (clean square)
        page.draw_rect(box, color=BLACK, fill=(1, 1, 1), width=0.5)
        if is_checked:
            # Draw an X mark inside for checked boxes
            inner = box + fitz.Rect(1.5, 1.5, -1.5, -1.5)
            page.draw_line(inner.top_left, inner.bottom_right, color=BLACK, width=0.7)
            page.draw_line(inner.top_right, inner.bottom_left, color=BLACK, width=0.7)


def _fill_manual_document(doc, template_type: str, data: dict) -> None:
    """Fill a template purely from FIELD_MAP coordinates."""
    for spec in FIELD_MAP.get(template_type, []):
        key = spec["key"]
        align = spec.get("align", "left")
        val = data.get(key)
        if val is None or str(val).strip() == "":
            continue
        pno, x0, y0, x1, y1 = spec["box"]
        page = doc[pno - 1]
        _draw_fitted(page, x0, y0, x1, y1, str(val),
                     fontsize=spec.get("size", spec.get("fontsize", 9.0)), align=align)

    # Convert text checkboxes like "[ ]" into actual drawn squares
    BLACK = (0, 0, 0)
    WHITE = (1, 1, 1)
    for pno in range(len(doc)):
        page = doc[pno]
        
        boxes_empty = page.search_for("[ ]")
        boxes_checked = page.search_for("[x]") + page.search_for("[X]")
        
        for r in boxes_empty:
            page.add_redact_annot(r, fill=WHITE)
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
            size = r.height * 0.7
            cx, cy = r.x0 + r.width / 2, r.y0 + r.height / 2
            sq = fitz.Rect(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2)
            page.draw_rect(sq, color=BLACK, fill=WHITE, width=0.5)
            
        for r in boxes_checked:
            page.add_redact_annot(r, fill=WHITE)
            page.apply_redactions(images=fitz.PDF_REDACT_IMAGE_NONE)
            size = r.height * 0.7
            cx, cy = r.x0 + r.width / 2, r.y0 + r.height / 2
            sq = fitz.Rect(cx - size / 2, cy - size / 2, cx + size / 2, cy + size / 2)
            page.draw_rect(sq, color=BLACK, fill=WHITE, width=0.5)
            # Draw X
            page.draw_line(sq.top_left, sq.bottom_right, color=BLACK, width=0.7)
            page.draw_line(sq.top_right, sq.bottom_left, color=BLACK, width=0.7)


def render_contract_pdf(template_type: str, data: dict, output_dir: str) -> str:
    """Fill the given template with `data` (canonical keys) and return the
    absolute path of the produced PDF file. Raises ValueError on bad template."""
    if template_type not in TEMPLATE_FILES:
        raise ValueError(f"Invalid template type. Must be one of: {list(TEMPLATE_FILES.keys())}")
    if not PYMUPDF_AVAILABLE:
        raise RuntimeError("PyMuPDF (pymupdf) is not installed. Run: pip install pymupdf")

    client_data_dir = _client_data_dir()
    src = os.path.join(client_data_dir, TEMPLATE_FILES[template_type])
    if not os.path.exists(src):
        raise FileNotFoundError(f"Template not found: {src}")

    os.makedirs(output_dir, exist_ok=True)
    doc = fitz.open(src)

    if template_type == "sell_b2c":
        _fill_token_document(doc, data)
    else:
        _fill_manual_document(doc, template_type, data)

    out_name = f"Generated_{template_type}_{int(__import__('time').time())}.pdf"
    out_path = os.path.join(output_dir, out_name)
    doc.save(out_path, garbage=4, deflate=True)
    doc.close()
    return out_path


# ── Legacy wrapper (kept for the /contracts/generate endpoint) ───────────────

def fill_contract_template(template_type: str, custom_data: dict, output_dir: str) -> dict:
    """Backward-compatible wrapper around render_contract_pdf."""
    filename = TEMPLATE_FILES.get(template_type)
    if not filename:
        raise ValueError(f"Invalid template type. Must be one of: {list(TEMPLATE_FILES.keys())}")
    if not custom_data:
        custom_data = {}
    # adapt legacy custom_data (may carry already-token keys) by mapping tokens→keys
    mapped = {}
    for k, v in custom_data.items():
        if k.startswith("[") and k.endswith("]"):
            mk = SELL_B2C_TOKEN_KEY.get(k.strip("[]"))
            if mk:
                mapped[mk] = v
            else:
                mapped[k] = v
        else:
            mapped[k] = v
    out_path = render_contract_pdf(template_type, mapped, output_dir)
    return {
        "success": True,
        "template_label": TEMPLATE_LABELS[template_type],
        "file_name": os.path.basename(out_path),
        "file_path": out_path,
    }


# ─── Text extraction (unchanged helpers) ─────────────────────────────────────

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using pdfplumber (digital) or pytesseract (scanned fallback)."""
    text = ""
    try:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception:
        pass

    if not text.strip() and OCR_AVAILABLE:
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    img = page.to_image(resolution=300).original
                    text += pytesseract.image_to_string(img, lang="deu+eng") + "\n"
        except Exception:
            pass

    return text.strip()


def extract_text_from_image(file_path: str) -> str:
    """Extract text from an image scan using pytesseract OCR."""
    if not OCR_AVAILABLE:
        return ""
    img = Image.open(file_path)
    return pytesseract.image_to_string(img, lang="deu+eng").strip()


def extract_document_text(file_path: str) -> str:
    """Smart router: choose PDF or image extraction based on file extension."""
    lower = file_path.lower()
    if lower.endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    elif lower.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
        return extract_text_from_image(file_path)
    return ""