import { createClient } from '@insforge/sdk';
import { checkProfileGate, injectUserName } from './profile_gate.js';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

document.addEventListener("DOMContentLoaded", async () => {
    // Profile Gate: Redirect to profile.html if not complete
    const agentMemory = checkProfileGate();
    if (!agentMemory) return;
    
    // Inject name from agentMemory into header
    injectUserName('header-user-name');

    // Set Header Username if agentMemory didn't already handle it
    try {
        const user = await client.auth.getCurrentUser();
        const usernameEl = document.getElementById("header-user-name");
        if (usernameEl && user?.email && usernameEl.textContent === 'Loading...') {
            usernameEl.innerText = user.email;
        }
    } catch (_) { /* no auth session */ }

    // Handle logout
    const logoutBtn = document.getElementById("logout-btn");
    if(logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            await client.auth.signOut();
            window.location.href = "login.html";
        });
    }

    // 2. Fetch and set Dashboard stats
    try {
        const { count: studentCount } = await client.database.from('students').select('*', { count: 'exact', head: true });
        const { count: mentorCount } = await client.database.from('ngo_leads').select('*', { count: 'exact', head: true });
        const { count: scholarshipCount } = await client.database.from('scholarships').select('*', { count: 'exact', head: true });

        const tsEl = document.getElementById('total-students');
        const amEl = document.getElementById('active-mentors');
        const scEl = document.getElementById('scholarships-count');
        
        if(tsEl) tsEl.innerText = studentCount || 0;
        if(amEl) amEl.innerText = mentorCount || 0;
        if(scEl) scEl.innerText = scholarshipCount || 0;
    } catch(err) {
        console.error("Error fetching stats:", err);
    }

    // 3. Fetch Recent Students for the Table
    try {
        const { data: students, error } = await client.database.from('students').select('*').limit(5).order('created_at', { ascending: false });
        if(error) throw error;

        const tableBody = document.getElementById('students-table-body');
        if(tableBody) {
            tableBody.innerHTML = ''; // Clear empty state
            
            if(students && students.length > 0) {
                students.forEach(student => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                <strong style="color: var(--text-main); font-weight: 500;">${student.full_name || 'N/A'}</strong>
                                <span style="color: var(--text-muted); font-size: 12px; font-family: monospace;">${student.id.substring(0, 8)}</span>
                            </div>
                        </td>
                        <td>${student.age || '-'}</td>
                        <td>${student.village_district || '-'}</td>
                        <td>${student.primary_language || '-'}</td>
                        <td><span class="badge-blue">${student.education_level || '-'}</span></td>
                    `;
                    tableBody.appendChild(tr);
                });
            } else {
                tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No students found.</td></tr>';
            }
        }
    } catch(err) {
        console.error("Error fetching students:", err);
    }
});
