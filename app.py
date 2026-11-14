"""Entry point for the local project-management web application."""

from __future__ import annotations

import os
import sys
from http.server import ThreadingHTTPServer

# Add backend directory to path for clean modular imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "backend")))

import project
import workspace_service
from http_handler import AppHandler


def main() -> None:
    project.initialize_database(workspace_service.DB_PATH)
    workspace_service.ensure_workspace_owner()
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
