let toastTimer;

export function showToast(toast, message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

export function openDialog(dialog, form, updateTaskOptions, state) {
  if (dialog.id === "project-dialog") state.editingProjectId = null;
  if (dialog.id === "task-dialog") state.editingTaskId = null;
  form.reset();
  dialog.querySelector(".dialog-error").textContent = "";
  if (dialog.id === "project-dialog") {
    document.querySelector("#project-dialog-title").textContent = "New project";
    form.querySelector('[type="submit"]').textContent = "Create project";
  }
  if (dialog.id === "task-dialog") {
    document.querySelector("#task-dialog-title").textContent = "Add a task";
    form.querySelector('[type="submit"]').textContent = "Add task";
  }
  if (dialog.id === "task-dialog") updateTaskOptions();
  dialog.showModal();
  dialog.querySelector("input:not([type=date]), select")?.focus();
}

export function showView(view, updateHash = true) {
  const validViews = ["overview", "projects", "tasks"];
  if (!validViews.includes(view)) view = "overview";
  document.querySelectorAll("[data-page-view]").forEach((section) => {
    section.hidden = section.dataset.pageView !== view;
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  document.querySelector("#current-view-label").textContent = view === "tasks"
    ? "My tasks"
    : view[0].toUpperCase() + view.slice(1);
  if (updateHash && location.hash !== `#${view}`) location.hash = view;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const toggle = document.querySelector("#theme-toggle");
  toggle.setAttribute("aria-label", label);
  toggle.title = label;
  try { localStorage.setItem("studio-theme", isDark ? "dark" : "light"); } catch {}
}

export function initializeTheme() {
  let savedTheme = "light";
  try { savedTheme = localStorage.getItem("studio-theme") || "light"; } catch {}
  setTheme(savedTheme);
  document.querySelector("#theme-toggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
}
