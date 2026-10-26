const list = document.querySelector("#task-list");
const empty = document.querySelector("#empty");
const form = document.querySelector("#add-form");
const input = document.querySelector("#new-title");
const dueInput = document.querySelector("#new-due");
const errorBox = document.querySelector("#error");

function showError(message) {
  errorBox.textContent = message ?? "";
  errorBox.hidden = !message;
}

async function api(path, options) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Request failed (${res.status})`);
  return res.status === 204 ? null : res.json();
}

function render(tasks) {
  list.replaceChildren(
    ...tasks.map((task) => {
      const li = document.createElement("li");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = Boolean(task.done);
      box.setAttribute("aria-label", `Done: ${task.title}`);
      box.addEventListener("change", async () => {
        try {
          await api(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ done: box.checked }) });
          showError("");
          await refresh();
        } catch (err) {
          showError(err.message);
        }
      });
      const text = document.createElement("span");
      text.className = "title";
      text.textContent = task.title;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        try {
          await api(`/api/tasks/${task.id}`, { method: "DELETE" });
          showError("");
          await refresh();
        } catch (err) {
          showError(err.message);
        }
      });
      li.append(box, text);
      if (task.due_date != null) {
        const due = document.createElement("span");
        due.className = "due";
        due.textContent = `Due ${task.due_date}`;
        li.append(due);
      }
      li.append(remove);
      return li;
    }),
  );
  empty.hidden = tasks.length > 0;
}

async function refresh() {
  try {
    render(await api("/api/tasks"));
  } catch (err) {
    showError(err.message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({ title: input.value, due_date: dueInput.value || null }),
    });
    input.value = "";
    dueInput.value = "";
    showError("");
    await refresh();
  } catch (err) {
    showError(err.message);
  }
});

refresh();
