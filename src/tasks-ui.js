import { icon } from "./icons.js";
import {
  TASKS_KEY,
  TASK_TITLE_LIMIT,
  emptyTasks,
  readTasks,
  writeTasks,
  addTask,
  setTaskCompleted,
  removeTask,
} from "./tasks.js";

export function mountTasks(container) {
  container.innerHTML = `
    <div class="tasks-heading">
      <div><p class="eyebrow">A PLAN FOR YOUR PROGRESS</p><h2 id="tasks-title">Your tasks</h2><p class="tasks-intro">Big ambitions. Small steps. A little space for both.</p></div>
      <span class="tasks-heading-icon" aria-hidden="true">${icon("checklist")}</span>
    </div>
    <form class="task-form" id="task-form">
      <div class="task-input-wrap"><label class="sr-only" for="task-title">Task title</label><input id="task-title" name="title" type="text" placeholder="What would you like to work on?" maxlength="${TASK_TITLE_LIMIT}" required autocomplete="off" /></div>
      <div class="task-term-wrap"><label class="sr-only" for="task-term">Task category</label><select id="task-term" name="term"><option value="short">Short-term</option><option value="long">Long-term</option></select></div>
      <button class="add-task-button" type="submit">${icon("plus")}<span>Add task</span></button>
    </form>
    <p class="task-error" role="alert" hidden></p>
    <div class="task-boards">
      <section class="task-board long-term" aria-labelledby="long-term-title"><div class="task-board-heading"><span class="task-board-icon">${icon("target")}</span><div><h3 id="long-term-title">Long-term</h3><p>The bigger picture</p></div><span class="task-count" id="long-task-count"></span></div><ul class="task-list" id="long-term-tasks"></ul><p class="task-empty" id="long-term-empty">A goal to grow into.<span>Add a long-term task to keep it in sight.</span></p></section>
      <section class="task-board short-term" aria-labelledby="short-term-title"><div class="task-board-heading"><span class="task-board-icon">${icon("checklist")}</span><div><h3 id="short-term-title">Short-term</h3><p>The next small step</p></div><span class="task-count" id="short-task-count"></span></div><ul class="task-list" id="short-term-tasks"></ul><p class="task-empty" id="short-term-empty">A little progress starts here.<span>Add something you can take on next.</span></p></section>
    </div>
    <p class="tasks-local-note">Your tasks are saved automatically in this browser.</p>
  `;
  const form = container.querySelector("form");
  const input = container.querySelector("#task-title");
  const term = container.querySelector("#task-term");
  const error = container.querySelector(".task-error");
  let state = emptyTasks();
  let healthy = true;
  let busy = false;

  function updateControls() {
    for (const control of container.querySelectorAll("input, select, button")) {
      control.disabled = !healthy || busy;
    }
  }

  function showError() {
    healthy = false;
    error.textContent =
      "Tasks could not be read or saved. Allow local storage and check available space, then refresh. Your saved tasks have not been replaced.";
    error.hidden = false;
    updateControls();
  }

  function taskFocus() {
    const focused = document.activeElement;
    const id = focused?.closest("[data-task-id]")?.dataset.taskId;
    return id
      ? { id, action: focused.matches("input") ? "input" : "button" }
      : null;
  }

  function render(focus = taskFocus()) {
    for (const category of ["long", "short"]) {
      const tasks = state.tasks.filter((task) => task.term === category);
      const list = container.querySelector(`#${category}-term-tasks`);
      const fragment = document.createDocumentFragment();
      for (const task of tasks) {
        const row = document.createElement("li");
        row.className = `task-item${task.completed ? " is-completed" : ""}`;
        row.dataset.taskId = task.id;
        const label = document.createElement("label");
        label.className = "task-checkbox-label";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.completed;
        const text = document.createElement("span");
        text.className = "task-title";
        text.textContent = task.title;
        label.append(checkbox, text);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "delete-task";
        button.setAttribute("aria-label", `Delete task: ${task.title}`);
        button.innerHTML = icon("trash");
        row.append(label, button);
        fragment.append(row);
      }
      list.replaceChildren(fragment);
      container.querySelector(`#${category}-term-empty`).hidden =
        tasks.length > 0;
      container.querySelector(`#${category}-task-count`).textContent =
        tasks.length
          ? `${tasks.filter((task) => task.completed).length} / ${tasks.length} done`
          : "0 tasks";
    }
    updateControls();
    if (focus && healthy && !busy) {
      const row = [...container.querySelectorAll("[data-task-id]")].find(
        (row) => row.dataset.taskId === focus.id,
      );
      (row?.querySelector(focus.action) ?? input).focus({
        preventScroll: true,
      });
    }
  }

  async function mutate(transform) {
    if (!healthy || busy) return false;
    const focus = taskFocus();
    busy = true;
    updateControls();
    let succeeded = false;
    const save = () => {
      const next = transform(readTasks());
      writeTasks(next);
      state = next;
      succeeded = true;
    };
    try {
      if (navigator.locks) await navigator.locks.request(TASKS_KEY, save);
      else save();
    } catch {
      showError();
    } finally {
      busy = false;
      render(focus);
    }
    return succeeded;
  }

  input.addEventListener("input", () => input.setCustomValidity(""));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!input.value.trim()) {
      input.setCustomValidity("Write a task before adding it.");
      input.reportValidity();
      return;
    }
    const title = input.value;
    const category = term.value;
    if (await mutate((fresh) => addTask(fresh, title, category))) {
      input.value = "";
      input.focus({ preventScroll: true });
    }
  });
  container.addEventListener("change", (event) => {
    if (!event.target.matches('.task-item input[type="checkbox"]')) return;
    const id = event.target.closest("[data-task-id]").dataset.taskId;
    const completed = event.target.checked;
    mutate((fresh) => setTaskCompleted(fresh, id, completed));
  });
  container.addEventListener("click", (event) => {
    const button = event.target.closest(".delete-task");
    if (!button) return;
    const id = button.closest("[data-task-id]").dataset.taskId;
    mutate((fresh) => removeTask(fresh, id));
  });
  function refresh() {
    try {
      state = readTasks();
      render();
    } catch {
      showError();
    }
  }
  window.addEventListener("storage", (event) => {
    if (event.key === TASKS_KEY || event.key === null) refresh();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  refresh();
}
