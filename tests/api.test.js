import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
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

  it("exports selected tasks as a text file without changing them", async () => {
    const a = await (await json("/api/tasks", "POST", { title: "alpha" })).json();
    const b = await (await json("/api/tasks", "POST", { title: "beta" })).json();
    await json(`/api/tasks/${b.id}`, "PATCH", { done: true });
    const before = await (await fetch(`${base}/api/tasks`)).json();

    const res = await json("/api/tasks/export", "POST", { ids: [b.id, a.id] });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-disposition"), /attachment; filename="tasks.txt"/);
    assert.equal(await res.text(), "[x] beta\n[ ] alpha\n");

    assert.deepEqual(await (await fetch(`${base}/api/tasks`)).json(), before);
  });

  it("export rejects missing or empty ids with 400", async () => {
    assert.equal((await json("/api/tasks/export", "POST", {})).status, 400);
    assert.equal((await json("/api/tasks/export", "POST", { ids: [] })).status, 400);
    assert.equal((await json("/api/tasks/export", "POST", { ids: "1" })).status, 400);
  });

  it("export returns 404 with no file for an unknown id", async () => {
    const t = await (await json("/api/tasks", "POST", { title: "gamma" })).json();
    const res = await json("/api/tasks/export", "POST", { ids: [t.id, 99999] });
    assert.equal(res.status, 404);
    assert.equal(res.headers.get("content-disposition"), null);
    assert.ok((await res.json()).error);
  });
});
