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

  describe("bulk-skill", () => {
    it("returns a result per submitted task", async () => {
      const a = await (await json("/api/tasks", "POST", { title: "a" })).json();
      const b = await (await json("/api/tasks", "POST", { title: "b" })).json();
      const res = await json("/api/tasks/bulk-skill", "POST", { ids: [a.id, b.id] });
      assert.equal(res.status, 200);
      assert.deepEqual(await res.json(), {
        processed: 2,
        results: [
          { id: a.id, status: "ok" },
          { id: b.id, status: "ok" },
        ],
      });
    });

    it("rejects an empty list", async () => {
      assert.equal((await json("/api/tasks/bulk-skill", "POST", { ids: [] })).status, 400);
    });

    it("rejects a non-array or non-integer ids", async () => {
      assert.equal((await json("/api/tasks/bulk-skill", "POST", { ids: "1" })).status, 400);
      assert.equal((await json("/api/tasks/bulk-skill", "POST", {})).status, 400);
      assert.equal((await json("/api/tasks/bulk-skill", "POST", { ids: [1, "x"] })).status, 400);
    });

    it("returns 404 naming unknown ids and applies nothing", async () => {
      const t = await (await json("/api/tasks", "POST", { title: "c" })).json();
      const res = await json("/api/tasks/bulk-skill", "POST", { ids: [t.id, 9999] });
      assert.equal(res.status, 404);
      const body = await res.json();
      assert.match(body.error, /9999/);
      assert.equal(body.results, undefined);
      assert.equal(body.processed, undefined);
    });
  });
});
