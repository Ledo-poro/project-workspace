import { request } from "./api.js";
import { renderMetrics, renderProjects, renderTasks, updateTaskFormOptions } from "./render.js";
import { escapeHtml } from "./utils.js";
import { initializeTheme, openDialog as showDialog, showToast, showView } from "./ui.js";
import { registerEvents } from "./events.js";

const elements = {
  projects: document.querySelector("#project-list"),
  tasks: document.querySelector("#task-list"),
  projectLists: document.querySelectorAll(".project-list"),
  taskLists: document.querySelectorAll(".task-list"),
  search: document.querySelector("#global-search"),
  workspaceError: document.querySelector("#workspace-error"),
  projectDialog: document.querySelector("#project-dialog"),
  taskDialog: document.querySelector("#task-dialog"),
  projectForm: document.querySelector("#project-form"),
  taskForm: document.querySelector("#task-form"),
  toast: document.querySelector("#toast"),
};

const state = {
  workspace: { projects: [], tasks: [], counts: {}, members: [] },
  projectFilter: "all",
  taskFilter: "all",
  editingProjectId: null,
  editingTaskId: null,
};

function renderProjectLists() {
  renderProjects(state.workspace, state.projectFilter, elements.search.value, elements.projectLists);
}

function renderTaskLists() {
  renderTasks(state.workspace, state.taskFilter, elements.search.value, elements.taskLists);
}

function render() {
  renderMetrics(state.workspace);
  renderProjectLists();
  renderTaskLists();
  updateTaskFormOptions(state.workspace);
}

// Show skeleton loading placeholders
function showLoadingSkeletons() {
  const skeletonRow = `<div class="loading-row" style="animation: pulse-soft 1.5s ease-in-out infinite;">
    <span style="color: var(--subtle); font-size: 12px;">Loading workspace…</span>
  </div>`;
  elements.projectLists.forEach((list) => { list.innerHTML = skeletonRow; });
  elements.taskLists.forEach((list) => { list.innerHTML = skeletonRow; });
}

async function loadWorkspace() {
  try {
    state.workspace = await request("/api/overview");
    elements.workspaceError.hidden = true;
    elements.workspaceError.textContent = "";
    render();
  } catch (error) {
    elements.workspaceError.textContent = `${error.message} Refresh the page to try again.`;
    elements.workspaceError.hidden = false;
  }
}

function openDialog(dialog, form) {
  showDialog(dialog, form, () => updateTaskFormOptions(state.workspace), state);
}

function notify(message) {
  showToast(elements.toast, message);
}

initializeTheme();
registerEvents({
  elements,
  state,
  request,
  render,
  renderProjects: renderProjectLists,
  renderTasks: renderTaskLists,
  loadWorkspace,
  showToast: notify,
  openDialog,
  updateTaskFormOptions: () => updateTaskFormOptions(state.workspace),
  showView,
});

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat(undefined, {
  weekday: "long",
  month: "long",
  day: "numeric",
}).format(new Date()).toUpperCase();
showView(location.hash.slice(1) || "overview", false);
showLoadingSkeletons();
loadWorkspace();
