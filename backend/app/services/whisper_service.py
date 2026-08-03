"""
app/services/whisper_service.py
────────────────────────────────────────────────────────────────────────
Whisper Audio Transcription Service using faster-whisper.
"""
import os
import tempfile
from faster_whisper import WhisperModel
from config import settings

_model: WhisperModel | None = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        print(f"Loading Whisper model '{settings.WHISPER_MODEL_SIZE}'...")
        _model = WhisperModel(settings.WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
        print("Whisper model loaded.")
    return _model


def transcribe_audio(file_path: str, language: str | None = None) -> str:
    """Transcribe an audio file using local faster-whisper."""
    model = get_model()
    segments, _ = model.transcribe(file_path, beam_size=5, language=language, temperature=0.0)
    return " ".join(seg.text for seg in segments).strip()


def transcribe_bytes(audio_bytes: bytes, suffix: str = ".mp3") -> str:
    """Transcribe audio from bytes."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        return transcribe_audio(tmp_path)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
