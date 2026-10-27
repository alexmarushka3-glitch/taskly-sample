import express from "express";
import { fileURLToPath } from "node:url";
import { addTask, deleteTask, getTasksByIds, listTasks, updateTask } from "./db.js";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

/** Placeholder provider until the real AI search provider is specified. */
export const stubAiProvider = {
  async search(title) {
    return `No AI provider configured yet (searched: ${title})`;
  },
};

/** Build the Express app around a database, so tests can use an in-memory one. */
export function createApp(db, aiProvider = stubAiProvider) {
  const app = express();
  app.use(express.json({ limit: "10kb" }));
  app.use(express.static(publicDir));

  app.get("/api/tasks", (req, res) => res.json(listTasks(db)));

  app.post("/api/tasks", (req, res) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) return res.status(400).json({ error: "title is required" });
    res.status(201).json(addTask(db, title));
  });

  app.post("/api/tasks/search-ai", async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids must be a non-empty array" });
    }
    const numericIds = [...new Set(ids.map(Number))].filter(Number.isInteger);
    const byId = new Map(getTasksByIds(db, numericIds).map((t) => [t.id, t]));
    try {
      const results = await Promise.all(
        ids.map(async (raw) => {
          const id = Number(raw);
          const task = byId.get(id);
          if (!task) return { id: Number.isFinite(id) ? id : raw, error: "not found" };
          return { id: task.id, title: task.title, result: await aiProvider.search(task.title) };
        }),
      );
      res.json({ results });
    } catch (err) {
      res.status(502).json({ error: err?.message || "AI provider failed" });
    }
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
