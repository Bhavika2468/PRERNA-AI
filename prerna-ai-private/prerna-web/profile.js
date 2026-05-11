import { createClient } from '@insforge/sdk';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

// ============================================================
// Step Navigation Logic
// ============================================================
let currentStep = 1;

function showStep(step) {
    document.querySelectorAll('.form-card').forEach(el => el.classList.add('hidden'));
    document.getElementById(`step-${step}`).classList.remove('hidden');

    // Update step dots
    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`step-dot-${i}`);
        dot.classList.remove('active', 'done');
        if (i < step) dot.classList.add('done');
        if (i === step) dot.classList.add('active');
    }
    
    // Update step lines
    const lines = document.querySelectorAll('.step-line');
    lines.forEach((line, i) => {
        line.classList.toggle('done', i < step - 1);
    });

    currentStep = step;
}

function showError(stepId, msg) {
    const el = document.getElementById(`${stepId}-error`);
    el.textContent = msg;
    el.style.display = 'block';
}

function clearError(stepId) {
    const el = document.getElementById(`${stepId}-error`);
    if (el) el.style.display = 'none';
}

// STEP 1 → 2
document.getElementById('next-1').addEventListener('click', () => {
    clearError('step1');
    const name = document.getElementById('full-name').value.trim();
    const age = parseInt(document.getElementById('age').value);
    const email = document.getElementById('email').value.trim();
    
    if (!name) return showError('step1', 'Please enter your full name.');
    if (!email || !email.includes('@')) return showError('step1', 'Please enter a valid email address.');
    if (!age || age < 10 || age > 30) return showError('step1', 'Please enter a valid age between 10 and 30.');
    
    showStep(2);
});

// STEP 2 → 3
document.getElementById('next-2').addEventListener('click', () => {
    clearError('step2');
    const classLevel = document.getElementById('class-level').value;
    const location = document.getElementById('location').value.trim();
    
    if (!classLevel) return showError('step2', 'Please select your current class level.');
    if (!location) return showError('step2', 'Please enter your village or district name.');
    
    showStep(3);
});

// Back navigation
document.getElementById('back-2').addEventListener('click', () => showStep(1));
document.getElementById('back-3').addEventListener('click', () => showStep(2));

// ============================================================
// FINAL SAVE - localStorage-first, DB sync in background
// ============================================================
document.getElementById('save-profile').addEventListener('click', async () => {
    clearError('step3');
    const btn = document.getElementById('save-profile');

    // Collect all data
    const fullName = document.getElementById('full-name').value.trim();
    const age = parseInt(document.getElementById('age').value);
    const email = document.getElementById('email').value.trim();
    const classLevel = document.getElementById('class-level').value;
    const location = document.getElementById('location').value.trim();
    const parentMobile = document.getElementById('parent-mobile').value.trim();

    btn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> <span>Saving securely...</span>`;
    btn.disabled = true;

    const isScholarshipEligible = age >= 17 && age <= 20;

    // ── 1. Save to agentMemory (localStorage) FIRST ──────────────────────
    // This guarantees the user always gets through even if the DB is not ready
    const agentMemory = {
        full_name: fullName,
        age: age,
        email: email,
        class_level: classLevel,
        location: location,
        scholarship_eligible: isScholarshipEligible,
        profile_complete: true,
        loaded_at: new Date().toISOString()
    };
    localStorage.setItem('prerna_agent_memory', JSON.stringify(agentMemory));

    // ── 2. Silently sync to InsForge DB (non-blocking) ───────────────────
    try {
        let userId = null;
        try {
            const user = await client.auth.getCurrentUser();
            userId = user?.id || null;
        } catch (_) { /* no auth session — fine */ }

        await client.database
            .from('profiles')
            .upsert([{
                user_id: userId,
                full_name: fullName,
                email: email,
                age: age,
                class_level: classLevel,
                location: location,
                parent_mobile: parentMobile || null,
                profile_complete: true,
                scholarship_eligible: isScholarshipEligible
            }])
            .select();

        console.log('Profile synced to InsForge DB!');
    } catch (dbErr) {
        // DB sync failed — not a blocker. agentMemory already saved.
        console.warn('DB sync skipped:', dbErr?.message || dbErr);
    }

    // ── 3. Show success and redirect ─────────────────────────────────────
    showStep('success');
    document.getElementById('welcome-msg').textContent =
        `Welcome, ${fullName.split(' ')[0]}! 🌸 Your AI assistant knows your profile. Taking you to your dashboard...`;

    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2500);
});
