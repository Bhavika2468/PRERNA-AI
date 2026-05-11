"""
Voice Analysis Tool
Adapted for PRERNA AI — uses Librosa + Faster-Whisper locally.
Faster-Whisper uses the "small" model with int8 quantization → runs on 4GB RAM CPU.
No external API calls.
"""

import os
import json
import tempfile
import numpy as np
import librosa

from moviepy import VideoFileClip
from faster_whisper import WhisperModel


# Load model once at module level (avoids reloading per request)
_whisper_model = None

def _get_whisper_model() -> WhisperModel:
    global _whisper_model
    if _whisper_model is None:
        # "small" model + int8 quantization = ~500MB RAM, runs on CPU
        _whisper_model = WhisperModel("small", device="cpu", compute_type="int8")
    return _whisper_model


def _extract_audio(video_path: str) -> str:
    """Extract audio track from video and save as .wav."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.wav')
    tmp.close()
    clip = VideoFileClip(video_path)
    clip.audio.write_audiofile(tmp.name, logger=None)
    clip.close()
    return tmp.name


def _transcribe(audio_path: str) -> str:
    """Run Faster-Whisper transcription. Returns full text."""
    model = _get_whisper_model()
    segments, _ = model.transcribe(audio_path, language="en", beam_size=3)
    return " ".join(seg.text for seg in segments).strip()


def analyze_voice_attributes(file_path: str) -> str:
    """
    Analyzes voice from audio or video file.

    Extracts:
    - transcription (Faster-Whisper, local)
    - speech_rate_wpm  (words per minute)
    - pitch_variation  (std of pitch frequencies — low = monotone)
    - volume_consistency (std of RMS energy — high = volatile)

    Returns JSON string.
    """
    _, ext = os.path.splitext(file_path)
    ext = ext.lower()

    audio_path = None
    is_temp = False

    try:
        # Extract audio if input is video
        if ext in ['.mp4', '.mov', '.avi', '.webm', '.mkv']:
            audio_path = _extract_audio(file_path)
            is_temp = True
        else:
            audio_path = file_path

        # ── Transcription ──
        try:
            transcription = _transcribe(audio_path)
        except Exception as e:
            transcription = f"[Transcription failed: {e}]"

        # ── Acoustic Analysis via Librosa ──
        y, sr = librosa.load(audio_path, sr=16000, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)

        # Speech rate (words per minute)
        words = transcription.split()
        speech_rate = len(words) / max(duration / 60.0, 0.01)

        # Pitch variation: std of detected pitch values (Hz)
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        pitch_values = pitches[magnitudes > np.median(magnitudes) * 1.5]
        pitch_variation = float(np.std(pitch_values)) if pitch_values.size > 0 else 0.0

        # Volume consistency: std of per-frame RMS energy
        rms = librosa.feature.rms(y=y)[0]
        volume_consistency = float(np.std(rms))

        return json.dumps({
            "transcription": transcription,
            "speech_rate_wpm": round(speech_rate, 2),
            "pitch_variation": round(pitch_variation, 2),
            "volume_consistency": round(volume_consistency, 6),
            "duration_seconds": round(duration, 1),
            "word_count": len(words),
        })

    except Exception as e:
        return json.dumps({
            "error": str(e),
            "transcription": "",
            "speech_rate_wpm": 0,
            "pitch_variation": 0,
            "volume_consistency": 0,
        })
    finally:
        if is_temp and audio_path and os.path.exists(audio_path):
            os.unlink(audio_path)
