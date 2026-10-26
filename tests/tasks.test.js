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
