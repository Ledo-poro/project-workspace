"""Local web application for the project-management SQLite database."""

from __future__ import annotations

import json
import os
import sqlite3
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

import project


ROOT = Path(__file__).parent
DB_PATH = Path(os.environ.get("PROJECT_DB_PATH", ROOT / "project_management.db"))
STATIC_FILES = {
    "/": (ROOT / "static" / "index.html", "text/html; charset=utf-8"),
    "/static/styles.css": (ROOT / "static" / "styles.css", "text/css; charset=utf-8"),
    "/static/app.js": (ROOT / "static" / "app.js", "text/javascript; charset=utf-8"),
}
PROJECT_STATUSES = {"planned", "active", "on_hold", "completed", "archived"}
TASK_STATUSES = {"backlog", "todo", "in_progress", "blocked", "done", "cancelled"}
TASK_PRIORITIES = {"low", "medium", "high", "urgent"}


def database() -> sqlite3.Connection:
    connection = project.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def ensure_workspace_owner() -> int:
    with closing(database()) as connection, connection:
        row = connection.execute(
            "SELECT id FROM users WHERE is_active = 1 ORDER BY id LIMIT 1"
        ).fetchone()
        if row:
            return int(row["id"])
        cursor = connection.execute(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            ("Workspace Admin", "admin@local.workspace", "local-workspace-account"),
        )
        return int(cursor.lastrowid)


def record_activity(
    connection: sqlite3.Connection,
    project_id: int,
    action: str,
    task_id: int | None = None,
    details: dict[str, object] | None = None,
) -> None:
    actor = connection.execute(
        "SELECT id FROM users WHERE is_active = 1 ORDER BY id LIMIT 1"
    ).fetchone()
    connection.execute(
        """INSERT INTO activity_log (project_id, task_id, actor_id, action, details)
           VALUES (?, ?, ?, ?, ?)""",
        (project_id, task_id, actor["id"] if actor else None, action, json.dumps(details or {})),
    )


def dashboard_data() -> dict[str, object]:
    with closing(database()) as connection:
        projects = [dict(row) for row in connection.execute(
            """SELECT p.id, p.name, p.description, p.status, p.start_date, p.due_date,
                      p.updated_at, u.name AS owner_name,
                      COUNT(t.id) AS task_count,
                      COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS completed_count
               FROM projects p
               JOIN users u ON u.id = p.owner_id
               LEFT JOIN tasks t ON t.project_id = p.id
               GROUP BY p.id
               ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'planned' THEN 1 ELSE 2 END,
                        p.updated_at DESC"""
        )]
        tasks = [dict(row) for row in connection.execute(
            """SELECT t.id, t.project_id, p.name AS project_name, t.title, t.description,
                      t.status, t.priority, t.assignee_id, u.name AS assignee_name,
                      t.due_date, t.estimate_minutes, t.updated_at
               FROM tasks t
               JOIN projects p ON p.id = t.project_id
               LEFT JOIN users u ON u.id = t.assignee_id
               ORDER BY CASE WHEN t.status IN ('done', 'cancelled') THEN 1 ELSE 0 END,
                        CASE t.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1
                        WHEN 'medium' THEN 2 ELSE 3 END,
                        t.due_date IS NULL, t.due_date, t.updated_at DESC
               """
        )]
        counts = connection.execute(
            """SELECT COUNT(DISTINCT p.id) AS projects,
                      COALESCE(SUM(CASE WHEN t.status NOT IN ('done', 'cancelled') THEN 1 ELSE 0 END), 0) AS open_tasks,
                      COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS completed_tasks,
                      COALESCE(SUM(CASE WHEN t.status = 'blocked' THEN 1 ELSE 0 END), 0) AS blocked_tasks
               FROM projects p LEFT JOIN tasks t ON t.project_id = p.id"""
        ).fetchone()
        members = [dict(row) for row in connection.execute(
            "SELECT id, name, email FROM users WHERE is_active = 1 ORDER BY name"
        )]
        return {"projects": projects, "tasks": tasks, "counts": dict(counts), "members": members}


class AppHandler(BaseHTTPRequestHandler):
    server_version = "StudioProjects/1.0"

    def send_json(self, payload: object, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self) -> dict[str, object]:
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError) as error:
            raise ValueError("Request body must be valid JSON.") from error
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/overview":
            self.send_json(dashboard_data())
            return
        if path in STATIC_FILES:
            file_path, content_type = STATIC_FILES[path]
            content = file_path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        self.send_json({"error": "Not found."}, 404)

    def do_POST(self) -> None:
        try:
            payload = self.read_json()
            path = urlparse(self.path).path
            if path == "/api/projects":
                self.create_project(payload)
            elif path == "/api/tasks":
                self.create_task(payload)
            else:
                self.send_json({"error": "Not found."}, 404)
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
        except sqlite3.IntegrityError as error:
            self.send_json({"error": f"Could not save record: {error}"}, 400)

    def do_PATCH(self) -> None:
        try:
            path_parts = urlparse(self.path).path.strip("/").split("/")
            if len(path_parts) != 3 or path_parts[0] != "api":
                self.send_json({"error": "Not found."}, 404)
                return
            record_id = int(path_parts[2])
            payload = self.read_json()
            if path_parts[1] == "tasks":
                self.update_task(record_id, payload)
            elif path_parts[1] == "projects":
                self.update_project(record_id, payload)
            else:
                self.send_json({"error": "Not found."}, 404)
        except (ValueError, sqlite3.IntegrityError) as error:
            self.send_json({"error": str(error)}, 400)

    def do_DELETE(self) -> None:
        path_parts = urlparse(self.path).path.strip("/").split("/")
        if len(path_parts) != 3 or path_parts[0] != "api":
            self.send_json({"error": "Not found."}, 404)
            return
        try:
            record_id = int(path_parts[2])
            if path_parts[1] == "tasks":
                self.delete_task(record_id)
            elif path_parts[1] == "projects":
                self.delete_project(record_id)
            else:
                self.send_json({"error": "Not found."}, 404)
        except (ValueError, sqlite3.IntegrityError) as error:
            self.send_json({"error": str(error)}, 400)

    def create_project(self, payload: dict[str, object]) -> None:
        name = str(payload.get("name", "")).strip()
        description = str(payload.get("description", "")).strip()
        status = str(payload.get("status", "active"))
        if not name:
            raise ValueError("Project name is required.")
        if status not in PROJECT_STATUSES:
            raise ValueError("Choose a valid project status.")
        start_date = str(payload.get("start_date", "")).strip() or None
        due_date = str(payload.get("due_date", "")).strip() or None
        owner_id = ensure_workspace_owner()
        with closing(database()) as connection, connection:
            cursor = connection.execute(
                """INSERT INTO projects (name, description, status, start_date, due_date, owner_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (name, description, status, start_date, due_date, owner_id),
            )
            project_id = int(cursor.lastrowid)
            connection.execute(
                "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, 'owner')",
                (project_id, owner_id),
            )
            record_activity(connection, project_id, "project_created", details={"name": name})
        self.send_json({"id": project_id}, 201)

    def create_task(self, payload: dict[str, object]) -> None:
        title = str(payload.get("title", "")).strip()
        if not title:
            raise ValueError("Task title is required.")
        try:
            project_id = int(payload.get("project_id", 0))
        except (TypeError, ValueError) as error:
            raise ValueError("Choose a project for this task.") from error
        status = str(payload.get("status", "todo"))
        priority = str(payload.get("priority", "medium"))
        if status not in TASK_STATUSES:
            raise ValueError("Choose a valid task status.")
        if priority not in TASK_PRIORITIES:
            raise ValueError("Choose a valid task priority.")
        assignee_value = payload.get("assignee_id")
        assignee_id = int(assignee_value) if assignee_value not in (None, "") else None
        due_date = str(payload.get("due_date", "")).strip() or None
        estimate_value = payload.get("estimate_minutes")
        estimate = int(estimate_value) if estimate_value not in (None, "") else None
        with closing(database()) as connection, connection:
            cursor = connection.execute(
                """INSERT INTO tasks
                   (project_id, title, description, status, priority, assignee_id, reporter_id, due_date, estimate_minutes)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (project_id, title, str(payload.get("description", "")).strip(), status,
                 priority, assignee_id, ensure_workspace_owner(), due_date, estimate),
            )
            task_id = int(cursor.lastrowid)
            record_activity(connection, project_id, "task_created", task_id, {"title": title})
        self.send_json({"id": task_id}, 201)

    def update_task(self, task_id: int, payload: dict[str, object]) -> None:
        allowed = {
            "title", "description", "project_id", "status", "priority",
            "assignee_id", "due_date",
        }
        updates = {key: value for key, value in payload.items() if key in allowed}
        if not updates:
            raise ValueError("No supported task fields were provided.")
        if "title" in updates:
            updates["title"] = str(updates["title"]).strip()
            if not updates["title"]:
                raise ValueError("Task title is required.")
        if "description" in updates:
            updates["description"] = str(updates["description"]).strip()
        if "project_id" in updates:
            updates["project_id"] = int(updates["project_id"])
        if "status" in updates and updates["status"] not in TASK_STATUSES:
            raise ValueError("Choose a valid task status.")
        if "priority" in updates and updates["priority"] not in TASK_PRIORITIES:
            raise ValueError("Choose a valid task priority.")
        if "assignee_id" in updates:
            updates["assignee_id"] = int(updates["assignee_id"]) if updates["assignee_id"] else None
        if "due_date" in updates:
            updates["due_date"] = str(updates["due_date"]).strip() or None
        assignments = [f"{field} = ?" for field in updates]
        values = list(updates.values())
        if updates.get("status") == "done":
            assignments.append("completed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
        elif updates.get("status"):
            assignments.append("completed_at = NULL")
        with closing(database()) as connection, connection:
            task = connection.execute("SELECT project_id FROM tasks WHERE id = ?", (task_id,)).fetchone()
            if not task:
                raise ValueError("Task not found.")
            connection.execute(
                f"UPDATE tasks SET {', '.join(assignments)} WHERE id = ?",
                (*values, task_id),
            )
            record_activity(connection, int(updates.get("project_id", task["project_id"])), "task_updated", task_id, updates)
        self.send_json({"ok": True})

    def update_project(self, project_id: int, payload: dict[str, object]) -> None:
        allowed = {"name", "description", "status", "start_date", "due_date"}
        updates = {key: value for key, value in payload.items() if key in allowed}
        if not updates:
            raise ValueError("No supported project fields were provided.")
        if "name" in updates:
            updates["name"] = str(updates["name"]).strip()
            if not updates["name"]:
                raise ValueError("Project name is required.")
        if "description" in updates:
            updates["description"] = str(updates["description"]).strip()
        if "status" in updates and updates["status"] not in PROJECT_STATUSES:
            raise ValueError("Choose a valid project status.")
        for field in ("start_date", "due_date"):
            if field in updates:
                updates[field] = str(updates[field]).strip() or None
        assignments = [f"{field} = ?" for field in updates]
        with closing(database()) as connection, connection:
            if not connection.execute("SELECT 1 FROM projects WHERE id = ?", (project_id,)).fetchone():
                raise ValueError("Project not found.")
            connection.execute(
                f"UPDATE projects SET {', '.join(assignments)} WHERE id = ?",
                (*updates.values(), project_id),
            )
            record_activity(connection, project_id, "project_updated", details=updates)
        self.send_json({"ok": True})

    def delete_task(self, task_id: int) -> None:
        with closing(database()) as connection, connection:
            task = connection.execute(
                "SELECT project_id, title FROM tasks WHERE id = ?", (task_id,)
            ).fetchone()
            if not task:
                raise ValueError("Task not found.")
            record_activity(
                connection,
                int(task["project_id"]),
                "task_deleted",
                task_id,
                {"title": task["title"]},
            )
            connection.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        self.send_json({"ok": True})

    def delete_project(self, project_id: int) -> None:
        with closing(database()) as connection, connection:
            cursor = connection.execute("DELETE FROM projects WHERE id = ?", (project_id,))
            if cursor.rowcount == 0:
                raise ValueError("Project not found.")
        self.send_json({"ok": True})

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    project.initialize_database(DB_PATH)
    ensure_workspace_owner()
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer((host, port), AppHandler)
    print(f"Project workspace running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down project workspace...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()