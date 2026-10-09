const PROJECT_FILTER_SELECTOR = "[data-project-filter]";
const TASK_FILTER_SELECTOR = "[data-task-filter]";
const TASK_BUTTON_SELECTOR = "#open-task-modal, #open-task-quick, [data-open-task]";

function syncFilterButtons(selector, selectedValue, dataKey) {
  document.querySelectorAll(selector).forEach((button) => {
    button.classList.toggle("selected", button.dataset[dataKey] === selectedValue);
  });
}

function openTaskDialogOrPrompt(context) {
  const { state, elements, showToast, openDialog, updateTaskFormOptions } = context;
  if (!state.workspace.projects.length) {
    showToast("Create a project before adding a task.");
    openDialog(elements.projectDialog, elements.projectForm, updateTaskFormOptions);
    return;
  }
  openDialog(elements.taskDialog, elements.taskForm, updateTaskFormOptions);
}

function editProject(context, projectId) {
  const { state, elements, openDialog, updateTaskFormOptions } = context;
  const project = state.workspace.projects.find((item) => item.id === projectId);
  if (!project) return;
  openDialog(elements.projectDialog, elements.projectForm, updateTaskFormOptions);
  state.editingProjectId = projectId;
  elements.projectForm.elements.name.value = project.name;
  elements.projectForm.elements.description.value = project.description;
  elements.projectForm.elements.status.value = project.status;
  elements.projectForm.elements.due_date.value = project.due_date || "";
  document.querySelector("#project-dialog-title").textContent = "Edit project";
  elements.projectForm.querySelector('[type="submit"]').textContent = "Save changes";
}

function editTask(context, taskId) {
  const { state, elements, openDialog, updateTaskFormOptions } = context;
  const task = state.workspace.tasks.find((item) => item.id === taskId);
  if (!task) return;
  openDialog(elements.taskDialog, elements.taskForm, updateTaskFormOptions);
  state.editingTaskId = taskId;
  const projectSelect = elements.taskForm.elements.project_id;
  if (!projectSelect.querySelector(`option[value="${task.project_id}"]`)) {
    const project = state.workspace.projects.find((item) => item.id === task.project_id);
    if (project) projectSelect.add(new Option(project.name, project.id));
  }
  elements.taskForm.elements.title.value = task.title;
  elements.taskForm.elements.description.value = task.description;
  elements.taskForm.elements.project_id.value = task.project_id;
  elements.taskForm.elements.priority.value = task.priority;
  elements.taskForm.elements.status.value = task.status;
  elements.taskForm.elements.assignee_id.value = task.assignee_id || "";
  elements.taskForm.elements.due_date.value = task.due_date || "";
  document.querySelector("#task-dialog-title").textContent = "Edit task";
  elements.taskForm.querySelector('[type="submit"]').textContent = "Save changes";
}

async function submitProject(context, event) {
  const { elements, state, request, loadWorkspace, showToast } = context;
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(elements.projectForm).entries());
  const error = document.querySelector("#project-error");
  error.textContent = "";
  try {
    const isEditing = state.editingProjectId !== null;
    const path = isEditing ? `/api/projects/${state.editingProjectId}` : "/api/projects";
    await request(path, {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    elements.projectDialog.close();
    state.editingProjectId = null;
    state.projectFilter = "all";
    syncFilterButtons(PROJECT_FILTER_SELECTOR, "all", "projectFilter");
    await loadWorkspace();
    showToast(isEditing ? "Project changes saved." : "Project created. Let’s get to it.");
  } catch (submitError) {
    error.textContent = submitError.message;
  }
}

async function submitTask(context, event) {
  const { elements, state, request, loadWorkspace, showToast } = context;
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(elements.taskForm).entries());
  const error = document.querySelector("#task-error");
  error.textContent = "";
  try {
    const isEditing = state.editingTaskId !== null;
    const path = isEditing ? `/api/tasks/${state.editingTaskId}` : "/api/tasks";
    await request(path, {
      method: isEditing ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    });
    elements.taskDialog.close();
    state.editingTaskId = null;
    await loadWorkspace();
    showToast(isEditing ? "Task changes saved." : "Task added to your list.");
  } catch (submitError) {
    error.textContent = submitError.message;
  }
}

function registerProjectActions(context) {
  const { elements, state, request, loadWorkspace, showToast } = context;
  elements.projectLists.forEach((list) => list.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-project]");
    if (editButton) {
      editProject(context, Number(editButton.dataset.editProject));
      return;
    }
    const deleteButton = event.target.closest("[data-delete-project]");
    if (!deleteButton) return;
    const project = state.workspace.projects.find((item) => item.id === Number(deleteButton.dataset.deleteProject));
    if (!project || !window.confirm(`Delete “${project.name}” and all of its tasks and related records? This cannot be undone.`)) return;
    try {
      await request(`/api/projects/${project.id}`, { method: "DELETE" });
      await loadWorkspace();
      showToast("Project and its tasks deleted.");
    } catch (error) {
      showToast(error.message);
    }
  }));
}

function registerTaskActions(context) {
  const { elements, state, request, loadWorkspace, showToast } = context;
  elements.taskLists.forEach((list) => list.addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-task]");
    if (editButton) {
      editTask(context, Number(editButton.dataset.editTask));
      return;
    }
    const deleteButton = event.target.closest("[data-delete-task]");
    if (deleteButton) {
      const task = state.workspace.tasks.find((item) => item.id === Number(deleteButton.dataset.deleteTask));
      if (!task || !window.confirm(`Delete “${task.title}”? This also removes subtasks, comments, time entries, attachments, labels, and dependencies.`)) return;
      try {
        await request(`/api/tasks/${task.id}`, { method: "DELETE" });
        await loadWorkspace();
        showToast("Task deleted.");
      } catch (error) {
        showToast(error.message);
      }
      return;
    }
    const completeButton = event.target.closest("[data-complete-task]");
    if (!completeButton) return;
    completeButton.disabled = true;
    try {
      await request(`/api/tasks/${completeButton.dataset.completeTask}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      await loadWorkspace();
      showToast("Nice work. Task completed.");
    } catch (error) {
      completeButton.disabled = false;
      showToast(error.message);
    }
  }));
}

export function registerEvents(context) {
  const { elements, state, render, renderProjects, renderTasks, loadWorkspace, showToast, openDialog, updateTaskFormOptions, showView } = context;

  document.addEventListener("click", (event) => {
    if (event.target.closest("#open-project-modal, [data-open-project]")) {
      openDialog(elements.projectDialog, elements.projectForm, updateTaskFormOptions);
    }
  });
  document.querySelectorAll(TASK_BUTTON_SELECTOR).forEach((button) => {
    button.addEventListener("click", () => openTaskDialogOrPrompt(context));
  });
  document.querySelectorAll("[data-close-dialog]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog").close());
  });
  document.querySelectorAll("dialog").forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });

  elements.projectForm.addEventListener("submit", (event) => submitProject(context, event));
  elements.taskForm.addEventListener("submit", (event) => submitTask(context, event));

  document.querySelectorAll(PROJECT_FILTER_SELECTOR).forEach((button) => {
    button.addEventListener("click", () => {
      state.projectFilter = button.dataset.projectFilter;
      syncFilterButtons(PROJECT_FILTER_SELECTOR, state.projectFilter, "projectFilter");
      renderProjects();
    });
  });
  document.querySelectorAll(TASK_FILTER_SELECTOR).forEach((button) => {
    button.addEventListener("click", () => {
      state.taskFilter = button.dataset.taskFilter;
      syncFilterButtons(TASK_FILTER_SELECTOR, state.taskFilter, "taskFilter");
      renderTasks();
    });
  });
  elements.search.addEventListener("input", () => {
    renderProjects();
    renderTasks();
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      showView(link.dataset.view);
    });
  });
  document.querySelectorAll("[data-navigate-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.navigateView));
  });
  window.addEventListener("hashchange", () => showView(location.hash.slice(1), false));
  document.querySelector("#tasks-page-add").addEventListener("click", () => openTaskDialogOrPrompt(context));

  registerProjectActions(context);
  registerTaskActions(context);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
    event.preventDefault();
    elements.search.focus();
  });
}
