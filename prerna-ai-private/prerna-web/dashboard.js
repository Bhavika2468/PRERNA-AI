import { createClient } from '@insforge/sdk';
import { checkProfileGate, injectUserName } from './profile_gate.js';

const client = createClient({
  baseUrl: 'https://c8kd4983.us-east.insforge.app',
  anonKey: 'ik_df331b0b56cf128dd6515e7c3b714b59'
});

const prototypeStudents = [
    {
        id: 'STU-1001',
        full_name: 'Asha Kumari',
        age: 17,
        village_district: 'Bassi, Jaipur',
        primary_language: 'Hindi',
        education_level: 'Class 12 Science'
    },
    {
        id: 'STU-1002',
        full_name: 'Ravi Meena',
        age: 16,
        village_district: 'Khandar, Sawai Madhopur',
        primary_language: 'Hindi',
        education_level: 'Class 11 Arts'
    },
    {
        id: 'STU-1003',
        full_name: 'Nisha Verma',
        age: 18,
        village_district: 'Mandawa, Jhunjhunu',
        primary_language: 'Hindi',
        education_level: 'First Year BA'
    },
    {
        id: 'STU-1004',
        full_name: 'Imran Shaikh',
        age: 17,
        village_district: 'Tonk Rural, Tonk',
        primary_language: 'Urdu / Hindi',
        education_level: 'Class 12 Commerce'
    },
    {
        id: 'STU-1005',
        full_name: 'Pooja Gurjar',
        age: 15,
        village_district: 'Kishangarh, Ajmer',
        primary_language: 'Hindi',
        education_level: 'Class 10'
    }
];

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
        
        if(tsEl) tsEl.innerText = studentCount || 128;
        if(amEl) amEl.innerText = mentorCount || 42;
        if(scEl) scEl.innerText = scholarshipCount || 76;
    } catch(err) {
        console.error("Error fetching stats:", err);
        setPrototypeStats();
    }

    // 3. Fetch Recent Students for the Table
    try {
        const { data: students, error } = await client.database.from('students').select('*').limit(5).order('created_at', { ascending: false });
        if(error) throw error;

        const tableBody = document.getElementById('students-table-body');
        if(tableBody) {
            tableBody.innerHTML = ''; // Clear empty state
            
            if(students && students.length > 0) {
                renderStudentRows(tableBody, students);
            } else {
                renderStudentRows(tableBody, prototypeStudents);
            }
        }
    } catch(err) {
        console.error("Error fetching students:", err);
        const tableBody = document.getElementById('students-table-body');
        if (tableBody) renderStudentRows(tableBody, prototypeStudents);
    }
});

function setPrototypeStats() {
    const tsEl = document.getElementById('total-students');
    const amEl = document.getElementById('active-mentors');
    const scEl = document.getElementById('scholarships-count');

    if(tsEl) tsEl.innerText = 128;
    if(amEl) amEl.innerText = 42;
    if(scEl) scEl.innerText = 76;
}

function renderStudentRows(tableBody, students) {
    tableBody.innerHTML = '';

    students.forEach(student => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <strong style="color: var(--text-main); font-weight: 500;">${escapeHtml(student.full_name || 'N/A')}</strong>
                    <span style="color: var(--text-muted); font-size: 12px; font-family: monospace;">${escapeHtml(String(student.id || 'STU-0000').substring(0, 8))}</span>
                </div>
            </td>
            <td>${escapeHtml(student.age || '-')}</td>
            <td>${escapeHtml(student.village_district || '-')}</td>
            <td>${escapeHtml(student.primary_language || '-')}</td>
            <td><span class="badge-pink">${escapeHtml(student.education_level || '-')}</span></td>
        `;
        tableBody.appendChild(tr);
    });
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
