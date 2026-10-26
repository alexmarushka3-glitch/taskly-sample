import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "../src/app.js";
import { listTasks, openDb } from "../src/db.js";

describe("start_date API", () => {
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

  it("POST accepts valid, omitted and empty dates", async () => {
    const a = await json("/api/tasks", "POST", { title: "a", start_date: "2024-06-01" });
    assert.equal(a.status, 201);
    assert.equal((await a.json()).start_date, "2024-06-01");
    const b = await json("/api/tasks", "POST", { title: "b" });
    assert.equal((await b.json()).start_date, null);
    const c = await json("/api/tasks", "POST", { title: "c", start_date: "" });
    assert.equal(c.status, 201);
    assert.equal((await c.json()).start_date, null);
  });

  it("POST rejects invalid dates", async () => {
    for (const d of ["2024-13-45", "tomorrow", "2024-02-30"]) {
      assert.equal((await json("/api/tasks", "POST", { title: "x", start_date: d })).status, 400);
    }
  });

  it("PATCH sets, changes, clears and preserves start_date", async () => {
    const t = await (await json("/api/tasks", "POST", { title: "p" })).json();
    const set = await (await json(`/api/tasks/${t.id}`, "PATCH", { start_date: "2024-01-02" })).json();
    assert.equal(set.start_date, "2024-01-02");
    assert.equal(set.title, "p");
    assert.equal(set.done, 0);
    const changed = await (await json(`/api/tasks/${t.id}`, "PATCH", { start_date: "2024-03-04" })).json();
    assert.equal(changed.start_date, "2024-03-04");
    const kept = await (await json(`/api/tasks/${t.id}`, "PATCH", { done: true })).json();
    assert.equal(kept.start_date, "2024-03-04");
    assert.equal(kept.done, 1);
    const cleared = await (await json(`/api/tasks/${t.id}`, "PATCH", { start_date: null })).json();
    assert.equal(cleared.start_date, null);
    assert.equal(cleared.title, "p");
    assert.equal(cleared.done, 1);
    assert.equal((await json(`/api/tasks/${t.id}`, "PATCH", { start_date: "nope" })).status, 400);
  });

  it("GET returns start_date on all tasks", async () => {
    const all = await (await fetch(`${base}/api/tasks`)).json();
    assert.ok(all.length > 0);
    for (const t of all) assert.ok("start_date" in t);
  });
});

describe("start_date migration", () => {
  it("upgrades an old database", () => {
    const path = `/tmp/taskly-old-${process.pid}-${Date.now()}.db`;
    const old = new DatabaseSync(path);
    old.exec("CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)");
    old.prepare("INSERT INTO tasks (title, done, created_at) VALUES ('old', 0, '2020-01-01')").run();
    old.close();

    const db = openDb(path);
    assert.equal(listTasks(db)[0].start_date, null);
    const again = openDb(path);
    assert.equal(listTasks(again).length, 1);
    again.close();
    db.prepare("UPDATE tasks SET start_date = ? WHERE id = 1").run("2024-06-01");
    assert.equal(listTasks(db)[0].start_date, "2024-06-01");
    db.close();
  });
});
