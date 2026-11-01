const list = document.querySelector("#task-list");
const empty = document.querySelector("#empty");
const form = document.querySelector("#add-form");
const input = document.querySelector("#new-title");
const searchBtn = document.querySelector("#search-selected");
const status = document.querySelector("#copy-status");

const selected = new Set();
let currentTasks = [];

async function api(path, options) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

function updateSearchButton() {
  searchBtn.disabled = selected.size === 0;
}

function render(tasks) {
  currentTasks = tasks;
  const ids = new Set(tasks.map((t) => t.id));
  for (const id of [...selected]) if (!ids.has(id)) selected.delete(id);
  list.replaceChildren(
    ...tasks.map((task) => {
      const li = document.createElement("li");
      const pick = document.createElement("input");
      pick.type = "checkbox";
      pick.className = "select-task";
      pick.checked = selected.has(task.id);
      pick.setAttribute("aria-label", `Select: ${task.title}`);
      pick.addEventListener("change", () => {
        if (pick.checked) selected.add(task.id);
        else selected.delete(task.id);
        updateSearchButton();
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
      li.append(pick, box, text, remove);
      return li;
    }),
  );
  empty.hidden = tasks.length > 0;
  updateSearchButton();
}

async function refresh() {
  render(await api("/api/tasks"));
}

searchBtn.addEventListener("click", async () => {
  const titles = currentTasks.filter((t) => selected.has(t.id)).map((t) => t.title);
  if (titles.length === 0) return;
  const text = titles.join(" ");
  window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, "_blank", "noopener");
  status.textContent = "";
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = "Copied";
  } catch {
    status.textContent = "Copy failed";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/tasks", { method: "POST", body: JSON.stringify({ title: input.value }) });
  input.value = "";
  await refresh();
});

refresh();
