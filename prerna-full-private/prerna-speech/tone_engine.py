"""
CLAW DECISION TREE — Tone & Emotional State Classifier
========================================================
This is the core "CLAW Logic" replacement for the LLM-based tone analysis.
It uses mathematical signal analysis on vocal features — zero API cost,
runs in < 5ms on any CPU.

Signal Map:
  pitch_variation  → emotional expressiveness (low = monotone/sad)
  speech_rate_wpm  → urgency/anxiety (high = anxious, very low = exhausted)
  volume_std       → emotional volatility (high spikes = fear/distress)
  transcript       → semantic keyword scan (bilingual EN + Hindi)
  smile_frequency  → facial positivity signal
  eye_contact      → engagement / confidence
"""

import re


# ── Bilingual Crisis/Stress Lexicon (Tier 1 keyword scan) ──
CRISIS_KEYWORDS = [
    # English
    "scared", "terrified", "afraid", "fear", "help me", "emergency",
    "pain", "hurt", "suffering", "abuse", "beaten", "hitting me",
    "harass", "rape", "assault", "unsafe", "danger", "trapped",
    "die", "dying", "death", "suicide", "kill myself", "end it all",
    "run away", "can't escape", "locked", "forced marriage", "no way out",
    "nobody cares", "completely alone", "give up", "hopeless",
    # Hindi / Hinglish
    "dar lag raha", "bahut dar", "bachao", "madad karo", "dara hua",
    "mujhe darr", "khud ko khatam", "mar jao", "nikal jaao",
    "zindagi khatam", "koi nahi", "akeli hoon", "chhod do mujhe",
]

STRESS_KEYWORDS = [
    "worried", "anxious", "nervous", "so stressed", "under pressure",
    "confused", "lost", "don't know what to do", "failing",
    "failed exam", "can't focus", "can't study", "depressed",
    "sad", "crying", "feel like crying", "no future", "what do i do",
    "nobody helps me", "feel like giving up", "nothing is working",
    "pareshan", "tension hai", "samajh nahi aata", "dar lagta",
]

POSITIVE_KEYWORDS = [
    "happy", "excited", "motivated", "confident", "ready",
    "thank you", "great", "wonderful", "amazing", "love this",
    "so good", "feeling good", "doing well",
]


def _keyword_scan(text: str) -> dict:
    """Fast O(n) keyword scan. Returns raw signal scores."""
    lower = text.lower()
    crisis_hits = sum(1 for kw in CRISIS_KEYWORDS if kw in lower)
    stress_hits = sum(1 for kw in STRESS_KEYWORDS if kw in lower)
    positive_hits = sum(1 for kw in POSITIVE_KEYWORDS if kw in lower)
    return {
        "crisis_kw": min(crisis_hits * 20, 100),
        "stress_kw": min(stress_hits * 15, 100),
        "positive_kw": min(positive_hits * 15, 100),
    }


def _vocal_signals(pitch_variation: float, speech_rate_wpm: float, volume_consistency: float) -> dict:
    """
    Maps vocal bio-signals to emotional indicators.

    Research basis:
    - Low pitch std (< 15Hz) → monotone → sadness/exhaustion
    - High speech rate (> 190 wpm) → anxiety/urgency
    - Very low speech rate (< 70 wpm) → despair/exhaustion
    - High volume std (> 0.05 RMS) → emotional volatility/fear
    """
    signals = {"crisis_vocal": 0, "stress_vocal": 0, "energy_vocal": 0}

    # Pitch variation: monotone is a crisis/depression signal
    if pitch_variation < 10:
        signals["crisis_vocal"] += 30  # Very monotone
    elif pitch_variation < 20:
        signals["stress_vocal"] += 20  # Slightly flat
    elif pitch_variation > 80:
        signals["energy_vocal"] += 20  # Highly expressive

    # Speech rate
    if speech_rate_wpm < 60:
        signals["crisis_vocal"] += 25  # Extremely slow → despair
    elif speech_rate_wpm < 90:
        signals["stress_vocal"] += 15  # Slow → low energy
    elif speech_rate_wpm > 200:
        signals["stress_vocal"] += 25  # Too fast → anxiety
    elif 100 <= speech_rate_wpm <= 160:
        signals["energy_vocal"] += 10  # Healthy range

    # Volume consistency (std of RMS energy)
    if volume_consistency > 0.06:
        signals["crisis_vocal"] += 20  # Large spikes → emotional volatility
    elif volume_consistency > 0.04:
        signals["stress_vocal"] += 10

    return signals


def _facial_signals(smile_frequency: float = 0, eye_contact_frequency: float = 0) -> dict:
    """Maps facial engagement metrics to emotional signals."""
    signals = {"positive_facial": 0, "stress_facial": 0}

    # Smile frequency: 0.0 to 1.0
    if smile_frequency < 0.05:
        signals["stress_facial"] += 15  # Almost no smiling
    elif smile_frequency > 0.3:
        signals["positive_facial"] += 20  # Frequently smiling

    # Eye contact
    if eye_contact_frequency < 0.2:
        signals["stress_facial"] += 10  # Avoiding eye contact
    elif eye_contact_frequency > 0.6:
        signals["positive_facial"] += 10  # Good engagement

    return signals


def classify_emotional_state(
    pitch_variation: float,
    speech_rate_wpm: float,
    volume_consistency: float,
    transcript: str,
    smile_frequency: float = 0.0,
    eye_contact_frequency: float = 0.0,
) -> dict:
    """
    CLAW Decision Tree — Master classifier.

    Fuses all signal layers into final tone scores (0-100 each).
    Returns: dominant state, all scores, coaching feedback, confidence.
    """
    kw = _keyword_scan(transcript)
    vocal = _vocal_signals(pitch_variation, speech_rate_wpm, volume_consistency)
    facial = _facial_signals(smile_frequency, eye_contact_frequency)

    # ── Weighted Score Fusion ──
    # Keywords carry the most weight (user intent is explicit)
    # Vocal signals are the next most reliable
    # Facial signals add context
    crisis_score = min(100, kw["crisis_kw"] * 0.6 + vocal["crisis_vocal"] * 0.3 + 0)
    stress_score = min(100, kw["stress_kw"] * 0.5 + vocal["stress_vocal"] * 0.35 + facial["stress_facial"] * 0.15)
    positive_score = min(100, kw["positive_kw"] * 0.5 + vocal["energy_vocal"] * 0.3 + facial["positive_facial"] * 0.2)
    neutral_score = max(0, 100 - crisis_score - stress_score * 0.5)

    # ── Final Decision ──
    if crisis_score >= 35:
        dominant = "crisis"
    elif stress_score >= 35:
        dominant = "stress"
    elif positive_score >= 40:
        dominant = "positive"
    else:
        dominant = "neutral"

    # ── Confidence: how decisive the leading score is ──
    all_scores = [crisis_score, stress_score, positive_score, neutral_score]
    sorted_scores = sorted(all_scores, reverse=True)
    confidence = min(100, int(sorted_scores[0] - sorted_scores[1] + 50))

    # ── Coaching Feedback (rule-based, no API needed) ──
    coaching = _generate_coaching(dominant, pitch_variation, speech_rate_wpm, volume_consistency, smile_frequency)

    return {
        "dominant": dominant,
        "confidence": confidence,
        "scores": {
            "crisis": round(crisis_score),
            "stress": round(stress_score),
            "positive": round(positive_score),
            "neutral": round(neutral_score),
        },
        "vocal_signals": {
            "pitch_variation": round(pitch_variation, 2),
            "speech_rate_wpm": round(speech_rate_wpm, 1),
            "volume_std": round(volume_consistency, 4),
            "assessment": _pitch_assessment(pitch_variation),
            "rate_assessment": _rate_assessment(speech_rate_wpm),
        },
        "facial_signals": {
            "smile_frequency": round(smile_frequency, 3),
            "eye_contact_frequency": round(eye_contact_frequency, 3),
        },
        "coaching": coaching,
        "engine": "CLAW-DecisionTree-v1",
    }


def _pitch_assessment(pitch_variation: float) -> str:
    if pitch_variation < 10:
        return "Very monotone — may indicate low energy or sadness"
    elif pitch_variation < 25:
        return "Slightly flat — try adding more vocal expression"
    elif pitch_variation < 60:
        return "Good range — natural and engaging"
    else:
        return "High variation — very expressive speaking"


def _rate_assessment(wpm: float) -> str:
    if wpm < 60:
        return "Very slow — may indicate exhaustion or low confidence"
    elif wpm < 100:
        return "Slow — consider speaking slightly faster"
    elif wpm <= 160:
        return "Ideal pace — clear and well-paced"
    elif wpm <= 200:
        return "Fast — try slowing down slightly for clarity"
    else:
        return "Very fast — listeners may struggle to follow"


def _generate_coaching(dominant, pitch_var, rate, vol_std, smile_freq) -> list:
    """Rule-based coaching tips. Zero API cost."""
    tips = []

    if dominant == "crisis":
        tips.append("It sounds like you might be going through something difficult. You are not alone — Sahara support is here for you.")
        return tips  # Immediate support, skip performance tips

    if dominant == "stress":
        tips.append("Take a slow, deep breath before speaking — it helps your voice sound more confident.")

    if pitch_var < 20:
        tips.append("Try varying your tone more — raise your pitch slightly for exciting points, lower it for serious ones.")

    if rate > 190:
        tips.append("You're speaking quite fast. Pause briefly after key sentences to let your words land.")
    elif rate < 80:
        tips.append("Speaking a little faster will help you sound more energetic and confident.")

    if vol_std > 0.05:
        tips.append("Your volume is inconsistent — try maintaining a steady, controlled voice throughout.")

    if smile_freq < 0.05:
        tips.append("A natural smile, even while speaking seriously, builds trust and warmth with your audience.")

    if not tips:
        tips.append("Great delivery! Keep practicing to maintain this level of confidence.")

    return tips
