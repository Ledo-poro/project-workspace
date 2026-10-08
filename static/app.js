const elements = {
  projects: document.querySelector("#project-list"),
  tasks: document.querySelector("#task-list"),
  search: document.querySelector("#global-search"),
  projectDialog: document.querySelector("#project-dialog"),
  taskDialog: document.querySelector("#task-dialog"),
  projectForm: document.querySelector("#project-form"),
  taskForm: document.querySelector("#task-form"),
  toast: document.querySelector("#toast"),
};

let workspace = { projects: [], tasks: [], counts: {}, members: [] };
let projectFilter = "all";
let taskFilter = "all";
let editingProjectId = null;
let editingTaskId = null;
let toastTimer;

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character]));

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Something went wrong.");
  return result;
}

function formattedDate(value) {
  if (!value) return "No target date";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

function statusLabel(value) {
  return ({ active: "In progress", planned: "Planned", on_hold: "On hold", completed: "Completed", archived: "Archived" })[value] || value;
}

function renderMetrics() {
  const active = workspace.projects.filter((item) => item.status === "active").length;
  document.querySelector("#metric-projects").textContent = active;
  document.querySelector("#metric-open").textContent = workspace.counts.open_tasks || 0;
  document.querySelector("#metric-done").textContent = workspace.counts.completed_tasks || 0;
  document.querySelector("#metric-blocked").textContent = workspace.counts.blocked_tasks || 0;
  document.querySelector("#metric-project-caption").textContent = active ? `${workspace.projects.length} total in your workspace` : "Ready to get moving";
  document.querySelector("#project-heading-count").textContent = workspace.projects.length;
  document.querySelector("#task-heading-count").textContent = workspace.counts.open_tasks || 0;
  document.querySelector("#nav-project-count").textContent = workspace.projects.length;
  document.querySelector("#nav-task-count").textContent = workspace.counts.open_tasks || 0;
}

function renderProjects() {
  const search = elements.search.value.trim().toLowerCase();
  const projects = workspace.projects.filter((item) => {
    const matchesFilter = projectFilter === "all" || item.status === projectFilter;
    const matchesSearch = !search || `${item.name} ${item.description}`.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });
  if (!projects.length) {
    const hasProjects = workspace.projects.length > 0;
    elements.projects.innerHTML = `<div class="empty-state"><span class="empty-icon">${hasProjects ? "⌕" : "+"}</span><strong>${hasProjects ? "Nothing in this view" : "Your first project starts here"}</strong><p>${hasProjects ? "Try another filter or a different search." : "Create a home for your team's next idea, launch, or big move."}</p>${hasProjects ? "" : '<button class="button button-secondary" type="button" data-open-project>Create a project</button>'}</div>`;
    return;
  }
  const colors = ["#789779", "#d68b73", "#d0a34d", "#8c83ad", "#5f91a0"];
  elements.projects.innerHTML = projects.map((item, index) => {
    const progress = item.task_count ? Math.round(item.completed_count / item.task_count * 100) : 0;
    return `<article class="project-row" style="--project-color:${colors[index % colors.length]};animation-delay:${index * 45}ms">
      <div class="project-name-wrap"><span class="project-color"></span><span class="project-meta"><strong>${escapeHtml(item.name)}</strong><small>${item.task_count} ${item.task_count === 1 ? "task" : "tasks"} · ${escapeHtml(item.owner_name || "Workspace")}</small></span></div>
      <div><div class="progress-copy"><span>Progress</span><strong>${progress}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>
      <span class="project-status ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      <span class="project-due">${escapeHtml(formattedDate(item.due_date))}</span>
      <div class="row-actions"><button class="row-action edit-icon" type="button" data-edit-project="${item.id}" aria-label="Edit project ${escapeHtml(item.name)}" title="Edit project"></button><button class="row-action delete-icon" type="button" data-delete-project="${item.id}" aria-label="Delete project ${escapeHtml(item.name)}" title="Delete project"></button></div>
    </article>`;
  }).join("");
}

function renderTasks() {
  const search = elements.search.value.trim().toLowerCase();
  const tasks = workspace.tasks.filter((item) => {
    const matchesFilter = taskFilter === "all"
      ? !["done", "cancelled"].includes(item.status)
      : taskFilter === "urgent"
        ? ["urgent", "high"].includes(item.priority) && !["done", "cancelled"].includes(item.status)
        : item.status === taskFilter;
    const matchesSearch = !search || `${item.title} ${item.project_name} ${item.assignee_name || ""}`.toLowerCase().includes(search);
    return matchesFilter && matchesSearch;
  });
  if (!tasks.length) {
    const hasProjects = workspace.projects.length > 0;
    elements.tasks.innerHTML = `<div class="empty-state"><span class="empty-icon">${hasProjects ? "✓" : "↗"}</span><strong>${hasProjects ? "A little breathing room" : "No tasks on the board yet"}</strong><p>${hasProjects ? "Add a task when there's a next step to take." : "Create a project first, then break the work into clear next steps."}</p>${hasProjects ? '<button class="button button-secondary" type="button" data-open-task>Add a task</button>' : ""}</div>`;
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  elements.tasks.innerHTML = tasks.map((task, index) => {
    const due = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null;
    const overdue = due && due < today;
    const initials = task.assignee_name ? task.assignee_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase() : "–";
    const priority = task.priority[0].toUpperCase() + task.priority.slice(1);
    return `<article class="task-row" style="animation-delay:${index * 35}ms">
      <button class="task-check" type="button" data-complete-task="${task.id}" aria-label="Mark ${escapeHtml(task.title)} complete" title="Mark complete"></button>
      <div class="task-copy"><strong class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</strong><div class="task-meta"><span class="task-project">${escapeHtml(task.project_name)}</span><span class="task-meta-sep"></span><span class="task-priority ${escapeHtml(task.priority)}"><i class="priority-mark"></i>${escapeHtml(priority)}</span></div></div>
      <div class="task-side"><span class="task-date ${overdue ? "overdue" : ""}">${due ? `${overdue ? "Late · " : "Due "}${escapeHtml(formattedDate(task.due_date))}` : ""}</span><span class="task-assignee ${task.assignee_name ? "" : "unassigned"}" title="${escapeHtml(task.assignee_name || "Unassigned")}">${escapeHtml(initials)}</span><div class="row-actions"><button class="row-action edit-icon" type="button" data-edit-task="${task.id}" aria-label="Edit task ${escapeHtml(task.title)}" title="Edit task"></button><button class="row-action delete-icon" type="button" data-delete-task="${task.id}" aria-label="Delete task ${escapeHtml(task.title)}" title="Delete task"></button></div></div>
    </article>`;
  }).join("");
}

function updateTaskFormOptions() {
  const currentProject = document.querySelector("#task-project").value;
  document.querySelector("#task-project").innerHTML = workspace.projects
    .filter((item) => !["completed", "archived"].includes(item.status) || String(item.id) === currentProject)
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  if (workspace.projects.some((item) => String(item.id) === currentProject)) {
    document.querySelector("#task-project").value = currentProject;
  }
  const assignee = document.querySelector("#task-assignee").value;
  document.querySelector("#task-assignee").innerHTML = '<option value="">Unassigned</option>' + workspace.members
    .map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("");
  document.querySelector("#task-assignee").value = assignee;
}

function render() {
  renderMetrics();
  renderProjects();
  renderTasks();
  updateTaskFormOptions();
}

async function loadWorkspace() {
  try {
    workspace = await request("/api/overview");
    render();
  } catch (error) {
    elements.projects.innerHTML = `<div class="loading-row error-state">${escapeHtml(error.message)} Refresh the page to try again.</div>`;
    elements.tasks.innerHTML = "";
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2600);
}

function openDialog(dialog, form) {
  if (dialog === elements.projectDialog) editingProjectId = null;
  if (dialog === elements.taskDialog) editingTaskId = null;
  form.reset();
  dialog.querySelector(".dialog-error").textContent = "";
  if (dialog === elements.projectDialog) {
    document.querySelector("#project-dialog-title").textContent = "New project";
    elements.projectForm.querySelector('[type="submit"]').textContent = "Create project";
  }
  if (dialog === elements.taskDialog) {
    document.querySelector("#task-dialog-title").textContent = "Add a task";
    elements.taskForm.querySelector('[type="submit"]').textContent = "Add task";
  }
  if (dialog === elements.taskDialog) updateTaskFormOptions();
  dialog.showModal();
  dialog.querySelector("input:not([type=date]), select")?.focus();
}

function editProject(projectId) {
  const item = workspace.projects.find((projectItem) => projectItem.id === projectId);
  if (!item) return;
  openDialog(elements.projectDialog, elements.projectForm);
  editingProjectId = projectId;
  elements.projectForm.elements.name.value = item.name;
  elements.projectForm.elements.description.value = item.description;
  elements.projectForm.elements.status.value = item.status;
  elements.projectForm.elements.due_date.value = item.due_date || "";
  document.querySelector("#project-dialog-title").textContent = "Edit project";
  elements.projectForm.querySelector('[type="submit"]').textContent = "Save changes";
}

function editTask(taskId) {
  const item = workspace.tasks.find((task) => task.id === taskId);
  if (!item) return;
  openDialog(elements.taskDialog, elements.taskForm);
  editingTaskId = taskId;
  if (!elements.taskForm.elements.project_id.querySelector(`option[value="${item.project_id}"]`)) {
    const projectItem = workspace.projects.find((projectEntry) => projectEntry.id === item.project_id);
    if (projectItem) elements.taskForm.elements.project_id.add(new Option(projectItem.name, projectItem.id));
  }
  elements.taskForm.elements.title.value = item.title;
  elements.taskForm.elements.description.value = item.description;
  elements.taskForm.elements.project_id.value = item.project_id;
  elements.taskForm.elements.priority.value = item.priority;
  elements.taskForm.elements.status.value = item.status;
  elements.taskForm.elements.assignee_id.value = item.assignee_id || "";
  elements.taskForm.elements.due_date.value = item.due_date || "";
  document.querySelector("#task-dialog-title").textContent = "Edit task";
  elements.taskForm.querySelector('[type="submit"]').textContent = "Save changes";
}

document.querySelectorAll("#open-project-modal, [data-open-project]").forEach((button) => button.addEventListener("click", () => openDialog(elements.projectDialog, elements.projectForm)));
document.querySelectorAll("#open-task-modal, #open-task-quick, [data-open-task]").forEach((button) => button.addEventListener("click", () => {
  if (!workspace.projects.length) {
    showToast("Create a project before adding a task.");
    openDialog(elements.projectDialog, elements.projectForm);
    return;
  }
  openDialog(elements.taskDialog, elements.taskForm);
}));
document.querySelectorAll("[data-close-dialog]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
}));

elements.projectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(elements.projectForm);
  const payload = Object.fromEntries(formData.entries());
  const error = document.querySelector("#project-error");
  error.textContent = "";
  try {
    const isEditing = editingProjectId !== null;
    await request(isEditing ? `/api/projects/${editingProjectId}` : "/api/projects", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    elements.projectDialog.close();
    editingProjectId = null;
    projectFilter = "all";
    document.querySelectorAll("[data-project-filter]").forEach((button) => button.classList.toggle("selected", button.dataset.projectFilter === "all"));
    await loadWorkspace();
    showToast(isEditing ? "Project changes saved." : "Project created. Let’s get to it.");
  } catch (submitError) { error.textContent = submitError.message; }
});

elements.taskForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(elements.taskForm).entries());
  const error = document.querySelector("#task-error");
  error.textContent = "";
  try {
    const isEditing = editingTaskId !== null;
    await request(isEditing ? `/api/tasks/${editingTaskId}` : "/api/tasks", {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    elements.taskDialog.close();
    editingTaskId = null;
    await loadWorkspace();
    showToast(isEditing ? "Task changes saved." : "Task added to your list.");
  } catch (submitError) { error.textContent = submitError.message; }
});

document.querySelectorAll("[data-project-filter]").forEach((button) => button.addEventListener("click", () => {
  projectFilter = button.dataset.projectFilter;
  document.querySelectorAll("[data-project-filter]").forEach((item) => item.classList.toggle("selected", item === button));
  renderProjects();
}));
document.querySelectorAll("[data-task-filter]").forEach((button) => button.addEventListener("click", () => {
  taskFilter = button.dataset.taskFilter;
  document.querySelectorAll("[data-task-filter]").forEach((item) => item.classList.toggle("selected", item === button));
  renderTasks();
}));
elements.search.addEventListener("input", () => { renderProjects(); renderTasks(); });
document.querySelector("#project-view-button").addEventListener("click", () => {
  projectFilter = "all";
  document.querySelectorAll("[data-project-filter]").forEach((button) => button.classList.toggle("selected", button.dataset.projectFilter === "all"));
  renderProjects();
  document.querySelector("#projects").scrollIntoView({ behavior: "smooth", block: "start" });
});
document.querySelectorAll(".nav-link").forEach((link) => link.addEventListener("click", () => {
  document.querySelectorAll(".nav-link").forEach((item) => item.classList.toggle("active", item === link));
  const target = document.querySelector(link.getAttribute("href"));
  target?.scrollIntoView({ behavior: "smooth", block: "start" });
}));

elements.tasks.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-task]");
  if (editButton) {
    editTask(Number(editButton.dataset.editTask));
    return;
  }
  const deleteButton = event.target.closest("[data-delete-task]");
  if (deleteButton) {
    const item = workspace.tasks.find((task) => task.id === Number(deleteButton.dataset.deleteTask));
    if (!item || !window.confirm(`Delete “${item.title}”? This also removes subtasks, comments, time entries, attachments, labels, and dependencies.`)) return;
    try {
      await request(`/api/tasks/${item.id}`, { method: "DELETE" });
      await loadWorkspace();
      showToast("Task deleted.");
    } catch (error) { showToast(error.message); }
    return;
  }
  const button = event.target.closest("[data-complete-task]");
  if (!button) return;
  button.disabled = true;
  try {
    await request(`/api/tasks/${button.dataset.completeTask}`, { method: "PATCH", body: JSON.stringify({ status: "done" }) });
    await loadWorkspace();
    showToast("Nice work. Task completed.");
  } catch (error) {
    button.disabled = false;
    showToast(error.message);
  }
});

elements.projects.addEventListener("click", async (event) => {
  const editButton = event.target.closest("[data-edit-project]");
  if (editButton) {
    editProject(Number(editButton.dataset.editProject));
    return;
  }
  const deleteButton = event.target.closest("[data-delete-project]");
  if (!deleteButton) return;
  const item = workspace.projects.find((projectItem) => projectItem.id === Number(deleteButton.dataset.deleteProject));
  if (!item || !window.confirm(`Delete “${item.name}” and all of its tasks and related records? This cannot be undone.`)) return;
  try {
    await request(`/api/projects/${item.id}`, { method: "DELETE" });
    await loadWorkspace();
    showToast("Project and its tasks deleted.");
  } catch (error) { showToast(error.message); }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
});

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
loadWorkspace();