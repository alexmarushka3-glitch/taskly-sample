import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  due_date TEXT
);
`;

/** Open the task database. Pass ":memory:" for a throwaway one (tests do). */
export function openDb(path = ":memory:") {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  const cols = db.prepare("PRAGMA table_info(tasks)").all();
  if (!cols.some((c) => c.name === "due_date")) {
    db.exec("ALTER TABLE tasks ADD COLUMN due_date TEXT");
  }
  return db;
}

function toTask(row) {
  if (!row) return row;
  const { due_date, ...rest } = row;
  return { ...rest, dueDate: due_date ?? null };
}

export function listTasks(db) {
  return db.prepare("SELECT * FROM tasks ORDER BY created_at DESC, id DESC").all().map(toTask);
}

export function addTask(db, title, dueDate = null) {
  const created_at = new Date().toISOString();
  const { lastInsertRowid } = db
    .prepare("INSERT INTO tasks (title, done, created_at, due_date) VALUES (?, 0, ?, ?)")
    .run(title, created_at, dueDate ?? null);
  return toTask(db.prepare("SELECT * FROM tasks WHERE id = ?").get(lastInsertRowid));
}

export function updateTask(db, id, { title, done, dueDate }) {
  const current = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
  if (!current) return null;
  db.prepare("UPDATE tasks SET title = ?, done = ?, due_date = ? WHERE id = ?").run(
    title ?? current.title,
    done === undefined ? current.done : done ? 1 : 0,
    dueDate === undefined ? current.due_date : dueDate,
    id,
  );
  return toTask(db.prepare("SELECT * FROM tasks WHERE id = ?").get(id));
}

export function deleteTask(db, id) {
  return db.prepare("DELETE FROM tasks WHERE id = ?").run(id).changes > 0;
}
