import { escapeHtml, formattedDate, statusLabel } from "./utils.js";

const PROJECT_COLORS = ["#789779", "#d68b73", "#d0a34d", "#8c83ad", "#5f91a0"];
const COMPLETED_TASK_STATUSES = ["done", "cancelled"];

export function renderMetrics(workspace) {
  const activeProjects = workspace.projects.filter((item) => item.status === "active").length;
  document.querySelector("#metric-projects").textContent = activeProjects;
  document.querySelector("#metric-open").textContent = workspace.counts.open_tasks || 0;
  document.querySelector("#metric-done").textContent = workspace.counts.completed_tasks || 0;
  document.querySelector("#metric-blocked").textContent = workspace.counts.blocked_tasks || 0;
  document.querySelector("#metric-project-caption").textContent = activeProjects
    ? `${workspace.projects.length} total in your workspace`
    : "Ready to get moving";
  document.querySelector("#project-heading-count").textContent = workspace.projects.length;
  document.querySelector("#task-heading-count").textContent = workspace.counts.open_tasks || 0;
  document.querySelector("#project-page-count").textContent = workspace.projects.length;
  document.querySelector("#task-page-count").textContent = workspace.tasks.length;
  document.querySelector("#nav-project-count").textContent = workspace.projects.length;
  document.querySelector("#nav-task-count").textContent = workspace.counts.open_tasks || 0;
}

function projectEmptyState(hasProjects) {
  const icon = hasProjects ? "⌕" : "+";
  const title = hasProjects ? "Nothing in this view" : "Your first project starts here";
  const description = hasProjects
    ? "Try another filter or a different search."
    : "Create a home for your team's next idea, launch, or big move.";
  const action = hasProjects
    ? ""
    : '<button class="button button-secondary" type="button" data-open-project>Create a project</button>';
  return `<div class="empty-state"><span class="empty-icon">${icon}</span><strong>${title}</strong><p>${description}</p>${action}</div>`;
}

function projectRow(item, index) {
  const progress = item.task_count
    ? Math.round(item.completed_count / item.task_count * 100)
    : 0;
  const taskLabel = item.task_count === 1 ? "task" : "tasks";
  return `<article class="project-row" style="--project-color:${PROJECT_COLORS[index % PROJECT_COLORS.length]};animation-delay:${index * 45}ms">
      <div class="project-name-wrap"><span class="project-color"></span><span class="project-meta"><strong>${escapeHtml(item.name)}</strong><small>${item.task_count} ${taskLabel} · ${escapeHtml(item.owner_name || "Workspace")}</small></span></div>
      <div><div class="progress-copy"><span>Progress</span><strong>${progress}%</strong></div><div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div></div>
      <span class="project-status ${escapeHtml(item.status)}">${escapeHtml(statusLabel(item.status))}</span>
      <span class="project-due">${escapeHtml(formattedDate(item.due_date))}</span>
      <div class="row-actions"><button class="row-action edit-icon" type="button" data-edit-project="${item.id}" aria-label="Edit project ${escapeHtml(item.name)}" title="Edit project"></button><button class="row-action delete-icon" type="button" data-delete-project="${item.id}" aria-label="Delete project ${escapeHtml(item.name)}" title="Delete project"></button></div>
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
  const icon = hasProjects ? "✓" : "↗";
  const title = hasProjects ? "A little breathing room" : "No tasks on the board yet";
  const description = hasProjects
    ? "Add a task when there's a next step to take."
    : "Create a project first, then break the work into clear next steps.";
  const action = hasProjects
    ? '<button class="button button-secondary" type="button" data-open-task>Add a task</button>'
    : "";
  return `<div class="empty-state"><span class="empty-icon">${icon}</span><strong>${title}</strong><p>${description}</p>${action}</div>`;
}

function taskRow(task, index, today) {
  const due = task.due_date ? new Date(`${task.due_date}T00:00:00`) : null;
  const overdue = due && due < today;
  const initials = task.assignee_name
    ? task.assignee_name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()
    : "–";
  const priority = task.priority[0].toUpperCase() + task.priority.slice(1);
  const dueLabel = due ? `${overdue ? "Late · " : "Due "}${escapeHtml(formattedDate(task.due_date))}` : "";
  return `<article class="task-row" style="animation-delay:${index * 35}ms">
      <button class="task-check" type="button" data-complete-task="${task.id}" aria-label="Mark ${escapeHtml(task.title)} complete" title="Mark complete"></button>
      <div class="task-copy"><strong class="task-title" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</strong><div class="task-meta"><span class="task-project">${escapeHtml(task.project_name)}</span><span class="task-meta-sep"></span><span class="task-priority ${escapeHtml(task.priority)}"><i class="priority-mark"></i>${escapeHtml(priority)}</span></div></div>
      <div class="task-side"><span class="task-date ${overdue ? "overdue" : ""}">${dueLabel}</span><span class="task-assignee ${task.assignee_name ? "" : "unassigned"}" title="${escapeHtml(task.assignee_name || "Unassigned")}">${escapeHtml(initials)}</span><div class="row-actions"><button class="row-action edit-icon" type="button" data-edit-task="${task.id}" aria-label="Edit task ${escapeHtml(task.title)}" title="Edit task"></button><button class="row-action delete-icon" type="button" data-delete-task="${task.id}" aria-label="Delete task ${escapeHtml(task.title)}" title="Delete task"></button></div></div>
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
