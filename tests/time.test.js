import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dayKey,
  splitByDay,
  dailyTotals,
  formatClock,
  formatDuration,
  calendarDays,
  weekStart,
  sessionsForDay,
} from "../src/time.js";
import { emptyState, readState, writeState } from "../src/storage.js";

test("timer formatting supports durations exceeding a day and clamps negative values", () => {
  assert.equal(formatClock(3_661_000), "01:01:01");
  assert.equal(formatClock(90_061_000), "25:01:01");
  assert.equal(formatClock(-1000), "00:00:00");
  assert.equal(formatDuration(5400000), "1 hr 30 min");
  assert.equal(formatDuration(45000, true), "<1m");
});

test("splits a midnight session into exact local-day durations", () => {
  const start = new Date(2026, 9, 26, 23, 50).getTime();
  const end = new Date(2026, 9, 27, 0, 20).getTime();
  assert.deepEqual(
    [...splitByDay(start, end)],
    [
      ["2026-10-26", 600000],
      ["2026-10-27", 1200000],
    ],
  );
});

test("ending at midnight does not create an empty day", () => {
  const start = new Date(2026, 9, 26, 23, 50).getTime();
  const end = new Date(2026, 9, 27).getTime();
  assert.deepEqual([...splitByDay(start, end)], [["2026-10-26", 600000]]);
  assert.equal(splitByDay(end, start).size, 0);
});

test("local midnight splitting preserves DST day lengths", () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = "America/Chicago";
    const start = new Date(2026, 2, 7, 23).getTime();
    const end = new Date(2026, 2, 9, 1).getTime();
    assert.deepEqual(
      [...splitByDay(start, end)],
      [
        ["2026-03-07", 3600000],
        ["2026-03-08", 23 * 3600000],
        ["2026-03-09", 3600000],
      ],
    );
    const fallStart = new Date(2026, 10, 1).getTime();
    const fallEnd = new Date(2026, 10, 2).getTime();
    assert.equal(
      splitByDay(fallStart, fallEnd).get("2026-11-01"),
      25 * 3600000,
    );
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("totals include saved sessions and restored running session without mutation", () => {
  const start = new Date(2026, 9, 26, 10).getTime();
  const state = {
    version: 1,
    sessions: [{ id: "a", startedAt: start, endedAt: start + 60000 }],
    active: { id: "b", startedAt: start + 120000 },
  };
  assert.equal(dailyTotals(state, start + 180000).get("2026-10-26"), 120000);
  assert.equal(state.sessions.length, 1);
  assert.equal(state.active.endedAt, undefined);
});

test("calendar uses Monday first and handles leap years and full six-week months", () => {
  assert.deepEqual(calendarDays(2024, 1), { offset: 3, count: 29 });
  assert.deepEqual(calendarDays(2026, 1), { offset: 6, count: 28 });
  assert.deepEqual(calendarDays(2026, 2), { offset: 6, count: 31 });
  assert.equal(weekStart(new Date(2026, 9, 25)), "2026-10-19");
  assert.equal(dayKey(new Date(2026, 0, 1)), "2026-01-01");
});

test("daily session detail clips cross-midnight records and keeps newest first", () => {
  const start = new Date(2026, 9, 26, 23, 50).getTime();
  const state = {
    sessions: [{ id: "a", startedAt: start, endedAt: start + 30 * 60000 }],
    active: { id: "b", startedAt: start + 40 * 60000 },
  };
  const records = sessionsForDay(state, "2026-10-27", start + 50 * 60000);
  assert.deepEqual(
    records.map((r) => r.id),
    ["b", "a"],
  );
  assert.equal(records[0].running, true);
  assert.equal(records[1].clippedEnd - records[1].clippedStart, 20 * 60000);
});

test("storage round-trips records and rejects malformed data without overwriting it", () => {
  let raw = null;
  const storage = {
    getItem: () => raw,
    setItem: (key, value) => {
      raw = value;
    },
  };
  assert.deepEqual(readState(storage), emptyState());
  const state = { ...emptyState(), active: { id: "a", startedAt: 1000 } };
  writeState(state, storage);
  assert.deepEqual(readState(storage), state);
  raw = "{bad json";
  assert.throws(() => readState(storage));
  assert.equal(raw, "{bad json");
  raw = JSON.stringify({
    version: 1,
    sessions: [{ id: "b", startedAt: 2000, endedAt: 1000 }],
    active: null,
  });
  assert.throws(() => readState(storage));
});
