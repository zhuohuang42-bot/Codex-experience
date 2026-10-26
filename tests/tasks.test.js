import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TASKS_KEY,
  emptyTasks,
  readTasks,
  writeTasks,
  addTask,
  setTaskCompleted,
  removeTask,
  validDueDate,
  setTaskDueDate,
  taskDueStatus,
  taskDueLabel,
} from "../src/tasks.js";
import { STORAGE_KEY } from "../src/storage.js";

test("task categories, completion and deletion preserve previous state", () => {
  const initial = emptyTasks();
  const first = addTask(initial, "  Learn algebra  ", "long", "long-1", 1000);
  const both = addTask(first, "Read chapter 1", "short", "short-1", 2000);
  assert.equal(initial.tasks.length, 0);
  assert.equal(first.tasks[0].title, "Learn algebra");
  const done = setTaskCompleted(both, "long-1", true);
  assert.equal(
    both.tasks.find((task) => task.id === "long-1").completed,
    false,
  );
  assert.equal(done.tasks.find((task) => task.id === "long-1").completed, true);
  const remaining = removeTask(done, "short-1");
  assert.equal(remaining.tasks.length, 1);
  assert.equal(remaining.tasks[0].term, "long");
  assert.equal(
    setTaskCompleted(remaining, "long-1", false).tasks[0].completed,
    false,
  );
});

test("task writes use a separate key and preserve study history exactly", () => {
  const savedHistory =
    '{"version":1,"sessions":[],"active":{"id":"running","startedAt":1000}}';
  const values = new Map([[STORAGE_KEY, savedHistory]]);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  assert.deepEqual(readTasks(storage), emptyTasks());
  const tasks = addTask(emptyTasks(), "Practice", "short", "one", 1000);
  writeTasks(tasks, storage);
  assert.deepEqual(readTasks(storage), tasks);
  assert.equal(values.get(STORAGE_KEY), savedHistory);
  assert.notEqual(TASKS_KEY, STORAGE_KEY);
});

test("invalid saved tasks and duplicate IDs are rejected without erasing data", () => {
  for (const raw of [
    "{invalid",
    "",
    "null",
    '{"version":2,"tasks":[]}',
    JSON.stringify({
      version: 1,
      tasks: [
        {
          id: "x",
          title: "Hello",
          term: "other",
          completed: false,
          createdAt: 1,
        },
      ],
    }),
  ]) {
    const storage = {
      getItem: () => raw,
      setItem: () => assert.fail("must not overwrite invalid data"),
    };
    assert.throws(() => readTasks(storage));
  }
  const task = addTask(emptyTasks(), "Read", "short", "duplicate", 1).tasks[0];
  assert.throws(() =>
    readTasks({
      getItem: () => JSON.stringify({ version: 1, tasks: [task, task] }),
    }),
  );
});

test("blank, oversized and invalid-category tasks cannot be added", () => {
  assert.throws(() => addTask(emptyTasks(), "   ", "long", "a", 1));
  assert.throws(() => addTask(emptyTasks(), "x".repeat(201), "long", "a", 1));
  assert.throws(() => addTask(emptyTasks(), "Read", "invalid", "a", 1));
  const initial = addTask(emptyTasks(), "Read", "short", "a", 1);
  assert.throws(() => addTask(initial, "Write", "long", "a", 2));
});

test("due dates validate actual calendar days including leap years", () => {
  for (const date of [
    "2026-10-26",
    "2024-02-29",
    "2000-02-29",
    "0001-01-01",
    "9999-12-31",
  ]) {
    assert.equal(validDueDate(date), true, date);
  }
  for (const date of [
    "2026-02-29",
    "1900-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-10-00",
    "0000-01-01",
    "2026-1-1",
    "2026-10-26T00:00:00Z",
    "",
    null,
  ]) {
    assert.equal(validDueDate(date), false, String(date));
  }
});

test("old undated tasks load unchanged, and dates can be set, changed and cleared", () => {
  const legacy = {
    version: 1,
    tasks: [
      {
        id: "old",
        title: "Keep learning",
        term: "long",
        completed: false,
        createdAt: 1,
      },
    ],
  };
  const raw = JSON.stringify(legacy);
  const loaded = readTasks({
    getItem: () => raw,
    setItem: () => assert.fail("reading must not rewrite records"),
  });
  assert.deepEqual(loaded, legacy);
  assert.equal(taskDueStatus(loaded.tasks[0]), "none");
  const dated = setTaskDueDate(loaded, "old", "2026-10-26");
  assert.equal(dated.tasks[0].dueDate, "2026-10-26");
  assert.deepEqual(loaded, legacy);
  const rescheduled = setTaskDueDate(dated, "old", "2026-11-01");
  assert.equal(rescheduled.tasks[0].dueDate, "2026-11-01");
  const cleared = setTaskDueDate(rescheduled, "old", null);
  assert.equal(cleared.tasks[0].dueDate, null);
  assert.equal(cleared.tasks[0].title, "Keep learning");
  assert.throws(() => setTaskDueDate(loaded, "old", "2026-02-30"));
});

test("new due dates persist and invalid stored dates are rejected without rewriting", () => {
  const tasks = addTask(
    emptyTasks(),
    "Finish course",
    "long",
    "date-test",
    1,
    "2026-11-01",
  );
  let raw = null;
  const storage = {
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  };
  writeTasks(tasks, storage);
  assert.deepEqual(readTasks(storage), tasks);
  assert.throws(() =>
    addTask(emptyTasks(), "Read", "short", "bad", 1, "2026-02-30"),
  );
  for (const dueDate of ["2026-02-30", 123, ""]) {
    raw = JSON.stringify({
      version: 1,
      tasks: [{ ...tasks.tasks[0], dueDate }],
    });
    const before = raw;
    assert.throws(() => readTasks(storage));
    assert.equal(raw, before);
  }
});

test("due status follows the local day, and completed tasks are never overdue", () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = "America/Chicago";
    const now = new Date("2026-10-26T01:00:00Z").getTime(); // Still Oct 25 locally.
    const task = { dueDate: "2026-10-25", completed: false };
    assert.equal(taskDueStatus(task, now), "today");
    assert.equal(taskDueLabel(task, now), "Due today");
    assert.equal(
      taskDueStatus({ ...task, dueDate: "2026-10-24" }, now),
      "overdue",
    );
    assert.equal(
      taskDueLabel({ ...task, dueDate: "2026-10-24" }, now),
      "Overdue · Oct 24, 2026",
    );
    assert.equal(
      taskDueStatus({ ...task, dueDate: "2026-10-26" }, now),
      "scheduled",
    );
    assert.equal(
      taskDueLabel({ ...task, dueDate: "2026-10-26" }, now),
      "Due Oct 26, 2026",
    );
    assert.equal(
      taskDueStatus({ ...task, completed: true }, now + 86400000),
      "scheduled",
    );
    assert.equal(taskDueStatus({ dueDate: null }, now), "none");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
