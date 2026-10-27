const list = document.querySelector("#task-list");
const empty = document.querySelector("#empty");
const form = document.querySelector("#add-form");
const input = document.querySelector("#new-title");
const searchBtn = document.querySelector("#search-ai");
const searchError = document.querySelector("#search-error");
const results = document.querySelector("#results");
const resultsList = document.querySelector("#results-list");

const selected = new Set();
let searching = false;
let titles = new Map();

async function api(path, options) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

function updateButton() {
  searchBtn.disabled = searching || selected.size === 0;
  searchBtn.textContent = searching ? "Searching..." : "Search AI";
}

function render(tasks) {
  list.replaceChildren(
    ...tasks.map((task) => {
      const li = document.createElement("li");
      const sel = document.createElement("input");
      sel.type = "checkbox";
      sel.className = "select";
      sel.checked = selected.has(task.id);
      sel.setAttribute("aria-label", `Select: ${task.title}`);
      sel.addEventListener("change", () => {
        if (sel.checked) selected.add(task.id);
        else selected.delete(task.id);
        updateButton();
      });
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = Boolean(task.done);
      box.setAttribute("aria-label", `Done: ${task.title}`);
      box.addEventListener("change", async () => {
        await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: box.checked }) });
        await refresh();
      });
      const text = document.createElement("span");
      text.textContent = task.title;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        await api(`/api/tasks/${task.id}`, { method: "DELETE" });
        await refresh();
      });
      li.append(sel, box, text, remove);
      return li;
    }),
  );
  empty.hidden = tasks.length > 0;
}

async function refresh() {
  const tasks = await api("/api/tasks");
  const ids = new Set(tasks.map((t) => t.id));
  for (const id of [...selected]) if (!ids.has(id)) selected.delete(id);
  titles = new Map(tasks.map((t) => [t.id, t.title]));
  render(tasks);
  updateButton();
}

function showResults(items) {
  resultsList.replaceChildren(
    ...items.map((item) => {
      const li = document.createElement("li");
      const title = document.createElement("strong");
      title.textContent = item.title ?? titles.get(item.id) ?? `Task ${item.id}`;
      const body = document.createElement("span");
      body.textContent = item.error ? `Error: ${item.error}` : item.result;
      li.append(title, body);
      return li;
    }),
  );
  results.hidden = false;
}

searchBtn.addEventListener("click", async () => {
  if (searching || selected.size === 0) return;
  searching = true;
  searchError.hidden = true;
  updateButton();
  try {
    const data = await api("/api/tasks/search-ai", {
      method: "POST",
      body: JSON.stringify({ ids: [...selected] }),
    });
    showResults(data.results);
  } catch (err) {
    searchError.textContent = err.message;
    searchError.hidden = false;
  } finally {
    searching = false;
    updateButton();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: input.value }) });
  input.value = "";
  await refresh();
});

refresh();
