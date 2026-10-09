export function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
}

export function formattedDate(value) {
  if (!value) return "No target date";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function statusLabel(value) {
  const labels = {
    active: "In progress",
    planned: "Planned",
    on_hold: "On hold",
    completed: "Completed",
    archived: "Archived",
  };
  return labels[value] || value;
}
