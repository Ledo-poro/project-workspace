# Studio Project Workspace

A lightweight project-management app for organizing projects and their next steps. It combines a responsive browser dashboard with a Python HTTP server and a local SQLite database. The app uses only Python's standard library; there are no Python or JavaScript packages to install.

## Features

- Use separate Overview, Projects, and My Tasks views; the overview keeps concise project and task previews.
- Switch between light and dark themes; the selected theme is remembered in the browser.
- Create projects with descriptions, statuses, and target dates.
- Add tasks to projects with priority, assignee, and due date.
- Edit or delete projects and tasks, with confirmation before deleting.
- Mark tasks complete and review progress in the dashboard.
- Filter and search projects and tasks, including done and cancelled tasks.
- Track task counts, completed work, and blocked work.
- Save data locally in SQLite across restarts.
- The database schema includes tables for members, milestones, dependencies, labels, comments, time entries, attachments, and activity records. These records do not currently have management screens or API routes.

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
├── app.py                 # Application entry point
├── http_handler.py        # HTTP routes and JSON/static responses
├── workspace_service.py   # Workspace queries and project/task operations
├── project.py             # SQLite schema and connection helpers
├── static/
│   ├── app.js             # Browser app entry point
│   ├── api.js             # JSON request helper
│   ├── events.js          # UI event handlers
│   ├── render.js          # Metrics, lists, and form options
│   ├── ui.js              # Dialogs, navigation, theme, and toasts
│   ├── utils.js           # Shared display helpers
│   ├── index.html         # App page
│   └── styles.css         # Responsive and theme styles
├── README.md
└── .gitignore
```

## API

- `GET /api/overview` returns all projects, tasks of every status, workspace counts, and active members. Tasks are ordered with open work first; including completed and cancelled tasks supports those filters in the browser.
- `POST /api/projects` creates a project.
- `POST /api/tasks` creates a task.
- `PATCH /api/tasks/{id}` updates a task's title, description, project, status, priority, assignee, or due date.
- `PATCH /api/projects/{id}` updates a project's name, description, status, start date, or due date.
- `DELETE /api/tasks/{id}` deletes a task and its related records.
- `DELETE /api/projects/{id}` deletes a project and its tasks and related records.

## Security Note

This is a local, single-workspace starter app. It does not implement login, access control, CSRF protection, or production deployment hardening. Keep it bound to `127.0.0.1`; do not expose it to an untrusted network or use it to store sensitive data without adding appropriate security controls.