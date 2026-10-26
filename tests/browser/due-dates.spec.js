import { test, expect } from "@playwright/test";

const key = "study-journal.tasks.v1";
const fixedNow = new Date("2026-10-26T02:00:00Z");

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(fixedNow.getTime() - 1000) });
  await page.clock.pauseAt(fixedNow);
});

async function add(page, title, category, dueDate = "") {
  await page.getByLabel("Task title", { exact: true }).fill(title);
  await page
    .getByLabel("Task category", { exact: true })
    .selectOption(category);
  await page.getByLabel("Due date (optional)", { exact: true }).fill(dueDate);
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: title, exact: true }),
  ).toBeEnabled();
}
const due = (page, title) =>
  page.getByRole("button", { name: `Set due date for: ${title}`, exact: true });

test("both categories accept optional dates, with today and overdue indicators", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "Finish course", "long", "2026-11-01");
  await add(page, "Read today", "short", "2026-10-26");
  await add(page, "Overdue reading", "short", "2026-10-25");
  await add(page, "No deadline", "long");
  await expect(due(page, "Finish course")).toHaveText("Due Nov 1, 2026");
  await expect(due(page, "Read today")).toHaveText("Due today");
  await expect(due(page, "Overdue reading")).toHaveText(
    "Overdue · Oct 25, 2026",
  );
  await expect(due(page, "No deadline")).toHaveText("Set due date");
  await page
    .getByRole("checkbox", { name: "Overdue reading", exact: true })
    .check();
  await expect(due(page, "Overdue reading")).not.toHaveClass(/due-overdue/);
  await page.reload();
  await expect(due(page, "Finish course")).toHaveText("Due Nov 1, 2026");
  await expect(
    page.getByRole("checkbox", { name: "Overdue reading", exact: true }),
  ).toBeChecked();
});

test("old tasks can be dated, rescheduled, cancelled and cleared without changing other records", async ({
  page,
}) => {
  const legacy = {
    version: 1,
    tasks: [
      {
        id: "old",
        title: "Existing goal",
        term: "long",
        completed: false,
        createdAt: 1,
      },
    ],
  };
  await page.addInitScript(
    ({ key, legacy }) => {
      if (localStorage.getItem(key) === null)
        localStorage.setItem(key, JSON.stringify(legacy));
    },
    { key, legacy },
  );
  await page.goto("/");
  expect(
    await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), key),
  ).toEqual(legacy);
  await due(page, "Existing goal").click();
  await page
    .getByLabel("Due date for: Existing goal", { exact: true })
    .fill("2026-10-26");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(due(page, "Existing goal")).toHaveText("Due today");
  await expect(due(page, "Existing goal")).toBeFocused();
  await due(page, "Existing goal").click();
  await page
    .getByLabel("Due date for: Existing goal", { exact: true })
    .fill("2026-12-01");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(due(page, "Existing goal")).toHaveText("Due today");
  await due(page, "Existing goal").click();
  await page
    .getByLabel("Due date for: Existing goal", { exact: true })
    .fill("2026-11-02");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(due(page, "Existing goal")).toHaveText("Due Nov 2, 2026");
  await page.reload();
  await expect(due(page, "Existing goal")).toHaveText("Due Nov 2, 2026");
  await due(page, "Existing goal").click();
  await page.getByRole("button", { name: "Remove date", exact: true }).click();
  await expect(due(page, "Existing goal")).toHaveText("Set due date");
  await page.reload();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).tasks[0],
      key,
    ),
  ).toEqual({ ...legacy.tasks[0], dueDate: null });
});

test("the date becomes overdue at local midnight without losing an open editing draft", async ({
  page,
}) => {
  await page.clock.setSystemTime(new Date("2026-10-26T15:59:59Z"));
  await page.goto("/");
  await add(page, "Finish today", "short", "2026-10-26");
  await due(page, "Finish today").click();
  await page
    .getByLabel("Due date for: Finish today", { exact: true })
    .fill("2026-11-01");
  await page.clock.fastForward(2000);
  await expect(due(page, "Finish today")).toHaveText("Overdue · Oct 26, 2026");
  await expect(
    page.getByLabel("Due date for: Finish today", { exact: true }),
  ).toHaveValue("2026-11-01");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(due(page, "Finish today")).toHaveText("Due Nov 1, 2026");
});

test("date changes synchronize across tabs and preserve completion state", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await add(page, "Shared goal", "long");
  const other = await context.newPage();
  await other.clock.install({ time: new Date(fixedNow.getTime() - 1000) });
  await other.clock.pauseAt(fixedNow);
  await other.goto("/");
  await due(other, "Shared goal").click();
  await other
    .getByLabel("Due date for: Shared goal", { exact: true })
    .fill("2026-11-01");
  await page
    .getByRole("checkbox", { name: "Shared goal", exact: true })
    .check();
  await expect(
    other.getByRole("checkbox", { name: "Shared goal", exact: true }),
  ).toBeChecked();
  await expect(
    other.getByLabel("Due date for: Shared goal", { exact: true }),
  ).toHaveValue("2026-11-01");
  await other.getByRole("button", { name: "Save", exact: true }).click();
  await expect(due(page, "Shared goal")).toHaveText("Due Nov 1, 2026");
  await expect(
    page.getByRole("checkbox", { name: "Shared goal", exact: true }),
  ).toBeChecked();
});

test("a failed date save preserves the original date and the editing draft", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "Keep date", "short", "2026-11-01");
  await due(page, "Keep date").click();
  await page
    .getByLabel("Due date for: Keep date", { exact: true })
    .fill("2026-12-01");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Tasks could not be read or saved",
  );
  await expect(
    page.getByLabel("Due date for: Keep date", { exact: true }),
  ).toHaveValue("2026-12-01");
  await expect(due(page, "Keep date")).toHaveText("Due Nov 1, 2026");
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).tasks[0].dueDate,
      key,
    ),
  ).toBe("2026-11-01");
});

test("due-date controls and inline editor fit a phone screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await add(page, "Phone task", "short", "2026-11-01");
  await due(page, "Phone task").click();
  await expect(
    page.getByLabel("Due date for: Phone task", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByLabel("Due date for: Phone task", { exact: true })
    .fill("2026-11-02");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(due(page, "Phone task")).toHaveText("Due Nov 2, 2026");
});
