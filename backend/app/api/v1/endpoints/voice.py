import tempfile
import os
import asyncio
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.whisper_service import transcribe_audio
from app.services.claude_service import extract_voice_actions

router = APIRouter(prefix="/voice", tags=["Voice Transcription"])


@router.post("/transcribe")
async def transcribe_voice_note(file: UploadFile = File(...)):
    """
    Upload a voice note (audio file).
    Transcribes audio via local Whisper and extracts action items via Claude.
    """
    suffix = os.path.splitext(file.filename or "audio")[1] or ".ogg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        # Run sync Whisper transcription in executor pool
        transcript = await asyncio.get_event_loop().run_in_executor(
            None, transcribe_audio, tmp_path
        )
        # Extract action items with Claude
        actions = await extract_voice_actions(transcript)

        return {
            "transcript": transcript,
            **actions
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice transcription error: {str(e)}")
    finally:
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
