import { icon } from "./icons.js";
import { dayKey } from "./time.js";
import {
  TASKS_KEY,
  TASK_TITLE_LIMIT,
  emptyTasks,
  readTasks,
  writeTasks,
  addTask,
  setTaskCompleted,
  removeTask,
  setTaskDueDate,
  taskDueLabel,
  taskDueStatus,
} from "./tasks.js";

export function mountTasks(container) {
  container.innerHTML = `
    <div class="tasks-heading">
      <div><p class="eyebrow">A PLAN FOR YOUR PROGRESS</p><h2 id="tasks-title">Your tasks</h2><p class="tasks-intro">Big ambitions. Small steps. A little space for both.</p></div>
      <span class="tasks-heading-icon" aria-hidden="true">${icon("checklist")}</span>
    </div>
    <form class="task-form" id="task-form">
      <div class="task-input-wrap"><label for="task-title">Task title</label><input id="task-title" name="title" type="text" placeholder="What would you like to work on?" maxlength="${TASK_TITLE_LIMIT}" required autocomplete="off" /></div>
      <div class="task-term-wrap"><label for="task-term">Task category</label><select id="task-term" name="term"><option value="short">Short-term</option><option value="long">Long-term</option></select></div>
      <div class="task-date-wrap"><label for="task-due-date">Due date <span>(optional)</span></label><input id="task-due-date" name="dueDate" type="date" min="0001-01-01" max="9999-12-31" /></div>
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
  const newDueDate = container.querySelector("#task-due-date");
  const error = container.querySelector(".task-error");
  let state = emptyTasks();
  let healthy = true;
  let busy = false;
  let editingTaskId = null;
  let dueDraft = "";

  function dueButton(task) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `task-due-toggle due-${taskDueStatus(task)}`;
    button.setAttribute("aria-label", `Set due date for: ${task.title}`);
    button.setAttribute("aria-description", taskDueLabel(task));
    button.setAttribute("aria-expanded", String(editingTaskId === task.id));
    button.innerHTML = icon("calendar");
    const text = document.createElement("span");
    text.textContent = taskDueLabel(task);
    button.append(text);
    return button;
  }

  function dueEditor(task) {
    const editor = document.createElement("form");
    editor.className = "task-due-form";
    editor.setAttribute("aria-label", `Change due date for: ${task.title}`);
    const label = document.createElement("label");
    label.textContent = "Due date";
    const field = document.createElement("input");
    field.type = "date";
    field.className = "task-due-input";
    field.min = "0001-01-01";
    field.max = "9999-12-31";
    field.value = dueDraft;
    field.setAttribute("aria-label", `Due date for: ${task.title}`);
    label.append(field);
    const actions = document.createElement("div");
    actions.className = "task-date-actions";
    for (const [text, className, type] of [
      ["Save", "save-task-date", "submit"],
      ["Cancel", "cancel-task-date", "button"],
      ...(task.dueDate ? [["Remove date", "clear-task-date", "button"]] : []),
    ]) {
      const button = document.createElement("button");
      button.type = type;
      button.className = className;
      button.textContent = text;
      actions.append(button);
    }
    editor.append(label, actions);
    return editor;
  }

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
    if (!id) return null;
    const action = focused.matches(".task-due-input")
      ? ".task-due-input"
      : focused.closest(".task-due-form")
        ? ".task-due-toggle"
        : focused.matches('input[type="checkbox"]')
          ? 'input[type="checkbox"]'
          : focused.matches(".task-due-toggle")
            ? ".task-due-toggle"
            : ".delete-task";
    return { id, action };
  }

  function render(focus = taskFocus()) {
    if (editingTaskId && !state.tasks.some((task) => task.id === editingTaskId))
      editingTaskId = null;
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
        const body = document.createElement("div");
        body.className = "task-body";
        body.append(label, dueButton(task));
        if (editingTaskId === task.id) body.append(dueEditor(task));
        row.append(body, button);
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
    const dueDate = newDueDate.value || null;
    if (
      await mutate((fresh) =>
        addTask(fresh, title, category, undefined, undefined, dueDate),
      )
    ) {
      input.value = "";
      newDueDate.value = "";
      input.focus({ preventScroll: true });
    }
  });
  container.addEventListener("input", (event) => {
    if (event.target.matches(".task-due-input")) dueDraft = event.target.value;
  });
  async function saveDueDate(id, dueDate) {
    if (await mutate((fresh) => setTaskDueDate(fresh, id, dueDate))) {
      editingTaskId = null;
      dueDraft = "";
      render({ id, action: ".task-due-toggle" });
    }
  }
  container.addEventListener("submit", (event) => {
    if (!event.target.matches(".task-due-form")) return;
    event.preventDefault();
    const id = event.target.closest("[data-task-id]").dataset.taskId;
    saveDueDate(
      id,
      event.target.querySelector(".task-due-input").value || null,
    );
  });
  container.addEventListener("change", (event) => {
    if (!event.target.matches('.task-item input[type="checkbox"]')) return;
    const id = event.target.closest("[data-task-id]").dataset.taskId;
    const completed = event.target.checked;
    mutate((fresh) => setTaskCompleted(fresh, id, completed));
  });
  container.addEventListener("click", (event) => {
    const toggle = event.target.closest(".task-due-toggle");
    if (toggle) {
      const id = toggle.closest("[data-task-id]").dataset.taskId;
      editingTaskId = editingTaskId === id ? null : id;
      dueDraft = state.tasks.find((task) => task.id === id)?.dueDate ?? "";
      render({
        id,
        action: editingTaskId ? ".task-due-input" : ".task-due-toggle",
      });
      return;
    }
    if (event.target.closest(".cancel-task-date")) {
      const id = editingTaskId;
      editingTaskId = null;
      render({ id, action: ".task-due-toggle" });
      return;
    }
    if (event.target.closest(".clear-task-date")) {
      saveDueDate(editingTaskId, null);
      return;
    }
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
  let today = dayKey(Date.now());
  setInterval(() => {
    const next = dayKey(Date.now());
    if (next === today) return;
    today = next;
    for (const row of container.querySelectorAll("[data-task-id]")) {
      const task = state.tasks.find((task) => task.id === row.dataset.taskId);
      if (!task) continue;
      const button = row.querySelector(".task-due-toggle");
      button.className = `task-due-toggle due-${taskDueStatus(task)}`;
      button.querySelector("span").textContent = taskDueLabel(task);
      button.setAttribute("aria-description", taskDueLabel(task));
    }
  }, 1000);
}
