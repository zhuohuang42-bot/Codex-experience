export function dayKey(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function nextDay(value) {
  const date = new Date(value);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + 1,
  ).getTime();
}

// Advance by local midnight rather than 24 hours, including daylight-saving days.
export function splitByDay(startedAt, endedAt) {
  const result = new Map();
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt <= startedAt
  )
    return result;
  let cursor = startedAt;
  while (cursor < endedAt) {
    const end = Math.min(nextDay(cursor), endedAt);
    const key = dayKey(cursor);
    result.set(key, (result.get(key) ?? 0) + end - cursor);
    cursor = end;
  }
  return result;
}

export function dailyTotals(state, now = Date.now()) {
  const totals = new Map();
  const sessions = [...state.sessions];
  if (state.active) sessions.push({ ...state.active, endedAt: now });
  for (const session of sessions) {
    for (const [key, duration] of splitByDay(
      session.startedAt,
      session.endedAt,
    )) {
      totals.set(key, (totals.get(key) ?? 0) + duration);
    }
  }
  return totals;
}

export function formatClock(milliseconds) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatDuration(milliseconds, short = false) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return short ? (seconds ? "<1分" : "0分") : `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${minutes}${short ? "分" : " 分钟"}`;
  return `${hours}${short ? "时" : " 小时"}${remainder ? `${short ? "" : " "}${remainder}${short ? "分" : " 分钟"}` : ""}`;
}

export function weekStart(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dayKey(date);
}

export function calendarDays(year, month) {
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return { offset, count };
}

export function sessionsForDay(state, key, now = Date.now()) {
  const start = dateFromKey(key).getTime();
  const end = nextDay(start);
  const sessions = state.active
    ? [...state.sessions, { ...state.active, endedAt: now, running: true }]
    : state.sessions;
  return sessions
    .filter((session) => session.startedAt < end && session.endedAt > start)
    .map((session) => ({
      ...session,
      clippedStart: Math.max(start, session.startedAt),
      clippedEnd: Math.min(end, session.endedAt),
      dayEnd: end,
    }))
    .sort((a, b) => b.startedAt - a.startedAt);
}
