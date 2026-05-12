const STORAGE_KEY = "prerna_mentors";

const seedMentors = [
  {
    id: "MEN-2001",
    name: "Dr. Kavita Rao",
    email: "kavita.rao@example.com",
    phone: "+91 99887 76655",
    expertise: "academics",
    bio: "STEM educator helping students build exam confidence and study discipline.",
    status: "active",
    verified: true,
    students: 28,
    rating: 4.9
  },
  {
    id: "MEN-2002",
    name: "Arjun Menon",
    email: "arjun.menon@example.com",
    phone: "+91 88776 65544",
    expertise: "career",
    bio: "Career coach focused on scholarships, interviews, and first-generation college pathways.",
    status: "active",
    verified: true,
    students: 34,
    rating: 4.8
  },
  {
    id: "MEN-2003",
    name: "Sana Fatima",
    email: "sana.fatima@example.com",
    phone: "+91 77665 54433",
    expertise: "personal",
    bio: "Youth counselor supporting confidence, communication, and family conversations.",
    status: "inactive",
    verified: false,
    students: 15,
    rating: 4.6
  },
  {
    id: "MEN-2004",
    name: "Vikram Singh",
    email: "vikram.singh@example.com",
    phone: "+91 66554 43322",
    expertise: "skills",
    bio: "Digital skills trainer with practical sessions on coding, English, and workplace readiness.",
    status: "active",
    verified: true,
    students: 41,
    rating: 4.9
  }
];

let mentors = loadMentors();
let editingId = null;

document.addEventListener("DOMContentLoaded", () => {
  bindMentorEvents();
  renderMentors();
});

function loadMentors() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : seedMentors;
  } catch (_) {
    return seedMentors;
  }
}

function saveMentors() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(mentors));
}

function bindMentorEvents() {
  document.getElementById("searchMentors")?.addEventListener("input", renderMentors);
  document.getElementById("filterExpertise")?.addEventListener("change", renderMentors);
  document.getElementById("addMentorBtn")?.addEventListener("click", () => openMentorModal());
  document.querySelector("#mentorModal .modal-close")?.addEventListener("click", closeMentorModal);
  document.getElementById("cancelBtn")?.addEventListener("click", closeMentorModal);
  document.getElementById("mentorForm")?.addEventListener("submit", handleMentorSubmit);
  document.querySelector(".logout-btn")?.addEventListener("click", () => {
    window.location.href = "login.html";
  });

  document.getElementById("mentorModal")?.addEventListener("click", (event) => {
    if (event.target.id === "mentorModal") closeMentorModal();
  });
}

function handleMentorSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("mentorName").value.trim();
  const email = document.getElementById("mentorEmail").value.trim();
  const expertise = document.getElementById("mentorExpertise").value;
  if (!name || !email || !expertise) return;

  const current = editingId ? getMentor(editingId) : null;
  const payload = {
    name,
    email,
    expertise,
    phone: document.getElementById("mentorPhone").value.trim(),
    bio: document.getElementById("mentorBio").value.trim(),
    status: document.getElementById("mentorStatus").value,
    verified: current?.verified ?? true,
    students: current?.students ?? Math.floor(8 + Math.random() * 18),
    rating: current?.rating ?? 4.7
  };

  if (editingId) {
    mentors = mentors.map((mentor) => mentor.id === editingId ? { ...mentor, ...payload } : mentor);
  } else {
    mentors.unshift({ id: `MEN-${Date.now().toString().slice(-5)}`, ...payload });
  }

  saveMentors();
  closeMentorModal();
  renderMentors();
}

function renderMentors() {
  const grid = document.getElementById("mentorsGrid");
  if (!grid) return;

  const query = document.getElementById("searchMentors")?.value.trim().toLowerCase() || "";
  const expertise = document.getElementById("filterExpertise")?.value || "";
  const visibleMentors = mentors.filter((mentor) => {
    const matchesSearch = [mentor.name, mentor.email, mentor.bio, expertiseLabel(mentor.expertise)].some((value) =>
      String(value).toLowerCase().includes(query)
    );
    const matchesExpertise = !expertise || mentor.expertise === expertise;
    return matchesSearch && matchesExpertise;
  });

  grid.innerHTML = visibleMentors.length
    ? visibleMentors.map(mentorCard).join("")
    : `<div class="empty-state">No mentors match your filters.</div>`;

  grid.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openMentorModal(button.dataset.edit));
  });
  grid.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteMentor(button.dataset.delete));
  });
  grid.querySelectorAll("[data-verify]").forEach((button) => {
    button.addEventListener("click", () => toggleVerified(button.dataset.verify));
  });

  updateMentorStats();
}

function mentorCard(mentor) {
  return `
    <article class="mentor-card">
      <div class="mentor-topline">
        <div class="mentor-avatar">${initials(mentor.name)}</div>
        <div>
          <h4>${escapeHtml(mentor.name)}</h4>
          <p>${escapeHtml(mentor.email)}</p>
        </div>
      </div>
      <div class="mentor-meta">
        <span class="badge badge-primary">${expertiseLabel(mentor.expertise)}</span>
        <span class="status-badge status-${mentor.status}">${capitalize(mentor.status)}</span>
        <span class="verified-pill ${mentor.verified ? "is-verified" : ""}">
          <i class="ri-shield-check-line"></i> ${mentor.verified ? "Verified" : "Review"}
        </span>
      </div>
      <p class="mentor-bio">${escapeHtml(mentor.bio || "Mentor bio will appear here after onboarding.")}</p>
      <div class="mentor-stats">
        <span><strong>${mentor.students}</strong> Students</span>
        <span><strong>${Number(mentor.rating).toFixed(1)}</strong> Rating</span>
      </div>
      <div class="mentor-actions">
        <button class="btn-sm btn-edit" data-edit="${mentor.id}" type="button"><i class="ri-edit-line"></i> Edit</button>
        <button class="btn-sm btn-verify" data-verify="${mentor.id}" type="button"><i class="ri-shield-check-line"></i> Verify</button>
        <button class="btn-sm btn-delete" data-delete="${mentor.id}" type="button"><i class="ri-delete-bin-line"></i> Delete</button>
      </div>
    </article>
  `;
}

function openMentorModal(id = null) {
  editingId = id;
  const modal = document.getElementById("mentorModal");
  const form = document.getElementById("mentorForm");
  const title = document.querySelector("#mentorModal .modal-header h3");
  form?.reset();

  if (id) {
    const mentor = getMentor(id);
    if (!mentor) return;
    title.textContent = "Edit Mentor";
    document.getElementById("mentorName").value = mentor.name;
    document.getElementById("mentorEmail").value = mentor.email;
    document.getElementById("mentorPhone").value = mentor.phone || "";
    document.getElementById("mentorExpertise").value = mentor.expertise;
    document.getElementById("mentorBio").value = mentor.bio || "";
    document.getElementById("mentorStatus").value = mentor.status;
  } else {
    title.textContent = "Add New Mentor";
    document.getElementById("mentorStatus").value = "active";
  }

  modal?.classList.add("active");
}

function closeMentorModal() {
  document.getElementById("mentorModal")?.classList.remove("active");
  editingId = null;
}

function deleteMentor(id) {
  const mentor = getMentor(id);
  if (!mentor || !confirm(`Delete ${mentor.name}?`)) return;
  mentors = mentors.filter((item) => item.id !== id);
  saveMentors();
  renderMentors();
}

function toggleVerified(id) {
  mentors = mentors.map((mentor) => mentor.id === id ? { ...mentor, verified: !mentor.verified } : mentor);
  saveMentors();
  renderMentors();
}

function updateMentorStats() {
  const total = mentors.length;
  const verified = mentors.filter((mentor) => mentor.verified).length;
  const mentored = mentors.reduce((sum, mentor) => sum + Number(mentor.students || 0), 0);
  const avg = total ? mentors.reduce((sum, mentor) => sum + Number(mentor.rating || 0), 0) / total : 0;

  setText("totalMentors", total);
  setText("verifiedMentors", verified);
  setText("totalMentored", mentored);
  setText("avgRating", avg.toFixed(1));
}

function getMentor(id) {
  return mentors.find((mentor) => mentor.id === id);
}

function expertiseLabel(value) {
  return {
    academics: "Academics",
    career: "Career Guidance",
    personal: "Personal Development",
    skills: "Skills Training"
  }[value] || "General";
}

function initials(name) {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function capitalize(value) {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
