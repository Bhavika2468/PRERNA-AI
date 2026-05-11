"""
CLAW WELLBEING ENGINE — Mental Wellbeing Swarm (Native Python)
===============================================================
Replaces AutoGen's initiate_swarm_chat() with three sequential
Python "Agent Modules" that hand off context to each other.

Stage 1: Assessment Module (Signal Logic + CLAW Decision Tree)
Stage 2: Action Module    (Resource Matcher — NGO Database logic)
Stage 3: Follow-up Module (Persistence Layer — milestone planning)

Zero AutoGen, Zero OpenAI API cost.
Optional: Groq API for the empathetic text response (free tier).
Falls back to deterministic template text if Groq is unavailable.

Architecture:
  Input dict → assess() → action() → followup() → WellbeingReport
"""

from __future__ import annotations
import os
import json
from datetime import datetime, timedelta
from typing import Optional
from tone_engine import (
    _keyword_scan,
    _vocal_signals,
    _facial_signals,
    CRISIS_KEYWORDS,
    STRESS_KEYWORDS,
)


# ── NGO Resource Database (pre-verified clinical roadmaps) ──────────────────
# Keyed by detected trigger tag. Mirrors the Sahara NGO logic but specialised
# for mental wellbeing intents.
WELLBEING_NGO_DB = {
    "crisis": {
        "ngo": "iCall — TISS Psychosocial Support",
        "phone": "9152987821",
        "url": "https://icallhelpline.org",
        "desc": "Free, confidential psychological counselling by trained professionals.",
        "steps": [
            "Call iCall right now — they speak Hindi & English",
            "Ask for a same-day session",
            "Tell them exactly what you shared here",
            "If you feel unsafe at home, ask for a safety plan",
        ],
        "emergency": True,
    },
    "anxiety": {
        "ngo": "Vandrevala Foundation Helpline",
        "phone": "1860-2662-345",
        "url": "https://www.vandrevalafoundation.com",
        "desc": "24x7 free mental health helpline — anxiety, panic, and stress.",
        "steps": [
            "Write down 3 things you can see, hear, and touch right now (grounding)",
            "Call the helpline when you feel ready",
            "Try 4-7-8 breathing: inhale 4s, hold 7s, exhale 8s",
            "Limit news/social media to 30 minutes per day",
        ],
        "emergency": False,
    },
    "stress": {
        "ngo": "Pratham Wellbeing Network",
        "phone": "1800-599-0019",
        "url": "https://nimhans.ac.in",
        "desc": "NIMHANS Connect — free tele-mental health by government psychiatrists.",
        "steps": [
            "Schedule a free tele-consultation via NIMHANS",
            "Start a 5-minute daily journaling habit",
            "Take a 10-minute walk outside after each study session",
            "Share one worry with a trusted person today",
        ],
        "emergency": False,
    },
    "loneliness": {
        "ngo": "Samaritans of Mumbai",
        "phone": "+91-8422984528",
        "url": "https://www.samaritansmumbai.com",
        "desc": "Emotional support helpline — you don't have to feel alone.",
        "steps": [
            "Call Samaritans — they listen without judgment",
            "Join one online community around a hobby you love",
            "Reconnect with one person from your past this week",
            "Set a daily 'connection goal': text someone you miss",
        ],
        "emergency": False,
    },
    "low_mood": {
        "ngo": "Snehi Foundation",
        "phone": "+91 44-24640050",
        "url": "https://www.snehiindia.org",
        "desc": "Emotional wellbeing support for depression and low mood.",
        "steps": [
            "Follow a consistent sleep schedule this week",
            "Eat at least one nutritious meal per day",
            "Do 15 minutes of sunlight exposure in the morning",
            "Contact Snehi for a counsellor match",
        ],
        "emergency": False,
    },
    "neutral": {
        "ngo": "iCall — Preventive Wellbeing",
        "phone": "9152987821",
        "url": "https://icallhelpline.org",
        "desc": "Building resilience before challenges arise.",
        "steps": [
            "Maintain your current sleep pattern (it's working!)",
            "Add one new self-care activity this week",
            "Practice gratitude journaling: 3 things each morning",
            "Stay connected with your support network",
        ],
        "emergency": False,
    },
}

# ── Daily Wellness Mission Pool (Milestone Tracker) ──────────────────────────
DAILY_MISSIONS = {
    "crisis":    ["Call the helpline and save the number", "Tell one trusted person you are struggling"],
    "anxiety":   ["Do 4-7-8 breathing for 5 minutes", "Take a screen-free walk outside"],
    "stress":    ["Write down 3 things causing stress, then close the notebook", "Take a 10-minute break every hour"],
    "loneliness":["Text one friend 'Hey, thinking of you'", "Join one online study group"],
    "low_mood":  ["Get 15 minutes of morning sunlight", "Eat a warm, nourishing meal today"],
    "neutral":   ["Write 3 things you are grateful for", "Do one kind thing for yourself today"],
}

# ── Groq empathetic voice (optional, free tier) ──────────────────────────────
GROQ_AVAILABLE = False
try:
    from groq import Groq as GroqClient  # type: ignore
    GROQ_AVAILABLE = bool(os.getenv("GROQ_API_KEY"))
except ImportError:
    pass


def _groq_voice(trigger: str, ngo_name: str, steps: list[str], student_name: str = "friend") -> str:
    """
    Uses Groq (llama-3.1-8b-instant, free tier) ONLY for turning the
    deterministic action plan into a warm, empathetic message.
    Falls back to a template string if Groq is unavailable.
    """
    if not GROQ_AVAILABLE:
        return _template_voice(trigger, ngo_name, steps, student_name)

    try:
        client = GroqClient(api_key=os.getenv("GROQ_API_KEY"))
        steps_text = "\n".join(f"- {s}" for s in steps)
        prompt = f"""
You are Prerna Didi, a warm and empathetic mentor for rural Indian girls.
The student (name: {student_name}) is experiencing: {trigger}.
Write a 2-3 sentence supportive message in simple English (no jargon).
Then tell them the first suggested step: "{steps[0]}".
End with: "You are not alone. I am here."
Do NOT use bullet points. Keep it human and warm.
        """.strip()

        res = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.7,
        )
        return res.choices[0].message.content.strip()
    except Exception:
        return _template_voice(trigger, ngo_name, steps, student_name)


def _template_voice(trigger: str, ngo_name: str, steps: list[str], student_name: str) -> str:
    """Zero-cost deterministic empathetic message template."""
    openers = {
        "crisis":    f"Dear {student_name}, I can hear that you are going through something very hard right now. You are incredibly brave for reaching out, and you don't have to face this alone.",
        "anxiety":   f"Dear {student_name}, it takes courage to acknowledge that anxiety is weighing on you. What you are feeling is real, and it is temporary — things can and do get better.",
        "stress":    f"Dear {student_name}, you are carrying a lot right now, and it's okay to feel overwhelmed. Reaching out is the first and most important step.",
        "loneliness":f"Dear {student_name}, feeling lonely doesn't mean there's something wrong with you. It means you are human, and you deserve connection.",
        "low_mood":  f"Dear {student_name}, low days are part of life, not the whole story. Small steps today can create big changes tomorrow.",
        "neutral":   f"Dear {student_name}, you seem to be doing okay today — and that's worth celebrating. Building wellness habits when you're well makes you stronger for harder days.",
    }
    opener = openers.get(trigger, openers["neutral"])
    return f"{opener}\n\nYour first step: **{steps[0]}**\n\n{ngo_name} is ready to help. You are not alone. I am here. 🌸"


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1: Assessment Module (CLAW Signal Logic)
# Replaces AutoGen's assessment_agent
# ═══════════════════════════════════════════════════════════════════════════════

def run_assessment(
    mental_state_text: str,
    sleep_hours: float,
    stress_level: int,
    support_system: list[str],
    recent_changes: str,
    symptoms: list[str],
    # Optional signal data from CLAW speech/facial analysis
    pitch_variation: float = 0.0,
    speech_rate_wpm: float = 120.0,
    volume_consistency: float = 0.02,
    smile_frequency: float = 0.0,
    eye_contact_frequency: float = 0.0,
) -> dict:
    """
    STAGE 1 — Assessment Module
    Runs the CLAW Decision Tree on text + optional biometric signals.
    Returns a 'WellnessScore' and identified 'trigger' tag.
    """
    # ── Text Signal Analysis ──
    combined_text = f"{mental_state_text} {recent_changes} {' '.join(symptoms)}"
    kw = _keyword_scan(combined_text)

    # ── Vocal + Facial Signals ──
    vocal = _vocal_signals(pitch_variation, speech_rate_wpm, volume_consistency)
    facial = _facial_signals(smile_frequency, eye_contact_frequency)

    # ── Sleep Signal ──
    sleep_crisis = 0
    sleep_stress = 0
    if sleep_hours < 4:
        sleep_crisis = 25
    elif sleep_hours < 6:
        sleep_stress = 20
    elif sleep_hours > 10:
        sleep_stress = 10  # oversleeping = possible depression signal

    # ── Symptom Signal ──
    symptom_crisis_map = {"Suicidal Thoughts", "Self-harm"}
    symptom_stress_map = {
        "Anxiety", "Insomnia", "Fatigue", "Difficulty Concentrating",
        "Mood Swings", "Changes in Appetite", "Social Withdrawal"
    }
    symptom_crisis = sum(1 for s in symptoms if s in symptom_crisis_map) * 30
    symptom_stress = sum(1 for s in symptoms if s in symptom_stress_map) * 8

    # ── Support System Signal ──
    no_support_penalty = 15 if "None" in support_system or len(support_system) == 0 else 0
    has_therapist_bonus = -10 if "Therapist" in support_system else 0

    # ── Stress Level Input ──
    stress_input_score = max(0, (stress_level - 5) * 8)  # 6-10 maps to 8-40

    # ── Score Fusion (weighted) ──
    crisis_score = min(100,
        kw["crisis_kw"] * 0.5
        + vocal.get("crisis_vocal", 0) * 0.2
        + sleep_crisis * 0.15
        + symptom_crisis * 0.15
    )
    stress_score = min(100,
        kw["stress_kw"] * 0.35
        + vocal.get("stress_vocal", 0) * 0.15
        + facial.get("stress_facial", 0) * 0.1
        + sleep_stress * 0.1
        + symptom_stress * 0.1
        + stress_input_score * 0.1
        + no_support_penalty * 0.1
        + has_therapist_bonus
    )
    positive_score = min(100,
        kw["positive_kw"] * 0.5
        + vocal.get("energy_vocal", 0) * 0.3
        + facial.get("positive_facial", 0) * 0.2
    )

    # ── Trigger Classification ──
    # More granular than the 4-class tone engine
    if crisis_score >= 30 or symptom_crisis > 0:
        trigger = "crisis"
    elif stress_level >= 8 and ("Anxiety" in symptoms or kw["stress_kw"] >= 30):
        trigger = "anxiety"
    elif ("Social Withdrawal" in symptoms or "loneliness" in combined_text.lower()
          or "alone" in combined_text.lower()):
        trigger = "loneliness"
    elif ("Depression" in symptoms or "Fatigue" in symptoms) and stress_score >= 25:
        trigger = "low_mood"
    elif stress_score >= 25 or stress_level >= 6:
        trigger = "stress"
    else:
        trigger = "neutral"

    # ── Wellness Score (inverted — higher = worse) ──
    wellness_score = max(0, min(100,
        100 - (crisis_score * 0.5 + stress_score * 0.35 + no_support_penalty * 0.15)
        + (positive_score * 0.2)
    ))

    # ── Clinical Summary (rule-based) ──
    summary_parts = []
    if sleep_hours < 6:
        summary_parts.append(f"Sleep deprivation ({sleep_hours}h/night) is amplifying stress responses.")
    if stress_level >= 7:
        summary_parts.append(f"High self-reported stress (level {stress_level}/10) indicates significant burden.")
    if not support_system or "None" in support_system:
        summary_parts.append("Limited support network increases vulnerability.")
    if symptoms:
        summary_parts.append(f"Active symptoms: {', '.join(symptoms)}.")
    if kw["crisis_kw"] > 0:
        summary_parts.append("⚠️ Crisis indicators detected in language patterns.")

    if not summary_parts:
        summary_parts.append("No significant distress indicators detected. Preventive care recommended.")

    return {
        "stage": "assessment",
        "trigger": trigger,
        "wellness_score": round(wellness_score),
        "scores": {
            "crisis": round(crisis_score),
            "stress": round(stress_score),
            "positive": round(positive_score),
        },
        "clinical_summary": " ".join(summary_parts),
        "sleep_hours": sleep_hours,
        "stress_level": stress_level,
        "symptoms": symptoms,
        "support_system": support_system,
        "engine": "CLAW-Wellbeing-v1",
    }


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2: Action Module (Resource Matcher)
# Replaces AutoGen's action_agent
# ═══════════════════════════════════════════════════════════════════════════════

def run_action(assessment: dict, student_name: str = "friend") -> dict:
    """
    STAGE 2 — Action Module
    Pulls pre-verified clinical roadmap from the NGO database
    based on the trigger identified in Stage 1.
    Generates the empathetic voice message via Groq (free tier) or template.
    """
    trigger = assessment["trigger"]
    resource = WELLBEING_NGO_DB.get(trigger, WELLBEING_NGO_DB["neutral"])

    # ── Immediate Coping Strategies (rule-based, no API) ──
    coping_map = {
        "crisis": [
            "🆘 Call the helpline NOW — save the number: " + resource["phone"],
            "Tell one trusted person where you are",
            "Stay in a safe, populated place",
            "Do not make any big decisions right now",
        ],
        "anxiety": [
            "Try box breathing: inhale 4s → hold 4s → exhale 4s → hold 4s",
            "Ground yourself: name 5 things you can see",
            "Drink a glass of cold water slowly",
            "Step outside for 5 minutes of fresh air",
        ],
        "stress": [
            "Write down everything stressing you — then close the notebook",
            "Take a 10-minute break: no screens, just rest",
            "Ask for help with one task you've been avoiding",
            "Sleep before midnight tonight",
        ],
        "loneliness": [
            "Send a short message to one person you trust right now",
            "Join a free online study group or community",
            "Watch a comforting show or movie",
            "Write a letter to your future self",
        ],
        "low_mood": [
            "Get 10 minutes of sunlight first thing in the morning",
            "Eat one warm, nourishing meal today",
            "Take a slow walk — movement helps the mind",
            "Call or text someone who makes you smile",
        ],
        "neutral": [
            "Maintain your healthy sleep schedule",
            "Add one new activity you enjoy this week",
            "Practice gratitude: write 3 good things from today",
            "Connect with someone from your support network",
        ],
    }

    coping_strategies = coping_map.get(trigger, coping_map["neutral"])

    # ── Generate Empathetic Voice (Groq / template fallback) ──
    voice_message = _groq_voice(
        trigger=trigger,
        ngo_name=resource["ngo"],
        steps=resource["steps"],
        student_name=student_name,
    )

    return {
        "stage": "action",
        "trigger": trigger,
        "resource": resource,
        "coping_strategies": coping_strategies,
        "voice_message": voice_message,
        "is_emergency": resource.get("emergency", False),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 3: Follow-up Module (Persistence Layer)
# Replaces AutoGen's followup_agent
# ═══════════════════════════════════════════════════════════════════════════════

def run_followup(assessment: dict, action: dict) -> dict:
    """
    STAGE 3 — Follow-up Module
    Designs the long-term support strategy and milestone plan.
    Returns a structured follow-up plan ready for InsForge persistence.
    """
    trigger = assessment["trigger"]
    wellness_score = assessment["wellness_score"]

    # ── Check-in Schedule (based on severity) ──
    if trigger == "crisis":
        checkin_days = [1, 3, 7, 14]
        checkin_label = "Daily check-in for the first week"
    elif trigger in ("anxiety", "low_mood"):
        checkin_days = [3, 7, 14, 30]
        checkin_label = "Check-in every 3 days"
    elif trigger == "stress":
        checkin_days = [7, 14, 30]
        checkin_label = "Weekly check-in"
    else:
        checkin_days = [14, 30]
        checkin_label = "Fortnightly check-in"

    now = datetime.utcnow()
    checkin_dates = [(now + timedelta(days=d)).strftime("%Y-%m-%d") for d in checkin_days]
    next_checkin = checkin_dates[0] if checkin_dates else None

    # ── Daily Wellness Missions ──
    missions = DAILY_MISSIONS.get(trigger, DAILY_MISSIONS["neutral"])

    # ── 4-Week Recovery Plan ──
    weekly_plan = {
        "Week 1": "Focus on basic stability: sleep, food, and one call for support.",
        "Week 2": "Introduce one small positive habit (walk, journal, or hobby).",
        "Week 3": "Strengthen your support network — reconnect with one person.",
        "Week 4": "Reflect on progress and set one goal for the next month.",
    }
    if trigger == "crisis":
        weekly_plan["Week 1"] = "Safety first: establish daily contact with a counsellor or trusted person."

    # ── Relapse Prevention Signals (rule-based flags) ──
    warning_signs = {
        "crisis":    ["Feeling trapped or hopeless again", "Withdrawing from all contact", "Not sleeping for 2+ days"],
        "anxiety":   ["Panic attacks increasing", "Avoiding important responsibilities", "Physical symptoms (chest pain, breathlessness)"],
        "stress":    ["Irritability increasing", "Can't concentrate for 5+ minutes", "Skipping meals regularly"],
        "loneliness":["Not leaving room for multiple days", "Refusing all contact", "Feeling invisible"],
        "low_mood":  ["Sleeping 12+ hours", "Losing interest in all activities", "Neglecting hygiene"],
        "neutral":   ["Stress level rising above 7", "Sleep dropping below 6 hours"],
    }

    return {
        "stage": "followup",
        "trigger": trigger,
        "wellness_score": wellness_score,
        "next_checkin": next_checkin,
        "checkin_dates": checkin_dates,
        "checkin_label": checkin_label,
        "daily_missions": missions,
        "weekly_plan": weekly_plan,
        "warning_signs": warning_signs.get(trigger, warning_signs["neutral"]),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# MASTER ORCHESTRATOR — Replaces initiate_swarm_chat()
# ═══════════════════════════════════════════════════════════════════════════════

def run_wellbeing_swarm(
    mental_state_text: str,
    sleep_hours: float,
    stress_level: int,
    support_system: list[str],
    recent_changes: str,
    symptoms: list[str],
    student_name: str = "friend",
    # Optional: biometric signal data from CLAW speech/facial analysis
    pitch_variation: float = 0.0,
    speech_rate_wpm: float = 120.0,
    volume_consistency: float = 0.02,
    smile_frequency: float = 0.0,
    eye_contact_frequency: float = 0.0,
) -> dict:
    """
    CLAW Wellbeing Swarm — Master Orchestrator

    Runs 3 sequential agent modules:
      1. Assessment → 2. Action → 3. Follow-up

    Hand-off is plain Python function calls.
    No AutoGen, no Docker, no heavy ML frameworks.
    Total runtime: < 100ms (pure logic, no model inference).
    """
    # ── Stage 1: Assessment ──
    assessment = run_assessment(
        mental_state_text=mental_state_text,
        sleep_hours=sleep_hours,
        stress_level=stress_level,
        support_system=support_system,
        recent_changes=recent_changes,
        symptoms=symptoms,
        pitch_variation=pitch_variation,
        speech_rate_wpm=speech_rate_wpm,
        volume_consistency=volume_consistency,
        smile_frequency=smile_frequency,
        eye_contact_frequency=eye_contact_frequency,
    )

    # ── Stage 2: Action (hand-off from assessment) ──
    action = run_action(assessment=assessment, student_name=student_name)

    # ── Stage 3: Follow-up (hand-off from action) ──
    followup = run_followup(assessment=assessment, action=action)

    return {
        "assessment": assessment,
        "action": action,
        "followup": followup,
        "generated_at": datetime.utcnow().isoformat(),
        "engine": "CLAW-WellbeingSwarm-v1",
    }
