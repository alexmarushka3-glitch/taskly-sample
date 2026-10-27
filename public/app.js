const list = document.querySelector("#task-list");
const empty = document.querySelector("#empty");
const form = document.querySelector("#add-form");
const input = document.querySelector("#new-title");
const bulkButton = document.querySelector("#bulk-skill");
const status = document.querySelector("#status");

const selected = new Set();

async function api(path, options) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function updateBulkButton() {
  bulkButton.disabled = selected.size === 0;
}

function render(tasks) {
  const existing = new Set(tasks.map((t) => t.id));
  for (const id of [...selected]) if (!existing.has(id)) selected.delete(id);
  list.replaceChildren(
    ...tasks.map((task) => {
      const li = document.createElement("li");
      const pick = document.createElement("input");
      pick.type = "checkbox";
      pick.className = "select";
      pick.checked = selected.has(task.id);
      pick.setAttribute("aria-label", `Select: ${task.title}`);
      pick.addEventListener("change", () => {
        if (pick.checked) selected.add(task.id);
        else selected.delete(task.id);
        updateBulkButton();
      });
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "done";
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
      li.append(pick, box, text, remove);
      return li;
    }),
  );
  empty.hidden = tasks.length > 0;
  updateBulkButton();
}

async function refresh() {
  render(await api("/api/tasks"));
}

bulkButton.addEventListener("click", async () => {
  const ids = [...selected];
  if (ids.length === 0) return;
  bulkButton.disabled = true;
  try {
    const result = await api("/api/tasks/bulk-skill", { method: "POST", body: JSON.stringify({ ids }) });
    selected.clear();
    await refresh();
    showStatus(`${result.processed} tasks processed`);
  } catch (err) {
    showStatus(err.message, true);
    updateBulkButton();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: input.value }) });
  input.value = "";
  await refresh();
});

refresh().catch((err) => showStatus(err.message, true));
