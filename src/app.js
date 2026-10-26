import express from "express";
import { fileURLToPath } from "node:url";
import { addTask, deleteTask, listTasks, updateTask } from "./db.js";

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
    const raw = req.body?.nickname;
    if (raw !== undefined && raw !== null && typeof raw !== "string") {
      return res.status(400).json({ error: "nickname must be a string" });
    }
    const nickname = typeof raw === "string" && raw.trim() ? raw.trim() : null;
    res.status(201).json(addTask(db, title, nickname));
  });

  app.patch("/api/tasks/:id", (req, res) => {
    const body = { ...(req.body ?? {}) };
    if (body.nickname !== undefined && body.nickname !== null) {
      if (typeof body.nickname !== "string") {
        return res.status(400).json({ error: "nickname must be a string" });
      }
      body.nickname = body.nickname.trim() || null;
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
