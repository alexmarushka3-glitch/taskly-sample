const list = document.querySelector("#task-list");
const empty = document.querySelector("#empty");
const form = document.querySelector("#add-form");
const input = document.querySelector("#new-title");
const nicknameInput = document.querySelector("#new-nickname");
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
          await refresh();
        } catch (err) {
          showError(err.message);
        }
      });
      const text = document.createElement("span");
      text.textContent = task.title;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete";
      remove.addEventListener("click", async () => {
        try {
          await api(`/api/tasks/${task.id}`, { method: "DELETE" });
          await refresh();
        } catch (err) {
          showError(err.message);
        }
      });
      li.append(box, text);
      if (typeof task.nickname === "string" && task.nickname.trim() !== "") {
        const nick = document.createElement("span");
        nick.className = "nickname";
        nick.textContent = task.nickname;
        li.append(nick);
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
    showError("");
  } catch (err) {
    showError(err.message);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = { title: input.value };
  const nickname = nicknameInput.value.trim();
  if (nickname) body.nickname = nickname;
  try {
    await api("/api/tasks", { method: "POST", body: JSON.stringify(body) });
    input.value = "";
    nicknameInput.value = "";
    await refresh();
  } catch (err) {
    showError(err.message);
  }
});

refresh();
