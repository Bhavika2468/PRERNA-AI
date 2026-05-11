/**
 * PRERNA AI — Voice Navigator
 * =====================================================
 * Architecture (Zero External Dependencies):
 *
 *  [ Browser SpeechRecognition ]   ← Free, no API, works offline
 *            ↓ raw text
 *  [ CLAW Tone Gate — Tier 1 ]     ← Local keyword scan (0ms, 0 cost)
 *            ↓ if ambiguous
 *  [ CLAW Tone Gate — Tier 2 ]     ← AI semantic scoring via InsForge
 *            ↓ tone: crisis | stress | neutral | positive
 *  [ State Router ]
 *    ├─ crisis   → Safety Override + NGO Alert (Sahara)
 *    └─ normal   → Query Engine (InsForge AI + agentMemory context)
 *            ↓ response text
 *  [ Browser SpeechSynthesis ]     ← Free TTS, voice tuned by age
 *  [ InsForge DB ]                 ← Log emotional check-ins
 * =====================================================
 */

import { createClient } from '@insforge/sdk';
import { checkProfileGate, injectUserName, getAgentMemory } from './profile_gate.js';

checkProfileGate();
injectUserName('header-user-name');

const client = createClient({
    baseUrl: 'https://c8kd4983.us-east.insforge.app',
    anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

const agentMemory = getAgentMemory();

// ============================================================
// CLAW TONE ENGINE — Tier 1: Local Keyword Dictionary
// This runs in < 1ms with zero API cost.
// ============================================================
const TONE_LEXICON = {
    crisis: {
        weight: 10,
        keywords: [
            'scared', 'fear', 'afraid', 'terror', 'help me', 'emergency',
            'pain', 'hurt', 'suffering', 'abuse', 'beaten', 'hit me',
            'harass', 'rape', 'touch', 'inappropriate', 'unsafe', 'danger',
            'die', 'dying', 'death', 'suicide', 'kill', 'end it',
            'run away', 'escape', 'trapped', 'locked', 'cannot leave',
            'forced', 'married off', 'child marriage', 'not allowed',
            'darr lag raha', 'dara hua', 'mujhe dar', 'bachao', 'madad karo'
        ]
    },
    stress: {
        weight: 5,
        keywords: [
            'worried', 'anxious', 'nervous', 'stressed', 'pressure',
            'confused', 'lost', 'don\'t know', 'no idea', 'failing',
            'failed', 'exam failed', 'not studying', 'can\'t focus',
            'depressed', 'sad', 'crying', 'tears', 'hopeless',
            'give up', 'no future', 'what to do', 'nobody helps'
        ]
    },
    positive: {
        weight: -3,
        keywords: [
            'happy', 'excited', 'great', 'wonderful', 'thank you', 'thanks',
            'love', 'amazing', 'confident', 'ready', 'motivated'
        ]
    }
};

/**
 * TIER 1: Fast local keyword scan.
 * Returns scores for each tone category.
 */
function tier1KeywordScan(text) {
    const lower = text.toLowerCase();
    const scores = { crisis: 0, stress: 0, neutral: 0, positive: 0 };

    for (const [tone, config] of Object.entries(TONE_LEXICON)) {
        for (const kw of config.keywords) {
            if (lower.includes(kw)) {
                if (tone === 'positive') scores.positive += Math.abs(config.weight);
                else scores[tone] += config.weight;
            }
        }
    }

    // Normalize to 0-100
    const max = 50;
    scores.crisis = Math.min(100, (scores.crisis / max) * 100);
    scores.stress = Math.min(100, (scores.stress / max) * 100);
    scores.positive = Math.min(100, (scores.positive / max) * 100);
    scores.neutral = Math.max(0, 100 - scores.crisis - scores.stress * 0.5);

    return scores;
}

/**
 * TIER 2: AI Semantic Tone Scoring (only called when Tier 1 is ambiguous)
 * Uses InsForge AI Gateway — cheap, fast, private.
 */
async function tier2AISentiment(text) {
    try {
        const res = await client.ai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [{
                role: 'system',
                content: `You are an emotional tone analyzer for an Indian rural student support app.
Analyze the text and return ONLY a JSON object with:
{"crisis": 0-100, "stress": 0-100, "neutral": 0-100, "positive": 0-100, "dominant": "crisis|stress|neutral|positive", "reason": "1 sentence"}
No markdown. Raw JSON only.`
            }, {
                role: 'user',
                content: `Analyze tone: "${text}"`
            }]
        });

        const raw = res?.choices?.[0]?.message?.content || '{}';
        const match = raw.match(/\{[\s\S]*\}/);
        return match ? JSON.parse(match[0]) : null;
    } catch (_) {
        return null; // Tier 2 failure is non-fatal
    }
}

/**
 * MASTER TONE ANALYSIS — Routes through both tiers.
 * Returns: { scores, dominant, reason, tier }
 */
async function analyzeTone(text) {
    const t1 = tier1KeywordScan(text);

    // Tier 1 is decisive if any score is high
    const t1Max = Math.max(t1.crisis, t1.stress);
    if (t1.crisis >= 30 || t1.stress >= 30 || t1.positive >= 30) {
        const dominant = t1.crisis >= 30 ? 'crisis'
            : t1.stress >= 30 ? 'stress'
            : 'positive';
        return {
            scores: t1,
            dominant,
            reason: `Detected ${dominant} indicators in your words.`,
            tier: 'Tier 1 — Keyword Engine'
        };
    }

    // Tier 2: Ambiguous — escalate to AI
    const t2 = await tier2AISentiment(text);
    if (t2) {
        return {
            scores: t2,
            dominant: t2.dominant || 'neutral',
            reason: t2.reason || 'AI sentiment analysis complete.',
            tier: 'Tier 2 — AI Semantic Engine'
        };
    }

    // Fallback
    return {
        scores: { crisis: 0, stress: 20, neutral: 80, positive: 0 },
        dominant: 'neutral',
        reason: 'Could not determine tone — treating as neutral.',
        tier: 'Fallback'
    };
}

// ============================================================
// QUERY ENGINE — The CLAW Logic Core
// Routes the query based on tone + builds system prompt
// from agentMemory (the "memory injection").
// ============================================================
async function queryEngine(text, toneResult) {
    const { dominant } = toneResult;

    // ── Build personalized context from agentMemory ──
    const memCtx = agentMemory ? `
STUDENT PROFILE (injected from agentMemory):
- Name: ${agentMemory.full_name}
- Age: ${agentMemory.age}
- Education: ${agentMemory.class_level.replace(/_/g, ' ')}
- Location: ${agentMemory.location}
- Scholarship eligible: ${agentMemory.scholarship_eligible ? 'YES' : 'NO'}
    `.trim() : 'No profile loaded.';

    // ── Tone-aware persona selection ──
    const age = agentMemory?.age || 16;
    let persona, voiceStyle;

    if (age <= 14) {
        persona = 'Prerna Didi (elder sister, warm and simple)';
        voiceStyle = 'Use very simple Hindi-English words. Be like a caring elder sister.';
    } else if (age <= 17) {
        persona = 'Prerna Didi (mentor, encouraging)';
        voiceStyle = 'Be motivating and structured. Use clear steps.';
    } else {
        persona = 'Prerna AI (peer advisor, professional)';
        voiceStyle = 'Be professional yet warm. Use career-focused language.';
    }

    // ── Stress mode: extra empathy before advice ──
    const stressPrefix = dominant === 'stress'
        ? 'Start with one sentence of genuine empathy before giving advice. '
        : '';

    const systemPrompt = `You are ${persona} for PRERNA AI, a support app for rural Indian girls.
${voiceStyle}
${stressPrefix}
${memCtx}

RULES:
- Speak as if talking out loud (this will be converted to speech)
- Keep response under 5 sentences for voice clarity
- If the student asks about scholarships, mention her scholarship eligibility status
- Always end with one encouraging sentence
- Do NOT use bullet points, markdown, or special characters
- Use simple, warm language`;

    const res = await client.ai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
        ]
    });

    return res?.choices?.[0]?.message?.content || 'I am here for you. Please ask me anything.';
}

// ============================================================
// VOICE PERSONALITY — Tuned by age
// ============================================================
function getVoicePersonality() {
    const age = agentMemory?.age || 16;
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(v =>
        v.lang.startsWith('en') && (v.name.toLowerCase().includes('female') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.includes('Rishi'))
    ) || voices.find(v => v.lang.startsWith('en')) || voices[0];

    return {
        voice: femaleVoice,
        rate: age <= 14 ? 0.85 : age <= 17 ? 0.9 : 0.95,
        pitch: age <= 14 ? 1.2 : age <= 17 ? 1.1 : 1.0,
        volume: 1.0
    };
}

function speakText(text) {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const personality = getVoicePersonality();
    if (personality.voice) utter.voice = personality.voice;
    utter.rate = personality.rate;
    utter.pitch = personality.pitch;
    utter.volume = personality.volume;

    const speakBtn = document.getElementById('speak-btn');
    utter.onstart = () => speakBtn?.classList.add('speaking');
    utter.onend = () => speakBtn?.classList.remove('speaking');

    window.speechSynthesis.speak(utter);
}

// ============================================================
// UI UPDATERS
// ============================================================
function setOrbState(state) {
    const orb = document.getElementById('main-orb');
    const icon = document.getElementById('orb-icon');
    const status = document.getElementById('orb-status');

    orb.className = 'orb';
    if (state === 'listening') {
        orb.classList.add('listening');
        icon.className = 'ri-mic-fill';
        status.textContent = 'Listening... speak now';
    } else if (state === 'thinking') {
        orb.classList.add('thinking');
        icon.className = 'ri-loader-4-line ri-spin';
        status.textContent = 'Analyzing your words...';
    } else if (state === 'crisis') {
        orb.classList.add('crisis-mode');
        icon.className = 'ri-shield-cross-line';
        status.textContent = 'Crisis detected — showing support';
    } else {
        icon.className = 'ri-mic-2-line';
        status.textContent = 'Tap the orb to speak';
    }
}

function renderToneCard(toneResult) {
    const { scores, dominant, reason, tier } = toneResult;
    const card = document.getElementById('tone-card');
    const bars = document.getElementById('tone-bars');
    const summary = document.getElementById('tone-summary');
    const badge = document.getElementById('tone-tier-badge');

    badge.textContent = tier;

    const tones = ['crisis', 'stress', 'neutral', 'positive'];
    bars.innerHTML = tones.map(t => `
        <div class="tone-bar-row tone-bar-${t}">
            <span class="tone-bar-label">${t.charAt(0).toUpperCase() + t.slice(1)}</span>
            <div class="tone-bar-track">
                <div class="tone-bar-fill" style="width: ${Math.round(scores[t] || 0)}%"></div>
            </div>
            <span class="tone-bar-val">${Math.round(scores[t] || 0)}%</span>
        </div>
    `).join('');

    summary.textContent = reason;
    card.style.display = 'block';

    // Update status bar
    const dot = document.getElementById('tone-dot');
    const label = document.getElementById('tone-label');
    const chip = document.getElementById('tone-score-chip');

    dot.className = `tone-dot ${dominant}`;
    const labels = {
        crisis: '⚠️ Crisis tone detected',
        stress: '😟 Stress / worry detected',
        neutral: '😐 Neutral tone',
        positive: '😊 Positive energy!'
    };
    label.textContent = labels[dominant] || 'Tone analyzed';
    chip.textContent = `Dominant: ${dominant}`;
    chip.style.display = 'inline-flex';
}

function renderResponse(text, dominant) {
    const card = document.getElementById('response-card');
    const responseText = document.getElementById('response-text');
    const persona = document.getElementById('response-persona');
    const mode = document.getElementById('response-mode');
    const avatar = document.getElementById('response-avatar');

    const age = agentMemory?.age || 16;
    const modeMap = {
        crisis: ['Crisis Override', '🛡️'],
        stress: ['Emotional Support Mode', '💜'],
        neutral: ['Career Guidance', '🌸'],
        positive: ['Encouragement Mode', '⭐']
    };
    const [modeLabel, emoji] = modeMap[dominant] || ['Career Guidance', '🌸'];

    persona.textContent = age <= 14 ? 'Prerna Didi' : age <= 17 ? 'Prerna Mentor' : 'Prerna AI';
    mode.textContent = modeLabel;
    avatar.textContent = emoji;

    responseText.textContent = '';
    card.style.display = 'block';

    // Typewriter effect
    let i = 0;
    const interval = setInterval(() => {
        responseText.textContent += text[i] || '';
        i++;
        if (i >= text.length) clearInterval(interval);
    }, 18);
}

function logCheckin(text, dominant) {
    const list = document.getElementById('checkin-list');
    const section = document.getElementById('history-section');
    const colors = { crisis: '#ef4444', stress: '#f59e0b', neutral: '#a78bfa', positive: '#2ecc71' };
    const item = document.createElement('div');
    item.className = 'checkin-item';
    item.innerHTML = `
        <div class="checkin-tone" style="background:${colors[dominant] || '#a78bfa'}"></div>
        <span class="checkin-text">"${text.substring(0, 60)}..."</span>
        <span class="checkin-time">${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    list.prepend(item);
    section.style.display = 'block';
}

async function saveCheckinToDb(text, toneScores, dominant) {
    try {
        await client.database.from('emotional_checkins').insert([{
            user_name: agentMemory?.full_name || 'Anonymous',
            message_text: text.substring(0, 300),
            tone_crisis: Math.round(toneScores.crisis || 0),
            tone_stress: Math.round(toneScores.stress || 0),
            tone_dominant: dominant,
            checked_at: new Date().toISOString()
        }]);
    } catch (_) { /* Table may not exist yet — non-fatal */ }
}

// ============================================================
// MAIN FLOW — Voice Input → Tone → Response
// ============================================================
async function processVoiceInput(text) {
    if (!text.trim()) return;

    // Show transcript
    document.getElementById('transcript-text').textContent = `"${text}"`;
    document.getElementById('transcript-box').style.display = 'block';
    document.getElementById('crisis-card').style.display = 'none';
    document.getElementById('response-card').style.display = 'none';
    document.getElementById('tone-card').style.display = 'none';

    setOrbState('thinking');

    // ── STEP 1: CLAW Tone Analysis ──
    const toneResult = await analyzeTone(text);
    const { dominant, scores } = toneResult;

    renderToneCard(toneResult);
    logCheckin(text, dominant);
    saveCheckinToDb(text, scores, dominant);

    // ── STEP 2: State Router ──
    if (dominant === 'crisis') {
        setOrbState('crisis');
        document.getElementById('crisis-card').style.display = 'block';

        // Still generate a compassionate response
        const reply = await queryEngine(
            `A student said: "${text}". She may be in distress. Respond with maximum empathy and guide her to Sahara support.`,
            toneResult
        );
        renderResponse(reply, 'crisis');
        speakText(reply);
    } else {
        // ── STEP 3: Query Engine ──
        const reply = await queryEngine(text, toneResult);
        setOrbState('idle');
        renderResponse(reply, dominant);
        speakText(reply);
    }
}

// ============================================================
// SPEECH RECOGNITION SETUP
// ============================================================
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        document.getElementById('orb-status').textContent = 'Voice not supported. Use Chrome or Edge.';
        return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
            .map(r => r[0].transcript)
            .join('');
        document.getElementById('transcript-text').textContent = `"${transcript}"`;
        document.getElementById('transcript-box').style.display = 'block';

        if (event.results[event.results.length - 1].isFinal) {
            processVoiceInput(transcript);
        }
    };

    recognition.onerror = (event) => {
        console.warn('SpeechRecognition error:', event.error);
        setOrbState('idle');
        if (event.error === 'not-allowed') {
            document.getElementById('orb-status').textContent = 'Microphone permission denied. Allow it in your browser.';
        } else {
            document.getElementById('orb-status').textContent = 'Could not hear clearly. Try again.';
        }
    };

    recognition.onend = () => {
        if (document.getElementById('main-orb').classList.contains('listening')) {
            setOrbState('idle');
        }
    };

    return recognition;
}

// ============================================================
// CONTROLS
// ============================================================
let recognition = null;
let isListening = false;

document.getElementById('main-orb').addEventListener('click', () => {
    if (!recognition) recognition = initSpeechRecognition();
    if (!recognition) return;

    if (isListening) {
        recognition.stop();
        isListening = false;
        setOrbState('idle');
    } else {
        window.speechSynthesis.cancel();
        recognition.start();
        isListening = true;
        setOrbState('listening');
        document.getElementById('quick-prompts').style.display = 'none';
    }
});

// Speak button
document.getElementById('speak-btn').addEventListener('click', () => {
    const text = document.getElementById('response-text').textContent;
    if (text) speakText(text);
});

// Quick prompt chips
document.querySelectorAll('.prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const text = chip.dataset.text;
        document.getElementById('quick-prompts').style.display = 'none';
        processVoiceInput(text);
    });
});

// Ensure voices are loaded
window.speechSynthesis.onvoiceschanged = () => { /* voices ready */ };

// ============================================================
// DEEP ANALYSIS MODULE
// Connects to prerna-speech FastAPI backend (local Python service)
// Falls back gracefully if backend is not running.
// ============================================================
const BACKEND_URL = 'http://localhost:8000';

// UI element refs
const daVideoInput    = document.getElementById('da-video-input');
const daDropZone      = document.getElementById('da-drop-zone');
const daBrowseBtn     = document.getElementById('da-browse-btn');
const daPreviewSection = document.getElementById('da-preview-section');
const daVideoPreview  = document.getElementById('da-video-preview');
const daAnalyzeBtn    = document.getElementById('da-analyze-btn');
const daClearBtn      = document.getElementById('da-clear-btn');
const daLoading       = document.getElementById('da-loading');
const daLoadingMsg    = document.getElementById('da-loading-msg');
const daResults       = document.getElementById('da-results');
const daBackendNotice = document.getElementById('da-backend-notice');

let selectedVideoFile = null;

// File browse
daBrowseBtn.addEventListener('click', () => daVideoInput.click());
daDropZone.addEventListener('click', () => daVideoInput.click());

daVideoInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadVideoPreview(file);
});

// Drag-and-drop
daDropZone.addEventListener('dragover', (e) => { e.preventDefault(); daDropZone.classList.add('dragover'); });
daDropZone.addEventListener('dragleave', () => daDropZone.classList.remove('dragover'));
daDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    daDropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) loadVideoPreview(file);
});

function loadVideoPreview(file) {
    selectedVideoFile = file;
    const url = URL.createObjectURL(file);
    daVideoPreview.src = url;
    document.getElementById('da-upload-area').style.display = 'none';
    daPreviewSection.style.display = 'block';
    daResults.style.display = 'none';
    daLoading.style.display = 'none';
}

daClearBtn.addEventListener('click', () => {
    selectedVideoFile = null;
    daVideoPreview.src = '';
    daVideoInput.value = '';
    daPreviewSection.style.display = 'none';
    daResults.style.display = 'none';
    document.getElementById('da-upload-area').style.display = 'block';
});

daAnalyzeBtn.addEventListener('click', runDeepAnalysis);

async function runDeepAnalysis() {
    if (!selectedVideoFile) return;

    daResults.style.display = 'none';
    daLoading.style.display = 'flex';
    daAnalyzeBtn.disabled = true;
    daLoadingMsg.textContent = 'Uploading video to CLAW engine...';

    const formData = new FormData();
    formData.append('video', selectedVideoFile);

    try {
        daLoadingMsg.textContent = 'Running facial expression analysis (MediaPipe + DeepFace)...';

        const response = await fetch(`${BACKEND_URL}/analyze`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) throw new Error(`Backend error: ${response.status}`);

        const result = await response.json();
        daLoadingMsg.textContent = 'Rendering CLAW results...';

        renderDeepResults(result);
        daBackendNotice.style.display = 'none';

    } catch (err) {
        console.error('Deep Analysis error:', err);

        if (err.message.includes('fetch') || err.message.includes('Failed')) {
            // Backend not running
            daBackendNotice.style.display = 'flex';
            daResults.style.display = 'block';
            renderDeepResultsOffline();
        } else {
            daBackendNotice.style.display = 'none';
            daResults.style.display = 'block';
            daResults.innerHTML = `<p style="color:#ff8585; text-align:center;">Analysis failed: ${err.message}</p>`;
        }
    } finally {
        daLoading.style.display = 'none';
        daAnalyzeBtn.disabled = false;
    }
}

function renderDeepResults(result) {
    const { voice, facial, tone } = result;

    // ── Vocal Signals ──
    document.getElementById('da-speech-rate').textContent = `${voice.speech_rate_wpm} wpm`;
    document.getElementById('da-rate-assess').textContent = tone.vocal_signals?.rate_assessment || '—';
    document.getElementById('da-pitch').textContent = `σ ${voice.pitch_variation} Hz`;
    document.getElementById('da-pitch-assess').textContent = tone.vocal_signals?.assessment || '—';
    document.getElementById('da-words').textContent = `${voice.word_count} words in ${voice.duration_seconds}s`;

    // ── Facial Signals ──
    const smilePct = Math.round((facial.engagement_metrics?.smile_frequency || 0) * 100);
    const eyePct   = Math.round((facial.engagement_metrics?.eye_contact_frequency || 0) * 100);
    document.getElementById('da-smile').textContent = `${smilePct}% of frames`;
    document.getElementById('da-eye').textContent   = `${eyePct}% of frames`;

    const timeline = facial.emotion_timeline || [];
    const dominantEmotion = timeline.length > 0
        ? Object.entries(timeline.reduce((acc, e) => { acc[e.emotion] = (acc[e.emotion] || 0) + 1; return acc; }, {}))
            .sort((a, b) => b[1] - a[1])[0]?.[0]
        : 'Neutral';
    document.getElementById('da-emotion').textContent = dominantEmotion;

    // ── CLAW Tone Bars ──
    renderToneBarsInElement('da-tone-bars', tone.scores || {});

    // ── Dominant Badge ──
    const badgeColors = {
        crisis:   ['rgba(239,68,68,0.15)', '#ef4444'],
        stress:   ['rgba(245,158,11,0.15)', '#f59e0b'],
        positive: ['rgba(46,204,113,0.15)', '#2ecc71'],
        neutral:  ['rgba(167,139,250,0.15)', '#a78bfa'],
    };
    const [bg, color] = badgeColors[tone.dominant] || badgeColors.neutral;
    const domBadge = document.getElementById('da-dominant-badge');
    domBadge.style.background = bg;
    domBadge.style.color = color;
    domBadge.textContent = `Dominant: ${tone.dominant?.toUpperCase()} — ${tone.confidence}% confidence`;

    // ── Transcript ──
    document.getElementById('da-transcript').textContent = voice.transcription || 'No speech detected.';

    // ── Coaching Tips ──
    if (tone.coaching && tone.coaching.length > 0) {
        const list = document.getElementById('da-coaching-list');
        list.innerHTML = tone.coaching.map(tip => `<li>${tip}</li>`).join('');
        document.getElementById('da-coaching-box').style.display = 'block';
    }

    daResults.style.display = 'block';
}

function renderToneBarsInElement(containerId, scores) {
    const container = document.getElementById(containerId);
    const tones = ['crisis', 'stress', 'neutral', 'positive'];
    container.innerHTML = tones.map(t => `
        <div class="tone-bar-row tone-bar-${t}">
            <span class="tone-bar-label">${t.charAt(0).toUpperCase() + t.slice(1)}</span>
            <div class="tone-bar-track">
                <div class="tone-bar-fill" style="width:${Math.round(scores[t] || 0)}%"></div>
            </div>
            <span class="tone-bar-val">${Math.round(scores[t] || 0)}%</span>
        </div>
    `).join('');
}

function renderDeepResultsOffline() {
    // Show placeholder state when backend is offline
    document.getElementById('da-speech-rate').textContent = 'Backend offline';
    document.getElementById('da-rate-assess').textContent = 'Start the Python service to analyze';
    document.getElementById('da-pitch').textContent = '—';
    document.getElementById('da-pitch-assess').textContent = '—';
    document.getElementById('da-words').textContent = '—';
    document.getElementById('da-smile').textContent = '—';
    document.getElementById('da-eye').textContent = '—';
    document.getElementById('da-emotion').textContent = '—';
    document.getElementById('da-transcript').textContent = 'Python backend required for local analysis.';
    document.getElementById('da-coaching-box').style.display = 'none';
    daResults.style.display = 'block';
}

// Backend help link
document.getElementById('da-backend-help')?.addEventListener('click', (e) => {
    e.preventDefault();
    alert(
        'To start the CLAW Speech Analysis backend:\n\n' +
        '1. Open a terminal\n' +
        '2. cd prerna-speech\n' +
        '3. pip install -r requirements.txt\n' +
        '4. uvicorn main:app --reload\n\n' +
        'Keep that terminal open while using Deep Analysis.'
    );
});

