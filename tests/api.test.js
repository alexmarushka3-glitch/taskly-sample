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

  it("creates with and without a nickname", async () => {
    const a = await (await json("/api/tasks", "POST", { title: "a", nickname: "  nick " })).json();
    assert.equal(a.nickname, "nick");
    const b = await (await json("/api/tasks", "POST", { title: "b" })).json();
    assert.equal(b.nickname, null);
    const c = await (await json("/api/tasks", "POST", { title: "c", nickname: "  " })).json();
    assert.equal(c.nickname, null);
  });

  it("patches nickname and leaves other fields alone", async () => {
    const t = await (await json("/api/tasks", "POST", { title: "p", nickname: "n1" })).json();
    const r1 = await (await json(`/api/tasks/${t.id}`, "PATCH", { nickname: "n2" })).json();
    assert.equal(r1.nickname, "n2");
    assert.equal(r1.title, "p");
    assert.equal(r1.done, 0);
    const r2 = await (await json(`/api/tasks/${t.id}`, "PATCH", { title: "p2" })).json();
    assert.equal(r2.nickname, "n2");
    assert.equal(r2.title, "p2");
    const r3 = await (await json(`/api/tasks/${t.id}`, "PATCH", { done: true })).json();
    assert.equal(r3.nickname, "n2");
    assert.equal(r3.done, 1);
  });

  it("rejects a non-string nickname", async () => {
    assert.equal((await json("/api/tasks", "POST", { title: "x", nickname: 5 })).status, 400);
    const t = await (await json("/api/tasks", "POST", { title: "y" })).json();
    assert.equal((await json(`/api/tasks/${t.id}`, "PATCH", { nickname: 5 })).status, 400);
  });
});

describe("legacy database migration", () => {
  it("adds the nickname column to an existing table", async () => {
    const path = `/tmp/taskly-legacy-${process.pid}-${Date.now()}.db`;
    const old = new DatabaseSync(path);
    old.exec("CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)");
    old.prepare("INSERT INTO tasks (title, done, created_at) VALUES ('old', 0, ?)").run(new Date().toISOString());
    old.close();

    const server = createApp(openDb(path)).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/tasks`);
      const all = await res.json();
      assert.equal(all.length, 1);
      assert.equal(all[0].nickname, null);
    } finally {
      server.close();
    }
  });
});
