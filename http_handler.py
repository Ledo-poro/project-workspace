"""HTTP routing and response handling for the local workspace app."""

from __future__ import annotations

import json
import sqlite3
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse

import workspace_service


ROOT = Path(__file__).parent
STATIC_FILES = {
    "/": (ROOT / "static" / "index.html", "text/html; charset=utf-8"),
    "/static/styles.css": (ROOT / "static" / "styles.css", "text/css; charset=utf-8"),
    "/static/app.js": (ROOT / "static" / "app.js", "text/javascript; charset=utf-8"),
    "/static/api.js": (ROOT / "static" / "api.js", "text/javascript; charset=utf-8"),
    "/static/events.js": (ROOT / "static" / "events.js", "text/javascript; charset=utf-8"),
    "/static/render.js": (ROOT / "static" / "render.js", "text/javascript; charset=utf-8"),
    "/static/ui.js": (ROOT / "static" / "ui.js", "text/javascript; charset=utf-8"),
    "/static/utils.js": (ROOT / "static" / "utils.js", "text/javascript; charset=utf-8"),
}
NOT_FOUND = {"error": "Not found."}


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

    def send_static_file(self, file_path: Path, content_type: str) -> None:
        content = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

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
            self.send_json(workspace_service.dashboard_data())
            return
        if path in STATIC_FILES:
            file_path, content_type = STATIC_FILES[path]
            self.send_static_file(file_path, content_type)
            return
        self.send_json(NOT_FOUND, 404)

    def do_POST(self) -> None:
        try:
            payload = self.read_json()
            path = urlparse(self.path).path
            if path == "/api/projects":
                self.send_json({"id": workspace_service.create_project(payload)}, 201)
            elif path == "/api/tasks":
                self.send_json({"id": workspace_service.create_task(payload)}, 201)
            else:
                self.send_json(NOT_FOUND, 404)
        except ValueError as error:
            self.send_json({"error": str(error)}, 400)
        except sqlite3.IntegrityError as error:
            self.send_json({"error": f"Could not save record: {error}"}, 400)

    def do_PATCH(self) -> None:
        try:
            path_parts = urlparse(self.path).path.strip("/").split("/")
            if len(path_parts) != 3 or path_parts[0] != "api":
                self.send_json(NOT_FOUND, 404)
                return
            record_id = int(path_parts[2])
            payload = self.read_json()
            if path_parts[1] == "tasks":
                workspace_service.update_task(record_id, payload)
            elif path_parts[1] == "projects":
                workspace_service.update_project(record_id, payload)
            else:
                self.send_json(NOT_FOUND, 404)
                return
            self.send_json({"ok": True})
        except (ValueError, sqlite3.IntegrityError) as error:
            self.send_json({"error": str(error)}, 400)

    def do_DELETE(self) -> None:
        path_parts = urlparse(self.path).path.strip("/").split("/")
        if len(path_parts) != 3 or path_parts[0] != "api":
            self.send_json(NOT_FOUND, 404)
            return
        try:
            record_id = int(path_parts[2])
            if path_parts[1] == "tasks":
                workspace_service.delete_task(record_id)
            elif path_parts[1] == "projects":
                workspace_service.delete_project(record_id)
            else:
                self.send_json(NOT_FOUND, 404)
                return
            self.send_json({"ok": True})
        except (ValueError, sqlite3.IntegrityError) as error:
            self.send_json({"error": str(error)}, 400)

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")
