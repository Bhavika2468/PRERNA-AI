import { createClient } from '@insforge/sdk';
import { checkProfileGate, getAgentMemory, injectUserName } from './profile_gate.js';

// Profile Gate check
const agentMemory = checkProfileGate();

// Initialize InsForge Client
const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

// Inject name into header
document.addEventListener('DOMContentLoaded', () => injectUserName('header-user-name'));

// Build context-aware system prompt from agentMemory
const userContext = agentMemory
    ? `The student's name is ${agentMemory.full_name}, she is ${agentMemory.age} years old, in ${agentMemory.class_level.replace('_', ' ')}, living in ${agentMemory.location}. Scholarship eligible: ${agentMemory.scholarship_eligible}.`
    : '';

// Chat Memory
let messageHistory = [
    {
        role: 'system',
        content: `You are "Prerna Didi", a warm, deeply empathetic, and highly knowledgeable older sister figure. Your specific purpose is to support, educate, and guide young girls (from 9th grade onwards) living in rural and underserved areas.

CORE DIRECTIVES:
1. Tone & Persona: 
   - Always be encouraging, patient, and completely non-judgmental. 
   - Speak in simple, accessible language. Avoid complex academic jargon.
   - Ensure every response validates the user's feelings, making her feel safe, heard, and understood before offering solutions.

2. Cultural Context & Empowerment: 
   - Understand that your users may face systemic barriers, limited resources, or conservative environments. 
   - Provide practical, achievable advice using everyday items where applicable.
   - Empower them by validating their ambitions, intelligence, and right to ask questions.

3. Health & Sensitive Topics (Periods, Cramps, UTIs, Hygiene):
   - Treat all reproductive and menstrual health questions as completely normal, natural, and important. Never use shaming language.
   - Provide medically accurate, easy-to-understand explanations of bodily functions, basic hygiene practices, and home comfort measures (e.g., hot water bags for cramps).
   - MEDICAL GUARDRAIL: You are an AI, not a doctor. NEVER prescribe medication. For persistent pain, potential infections like UTIs, or abnormal symptoms, gently but firmly encourage the user to speak with a trusted adult female (like a mother, elder sister, teacher, or local ASHA worker) or visit a local clinic.

4. Safety & Boundaries: 
   - If a user mentions self-harm, abuse, or severe danger, prioritize their immediate safety. Provide generalized crisis advice and urge them to contact a trusted teacher, adult, or local helpline immediately.
   - Never ask for personally identifiable information (PII) like their exact address or full name.

5. Formatting: 
   - Keep responses concise and easy to read on a mobile device.
   - Use short paragraphs and bullet points for actionable steps.

STUDENT PROFILE (from PRERNA memory):
${userContext || 'Profile not loaded — greet warmly and ask her name gently.'}`
    }
];


// DOM Elements
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// Auto-resize textarea
chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value.trim() === '') {
        this.style.height = 'auto';
    }
});

// Handle Enter to submit (Shift+Enter for new line)
chatInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.requestSubmit();
    }
});

// Add message to UI
function addMessageToUI(content, isAI = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isAI ? 'ai-message' : 'user-message'}`;
    
    // Process simple markdown for AI messages (bold, code blocks, newlines)
    let formattedContent = content;
    if (isAI) {
        formattedContent = formattedContent
            .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\\n/g, '<br>');
    } else {
        formattedContent = formattedContent.replace(/\\n/g, '<br>');
    }

    msgDiv.innerHTML = `
        <div class="message-avatar">
            <i class="${isAI ? 'ri-robot-2-fill' : 'ri-user-smile-fill'}"></i>
        </div>
        <div class="message-content">
            ${formattedContent}
        </div>
    `;
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show typing indicator
function showTypingIndicator() {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message ai-message typing-msg';
    msgDiv.id = 'typing-indicator';
    
    msgDiv.innerHTML = `
        <div class="message-avatar">
            <i class="ri-robot-2-fill"></i>
        </div>
        <div class="message-content">
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Remove typing indicator
function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Handle form submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userText = chatInput.value.trim();
    if (!userText) return;
    
    // Update UI
    addMessageToUI(userText, false);
    chatInput.value = '';
    chatInput.style.height = 'auto';
    sendBtn.disabled = true;
    chatInput.disabled = true;
    
    // Add to memory
    messageHistory.push({ role: 'user', content: userText });
    
    // Show AI typing
    showTypingIndicator();
    
    try {
        // Build the prompt from history
        // InsForge SDK uses the standard OpenAI-compatible chat.completions.create structure
        const res = await client.ai.chat.completions.create({
            model: 'openai/gpt-4o-mini', // InsForge AI Gateway requires the provider prefix
            messages: messageHistory
        });
        
        removeTypingIndicator();
        
        // Extract response
        const aiResponse = res?.choices?.[0]?.message?.content || "I received your message but could not generate a response.";
        
        // Add to memory
        messageHistory.push({ role: 'assistant', content: aiResponse });
        
        // Add to UI
        addMessageToUI(aiResponse, true);
    } catch (err) {
        console.error("Fetch Error:", err);
        removeTypingIndicator();
        addMessageToUI(`I'm sorry, I encountered an error: ${err.message || 'Please check your connection.'}`, true);
    } finally {
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
});
