/**
 * manas.js — CLAW Wellbeing Swarm Frontend
 * Calls /wellbeing on the Python backend (prerna-speech FastAPI).
 * Animates the 3-agent pipeline: Assessment → Action → Follow-up.
 */
import { checkProfileGate } from './profile_gate.js';
checkProfileGate();

const BACKEND = 'http://127.0.0.1:8000';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const form          = document.getElementById('manas-form');
const submitBtn     = document.getElementById('manas-submit-btn');
const loader        = document.getElementById('manas-loader');
const results       = document.getElementById('manas-results');
const formSection   = document.getElementById('manas-form-section');
const hero          = document.getElementById('manas-hero');
const crisBanner    = document.getElementById('crisis-banner');
const restartBtn    = document.getElementById('manas-restart-btn');
const saveBtn       = document.getElementById('manas-save-btn');

// Slider displays
const sleepSlider   = document.getElementById('manas-sleep');
const sleepVal      = document.getElementById('manas-sleep-val');
const stressSlider  = document.getElementById('manas-stress');
const stressVal     = document.getElementById('manas-stress-val');

sleepSlider.addEventListener('input', () => sleepVal.textContent = sleepSlider.value);
stressSlider.addEventListener('input', () => {
  stressVal.textContent = stressSlider.value;
  stressSlider.style.background = `linear-gradient(to right, #10b981 0%, #10b981 ${(stressSlider.value-1)/9*100}%, rgba(255,255,255,0.1) ${(stressSlider.value-1)/9*100}%, rgba(255,255,255,0.1) 100%)`;
});

// ── Chip multi-select ─────────────────────────────────────────────────────────
function initChips(containerId) {
  const container = document.getElementById(containerId);
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => chip.classList.toggle('selected'));
  });
}
initChips('support-chips');
initChips('symptom-chips');

function getSelectedChips(containerId) {
  return [...document.getElementById(containerId).querySelectorAll('.chip.selected')]
    .map(c => c.dataset.value);
}

// ── Close crisis banner ───────────────────────────────────────────────────────
document.getElementById('close-crisis-banner').addEventListener('click', () => {
  crisBanner.style.display = 'none';
});

// ── Loader Animation helpers ─────────────────────────────────────────────────
function setAgentState(id, state, msg) {
  const agent = document.getElementById(`loader-${id}`);
  const status = document.getElementById(`status-${id}`);
  const prog   = document.getElementById(`prog-${id}`);
  agent.className = `swarm-agent ${state}`;
  status.textContent = msg;
  if (state === 'active') prog.style.width = '60%';
  if (state === 'done')   prog.style.width = '100%';
}

async function animateLoader() {
  setAgentState('assess', 'active', 'Analyzing signals...');
  await sleep(900);
  setAgentState('assess', 'done', '✓ Complete');
  setAgentState('action', 'active', 'Matching resources...');
  await sleep(700);
  setAgentState('action', 'done', '✓ Complete');
  setAgentState('followup', 'active', 'Planning milestones...');
  await sleep(600);
  setAgentState('followup', 'done', '✓ Complete');
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── TRIGGER LABELS ────────────────────────────────────────────────────────────
const TRIGGER_META = {
  crisis:    { label: '⚠️ Crisis Detected', color: '#f87171' },
  anxiety:   { label: '😰 Anxiety & Worry', color: '#fbbf24' },
  stress:    { label: '😤 High Stress', color: '#fb923c' },
  loneliness:{ label: '💙 Feeling Lonely', color: '#60a5fa' },
  low_mood:  { label: '😔 Low Mood', color: '#a78bfa' },
  neutral:   { label: '😊 Stable & Well', color: '#6ee7b7' },
};

// ── FORM SUBMIT ───────────────────────────────────────────────────────────────
form.addEventListener('submit', async e => {
  e.preventDefault();

  const payload = {
    mental_state:   document.getElementById('manas-mental-state').value.trim(),
    sleep_hours:    parseFloat(sleepSlider.value),
    stress_level:   parseInt(stressSlider.value),
    support_system: getSelectedChips('support-chips'),
    recent_changes: document.getElementById('manas-changes').value.trim(),
    symptoms:       getSelectedChips('symptom-chips'),
    student_name:   'friend', // TODO: pull from InsForge profile
    // Biometric signals from CLAW Voice (if stored in sessionStorage by voice.js)
    pitch_variation:     parseFloat(sessionStorage.getItem('claw_pitch_variation') || '0'),
    speech_rate_wpm:     parseFloat(sessionStorage.getItem('claw_speech_rate_wpm') || '120'),
    volume_consistency:  parseFloat(sessionStorage.getItem('claw_volume_consistency') || '0.02'),
    smile_frequency:     parseFloat(sessionStorage.getItem('claw_smile_frequency') || '0'),
    eye_contact_frequency: parseFloat(sessionStorage.getItem('claw_eye_contact_frequency') || '0'),
  };

  // Show loader
  submitBtn.disabled = true;
  formSection.style.opacity = '0.4';
  loader.style.display = 'block';
  results.style.display = 'none';

  const loaderAnim = animateLoader();

  let data;
  try {
    const res = await fetch(`${BACKEND}/wellbeing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    data = await res.json();
  } catch (err) {
    // Backend unavailable — run client-side fallback
    data = clientFallback(payload);
  }

  await loaderAnim;
  await sleep(400);

  loader.style.display = 'none';
  formSection.style.opacity = '1';
  submitBtn.disabled = false;

  renderResults(data);
});

// ── CLIENT FALLBACK (if Python backend is off) ────────────────────────────────
function clientFallback(p) {
  const text = `${p.mental_state} ${p.recent_changes}`.toLowerCase();
  let trigger = 'neutral';
  const crisisKw = ['scared','help','danger','suicide','die','bachao','trapped'];
  const stressKw = ['stressed','anxious','worried','tension','depressed','fail','alone'];
  if (crisisKw.some(k => text.includes(k)) || p.symptoms.includes('Suicidal Thoughts')) trigger = 'crisis';
  else if (p.stress_level >= 8 && p.symptoms.includes('Anxiety')) trigger = 'anxiety';
  else if (p.symptoms.includes('Social Withdrawal') || text.includes('alone')) trigger = 'loneliness';
  else if (p.symptoms.includes('Depression') || p.symptoms.includes('Fatigue')) trigger = 'low_mood';
  else if (p.stress_level >= 6) trigger = 'stress';

  const wellness = Math.max(20, 100 - p.stress_level * 8 + (p.sleep_hours >= 7 ? 10 : 0));

  const NGOs = {
    crisis:    { ngo:'iCall — TISS', phone:'9152987821', url:'https://icallhelpline.org', steps:['Call iCall now','Stay in a safe place','Tell someone you trust'], emergency: true },
    anxiety:   { ngo:'Vandrevala Foundation', phone:'1860-2662-345', url:'https://vandrevalafoundation.com', steps:['Try 4-7-8 breathing','Call the helpline','Limit screens to 30min'], emergency: false },
    stress:    { ngo:'NIMHANS Connect', phone:'1800-599-0019', url:'https://nimhans.ac.in', steps:['Journal your worries','Take breaks','Book a free tele-consult'], emergency: false },
    loneliness:{ ngo:'Samaritans Mumbai', phone:'+91-8422984528', url:'https://samaritansmumbai.com', steps:['Call Samaritans','Text one trusted person','Join a study group'], emergency: false },
    low_mood:  { ngo:'Snehi Foundation', phone:'+91 44-24640050', url:'https://snehiindia.org', steps:['15min morning sunlight','Eat one warm meal','Contact Snehi'], emergency: false },
    neutral:   { ngo:'iCall — Preventive', phone:'9152987821', url:'https://icallhelpline.org', steps:['Keep your sleep routine','Add a self-care habit','Practice gratitude'], emergency: false },
  };

  const missions = {
    crisis:['Call the helpline today','Tell one person you are struggling'],
    anxiety:['Do 4-7-8 breathing','Take a screen-free walk'],
    stress:['Write down 3 worries then close the notebook','Take a 10-min break hourly'],
    loneliness:["Text a friend 'thinking of you'",'Join one online community'],
    low_mood:['Get 15min morning sunlight','Eat a nourishing meal'],
    neutral:['Write 3 gratitudes','Do one kind thing for yourself'],
  };

  const weekly = {
    'Week 1':'Focus on basic stability: sleep, food, one support call.',
    'Week 2':'Introduce one positive habit (walk, journal, or hobby).',
    'Week 3':'Strengthen support — reconnect with one person.',
    'Week 4':'Reflect on progress and set one goal for next month.',
  };

  const resource = NGOs[trigger];
  return {
    status: 'success (offline)',
    assessment: {
      trigger, wellness_score: wellness,
      scores: { crisis: trigger==='crisis'?70:10, stress: p.stress_level*8, positive: 30 },
      clinical_summary: p.symptoms.length ? `Active symptoms: ${p.symptoms.join(', ')}.` : 'No major symptoms reported.',
      symptoms: p.symptoms, support_system: p.support_system, sleep_hours: p.sleep_hours, stress_level: p.stress_level,
    },
    action: {
      trigger, resource, is_emergency: resource.emergency,
      coping_strategies: resource.steps,
      voice_message: `Dear friend, I hear you. Your first step is: **${resource.steps[0]}**. You are not alone. I am here. 🌸`,
    },
    followup: {
      trigger, wellness_score: wellness,
      daily_missions: missions[trigger] || missions.neutral,
      next_checkin: new Date(Date.now() + 7*86400000).toISOString().split('T')[0],
      weekly_plan: weekly,
      warning_signs: ['Stress rising above 8','Sleep dropping below 5h'],
      checkin_label: 'Weekly check-in',
    },
  };
}

// ── RENDER RESULTS ────────────────────────────────────────────────────────────
function renderResults(data) {
  const { assessment, action, followup } = data;
  const meta = TRIGGER_META[assessment.trigger] || TRIGGER_META.neutral;

  // Show crisis banner if needed
  if (action.is_emergency) crisBanner.style.display = 'flex';

  // ── Wellness Score Ring ──
  const score = assessment.wellness_score;
  document.getElementById('ws-score-num').textContent = score;
  const circ = document.getElementById('ws-circle');
  const circumference = 2 * Math.PI * 40; // r=40
  const offset = circumference - (score / 100) * circumference;
  circ.style.strokeDashoffset = offset;
  circ.style.stroke = score < 30 ? '#f87171' : score < 60 ? '#fbbf24' : '#6ee7b7';

  document.getElementById('ws-trigger-title').textContent = meta.label;
  document.getElementById('ws-clinical-summary').textContent = assessment.clinical_summary;
  document.getElementById('ws-scores-row').innerHTML = `
    <span class="ws-score-chip chip-crisis">Crisis: ${assessment.scores.crisis}</span>
    <span class="ws-score-chip chip-stress">Stress: ${assessment.scores.stress}</span>
    <span class="ws-score-chip chip-positive">Positive: ${assessment.scores.positive}</span>
  `;

  // ── Prerna Voice ──
  const pvText = document.getElementById('pv-text');
  pvText.innerHTML = action.voice_message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
  document.getElementById('pv-mode').textContent = `${meta.label} — CLAW Agent Response`;

  document.getElementById('pv-speak-btn').onclick = () => {
    const utterance = new SpeechSynthesisUtterance(pvText.textContent);
    utterance.rate = 0.9; utterance.lang = 'en-IN';
    window.speechSynthesis.speak(utterance);
  };

  // ── Assessment Panel ──
  const r = action.resource;
  document.getElementById('panel-assess-body').innerHTML = `
    <div class="panel-section-title">Clinical Summary</div>
    <p style="font-size:0.88rem;color:var(--text-muted);line-height:1.6;">${assessment.clinical_summary}</p>
    <div class="panel-section-title">Key Signals Detected</div>
    <ul>
      <li>Sleep: ${assessment.sleep_hours}h/night ${assessment.sleep_hours < 6 ? '⚠️ Below recommended' : '✓ Adequate'}</li>
      <li>Stress Level: ${assessment.stress_level}/10 ${assessment.stress_level >= 7 ? '⚠️ High' : '✓ Manageable'}</li>
      <li>Support System: ${assessment.support_system.length ? assessment.support_system.join(', ') : 'None reported ⚠️'}</li>
      ${assessment.symptoms.length ? `<li>Symptoms: ${assessment.symptoms.join(', ')}</li>` : ''}
    </ul>
    <div class="panel-section-title">Engine</div>
    <p style="font-size:0.78rem;color:var(--text-muted);">CLAW-WellbeingSwarm-v1 · Pure signal logic · No API cost</p>
  `;

  // ── Action Panel ──
  const stepsHtml = r.steps.map(s => `<li>${s}</li>`).join('');
  const copingHtml = action.coping_strategies.map(s => `<li>${s}</li>`).join('');
  document.getElementById('panel-action-body').innerHTML = `
    <div class="panel-section-title">Immediate Coping Strategies</div>
    <ul>${copingHtml}</ul>
    <div class="panel-section-title">Your Matched Support Resource</div>
    <div class="ngo-box-mini">
      <h5>${r.ngo}</h5>
      <p>${r.desc || 'Professional mental health support.'}</p>
      <div class="ngo-meta-row">
        <a href="tel:${r.phone}"><i class="ri-phone-fill"></i> ${r.phone}</a>
        <a href="${r.url}" target="_blank" rel="noopener"><i class="ri-external-link-line"></i> Visit Website</a>
      </div>
    </div>
    <div class="panel-section-title">Recommended Action Steps</div>
    <ul>${stepsHtml}</ul>
  `;

  // ── Follow-up Panel ──
  const weeklyHtml = Object.entries(followup.weekly_plan || {})
    .map(([w, t]) => `<div class="week-card"><div class="week-label">${w}</div><div class="week-text">${t}</div></div>`).join('');
  const warningHtml = (followup.warning_signs || [])
    .map(w => `<span class="warning-chip">${w}</span>`).join('');

  document.getElementById('panel-followup-body').innerHTML = `
    <div class="panel-section-title">${followup.checkin_label}</div>
    <p style="font-size:0.88rem;color:var(--text-muted);">Scheduled check-ins: ${(followup.checkin_dates || [followup.next_checkin]).join(' · ')}</p>
    <div class="panel-section-title">4-Week Recovery Plan</div>
    <div class="weekly-plan-grid">${weeklyHtml}</div>
    <div class="panel-section-title">⚠️ Warning Signs to Watch For</div>
    <div class="warning-chips">${warningHtml}</div>
  `;

  // ── Daily Mission ──
  const missions = followup.daily_missions || [];
  document.getElementById('dm-missions').innerHTML = missions.map((m, i) => `
    <div class="dm-mission-item" id="mission-${i}" onclick="this.classList.toggle('done')">
      <div class="dm-checkbox"><i class="ri-check-line" style="font-size:0.8rem;color:white;display:none;"></i></div>
      <span>${m}</span>
    </div>
  `).join('');
  document.getElementById('dm-next-checkin').textContent = followup.next_checkin || '7 days';

  // Show results
  results.style.display = 'block';
  hero.style.display = 'none';
  results.scrollIntoView({ behavior: 'smooth' });

  // Store in sessionStorage for persistence
  sessionStorage.setItem('manas_last_result', JSON.stringify({
    trigger: assessment.trigger,
    wellness_score: assessment.wellness_score,
    next_checkin: followup.next_checkin,
    timestamp: new Date().toISOString(),
  }));
}

// ── Restart ───────────────────────────────────────────────────────────────────
restartBtn.addEventListener('click', () => {
  results.style.display = 'none';
  hero.style.display = 'flex';
  formSection.style.display = 'block';
  crisBanner.style.display = 'none';
  form.reset();
  sleepVal.textContent = '7';
  stressVal.textContent = '5';
  document.querySelectorAll('.chip.selected').forEach(c => c.classList.remove('selected'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ── Save to Profile ────────────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  const saved = JSON.parse(sessionStorage.getItem('manas_last_result') || '{}');
  if (!saved.trigger) return;
  // TODO: POST to InsForge student profile table
  saveBtn.innerHTML = '<i class="ri-check-line"></i> Saved!';
  saveBtn.style.background = 'rgba(16,185,129,0.3)';
  setTimeout(() => {
    saveBtn.innerHTML = '<i class="ri-save-line"></i> Save to Profile';
    saveBtn.style.background = '';
  }, 2500);
});
