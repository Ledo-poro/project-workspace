"""SQLite storage layer for a small project-management system."""

from __future__ import annotations

import sqlite3
from pathlib import Path


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	email TEXT NOT NULL UNIQUE COLLATE NOCASE,
	password_hash TEXT NOT NULL,
	is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS projects (
	id INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'planned'
		CHECK (status IN ('planned', 'active', 'on_hold', 'completed', 'archived')),
	start_date TEXT,
	due_date TEXT,
	owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date)
);

CREATE TABLE IF NOT EXISTS project_members (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	role TEXT NOT NULL DEFAULT 'member'
		CHECK (role IN ('owner', 'manager', 'member', 'viewer')),
	joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS milestones (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	due_date TEXT,
	status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'completed')),
	completed_at TEXT,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS tasks (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	milestone_id INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
	parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
	title TEXT NOT NULL,
	description TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'todo'
		CHECK (status IN ('backlog', 'todo', 'in_progress', 'blocked', 'done', 'cancelled')),
	priority TEXT NOT NULL DEFAULT 'medium'
		CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
	assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
	reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
	start_date TEXT,
	due_date TEXT,
	estimate_minutes INTEGER CHECK (estimate_minutes IS NULL OR estimate_minutes >= 0),
	position REAL NOT NULL DEFAULT 0,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	completed_at TEXT,
	CHECK (start_date IS NULL OR due_date IS NULL OR start_date <= due_date),
	CHECK (parent_task_id IS NULL OR parent_task_id <> id)
);

CREATE TABLE IF NOT EXISTS task_dependencies (
	task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	dependency_type TEXT NOT NULL DEFAULT 'finish_to_start'
		CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	PRIMARY KEY (task_id, depends_on_task_id),
	CHECK (task_id <> depends_on_task_id)
);

CREATE TABLE IF NOT EXISTS labels (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	name TEXT NOT NULL,
	color TEXT NOT NULL DEFAULT '#64748b',
	UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS task_labels (
	task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
	PRIMARY KEY (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS comments (
	id INTEGER PRIMARY KEY,
	task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
	body TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
	updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS time_entries (
	id INTEGER PRIMARY KEY,
	task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	description TEXT NOT NULL DEFAULT '',
	minutes INTEGER NOT NULL CHECK (minutes > 0),
	work_date TEXT NOT NULL,
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS attachments (
	id INTEGER PRIMARY KEY,
	task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
	file_name TEXT NOT NULL,
	storage_path TEXT NOT NULL,
	mime_type TEXT,
	size_bytes INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
	id INTEGER PRIMARY KEY,
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
	actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
	action TEXT NOT NULL,
	details TEXT NOT NULL DEFAULT '{}',
	created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_owner_status ON projects(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id, project_id);
CREATE INDEX IF NOT EXISTS idx_milestones_project_due ON milestones(project_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assignee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_blocked ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_labels_label ON task_labels(label_id, task_id);
CREATE INDEX IF NOT EXISTS idx_comments_task_created ON comments(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_time_entries_task_date ON time_entries(task_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_project_created ON activity_log(project_id, created_at);

CREATE TRIGGER IF NOT EXISTS trg_projects_updated_at
AFTER UPDATE ON projects
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
	UPDATE projects SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_updated_at
AFTER UPDATE ON tasks
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
	UPDATE tasks SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_comments_updated_at
AFTER UPDATE ON comments
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
	UPDATE comments SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = NEW.id;
END;
"""


def connect(db_path: str | Path = "project_management.db") -> sqlite3.Connection:
	"""Open a configured SQLite connection with foreign-key enforcement enabled."""
	connection = sqlite3.connect(db_path)
	connection.row_factory = sqlite3.Row
	connection.execute("PRAGMA foreign_keys = ON")
	return connection


def initialize_database(db_path: str | Path = "project_management.db") -> None:
	"""Create the project-management schema and indexes if they do not exist."""
	if str(db_path) != ":memory:":
		Path(db_path).parent.mkdir(parents=True, exist_ok=True)

	with connect(db_path) as connection:
		connection.executescript(SCHEMA)


if __name__ == "__main__":
	initialize_database()
	print("Initialized project_management.db")
