const STORAGE_KEY = "prerna_students";

const seedStudents = [
  {
    id: "STU-1001",
    name: "Asha Kumari",
    email: "asha.kumari@example.com",
    phone: "+91 98765 43210",
    status: "active",
    performance: 8.9,
    scholarships: 3,
    joined: "2026-04-18"
  },
  {
    id: "STU-1002",
    name: "Ravi Meena",
    email: "ravi.meena@example.com",
    phone: "+91 97654 32109",
    status: "active",
    performance: 7.8,
    scholarships: 2,
    joined: "2026-03-29"
  },
  {
    id: "STU-1003",
    name: "Nisha Verma",
    email: "nisha.verma@example.com",
    phone: "+91 96543 21098",
    status: "inactive",
    performance: 6.6,
    scholarships: 1,
    joined: "2026-02-14"
  },
  {
    id: "STU-1004",
    name: "Imran Shaikh",
    email: "imran.shaikh@example.com",
    phone: "+91 95432 10987",
    status: "active",
    performance: 9.3,
    scholarships: 4,
    joined: "2026-05-02"
  }
];

let students = loadStudents();
let editingId = null;

document.addEventListener("DOMContentLoaded", () => {
  bindStudentEvents();
  renderStudents();
});

function loadStudents() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) && saved.length ? saved : seedStudents;
  } catch (_) {
    return seedStudents;
  }
}

function saveStudents() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
}

function bindStudentEvents() {
  document.getElementById("searchStudents")?.addEventListener("input", renderStudents);
  document.getElementById("filterStatus")?.addEventListener("change", renderStudents);
  document.getElementById("addStudentBtn")?.addEventListener("click", () => openStudentModal());
  document.querySelector("#studentModal .modal-close")?.addEventListener("click", closeStudentModal);
  document.getElementById("cancelBtn")?.addEventListener("click", closeStudentModal);
  document.getElementById("studentForm")?.addEventListener("submit", handleStudentSubmit);
  document.querySelector(".logout-btn")?.addEventListener("click", () => {
    window.location.href = "login.html";
  });

  document.getElementById("studentModal")?.addEventListener("click", (event) => {
    if (event.target.id === "studentModal") closeStudentModal();
  });
}

function handleStudentSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("studentName").value.trim();
  const email = document.getElementById("studentEmail").value.trim();
  const performance = normalizePerformance(document.getElementById("studentPerformance").value);

  if (!name || !email) return;

  const payload = {
    name,
    email,
    phone: document.getElementById("studentPhone").value.trim(),
    status: document.getElementById("studentStatus").value,
    performance,
    scholarships: editingId ? getStudent(editingId)?.scholarships || 0 : Math.max(1, Math.round(performance / 3)),
    joined: editingId ? getStudent(editingId)?.joined || today() : today()
  };

  if (editingId) {
    students = students.map((student) => student.id === editingId ? { ...student, ...payload } : student);
  } else {
    students.unshift({ id: `STU-${Date.now().toString().slice(-5)}`, ...payload });
  }

  saveStudents();
  closeStudentModal();
  renderStudents();
}

function renderStudents() {
  const tbody = document.getElementById("studentsList");
  if (!tbody) return;

  const query = document.getElementById("searchStudents")?.value.trim().toLowerCase() || "";
  const status = document.getElementById("filterStatus")?.value || "";
  const visibleStudents = students.filter((student) => {
    const matchesSearch = [student.name, student.email, student.id].some((value) =>
      String(value).toLowerCase().includes(query)
    );
    const matchesStatus = !status || student.status === status;
    return matchesSearch && matchesStatus;
  });

  tbody.innerHTML = visibleStudents.length
    ? visibleStudents.map(studentRow).join("")
    : `<tr><td colspan="7" class="empty-state">No students match your filters.</td></tr>`;

  tbody.querySelectorAll("[data-edit]").forEach((button) => {
    button.addEventListener("click", () => openStudentModal(button.dataset.edit));
  });
  tbody.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => deleteStudent(button.dataset.delete));
  });

  updateStudentStats();
}

function studentRow(student) {
  const performance = normalizePerformance(student.performance);
  return `
    <tr>
      <td>
        <div class="entity-cell">
          <strong>${escapeHtml(student.name)}</strong>
          <span>${escapeHtml(student.id)}</span>
        </div>
      </td>
      <td>${escapeHtml(student.email)}</td>
      <td><span class="status-badge status-${student.status}">${capitalize(student.status)}</span></td>
      <td>
        <div class="score-cell">
          <span>${performance.toFixed(1)}/10</span>
          <div class="performance-bar"><div class="performance-bar-fill" style="width: ${performance * 10}%"></div></div>
        </div>
      </td>
      <td><span class="badge badge-primary">${student.scholarships}</span></td>
      <td>${formatDate(student.joined)}</td>
      <td>
        <div class="action-buttons">
          <button class="btn-sm btn-edit" data-edit="${student.id}" type="button"><i class="ri-edit-line"></i> Edit</button>
          <button class="btn-sm btn-delete" data-delete="${student.id}" type="button"><i class="ri-delete-bin-line"></i> Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function openStudentModal(id = null) {
  editingId = id;
  const modal = document.getElementById("studentModal");
  const form = document.getElementById("studentForm");
  const title = document.querySelector("#studentModal .modal-header h3");
  form?.reset();

  if (id) {
    const student = getStudent(id);
    if (!student) return;
    title.textContent = "Edit Student";
    document.getElementById("studentName").value = student.name;
    document.getElementById("studentEmail").value = student.email;
    document.getElementById("studentPhone").value = student.phone || "";
    document.getElementById("studentStatus").value = student.status;
    document.getElementById("studentPerformance").value = student.performance;
  } else {
    title.textContent = "Add New Student";
    document.getElementById("studentStatus").value = "active";
  }

  modal?.classList.add("active");
}

function closeStudentModal() {
  document.getElementById("studentModal")?.classList.remove("active");
  editingId = null;
}

function deleteStudent(id) {
  const student = getStudent(id);
  if (!student || !confirm(`Delete ${student.name}?`)) return;
  students = students.filter((item) => item.id !== id);
  saveStudents();
  renderStudents();
}

function updateStudentStats() {
  const total = students.length;
  const active = students.filter((student) => student.status === "active").length;
  const matched = students.reduce((sum, student) => sum + Number(student.scholarships || 0), 0);
  const avg = total ? students.reduce((sum, student) => sum + normalizePerformance(student.performance), 0) / total : 0;

  setText("totalStudents", total);
  setText("activeStudents", active);
  setText("matchedScholarships", matched);
  setText("avgPerformance", avg.toFixed(1));
}

function getStudent(id) {
  return students.find((student) => student.id === id);
}

function normalizePerformance(value) {
  const score = Number(value);
  if (Number.isNaN(score)) return 0;
  return Math.min(10, Math.max(0, score));
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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
