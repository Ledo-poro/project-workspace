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

async function loadWorkspace() {
  try {
    state.workspace = await request("/api/overview");
    render();
  } catch (error) {
    elements.projects.innerHTML = `<div class="loading-row error-state">${escapeHtml(error.message)} Refresh the page to try again.</div>`;
    elements.tasks.innerHTML = "";
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
loadWorkspace();
