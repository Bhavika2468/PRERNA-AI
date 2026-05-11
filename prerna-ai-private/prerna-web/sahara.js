import { createClient } from '@insforge/sdk';
import { checkProfileGate } from './profile_gate.js';

// Profile Gate
checkProfileGate();

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

// Mock NGO Database (Vast NGO List simulation)
const NGOs = {
    "Crisis/Safety": {
        name: "Sakhi (One Stop Centre)",
        desc: "Provides integrated support and assistance to women affected by violence, both in private and public spaces.",
        location: "Nearest District Hospital",
        phone: "181 (Women Helpline)"
    },
    "Health/Hygiene": {
        name: "Myna Mahila Foundation",
        desc: "Empowering women by discussing menstrual hygiene and providing affordable health products.",
        location: "Local Rural Hub",
        phone: "+91 98765 43210"
    },
    "Legal Aid": {
        name: "Rural Legal Care",
        desc: "Free legal counseling and support for women navigating domestic or systemic issues.",
        location: "District Court Complex",
        phone: "15100 (Legal Aid)"
    },
    "General/Education": {
        name: "Pratham Education",
        desc: "Support for continuing education and overcoming systemic barriers to learning.",
        location: "Regional Center",
        phone: "1800-XXX-XXXX"
    }
};

const form = document.getElementById('sahara-form');
const issueText = document.getElementById('issue-text');
const analyzeBtn = document.getElementById('analyze-btn');

const expressionSection = document.getElementById('expression-section');
const matchSection = document.getElementById('match-section');
const secureChatSection = document.getElementById('secure-chat-section');

const intentBadge = document.getElementById('intent-badge');
const ngoNameEl = document.getElementById('ngo-name');
const ngoDescEl = document.getElementById('ngo-desc');
const ngoLocationEl = document.getElementById('ngo-location');
const ngoPhoneEl = document.getElementById('ngo-phone');

const quickConnectBtn = document.getElementById('quick-connect-btn');
const chatBody = document.getElementById('secure-chat-body');
const chatInput = document.getElementById('secure-input');
const sendBtn = document.getElementById('secure-send-btn');
const chatNgoName = document.getElementById('chat-ngo-name');

// 1. Analyze Intent
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = issueText.value.trim();
    if (!text) return;
    
    analyzeBtn.innerHTML = `<i class="ri-loader-4-line ri-spin"></i> Analyzing Securely...`;
    analyzeBtn.disabled = true;

    try {
        // Send to InsForge AI for Semantic Intent Detection
        const res = await client.ai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: [{
                role: 'system',
                content: 'You are an intent detection engine. Read the user issue and categorize it strictly into one of these tags: [Crisis/Safety], [Health/Hygiene], [Legal Aid], or [General/Education]. Return ONLY the tag.'
            }, {
                role: 'user',
                content: text
            }]
        });
        
        let intent = res?.choices?.[0]?.message?.content || "[General/Education]";
        
        // Clean up intent string just in case
        const validIntents = ["Crisis/Safety", "Health/Hygiene", "Legal Aid", "General/Education"];
        let matchedIntent = "General/Education";
        for (const v of validIntents) {
            if (intent.includes(v)) {
                matchedIntent = v;
                break;
            }
        }
        
        showMatchedNGO(matchedIntent);

    } catch (err) {
        console.error("Analysis Error:", err);
        showMatchedNGO("General/Education"); // Fallback
    }
});

// 2. Display the Matched NGO
function showMatchedNGO(intent) {
    const ngo = NGOs[intent];
    
    intentBadge.textContent = `[Intent: ${intent}]`;
    ngoNameEl.textContent = ngo.name;
    ngoDescEl.textContent = ngo.desc;
    ngoLocationEl.textContent = ngo.location;
    ngoPhoneEl.textContent = ngo.phone;
    
    chatNgoName.textContent = ngo.name; // Update chat header
    
    expressionSection.style.display = 'none';
    matchSection.style.display = 'block';
}

// 3. Secure Handshake (Open Chat)
quickConnectBtn.addEventListener('click', () => {
    matchSection.style.display = 'none';
    secureChatSection.style.display = 'flex';
    secureChatSection.style.flexDirection = 'column';
    
    // Simulate initial NGO message
    setTimeout(() => {
        addMessage("Hello, this is a secure channel. We are here to help. What do you need right now?", 'ngo-bubble');
    }, 1000);
});

// 4. Secure Chat Logic
function addMessage(text, className) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${className}`;
    bubble.textContent = text;
    chatBody.appendChild(bubble);
    chatBody.scrollTop = chatBody.scrollHeight;
}

sendBtn.addEventListener('click', sendSecureMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendSecureMessage();
});

async function sendSecureMessage() {
    const msg = chatInput.value.trim();
    if (!msg) return;
    
    addMessage(msg, 'user-bubble');
    chatInput.value = '';
    
    // Simulate real-time response from NGO representative
    setTimeout(() => {
        addMessage("I hear you. You are not alone in this. Our field worker is available to talk on the phone anonymously, or we can continue chatting here.", 'ngo-bubble');
    }, 2000);
}
