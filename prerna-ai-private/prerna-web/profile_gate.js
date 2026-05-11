/**
 * profile_gate.js
 * 
 * Import this at the top of every page's JS module.
 * It checks if the user has completed their profile.
 * If not, it immediately redirects them to profile.html.
 * 
 * Usage: import './profile_gate.js';
 */

export function checkProfileGate() {
    const memory = localStorage.getItem('prerna_agent_memory');
    if (!memory) {
        // No profile found — redirect to setup
        window.location.href = 'profile.html';
        return null;
    }
    
    try {
        const parsed = JSON.parse(memory);
        if (!parsed.profile_complete) {
            window.location.href = 'profile.html';
            return null;
        }
        return parsed;
    } catch (e) {
        window.location.href = 'profile.html';
        return null;
    }
}

/**
 * Injects the user's name from agentMemory into the header element.
 * @param {string} elementId - The ID of the element to update (default: 'header-user-name')
 */
export function injectUserName(elementId = 'header-user-name') {
    const memory = localStorage.getItem('prerna_agent_memory');
    if (!memory) return;
    
    try {
        const parsed = JSON.parse(memory);
        const el = document.getElementById(elementId);
        if (el && parsed.full_name) {
            el.textContent = parsed.full_name.split(' ')[0]; // First name only
        }
    } catch (e) {
        console.error('agentMemory read error:', e);
    }
}

/**
 * Returns the full parsed agentMemory object, or null.
 */
export function getAgentMemory() {
    const memory = localStorage.getItem('prerna_agent_memory');
    if (!memory) return null;
    try {
        return JSON.parse(memory);
    } catch (e) {
        return null;
    }
}
