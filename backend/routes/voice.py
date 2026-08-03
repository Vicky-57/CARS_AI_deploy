"""
backend/routes/voice.py — Whisper transcription endpoint (kept from old stack)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from services.whisper_service import transcribe_audio
import tempfile, os

router = APIRouter(prefix="/api/voice", tags=["Voice"])


@router.post("/transcribe")
async def transcribe_voice(file: UploadFile = File(...)):
    """
    Transcribes an audio file using local faster-whisper.
    Returns: { transcript, language, duration_seconds }
    """
    suffix = os.path.splitext(file.filename)[1] or ".ogg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        result = await transcribe_audio(tmp_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(tmp_path)
