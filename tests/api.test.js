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

  it("stores start_date on create, or null without it", async () => {
    const a = await (await json("/api/tasks", "POST", { title: "dated", start_date: "2024-02-29" })).json();
    const b = await (await json("/api/tasks", "POST", { title: "undated" })).json();
    assert.equal(a.start_date, "2024-02-29");
    assert.equal(b.start_date, null);
    const all = await (await fetch(`${base}/api/tasks`)).json();
    assert.equal(all.find((t) => t.id === a.id).start_date, "2024-02-29");
    assert.equal(all.find((t) => t.id === b.id).start_date, null);
    await json(`/api/tasks/${a.id}`, "DELETE");
    await json(`/api/tasks/${b.id}`, "DELETE");
  });

  it("sets, changes and clears start_date via PATCH", async () => {
    const t = await (await json("/api/tasks", "POST", { title: "p" })).json();
    let r = await (await json(`/api/tasks/${t.id}`, "PATCH", { start_date: "2025-01-02" })).json();
    assert.equal(r.start_date, "2025-01-02");
    r = await (await json(`/api/tasks/${t.id}`, "PATCH", { start_date: "2025-03-04" })).json();
    assert.equal(r.start_date, "2025-03-04");
    r = await (await json(`/api/tasks/${t.id}`, "PATCH", { title: "p2", done: true })).json();
    assert.equal(r.start_date, "2025-03-04");
    assert.equal(r.title, "p2");
    assert.equal(r.done, 1);
    r = await (await json(`/api/tasks/${t.id}`, "PATCH", { start_date: null })).json();
    assert.equal(r.start_date, null);
    await json(`/api/tasks/${t.id}`, "DELETE");
  });

  it("rejects invalid start_date without writing", async () => {
    const t = await (await json("/api/tasks", "POST", { title: "keep", start_date: "2025-05-06" })).json();
    for (const bad of ["banana", "2024-13-45", "2023-02-29", 20240101]) {
      assert.equal((await json("/api/tasks", "POST", { title: "bad", start_date: bad })).status, 400);
      assert.equal((await json(`/api/tasks/${t.id}`, "PATCH", { title: "changed", start_date: bad })).status, 400);
    }
    const all = await (await fetch(`${base}/api/tasks`)).json();
    assert.equal(all.length, 1);
    assert.equal(all[0].title, "keep");
    assert.equal(all[0].start_date, "2025-05-06");
    await json(`/api/tasks/${t.id}`, "DELETE");
  });
});

describe("start_date migration", () => {
  it("adds the column to an old database and keeps old rows", () => {
    const path = `/tmp/taskly-migrate-${process.pid}-${Date.now()}.db`;
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
      INSERT INTO tasks (title, done, created_at) VALUES ('old', 0, '2020-01-01T00:00:00.000Z');`);
    old.close();
    const db = openDb(path);
    const rows = db.prepare("SELECT * FROM tasks").all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, "old");
    assert.equal(rows[0].start_date, null);
    db.close();
    openDb(path).close();
  });
});
