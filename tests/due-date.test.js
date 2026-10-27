import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";
import { addTask, listTasks, openDb } from "../src/db.js";

describe("due dates", () => {
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

  it("POST with and without dueDate, GET returns both", async () => {
    const a = await (await json("/api/tasks", "POST", { title: "a", dueDate: "2024-05-06" })).json();
    const b = await (await json("/api/tasks", "POST", { title: "b" })).json();
    assert.equal(a.dueDate, "2024-05-06");
    assert.equal(b.dueDate, null);
    const all = await (await fetch(`${base}/api/tasks`)).json();
    assert.equal(all.find((t) => t.id === a.id).dueDate, "2024-05-06");
    assert.equal(all.find((t) => t.id === b.id).dueDate, null);
  });

  it("PATCH sets, changes, clears, and keeps other fields", async () => {
    const t = await (await json("/api/tasks", "POST", { title: "p" })).json();
    let r = await (await json(`/api/tasks/${t.id}`, "PATCH", { dueDate: "2025-01-02" })).json();
    assert.equal(r.dueDate, "2025-01-02");
    assert.equal(r.title, "p");
    r = await (await json(`/api/tasks/${t.id}`, "PATCH", { done: true })).json();
    assert.equal(r.dueDate, "2025-01-02");
    assert.equal(r.done, 1);
    r = await (await json(`/api/tasks/${t.id}`, "PATCH", { dueDate: "2025-03-04" })).json();
    assert.equal(r.dueDate, "2025-03-04");
    assert.equal(r.done, 1);
    r = await (await json(`/api/tasks/${t.id}`, "PATCH", { dueDate: null })).json();
    assert.equal(r.dueDate, null);
    assert.equal(r.title, "p");
    assert.equal(r.done, 1);
  });

  it("rejects invalid dates and leaves the stored value unchanged", async () => {
    for (const bad of ["not-a-date", "2024-13-45", "2024-02-30"]) {
      assert.equal((await json("/api/tasks", "POST", { title: "x", dueDate: bad })).status, 400);
      const t = await (await json("/api/tasks", "POST", { title: "k", dueDate: "2024-01-01" })).json();
      assert.equal((await json(`/api/tasks/${t.id}`, "PATCH", { dueDate: bad })).status, 400);
      const all = await (await fetch(`${base}/api/tasks`)).json();
      assert.equal(all.find((x) => x.id === t.id).dueDate, "2024-01-01");
    }
  });
});

describe("migration", () => {
  it("adds due_date to an old database", () => {
    const path = `/tmp/taskly-mig-${process.pid}-${Date.now()}.db`;
    const old = new DatabaseSync(path);
    old.exec("CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)");
    old.prepare("INSERT INTO tasks (title, done, created_at) VALUES ('old', 0, '2020-01-01T00:00:00Z')").run();
    old.close();
    const db = openDb(path);
    assert.equal(listTasks(db)[0].dueDate, null);
    assert.equal(addTask(db, "new", "2024-05-06").dueDate, "2024-05-06");
    db.close();
  });
});
