let toastTimer;

export function showToast(toast, message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

export function openDialog(dialog, form, updateTaskOptions, state) {
  if (dialog.id === "project-dialog") state.editingProjectId = null;
  if (dialog.id === "task-dialog") state.editingTaskId = null;
  form.reset();
  dialog.querySelector(".dialog-error").textContent = "";
  if (dialog.id === "project-dialog") {
    document.querySelector("#project-dialog-title").textContent = "New project";
    form.querySelector('[type="submit"]').textContent = "Save Project";
  }
  if (dialog.id === "task-dialog") {
    document.querySelector("#task-dialog-title").textContent = "Add a task";
    form.querySelector('[type="submit"]').textContent = "Save Task";
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
  document.querySelectorAll(".tab-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
  if (updateHash && location.hash !== `#${view}`) location.hash = view;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function setTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? "#0b0f17" : "#f1f5f9";
  const toggle = document.querySelector("#theme-toggle");
  try { localStorage.setItem("studio-theme", isDark ? "dark" : "light"); } catch {}
}

export function initializeTheme() {
  let savedTheme = "dark";
  try { savedTheme = localStorage.getItem("studio-theme") || "dark"; } catch {}
  setTheme(savedTheme);
  document.querySelector("#theme-toggle").addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
}
