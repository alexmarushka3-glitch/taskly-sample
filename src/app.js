import express from "express";
import { fileURLToPath } from "node:url";
import { addTask, deleteTask, listTasks, updateTask } from "./db.js";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

function isValidDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Build the Express app around a database, so tests can use an in-memory one. */
export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(publicDir));

  app.get("/api/tasks", (req, res) => res.json(listTasks(db)));

  app.post("/api/tasks", (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) return res.status(400).json({ error: "title is required" });
    const dueDate = req.body?.dueDate ?? null;
    if (dueDate !== null && !isValidDate(dueDate)) {
      return res.status(400).json({ error: "dueDate must be a valid YYYY-MM-DD date" });
    }
    res.status(201).json(addTask(db, title, dueDate));
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const body = req.body ?? {};
    if (body.dueDate !== undefined && body.dueDate !== null && !isValidDate(body.dueDate)) {
      return res.status(400).json({ error: "dueDate must be a valid YYYY-MM-DD date" });
    }
    const task = updateTask(db, Number(req.params.id), body);
    if (!task) return res.status(404).json({ error: "not found" });
    res.json(task);
  });

  app.delete("/api/tasks/:id", (req, res) => {
    if (!deleteTask(db, Number(req.params.id))) return res.status(404).json({ error: "not found" });
    res.status(204).end();
  });

  return app;
}
