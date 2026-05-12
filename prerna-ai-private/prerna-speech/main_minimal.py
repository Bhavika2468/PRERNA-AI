"""
PRERNA AI — Minimal Backend (Development Mode)
This is a simplified version without heavy AI/ML dependencies.
Replace main.py with this to get the app running locally for UI development.
"""

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import json

app = FastAPI(title="PRERNA Speech Intelligence API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "status": "PRERNA Speech Intelligence Backend is running",
        "version": "1.0.0",
        "mode": "development (minimal)"
    }


@app.post("/analyze")
async def analyze(video: UploadFile = File(...)):
    """Mock analysis endpoint for frontend testing"""
    return JSONResponse(content={
        "status": "success",
        "facial": {
            "confidence": 0.92,
            "emotions": {
                "joy": 0.45,
                "sadness": 0.1,
                "anger": 0.05,
                "surprise": 0.3,
                "neutral": 0.1
            },
            "engagement_metrics": {
                "smile_frequency": 0.7,
                "eye_contact_frequency": 0.65,
                "head_movement": 0.3
            }
        },
        "voice": {
            "transcription": "Hello, this is a test message.",
            "pitch_variation": 12.5,
            "speech_rate_wpm": 145,
            "volume_consistency": 0.89,
            "confidence": 0.88
        },
        "tone": {
            "primary_emotion": "joy",
            "confidence": 0.85,
            "wellbeing_score": 7.2
        }
    })


@app.post("/analyze-audio")
async def analyze_audio_only(audio: UploadFile = File(...)):
    """Mock audio-only analysis for voice orb feature"""
    return JSONResponse(content={
        "status": "success",
        "voice": {
            "transcription": "Test audio message",
            "pitch_variation": 10.2,
            "speech_rate_wpm": 140,
            "volume_consistency": 0.85,
            "confidence": 0.90
        },
        "tone": {
            "primary_emotion": "calm",
            "confidence": 0.88,
            "wellbeing_score": 7.5
        }
    })


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
