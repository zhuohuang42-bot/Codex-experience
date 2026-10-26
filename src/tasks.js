import { dayKey } from "./time.js";

export const TASKS_KEY = "study-journal.tasks.v1";
export const TASK_TITLE_LIMIT = 200;

export function emptyTasks() {
  return { version: 1, tasks: [] };
}

export function validDueDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

export function taskDueStatus(task, now = Date.now()) {
  if (!task.dueDate) return "none";
  if (task.completed) return "scheduled";
  const today = dayKey(now);
  if (task.dueDate < today) return "overdue";
  return task.dueDate === today ? "today" : "scheduled";
}

export function taskDueLabel(task, now = Date.now()) {
  const status = taskDueStatus(task, now);
  if (status === "none") return "Set due date";
  if (status === "today") return "Due today";
  const [year, month, day] = task.dueDate.split("-").map(Number);
  // A calendar date is not a UTC instant: format it without shifting timezones.
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return status === "overdue" ? `Overdue · ${label}` : `Due ${label}`;
}

function validTask(task) {
  return (
    task &&
    typeof task.id === "string" &&
    task.id.length > 0 &&
    typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    task.title.length <= TASK_TITLE_LIMIT &&
    (task.dueDate == null || validDueDate(task.dueDate)) &&
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
  dueDate = null,
) {
  const task = {
    id,
    title: title.trim(),
    term,
    completed: false,
    createdAt,
    dueDate,
  };
  if (!validTask(task) || state.tasks.some((existing) => existing.id === id)) {
    throw new Error("Invalid new task");
  }
  return { ...state, tasks: [task, ...state.tasks] };
}

export function setTaskDueDate(state, id, dueDate) {
  if (dueDate !== null && !validDueDate(dueDate))
    throw new Error("Invalid due date");
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === id ? { ...task, dueDate } : task,
    ),
  };
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
