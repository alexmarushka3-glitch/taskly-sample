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
  const list = async () => (await fetch(`${base}/api/tasks`)).json();

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

  it("POST handles due_date valid, omitted and null", async () => {
    const a = await (await json("/api/tasks", "POST", { title: "a", due_date: "2024-05-06" })).json();
    assert.equal(a.due_date, "2024-05-06");
    const b = await (await json("/api/tasks", "POST", { title: "b" })).json();
    assert.equal(b.due_date, null);
    const c = await (await json("/api/tasks", "POST", { title: "c", due_date: null })).json();
    assert.equal(c.due_date, null);
    for (const t of [a, b, c]) await json(`/api/tasks/${t.id}`, "DELETE");
  });

  it("POST rejects invalid due_date without creating a task", async () => {
    const before = (await list()).length;
    for (const due_date of ["2024-13-45", "tomorrow"]) {
      assert.equal((await json("/api/tasks", "POST", { title: "x", due_date })).status, 400);
    }
    assert.equal((await list()).length, before);
  });

  it("PATCH sets, changes and clears due_date", async () => {
    const t = await (await json("/api/tasks", "POST", { title: "keep" })).json();
    await json(`/api/tasks/${t.id}`, "PATCH", { done: true });
    for (const d of ["2025-01-02", "2025-03-04", null]) {
      const res = await json(`/api/tasks/${t.id}`, "PATCH", { due_date: d });
      assert.equal(res.status, 200);
      const got = (await list()).find((x) => x.id === t.id);
      assert.equal(got.due_date, d);
      assert.equal(got.title, "keep");
      assert.equal(got.done, 1);
    }
    const bad = await json(`/api/tasks/${t.id}`, "PATCH", { due_date: "2025-02-30" });
    assert.equal(bad.status, 400);
    await json(`/api/tasks/${t.id}`, "PATCH", { due_date: "2025-01-02" });
    assert.equal((await json(`/api/tasks/${t.id}`, "PATCH", { due_date: "nope" })).status, 400);
    const got = (await list()).find((x) => x.id === t.id);
    assert.equal(got.due_date, "2025-01-02");
    assert.equal(got.title, "keep");
  });
});

describe("migration", () => {
  it("adds due_date to an old database without losing rows", async () => {
    const path = `${process.env.TMPDIR || "/tmp"}/taskly-mig-${process.pid}-${Date.now()}.db`;
    const old = new DatabaseSync(path);
    old.exec(
      "CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)",
    );
    old.prepare("INSERT INTO tasks (title, done, created_at) VALUES (?, 1, ?)").run("old", "2020-01-01T00:00:00.000Z");
    old.close();

    const server = createApp(openDb(path)).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    try {
      const rows = await (await fetch(`http://127.0.0.1:${server.address().port}/api/tasks`)).json();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, "old");
      assert.equal(rows[0].done, 1);
      assert.equal(rows[0].due_date, null);
    } finally {
      server.close();
    }
  });
});
