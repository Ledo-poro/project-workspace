import { escapeHtml, formattedDate, statusLabel } from "./utils.js";

const PROJECT_COLORS = ["#34d399", "#38bdf8", "#fbbf24", "#c084fc", "#fb7185", "#2dd4bf", "#818cf8"];
const COMPLETED_TASK_STATUSES = ["done", "cancelled"];

function animateCounters() {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".metric-number").forEach((el) => {
    const target = parseInt(el.textContent, 10) || 0;
    if (prefersReducedMotion || target === 0) return;
    const duration = 600;
    const start = performance.now();
    const from = 0;
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(from + (target - from) * eased);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  });
}

export function renderMetrics(workspace) {
  const activeProjects = workspace.projects.filter((item) => item.status === "active").length;
  document.querySelector("#metric-projects").textContent = activeProjects;
  document.querySelector("#metric-open").textContent = workspace.counts.open_tasks || 0;
  document.querySelector("#metric-done").textContent = workspace.counts.completed_tasks || 0;
  document.querySelector("#metric-blocked").textContent = workspace.counts.blocked_tasks || 0;
  document.querySelector("#metric-project-caption").textContent = activeProjects
    ? `${workspace.projects.length} total in workspace`
    : "Ready to deploy";
  document.querySelector("#project-heading-count").textContent = workspace.projects.length;
  document.querySelector("#task-heading-count").textContent = workspace.counts.open_tasks || 0;
  document.querySelector("#project-page-count").textContent = workspace.projects.length;
  document.querySelector("#task-page-count").textContent = workspace.tasks.length;
  document.querySelector("#nav-project-count").textContent = workspace.projects.length;
  document.querySelector("#nav-task-count").textContent = workspace.counts.open_tasks || 0;

  requestAnimationFrame(() => animateCounters());
}

function projectEmptyState(hasProjects) {
  const title = hasProjects ? "No projects in this view" : "Start your first project";
  const description = hasProjects
    ? "Try clearing filters or search queries."
    : "Create a home for your next initiative, app, or release.";
  const action = hasProjects
    ? ""
    : '<button class="button button-primary" type="button" data-open-project>Create Project</button>';
  return `<div class="empty-state"><span class="empty-icon">📂</span><strong>${title}</strong><p>${description}</p>${action}</div>`;
}

function projectRow(item, index) {
  const progress = item.task_count
    ? Math.round(item.completed_count / item.task_count * 100)
    : 0;
  const taskLabel = item.task_count === 1 ? "task" : "tasks";
  return `<article class="project-row" style="--project-color:${PROJECT_COLORS[index % PROJECT_COLORS.length]}">
      <div class="project-name-wrap"><span class="project-color"></span><span class="project-meta"><strong>${escapeHtml(item.name)}</strong><small>${item.task_count} ${taskLabel} · ${escapeHtml(item.owner_name || "Workspace")}</small></span></div>
      <div><div class="progress-copy"><span>Progress</span><strong>${progress}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>
      <span class="project-status ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      <span class="project-due">${escapeHtml(formattedDate(item.due_date))}</span>
      <div class="row-actions">
        <button class="row-action-btn edit-btn" type="button" data-edit-project="${item.id}" title="Edit project">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="row-action-btn delete-btn" type="button" data-delete-project="${item.id}" title="Delete project">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete
        </button>
      </div>
    </article>`;
}

function renderProjectList(list, projects, hasProjects) {
  if (!projects.length) {
    list.innerHTML = projectEmptyState(hasProjects);
    return;
  }
  list.innerHTML = projects.map(projectRow).join("");
}

export function renderProjects(workspace, projectFilter, search, projectLists) {
  const normalizedSearch = search.trim().toLowerCase();
  const projects = workspace.projects.filter((item) => {
    const matchesFilter = projectFilter === "all" || item.status === projectFilter;
    const matchesSearch = !normalizedSearch
      || `${item.name} ${item.description}`.toLowerCase().includes(normalizedSearch);
    return matchesFilter && matchesSearch;
  });

  projectLists.forEach((list) => {
    const visibleProjects = list.dataset.listView === "overview" ? projects.slice(0, 3) : projects;
    renderProjectList(list, visibleProjects, workspace.projects.length > 0);
  });
}

function taskEmptyState(hasProjects) {
  const title = hasProjects ? "All caught up" : "No tasks in the queue";
  const description = hasProjects
    ? "No tasks match your current filter."
    : "Create a project and add tasks to get moving.";
  const action = hasProjects
    ? '<button class="button button-secondary" type="button" data-open-task>Add Task</button>'
    : "";
  return `<div class="empty-state"><span class="empty-icon">✨</span><strong>${title}</strong><p>${description}</p>${action}</div>`;
}

function taskRow(task, index, today) {
  const due = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null;
  const overdue = due && due < today;
  const initials = task.assignee_name
    ? task.assignee_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()
    : "–";
  const priority = task.priority[0].toUpperCase() + task.priority.slice(1);
  const dueLabel = due ? `${overdue ? "Late · " : "Due "}${escapeHtml(formattedDate(task.due_date))}` : "";
  return `<article class="task-row">
      <button class="task-check" type="button" data-complete-task="${task.id}" aria-label="Mark complete" title="Mark complete"></button>
      <div class="task-copy"><strong class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</strong><div class="task-meta"><span class="task-project">${escapeHtml(task.project_name)}</span><span>·</span><span class="task-priority ${escapeHtml(task.priority)}">${escapeHtml(priority)}</span></div></div>
      <div class="task-side">
        <span class="task-date ${overdue ? "overdue" : ""}">${dueLabel}</span>
        <span class="task-assignee" title="${escapeHtml(task.assignee_name || "Unassigned")}">${escapeHtml(initials)}</span>
      </div>
      <div class="row-actions">
        <button class="row-action-btn edit-btn" type="button" data-edit-task="${task.id}" title="Edit task">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit
        </button>
        <button class="row-action-btn delete-btn" type="button" data-delete-task="${task.id}" title="Delete task">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete
        </button>
      </div>
    </article>`;
}

function renderTaskList(list, tasks, hasProjects) {
  if (!tasks.length) {
    list.innerHTML = taskEmptyState(hasProjects);
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  list.innerHTML = tasks.map((task, index) => taskRow(task, index, today)).join("");
}

export function renderTasks(workspace, taskFilter, search, taskLists) {
  const normalizedSearch = search.trim().toLowerCase();
  const tasks = workspace.tasks.filter((item) => {
    const isOpen = !COMPLETED_TASK_STATUSES.includes(item.status);
    const matchesFilter = taskFilter === "all"
      ? isOpen
      : taskFilter === "urgent"
        ? ["urgent", "high"].includes(item.priority) && isOpen
        : item.status === taskFilter;
    const matchesSearch = !normalizedSearch
      || `${item.title} ${item.project_name} ${item.assignee_name || ""}`.toLowerCase().includes(normalizedSearch);
    return matchesFilter && matchesSearch;
  });

  taskLists.forEach((list) => {
    const visibleTasks = list.dataset.listView === "overview" ? tasks.slice(0, 4) : tasks;
    renderTaskList(list, visibleTasks, workspace.projects.length > 0);
  });
}

export function updateTaskFormOptions(workspace) {
  const projectSelect = document.querySelector("#task-project");
  const currentProject = projectSelect.value;
  projectSelect.innerHTML = workspace.projects
    .filter((item) => !["completed", "archived"].includes(item.status) || String(item.id) === currentProject)
    .map((item) => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join("");
  if (workspace.projects.some((item) => String(item.id) === currentProject)) {
    projectSelect.value = currentProject;
  }

  const assigneeSelect = document.querySelector("#task-assignee");
  const assignee = assigneeSelect.value;
  assigneeSelect.innerHTML = '<option value="">Unassigned</option>' + workspace.members
    .map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`).join("");
  assigneeSelect.value = assignee;
}
