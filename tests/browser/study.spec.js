import { test, expect } from "@playwright/test";

const fixedNow = new Date("2026-10-26T02:00:00Z"); // Monday, 10:00 in Shanghai
const key = "shiguang.study.v1";

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date(fixedNow.getTime() - 1000) });
  await page.clock.pauseAt(fixedNow);
});

test("start, stop, accumulate, and retain records after reload", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "把时间，留给成长。",
  );
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeEnabled();
  await page.clock.fastForward(65000);
  await expect(page.getByRole("timer")).toHaveText("00:01:05");
  await page.getByRole("button", { name: "停止并保存学习记录" }).click();
  await expect(page.locator("#day-summary")).toHaveText(
    "1 次专注 · 共学习 1 分钟",
  );
  await expect(page.locator(".session-row")).toHaveCount(1);
  await expect(page.locator("#stat-today")).toHaveText("1 分钟");
  await expect(page.locator('[data-day="2026-10-26"]')).toContainText("1分");
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeEnabled();
  await page.clock.fastForward(60000);
  await page.getByRole("button", { name: "停止并保存学习记录" }).click();
  await expect(page.locator("#day-summary")).toHaveText(
    "2 次专注 · 共学习 2 分钟",
  );
  await page.reload();
  await expect(page.locator(".session-row")).toHaveCount(2);
  await expect(page.locator("#stat-today")).toHaveText("2 分钟");
  await expect(page.getByRole("timer")).toHaveText("00:00:00");
});

test("running timer survives reload and keeps counting real elapsed time", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeEnabled();
  await page.clock.fastForward(120000);
  await page.reload();
  await expect(page.getByRole("timer")).toHaveText("00:02:00");
  await page.clock.fastForward(30000);
  await expect(page.getByRole("timer")).toHaveText("00:02:30");
  await page.getByRole("button", { name: "停止并保存学习记录" }).click();
  await expect(
    page.getByRole("button", { name: "开始学习", exact: true }),
  ).toBeEnabled();
  const saved = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    key,
  );
  expect(saved.active).toBeNull();
  expect(saved.sessions).toHaveLength(1);
  expect(saved.sessions[0].endedAt - saved.sessions[0].startedAt).toBe(150000);
});

test("calendar splits a midnight session between two dates", async ({
  page,
}) => {
  await page.clock.setSystemTime(new Date("2026-10-26T15:50:00Z"));
  await page.goto("/");
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeEnabled();
  await page.clock.fastForward(30 * 60000);
  await page.getByRole("button", { name: "停止并保存学习记录" }).click();
  await expect(page.locator("#stat-today")).toHaveText("20 分钟");
  await expect(page.locator("#stat-days")).toHaveText("2");
  await page.locator('[data-day="2026-10-26"]').click();
  await expect(page.locator("#day-summary")).toHaveText(
    "1 次专注 · 共学习 10 分钟",
  );
  await expect(page.locator(".session-info p")).toHaveText("23:50 — 24:00");
  await page.locator('[data-day="2026-10-27"]').click();
  await expect(page.locator("#day-summary")).toHaveText(
    "1 次专注 · 共学习 20 分钟",
  );
});

test("month controls cross year boundaries and today resets selection", async ({
  page,
}) => {
  await page.goto("/");
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "下个月" }).click();
  await expect(page.locator("#month-title")).toHaveText("2027年 1月");
  await page.locator('[data-day="2027-01-01"]').click();
  await expect(page.locator("#day-records")).toContainText(
    "未来的精彩，等待你来书写",
  );
  await page.getByRole("button", { name: "回到今天" }).click();
  await expect(page.locator("#month-title")).toHaveText("2026年 10月");
  await expect(page.locator('[data-day="2026-10-26"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#calendar-grid .calendar-day")).toHaveCount(31);
});

test("export includes recorded daily totals in a spreadsheet-friendly CSV", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "导出记录" }).click();
  await expect(page.getByRole("status")).toContainText("还没有学习记录");
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeEnabled();
  await page.clock.fastForward(90000);
  await page.getByRole("button", { name: "停止并保存学习记录" }).click();
  await expect(
    page.getByRole("button", { name: "开始学习", exact: true }),
  ).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出记录" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("拾光-学习记录-2026-10-26.csv");
  const stream = await download.createReadStream();
  let output = "";
  for await (const chunk of stream) output += chunk.toString("utf8");
  expect(output).toContain("日期,学习秒数,学习时长");
  expect(output).toContain("2026-10-26,90,1 分钟");
});

test("corrupt stored data remains intact and shows an actionable error", async ({
  page,
}) => {
  await page.addInitScript((key) => localStorage.setItem(key, "{invalid"), key);
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("无法读取或保存学习记录");
  await expect(
    page.getByRole("button", { name: "开始学习", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(
    "{invalid",
  );
});

test("a failed save preserves the active session instead of pretending it stopped", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeEnabled();
  await page.clock.fastForward(60000);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };
  });
  await page.getByRole("button", { name: "停止并保存学习记录" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).active,
      key,
    ),
  ).not.toBeNull();
});

test("two tabs share one timer and stopping in either tab updates both", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const other = await context.newPage();
  await other.clock.install({ time: new Date(fixedNow.getTime() - 1000) });
  await other.clock.pauseAt(fixedNow);
  await other.goto("/");
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await expect(
    other.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeVisible();
  await other.clock.fastForward(60000);
  await other.getByRole("button", { name: "停止并保存学习记录" }).click();
  await expect(
    page.getByRole("button", { name: "开始学习", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".session-row")).toHaveCount(1);
  await expect(page.locator("#stat-today")).toHaveText("1 分钟");
});

test("phone layout is usable with no horizontal overflow or script errors", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "开始学习", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "停止并保存学习记录" }),
  ).toBeEnabled();
  await page.clock.fastForward(3000);
  await expect(page.getByRole("timer")).toHaveText("00:00:03");
  await page.getByRole("button", { name: "停止并保存学习记录" }).click();
  await page.locator('[data-day="2026-10-25"]').click();
  await expect(page.locator("#day-records")).toContainText(
    "这一天，还没有学习记录",
  );
  expect(errors).toEqual([]);
});
