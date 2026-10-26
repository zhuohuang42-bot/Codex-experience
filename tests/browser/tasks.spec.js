import { test, expect } from "@playwright/test";
const taskKey = "study-journal.tasks.v1";
const studyKey = "shiguang.study.v1";

async function add(page, title, category = "short") {
  await page.getByRole("textbox", { name: "Task title" }).fill(title);
  await page
    .getByRole("combobox", { name: "Task category" })
    .selectOption(category);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: title, exact: true }),
  ).toBeEnabled();
}

test("name, labels, calendar and duration units are English", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Study Journal");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("link", { name: "Study Journal home" }),
  ).toContainText("Study Journal");
  await expect(page.locator("body")).not.toContainText(/[\u3400-\u9fff]/);
  await expect(page.locator("#stat-today")).toHaveText("0 sec");
  await expect(page.locator(".weekdays")).toHaveText("MonTueWedThuFriSatSun");
});

test("add both categories, complete, reopen and delete across reloads", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "Learn linear algebra", "long");
  await add(page, "Read chapter 1");
  await expect(page.locator("#long-term-tasks .task-item")).toHaveCount(1);
  await expect(page.locator("#short-term-tasks .task-item")).toHaveCount(1);
  await page
    .getByRole("checkbox", { name: "Learn linear algebra", exact: true })
    .check();
  await expect(page.locator("#long-task-count")).toHaveText("1 / 1 done");
  await expect(
    page.getByRole("checkbox", { name: "Learn linear algebra", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "Learn linear algebra", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Read chapter 1", exact: true }),
  ).not.toBeChecked();
  await page
    .getByRole("checkbox", { name: "Learn linear algebra", exact: true })
    .uncheck();
  await expect(page.locator("#long-task-count")).toHaveText("0 / 1 done");
  await page
    .getByRole("button", { name: "Delete task: Read chapter 1", exact: true })
    .click();
  await expect(page.locator("#short-term-tasks .task-item")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#short-term-empty")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Learn linear algebra", exact: true }),
  ).not.toBeChecked();
});

test("old study records and an active timer survive the update unchanged", async ({
  page,
}) => {
  const now = new Date("2026-10-26T02:00:00Z");
  await page.clock.install({ time: new Date(now.getTime() - 1000) });
  await page.clock.pauseAt(now);
  const legacy = {
    version: 1,
    sessions: [
      {
        id: "saved",
        startedAt: now.getTime() - 300000,
        endedAt: now.getTime() - 180000,
      },
    ],
    active: { id: "running", startedAt: now.getTime() - 60000 },
  };
  await page.addInitScript(
    ({ key, legacy }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(legacy));
    },
    { key: studyKey, legacy },
  );
  await page.goto("/");
  await expect(page.getByRole("timer")).toHaveText("00:01:00");
  await expect(page.locator("#stat-today")).toHaveText("3 min");
  await add(page, "Keep learning", "long");
  await page
    .getByRole("checkbox", { name: "Keep learning", exact: true })
    .check();
  await expect(page.locator("#long-task-count")).toHaveText("1 / 1 done");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      studyKey,
    ),
  ).toEqual(legacy);
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("00:01:00");
  await page
    .getByRole("button", { name: "Stop and save study session" })
    .click();
  await expect(page.locator("#day-summary")).toHaveText(
    "2 sessions · 3 min studied",
  );
  await expect(
    page.getByRole("checkbox", { name: "Keep learning", exact: true }),
  ).toBeChecked();
});

test("blank tasks are rejected and HTML-like task text stays plain text", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Task title" }).fill("   ");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.locator(".task-item")).toHaveCount(0);
  const title = '<img src=x onerror="window.taskInjected=true">';
  await add(page, title);
  await expect(page.locator(".task-title")).toHaveText(title);
  await expect(page.locator("#tasks-panel img")).toHaveCount(0);
  expect(await page.evaluate(() => window.taskInjected)).toBeUndefined();
});

test("concurrent additions, completion and deletion synchronize across tabs", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.goto("/");
  await Promise.all([
    add(page, "Long project", "long"),
    add(other, "Small step", "short"),
  ]);
  await expect(page.locator(".task-item")).toHaveCount(2);
  await expect(other.locator(".task-item")).toHaveCount(2);
  await page.getByRole("checkbox", { name: "Small step", exact: true }).check();
  await expect(
    other.getByRole("checkbox", { name: "Small step", exact: true }),
  ).toBeChecked();
  await other
    .getByRole("button", { name: "Delete task: Long project", exact: true })
    .click();
  await expect(page.locator(".task-item")).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: "Small step", exact: true }),
  ).toBeChecked();
});

test("corrupt task data stays intact and does not block the study timer", async ({
  page,
}) => {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "{invalid"),
    taskKey,
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "Tasks could not be read or saved",
  );
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Start studying", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), taskKey)).toBe(
    "{invalid",
  );
});

test("a failed task save keeps the draft and leaves saved tasks unchanged", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "Existing task");
  await page.evaluate((key) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (name, value) {
      if (name === key)
        throw new DOMException("Storage full", "QuotaExceededError");
      return original.call(this, name, value);
    };
  }, taskKey);
  await page
    .getByRole("textbox", { name: "Task title" })
    .fill("Keep this draft");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Tasks could not be read or saved",
  );
  await expect(page.getByRole("textbox", { name: "Task title" })).toHaveValue(
    "Keep this draft",
  );
  await expect(page.locator(".task-item")).toHaveCount(1);
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).tasks.length,
      taskKey,
    ),
  ).toBe(1);
  await page
    .getByRole("button", { name: "Start studying", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop and save study session" }),
  ).toBeEnabled();
});

test("phone task form and long titles fit without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const title = "LongTask".repeat(20);
  await add(page, title, "long");
  await expect(
    page.getByRole("checkbox", { name: title, exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("checkbox", { name: title, exact: true }).check();
  await expect(page.locator("#long-task-count")).toHaveText("1 / 1 done");
});
