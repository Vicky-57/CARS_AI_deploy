import os
import tempfile
from fastapi import APIRouter, UploadFile, File, HTTPException
from services import whisper_service, claude_service, pdf_service

router = APIRouter(prefix="/api", tags=["OCR & Voice"])


@router.post("/ocr/parse")
async def parse_document(file: UploadFile = File(...)):
    """Upload a PDF or image scan → extract raw OCR text."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    suffix = os.path.splitext(file.filename)[-1].lower()
    if suffix not in {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp"}:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF or image.")

    content = await file.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        text = pdf_service.extract_document_text(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass

    return {
        "filename": file.filename,
        "text": text,
        "char_count": len(text),
    }


@router.post("/voice/transcribe")
async def transcribe_voice(file: UploadFile = File(...)):
    """Upload an audio file → Whisper transcription + Claude action extraction."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided.")

    content = await file.read()
    suffix = os.path.splitext(file.filename)[-1].lower()

    # Transcribe via local Whisper
    transcript = whisper_service.transcribe_bytes(content, suffix=suffix)

    # Extract actions via Claude
    analysis = await claude_service.extract_voice_actions(transcript)

    return {
        "transcript": transcript,
        "analysis": analysis,
    }
