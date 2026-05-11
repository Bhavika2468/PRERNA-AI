import { createClient } from '@insforge/sdk';
import { checkProfileGate, injectUserName, getAgentMemory } from './profile_gate.js';

// Profile Gate
checkProfileGate();
injectUserName('header-user-name');

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

const agentMemory = getAgentMemory();

// ============================================================
// Tab Navigation
// ============================================================
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// ============================================================
// AI Helper
// ============================================================
async function callAI(systemPrompt, userPrompt) {
    const res = await client.ai.chat.completions.create({
        model: 'openai/gpt-4o-mini',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ]
    });
    return res?.choices?.[0]?.message?.content || '';
}

function parseJsonArray(raw) {
    try {
        const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
        const match = cleaned.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('Could not find a JSON array in the AI response.');
        return JSON.parse(match[0]);
    } catch (e) {
        console.error('JSON Parse Error:', e, 'Raw output:', raw);
        throw new Error('The AI returned an invalid response format. Please try again.');
    }
}

function showLoading(container, message) {
    container.innerHTML = `
        <div class="disha-loading">
            <div class="disha-spinner"></div>
            <p>${message}</p>
        </div>
    `;
    container.style.display = 'block';
}

// ============================================================
// TAB 1: KNOWLEDGE SCOUT
// ============================================================
const scoutBtn = document.getElementById('scout-btn');
const scoutResults = document.getElementById('scout-results');
const scoutCards = document.getElementById('scout-cards');
const scoutTopicLabel = document.getElementById('scout-topic-label');
const cacheBadge = document.getElementById('cache-badge');

document.getElementById('scout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const topic = document.getElementById('scout-topic').value.trim();
    if (!topic) return;

    scoutBtn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Searching...`;
    scoutBtn.disabled = true;
    scoutResults.style.display = 'block';
    showLoading(scoutCards, 'Scouting for verified resources...');
    cacheBadge.style.display = 'none';

    try {
        let resources = null;

        // Try DB cache
        try {
            const cacheKey = topic.toLowerCase().replace(/\s+/g, '_');
            const { data: cached } = await client.database
                .from('study_cache').select('*').eq('topic_key', cacheKey).limit(1);
            if (cached && cached.length > 0) {
                resources = JSON.parse(cached[0].resources_json);
                cacheBadge.style.display = 'flex';
            }
        } catch (_) {}

        if (!resources) {
            const classCtx = agentMemory ? `Student: ${agentMemory.class_level.replace(/_/g, ' ')}.` : '';
            const raw = await callAI(
                `You are a study resource finder. ${classCtx}
Return ONLY a JSON array with 3 objects: {"type":"YouTube"|"PDF"|"Quiz", "title", "description", "link"}.
No markdown. No extra text.`,
                `Top 3 free resources for: "${topic}"`
            );
            resources = parseJsonArray(raw);

            // Cache result
            try {
                const cacheKey = topic.toLowerCase().replace(/\s+/g, '_');
                await client.database.from('study_cache').insert([{
                    topic_key: cacheKey, topic_display: topic,
                    resources_json: JSON.stringify(resources)
                }]);
            } catch (_) {}
        }

        scoutTopicLabel.textContent = topic;
        scoutCards.innerHTML = '';
        const badgeMap = { YouTube: ['badge-youtube','ri-youtube-line'], PDF: ['badge-pdf','ri-file-pdf-line'], Quiz: ['badge-quiz','ri-question-answer-line'] };

        resources.forEach((r, i) => {
            const [badgeClass, iconClass] = badgeMap[r.type] || ['badge-quiz', 'ri-book-line'];
            const card = document.createElement('div');
            card.className = 'resource-card';
            card.style.animationDelay = `${i * 0.1}s`;
            card.innerHTML = `<span class="resource-type-badge ${badgeClass}"><i class="${iconClass}"></i> ${r.type}</span><h5>${r.title}</h5><p>${r.description}</p><a href="${r.link}" target="_blank" class="resource-link">Open <i class="ri-arrow-right-up-line"></i></a>`;
            scoutCards.appendChild(card);
        });
    } catch (err) {
        scoutCards.innerHTML = `<p style="color:#ff8585; text-align:center;">${err.message}</p>`;
    } finally {
        scoutBtn.innerHTML = `<i class="ri-send-plane-fill"></i> Search`;
        scoutBtn.disabled = false;
    }
});

// ============================================================
// TAB 2: CAREER ROADMAP
// ============================================================
const roadmapBtn = document.getElementById('roadmap-btn');
const roadmapResults = document.getElementById('roadmap-results');
const roadmapSteps = document.getElementById('roadmap-steps');
const roadmapGoalLabel = document.getElementById('roadmap-goal-label');
let currentRoadmapData = null;

document.getElementById('roadmap-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const goal = document.getElementById('career-goal').value.trim();
    if (!goal) return;

    roadmapBtn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Planning...`;
    roadmapBtn.disabled = true;
    roadmapResults.style.display = 'block';
    showLoading(roadmapSteps, 'Mapping your career journey...');

    try {
        const classCtx = agentMemory ? `Currently in ${agentMemory.class_level.replace(/_/g, ' ')}, age ${agentMemory.age}.` : '';
        const raw = await callAI(
            `You are a career expert for rural students. ${classCtx}
Return ONLY a JSON array with 5 objects: {"step":1-5, "title", "description", "timeframe"}.
No markdown. No extra text.`,
            `5-step roadmap to become a: "${goal}"`
        );
        const steps = parseJsonArray(raw);
        currentRoadmapData = { goal, steps };

        roadmapGoalLabel.textContent = goal;
        roadmapSteps.innerHTML = '';
        steps.forEach((s, i) => {
            const stepEl = document.createElement('div');
            stepEl.className = 'quest-step';
            stepEl.style.animationDelay = `${i * 0.15}s`;
            stepEl.innerHTML = `<div class="step-circle" id="circle-${i}">${s.step}</div><div class="step-body"><h5>${s.title} <span style="font-size:0.8rem; color:var(--text-muted);">— ${s.timeframe}</span></h5><p>${s.description}</p><button class="step-mark-btn" data-step="${i}"><i class="ri-check-line"></i> Done</button></div>`;
            roadmapSteps.appendChild(stepEl);
        });

        document.querySelectorAll('.step-mark-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.step;
                const circle = document.getElementById(`circle-${idx}`);
                circle.classList.add('done');
                circle.innerHTML = '<i class="ri-check-line"></i>';
                btn.classList.add('done'); btn.innerHTML = 'Completed!'; btn.disabled = true;
            });
        });
    } catch (err) {
        roadmapSteps.innerHTML = `<p style="color:#ff8585; text-align:center;">${err.message}</p>`;
    } finally {
        roadmapBtn.innerHTML = `<i class="ri-magic-line"></i> Generate`;
        roadmapBtn.disabled = false;
    }
});

document.getElementById('save-roadmap-btn').addEventListener('click', () => {
    if (currentRoadmapData) localStorage.setItem('prerna_roadmap', JSON.stringify(currentRoadmapData));
});

// ============================================================
// TAB 3: MENTOR CHAT
// ============================================================
let mentorHistory = [];
document.querySelectorAll('.profession-card').forEach(card => card.addEventListener('click', () => {
    const role = card.dataset.role;
    mentorHistory = [{ role: 'system', content: `You are a ${role} in India. Talk simply to a rural student. Max 4 sentences.` }];
    document.getElementById('profession-grid').closest('.disha-hero-card').style.display = 'none';
    document.getElementById('mentor-chat-section').style.display = 'block';
    document.getElementById('mentor-avatar').textContent = card.dataset.emoji;
    document.getElementById('mentor-title').textContent = role.toUpperCase();
    document.getElementById('mentor-chat-body').innerHTML = `<div class="chat-bubble ngo-bubble">Namaste! Ask me anything about being a ${role}. 😊</div>`;
}));

document.getElementById('change-prof-btn').addEventListener('click', () => {
    document.getElementById('mentor-chat-section').style.display = 'none';
    document.getElementById('profession-grid').closest('.disha-hero-card').style.display = 'block';
});

document.getElementById('mentor-send-btn').addEventListener('click', async () => {
    const input = document.getElementById('mentor-input');
    const msg = input.value.trim(); if (!msg) return;
    input.value = '';
    const chatBody = document.getElementById('mentor-chat-body');
    chatBody.innerHTML += `<div class="chat-bubble user-bubble">${msg}</div>`;
    const typing = document.createElement('div'); typing.className = 'chat-bubble ngo-bubble'; typing.textContent = '...';
    chatBody.appendChild(typing);
    chatBody.scrollTop = chatBody.scrollHeight;

    try {
        mentorHistory.push({ role: 'user', content: msg });
        const res = await client.ai.chat.completions.create({ model: 'openai/gpt-4o-mini', messages: mentorHistory });
        const reply = res?.choices?.[0]?.message?.content || 'Interesting!';
        mentorHistory.push({ role: 'assistant', content: reply });
        typing.textContent = reply;
    } catch (_) { typing.textContent = 'Error connecting.'; }
    chatBody.scrollTop = chatBody.scrollHeight;
});
