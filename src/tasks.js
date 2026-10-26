export const TASKS_KEY = "study-journal.tasks.v1";
export const TASK_TITLE_LIMIT = 200;

export function emptyTasks() {
  return { version: 1, tasks: [] };
}

function validTask(task) {
  return (
    task &&
    typeof task.id === "string" &&
    task.id.length > 0 &&
    typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    task.title.length <= TASK_TITLE_LIMIT &&
    ["long", "short"].includes(task.term) &&
    typeof task.completed === "boolean" &&
    Number.isFinite(task.createdAt) &&
    task.createdAt >= 0
  );
}

export function readTasks(storage = localStorage) {
  const raw = storage.getItem(TASKS_KEY);
  if (raw === null) return emptyTasks();
  const state = JSON.parse(raw);
  if (
    state?.version !== 1 ||
    !Array.isArray(state.tasks) ||
    !state.tasks.every(validTask) ||
    new Set(state.tasks.map((task) => task.id)).size !== state.tasks.length
  ) {
    throw new Error("Invalid saved tasks");
  }
  return state;
}

export function writeTasks(state, storage = localStorage) {
  storage.setItem(TASKS_KEY, JSON.stringify(state));
}

export function addTask(
  state,
  title,
  term,
  id = crypto.randomUUID(),
  createdAt = Date.now(),
) {
  const task = { id, title: title.trim(), term, completed: false, createdAt };
  if (!validTask(task) || state.tasks.some((existing) => existing.id === id)) {
    throw new Error("Invalid new task");
  }
  return { ...state, tasks: [task, ...state.tasks] };
}

export function setTaskCompleted(state, id, completed) {
  if (typeof completed !== "boolean") throw new Error("Invalid task status");
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, completed } : task,
    ),
  };
}

export function removeTask(state, id) {
  return { ...state, tasks: state.tasks.filter((task) => task.id !== id) };
}
