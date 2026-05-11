"""
PRERNA AI — Speech Intelligence Backend
========================================
Local-first FastAPI service. No external LLM APIs required for analysis.

Replaces:
  - Together API (Llama-3.3-70B)  → CLAW Decision Tree (local math)
  - Agno agent framework          → Plain Python functions
  - Qdrant vector DB              → InsForge PostgreSQL
  - Streamlit frontend            → PRERNA web (Vite)

Keeps (all run locally, 0 API cost):
  - MediaPipe + DeepFace          (facial landmark + emotion detection)
  - Librosa                        (audio signal processing)
  - Faster-Whisper (small model)   (speech-to-text, CPU, int8)
"""

from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile, os, json
from dotenv import load_dotenv

load_dotenv()

from facial_tool import analyze_facial_expressions
from voice_tool import analyze_voice_attributes
from tone_engine import classify_emotional_state
from wellbeing_engine import run_wellbeing_swarm

app = FastAPI(title="PRERNA Speech Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # PRERNA Vite dev server (localhost:5173/5174)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"status": "PRERNA Speech Intelligence Backend is running", "version": "1.0.0"}


@app.post("/analyze")
async def analyze(video: UploadFile = File(...)):
    """
    Full multimodal analysis pipeline.
    Accepts a video file, runs facial + voice analysis locally,
    classifies emotional state via CLAW Decision Tree.
    """
    # Save uploaded video to temp file
    suffix = os.path.splitext(video.filename)[1] or '.mp4'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await video.read()
        tmp.write(content)
        video_path = tmp.name

    try:
        # ── TIER 1: Local Facial Analysis (MediaPipe + DeepFace) ──
        facial_result = analyze_facial_expressions(video_path)
        facial_data = json.loads(facial_result) if isinstance(facial_result, str) else facial_result

        # ── TIER 2: Local Voice Analysis (Librosa + Whisper) ──
        voice_result = analyze_voice_attributes(video_path)
        voice_data = json.loads(voice_result) if isinstance(voice_result, str) else voice_result

        # ── TIER 3: CLAW Decision Tree — No API, Pure Math ──
        tone_result = classify_emotional_state(
            pitch_variation=float(voice_data.get("pitch_variation", 0)),
            speech_rate_wpm=float(voice_data.get("speech_rate_wpm", 120)),
            volume_consistency=float(voice_data.get("volume_consistency", 0.02)),
            transcript=voice_data.get("transcription", ""),
            smile_frequency=facial_data.get("engagement_metrics", {}).get("smile_frequency", 0),
            eye_contact_frequency=facial_data.get("engagement_metrics", {}).get("eye_contact_frequency", 0),
        )

        return JSONResponse(content={
            "status": "success",
            "facial": facial_data,
            "voice": voice_data,
            "tone": tone_result,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(video_path)


@app.post("/analyze-audio")
async def analyze_audio_only(audio: UploadFile = File(...)):
    """
    Lightweight voice-only analysis for the live voice orb feature.
    Accepts audio blob from browser MediaRecorder API.
    """
    suffix = os.path.splitext(audio.filename)[1] or '.webm'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        audio_path = tmp.name

    try:
        voice_result = analyze_voice_attributes(audio_path)
        voice_data = json.loads(voice_result) if isinstance(voice_result, str) else voice_result

        tone_result = classify_emotional_state(
            pitch_variation=float(voice_data.get("pitch_variation", 0)),
            speech_rate_wpm=float(voice_data.get("speech_rate_wpm", 120)),
            volume_consistency=float(voice_data.get("volume_consistency", 0.02)),
            transcript=voice_data.get("transcription", ""),
        )

        return JSONResponse(content={
            "status": "success",
            "voice": voice_data,
            "tone": tone_result,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        os.unlink(audio_path)


@app.post("/wellbeing")
async def mental_wellbeing_assessment(payload: dict):
    """
    CLAW Wellbeing Swarm endpoint.
    Accepts a JSON body with user inputs and optional biometric signals.
    Runs the 3-stage sequential logic:
      1. Assessment Module (CLAW Decision Tree)
      2. Action Module    (NGO Resource Matcher)
      3. Follow-up Module (Milestone Planner)

    No AutoGen, no OpenAI. Pure Python, < 100ms.
    """
    try:
        result = run_wellbeing_swarm(
            mental_state_text=payload.get("mental_state", ""),
            sleep_hours=float(payload.get("sleep_hours", 7)),
            stress_level=int(payload.get("stress_level", 5)),
            support_system=payload.get("support_system", []),
            recent_changes=payload.get("recent_changes", ""),
            symptoms=payload.get("symptoms", []),
            student_name=payload.get("student_name", "friend"),
            # Optional biometric signals from CLAW speech/facial analysis
            pitch_variation=float(payload.get("pitch_variation", 0.0)),
            speech_rate_wpm=float(payload.get("speech_rate_wpm", 120.0)),
            volume_consistency=float(payload.get("volume_consistency", 0.02)),
            smile_frequency=float(payload.get("smile_frequency", 0.0)),
            eye_contact_frequency=float(payload.get("eye_contact_frequency", 0.0)),
        )
        return JSONResponse(content={"status": "success", **result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
