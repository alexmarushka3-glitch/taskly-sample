import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  start_date TEXT
);
`;

/**
 * Parse an optional start date. Returns { value } (string or null) or { error }.
 * undefined/null/"" mean "no date"; otherwise a real YYYY-MM-DD calendar date.
 */
export function parseStartDate(value) {
  if (value === undefined || value === null || value === "") return { value: null };
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: "start_date must be a YYYY-MM-DD date" };
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    return { error: "start_date must be a real calendar date" };
  }
  return { value };
}

/** Open the task database. Pass ":memory:" for a throwaway one (tests do). */
export function openDb(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  const cols = db.prepare("PRAGMA table_info(tasks)").all();
  if (!cols.some((c) => c.name === "start_date")) {
    db.exec("ALTER TABLE tasks ADD COLUMN start_date TEXT");
  }
  return db;
}

export function listTasks(db) {
  return db.prepare("SELECT * FROM tasks ORDER BY created_at DESC, id DESC").all();
}

export function addTask(db, title, start_date = null) {
  const created_at = new Date().toISOString();
  const { lastInsertRowid } = db
    .prepare("INSERT INTO tasks (title, done, created_at, start_date) VALUES (?, 0, ?, ?)")
    .run(title, created_at, start_date ?? null);
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(lastInsertRowid);
}

export function updateTask(db, id, fields) {
  const { title, done } = fields;
  const current = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!current) return null;
  const start_date = "start_date" in fields ? (fields.start_date ?? null) : current.start_date;
  db.prepare("UPDATE tasks SET title = ?, done = ?, start_date = ? WHERE id = ?").run(
    title ?? current.title,
    done === undefined ? current.done : done ? 1 : 0,
    start_date,
    id,
  );
  return db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
}

export function deleteTask(db, id) {
  return db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
}
