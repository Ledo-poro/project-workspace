# Studio Project Workspace

A lightweight project-management app for organizing projects and their next steps. It combines a responsive browser dashboard with a Python HTTP server and a local SQLite database. The app uses only Python's standard library; there are no Python or JavaScript packages to install.

## Features

- Create projects with descriptions, statuses, and target dates.
- Add tasks to projects with priority, assignee, and due date.
- Edit or delete projects and tasks, with confirmation before deleting.
- Mark tasks complete and review progress in the dashboard.
- Filter and search projects and open tasks.
- Track task counts, completed work, and blocked work.
- Save data locally in SQLite across restarts.
- Manage project members, milestones, task dependencies, labels, comments, time entries, attachments, and activity records in the database schema.

## Requirements

- Python 3.10 or newer
- A modern web browser

The app has no third-party dependencies.

## Run Locally

Open a terminal in this project directory and run:

```powershell
python app.py
```

Then open [http://127.0.0.1:8000](http://127.0.0.1:8000) in your browser. Leave the terminal open while using the app. Press `Ctrl+C` in that terminal to stop the server.

On Windows, if `python` is not on your PATH, use the Python launcher instead:

```powershell
py app.py
```

The server creates `project_management.db` in the project directory on first run. This database is intentionally ignored by Git so your local workspace data is not uploaded. `project.py` contains the schema and can also be run directly to initialize the database:

```powershell
python project.py
```

## Configuration

By default, the server listens only on `127.0.0.1` at port `8000`. You can select another database path, host, or port with environment variables:

```powershell
$env:PROJECT_DB_PATH = "C:\Data\studio-projects.db"
$env:HOST = "127.0.0.1"
$env:PORT = "8080"
python app.py
```

## Project Layout

```text
.
├── app.py                 # Local HTTP server and JSON API
├── project.py             # SQLite schema and connection helpers
├── static/
│   ├── app.js             # Dashboard behavior
│   ├── index.html         # App page
│   └── styles.css         # Responsive styles
├── README.md
└── .gitignore
```

## API

- `GET /api/overview` returns projects, open tasks, workspace counts, and members.
- `POST /api/projects` creates a project.
- `POST /api/tasks` creates a task.
- `PATCH /api/tasks/{id}` updates a task's title, details, project, status, priority, assignee, or due date.
- `PATCH /api/projects/{id}` edits a project.
- `DELETE /api/tasks/{id}` deletes a task and its related records.
- `DELETE /api/projects/{id}` deletes a project and its tasks and related records.

## Security Note

This is a local, single-workspace starter app. It does not implement login, access control, CSRF protection, or production deployment hardening. Keep it bound to `127.0.0.1`; do not expose it to an untrusted network or use it to store sensitive data without adding appropriate security controls.