const list = document.querySelector("#task-list");
const empty = document.querySelector("#empty");
const form = document.querySelector("#add-form");
const input = document.querySelector("#new-title");
const countEl = document.querySelector("#selected-count");
const exportBtn = document.querySelector("#export-btn");
const errorEl = document.querySelector("#error");

const selected = new Set();

async function api(path, options) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

function showError(message) {
  errorEl.textContent = message ?? "";
  errorEl.hidden = !message;
}

function updateToolbar() {
  countEl.textContent = `${selected.size} selected`;
  exportBtn.disabled = selected.size === 0;
}

function render(tasks) {
  const ids = new Set(tasks.map((t) => t.id));
  for (const id of [...selected]) if (!ids.has(id)) selected.delete(id);
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
        updateToolbar();
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
  updateToolbar();
}

async function refresh() {
  render(await api("/api/tasks"));
}

exportBtn.addEventListener("click", async () => {
  if (selected.size === 0) return;
  showError("");
  exportBtn.disabled = true;
  try {
    const res = await fetch("/api/tasks/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected] }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Export failed (${res.status})`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tasks.txt";
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    selected.clear();
    await refresh();
  } catch (err) {
    showError(err.message);
    updateToolbar();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: input.value }) });
  input.value = "";
  await refresh();
});

refresh().catch((err) => showError(err.message));
