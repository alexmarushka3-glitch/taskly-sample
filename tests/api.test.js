import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db.js";

describe("tasks API", () => {
  let server;
  let base;

  before(async () => {
    server = createApp(openDb()).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });
  after(() => server.close());

  const json = (path, method, body) =>
    fetch(base + path, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });

  it("starts empty", async () => {
    const res = await fetch(`${base}/api/tasks`);
    assert.deepEqual(await res.json(), []);
  });

  it("creates, lists, updates and deletes a task", async () => {
    const created = await json("/api/tasks", "POST", { title: "  buy milk " });
    assert.equal(created.status, 201);
    const task = await created.json();
    assert.equal(task.title, "buy milk");
    assert.equal(task.done, 0);
    assert.equal(task.due_date, null);

    const done = await (await json(`/api/tasks/${task.id}`, "PATCH", { done: true })).json();
    assert.equal(done.done, 1);
    assert.equal(done.title, "buy milk");

    const all = await (await fetch(`${base}/api/tasks`)).json();
    assert.equal(all.length, 1);

    assert.equal((await json(`/api/tasks/${task.id}`, "DELETE")).status, 204);
    assert.deepEqual(await (await fetch(`${base}/api/tasks`)).json(), []);
  });

  it("rejects an empty title", async () => {
    const res = await json("/api/tasks", "POST", { title: "   " });
    assert.equal(res.status, 400);
  });

  it("returns 404 for a task that does not exist", async () => {
    assert.equal((await json("/api/tasks/999", "PATCH", { done: true })).status, 404);
    assert.equal((await json("/api/tasks/999", "DELETE")).status, 404);
  });

  it("creates a task with a valid due date and lists it", async () => {
    const res = await json("/api/tasks", "POST", { title: "dated", due_date: "2024-05-06" });
    assert.equal(res.status, 201);
    const task = await res.json();
    assert.equal(task.due_date, "2024-05-06");
    const all = await (await fetch(`${base}/api/tasks`)).json();
    assert.equal(all.find((t) => t.id === task.id).due_date, "2024-05-06");
  });

  it("rejects an invalid due date on POST", async () => {
    assert.equal((await json("/api/tasks", "POST", { title: "x", due_date: "nope" })).status, 400);
    assert.equal((await json("/api/tasks", "POST", { title: "x", due_date: "2024-13-45" })).status, 400);
  });

  it("sets, changes, clears and preserves due_date on PATCH", async () => {
    const task = await (await json("/api/tasks", "POST", { title: "patch me" })).json();
    const url = `/api/tasks/${task.id}`;

    let t = await (await json(url, "PATCH", { due_date: "2024-01-02" })).json();
    assert.equal(t.due_date, "2024-01-02");
    t = await (await json(url, "PATCH", { due_date: "2024-02-03" })).json();
    assert.equal(t.due_date, "2024-02-03");

    t = await (await json(url, "PATCH", { title: "renamed" })).json();
    assert.equal(t.due_date, "2024-02-03");
    t = await (await json(url, "PATCH", { done: true })).json();
    assert.equal(t.due_date, "2024-02-03");

    t = await (await json(url, "PATCH", { due_date: null })).json();
    assert.equal(t.due_date, null);
  });

  it("rejects invalid due_date on PATCH and leaves the task unchanged", async () => {
    const task = await (await json("/api/tasks", "POST", { title: "keep", due_date: "2024-03-04" })).json();
    const url = `/api/tasks/${task.id}`;
    for (const bad of ["not-a-date", "2024-13-45"]) {
      assert.equal((await json(url, "PATCH", { due_date: bad, title: "changed" })).status, 400);
    }
    const all = await (await fetch(`${base}/api/tasks`)).json();
    const after = all.find((t) => t.id === task.id);
    assert.equal(after.due_date, "2024-03-04");
    assert.equal(after.title, "keep");
  });
});

describe("due_date migration", () => {
  it("adds due_date to an old database without losing data", () => {
    const path = `/tmp/taskly-migrate-${process.pid}-${Date.now()}.db`;
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE tasks (
      id INTEGER PRIMARY KEY, title TEXT NOT NULL,
      done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      INSERT INTO tasks (title, done, created_at) VALUES ('old', 1, '2020-01-01T00:00:00.000Z');`);
    old.close();

    const db = openDb(path);
    const rows = db.prepare("SELECT * FROM tasks").all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "old");
    assert.equal(rows[0].done, 1);
    assert.equal(rows[0].due_date, null);
    db.close();
    // reopening is idempotent
    openDb(path).close();
  });
});
