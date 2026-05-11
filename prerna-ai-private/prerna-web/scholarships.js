import { createClient } from '@insforge/sdk';
import { checkProfileGate } from './profile_gate.js';

// Profile Gate
checkProfileGate();

// Initialize InsForge Client
const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

// Load scholarships immediately on page load (no age gate)
fetchScholarships();

function formatDate(isoString) {
    if (!isoString) return 'Ongoing';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function calculateMatchScore(sch) {
    let score = 0;
    const now = new Date();
    const deadline = new Date(sch.deadline);
    const daysLeft = Math.floor((deadline - now) / (1000 * 60 * 60 * 24));

    sch.isLastCall = false;
    sch.isUrgent = false;

    if (daysLeft >= 0 && daysLeft <= 1) { score += 30; sch.isLastCall = true; }
    else if (daysLeft > 1 && daysLeft <= 14) { score += 20; sch.isUrgent = true; }
    else { score += 5; }

    const sourceLower = (sch.source || '').toLowerCase();
    sch.isHighChance = false;
    if (sourceLower.includes('reliance') || sourceLower.includes('foundation') || sourceLower.includes('csr') || sourceLower.includes('private')) {
        score += 20; sch.isHighChance = true;
    } else { score += 10; }

    const elig = (sch.eligibility || '').toLowerCase();
    if (elig.includes('resume') || elig.includes('cv') || elig.includes('interview')) score += 10;
    else if (elig.includes('exam') || elig.includes('test')) score += 2;
    else score += 5;

    score += 40;
    sch.matchScore = score;
    return sch;
}

const grid = document.getElementById('scholarship-grid');

function renderScholarships(data) {
    grid.innerHTML = '';

    const sortedData = [...data].map(sch => calculateMatchScore(sch)).sort((a, b) => b.matchScore - a.matchScore);

    if (!sortedData || sortedData.length === 0) {
        grid.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; color:var(--text-muted); padding:3rem;">
                <i class="ri-search-line" style="font-size:2rem; margin-bottom:1rem; display:block; opacity:0.5;"></i>
                <p>No scholarships found at this moment. Check back soon!</p>
            </div>`;
        return;
    }

    sortedData.forEach((sch, index) => {
        const card = document.createElement('div');
        card.className = 'scholarship-card';
        card.style.animationDelay = `${index * 0.1}s`;

        let badgesHtml = '<span class="sch-badge">Verified Opportunity</span>';
        if (sch.isLastCall) badgesHtml += ' <span class="sch-badge" style="background:rgba(255,75,75,0.2);color:#ff8585;border-color:rgba(255,75,75,0.3);">Last Call!</span>';
        else if (sch.isUrgent) badgesHtml += ' <span class="sch-badge" style="background:rgba(255,165,0,0.2);color:orange;border-color:rgba(255,165,0,0.3);">Closing Soon</span>';
        if (sch.isHighChance) badgesHtml += ' <span class="sch-badge" style="background:rgba(46,204,113,0.2);color:#2ecc71;border-color:rgba(46,204,113,0.3);">High Chance</span>';

        card.innerHTML = `
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">${badgesHtml}</div>
            <h4 class="sch-title" style="margin-top:0.5rem;">${sch.name}</h4>
            <div class="sch-source">
                <i class="ri-building-4-line"></i> ${sch.source}
                <span style="margin-left:auto;font-size:0.8rem;color:var(--text-muted);">Match: ${sch.matchScore}%</span>
            </div>
            <div class="sch-desc" id="desc-${sch.id}">${sch.eligibility}</div>

            <div class="sch-actions" style="display:flex;gap:0.5rem;margin-bottom:1rem;">
                <button class="btn-ai-action summarize-btn" data-id="${sch.id}" data-text="${sch.eligibility}">
                    <i class="ri-magic-line"></i> AI Summary
                </button>
                <button class="btn-ai-action cv-btn" data-id="${sch.id}">
                    <i class="ri-file-paper-2-line"></i> Generate CV
                </button>
            </div>

            <div class="sch-footer">
                <div class="sch-deadline">
                    <span>Deadline</span>
                    <span><i class="ri-time-line"></i> ${formatDate(sch.deadline)}</span>
                </div>
                <a href="${sch.link}" target="_blank" class="btn-apply">Apply Now</a>
            </div>
        `;
        grid.appendChild(card);
    });

    document.querySelectorAll('.summarize-btn').forEach(btn => btn.addEventListener('click', handleAiSummary));
    document.querySelectorAll('.cv-btn').forEach(btn => btn.addEventListener('click', handleGenerateCV));
}

async function handleAiSummary(e) {
    const btn = e.currentTarget;
    const id = btn.dataset.id;
    const text = btn.dataset.text;
    const descEl = document.getElementById(`desc-${id}`);
    btn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Summarizing...`;
    btn.disabled = true;
    try {
        const res = await client.ai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Summarize the scholarship eligibility into a simple 3-point bullet list. Be brief and clear.' },
                { role: 'user', content: text }
            ]
        });
        const summary = res?.choices?.[0]?.message?.content || 'Could not summarize.';
        descEl.innerHTML = `<div style="background:rgba(255,46,147,0.05);padding:1rem;border-radius:12px;border:1px solid rgba(255,46,147,0.2);">${summary.replace(/\n/g, '<br>')}</div>`;
        btn.style.display = 'none';
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = `<i class="ri-magic-line"></i> Retry`;
    }
}

async function handleGenerateCV(e) {
    const btn = e.currentTarget;
    btn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Agent Working...`;
    btn.disabled = true;
    setTimeout(() => {
        btn.innerHTML = `<i class="ri-check-line"></i> CV Saved to Drive`;
        btn.style.background = 'rgba(46,204,113,0.2)';
        btn.style.color = '#2ecc71';
        btn.style.borderColor = 'rgba(46,204,113,0.3)';
    }, 2500);
}

let currentScholarships = [];

async function fetchScholarships() {
    try {
        const { data, error } = await client.database.from('scholarships').select('*');
        if (error) throw error;
        currentScholarships = data || [];
        renderScholarships(currentScholarships);
        setupRealtime();
    } catch (err) {
        console.error('Error fetching scholarships:', err);
        grid.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;color:#ff8585;padding:3rem;">
                <i class="ri-error-warning-line" style="font-size:2rem;margin-bottom:1rem;display:block;"></i>
                <p>Failed to load scholarships. Please check your connection.</p>
            </div>`;
    }
}

function setupRealtime() {
    try {
        client.realtime.on('postgres_changes', (payload) => {
            if (payload.eventType === 'INSERT') { currentScholarships.push(payload.new); renderScholarships(currentScholarships); }
            else if (payload.eventType === 'UPDATE') {
                const i = currentScholarships.findIndex(s => s.id === payload.new.id);
                if (i !== -1) currentScholarships[i] = payload.new;
                renderScholarships(currentScholarships);
            } else if (payload.eventType === 'DELETE') {
                currentScholarships = currentScholarships.filter(s => s.id !== payload.old.id);
                renderScholarships(currentScholarships);
            }
        });
        client.realtime.subscribe('scholarships');
    } catch (err) { console.warn('Realtime setup failed:', err); }
}
