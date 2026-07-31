import os
import pdfplumber
from PIL import Image

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


def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from PDF using pdfplumber (digital) or pytesseract (scanned)."""
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

    # Fallback to OCR if digital extraction empty
    if not text.strip() and OCR_AVAILABLE:
        with pdfplumber.open(file_path) as pdf:
            for page in pdf.pages:
                img = page.to_image(resolution=300).original
                text += pytesseract.image_to_string(img, lang="deu+eng") + "\n"

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


def fill_template_placeholders(template_text: str, fields: dict) -> str:
    """Replace {{key}} placeholders in a template string with field values."""
    for key, value in fields.items():
        if value is not None:
            template_text = template_text.replace(f"{{{{{key}}}}}", str(value))
    return template_text
