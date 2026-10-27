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
});

describe("POST /api/tasks/search-ai", () => {
  const servers = [];
  after(() => servers.forEach((s) => s.close()));

  async function start(provider) {
    const db = openDb();
    const server = createApp(db, provider).listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    servers.push(server);
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (path, body) =>
      fetch(base + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const add = async (title) => (await post("/api/tasks", { title })).json();
    return { post, add };
  }

  const okProvider = { search: async (title) => `result for ${title}` };

  it("returns one result per id", async () => {
    const { post, add } = await start(okProvider);
    const a = await add("alpha");
    const b = await add("beta");
    const res = await post("/api/tasks/search-ai", { ids: [a.id, b.id] });
    assert.equal(res.status, 200);
    const { results } = await res.json();
    assert.deepEqual(results, [
      { id: a.id, title: "alpha", result: "result for alpha" },
      { id: b.id, title: "beta", result: "result for beta" },
    ]);
  });

  it("returns 400 for missing, non-array or empty ids", async () => {
    const { post } = await start(okProvider);
    assert.equal((await post("/api/tasks/search-ai", {})).status, 400);
    assert.equal((await post("/api/tasks/search-ai", { ids: "1" })).status, 400);
    assert.equal((await post("/api/tasks/search-ai", { ids: [] })).status, 400);
  });

  it("reports unknown ids as not found without failing the batch", async () => {
    const { post, add } = await start(okProvider);
    const a = await add("alpha");
    const res = await post("/api/tasks/search-ai", { ids: [a.id, 9999] });
    assert.equal(res.status, 200);
    const { results } = await res.json();
    assert.equal(results[0].result, "result for alpha");
    assert.deepEqual(results[1], { id: 9999, error: "not found" });
  });

  it("returns 502 when the provider fails", async () => {
    const { post, add } = await start({
      search: async () => {
        throw new Error("provider down");
      },
    });
    const a = await add("alpha");
    const res = await post("/api/tasks/search-ai", { ids: [a.id] });
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: "provider down" });
  });
});
