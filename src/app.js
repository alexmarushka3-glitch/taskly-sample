import express from "express";
import { fileURLToPath } from "node:url";
import { addTask, deleteTask, getTasksByIds, listTasks, updateTask } from "./db.js";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

/** Build the Express app around a database, so tests can use an in-memory one. */
export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(publicDir));

  app.get("/api/tasks", (req, res) => res.json(listTasks(db)));

  app.post("/api/tasks", (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) return res.status(400).json({ error: "title is required" });
    res.status(201).json(addTask(db, title));
  });

  app.post("/api/tasks/bulk-skill", (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((n) => Number.isInteger(n))) {
      return res.status(400).json({ error: "ids must be a non-empty array of integers" });
    }
    const unique = [...new Set(ids)];
    const found = new Set(getTasksByIds(db, unique).map((t) => t.id));
    const missing = unique.filter((id) => !found.has(id));
    if (missing.length) return res.status(404).json({ error: `tasks not found: ${missing.join(", ")}` });
    res.json({ processed: ids.length, results: ids.map((id) => ({ id, status: "ok" })) });
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const task = updateTask(db, Number(req.params.id), req.body ?? {});
    if (!task) return res.status(404).json({ error: "not found" });
    res.json(task);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    if (!deleteTask(db, Number(req.params.id))) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  });

  return app;
}
