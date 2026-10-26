import "./styles.css";
import {
  dayKey,
  dateFromKey,
  dailyTotals,
  formatClock,
  formatDuration,
  weekStart,
  calendarDays,
  sessionsForDay,
} from "./time.js";
import { STORAGE_KEY, emptyState, readState, writeState } from "./storage.js";

import { icon } from "./icons.js";
import { mountTasks } from "./tasks-ui.js";

const now = new Date();
let selectedDay = dayKey(now);
let visibleMonth = { year: now.getFullYear(), month: now.getMonth() };
let state = emptyState();
let storageHealthy = true;
try {
  state = readState();
} catch {
  storageHealthy = false;
}

document.querySelector("#app").innerHTML = `
  <header class="site-header">
    <a href="./" class="brand" aria-label="Study Journal home"><span class="brand-mark">${icon("sprout")}</span><span>Study Journal<span class="brand-en">A LITTLE EVERY DAY</span></span></a>
    <div class="header-right"><span class="header-date" id="header-date"></span><span class="local-badge"><span></span> Saved locally</span></div>
  </header>
  <main class="page-shell">
    <section class="welcome" aria-labelledby="page-title">
      <div><p class="eyebrow"><span class="little-line"></span> A LITTLE EVERY DAY</p><h1 id="page-title">Make time for <span>growth.</span></h1><p class="welcome-copy">Every focused moment counts. Build a little progress, every day.</p></div>
      <div class="welcome-note">${icon("sun")}<span>You don’t have to do it all today.<br><strong>A small step forward is enough.</strong></span></div>
    </section>

    <section class="stats-grid" aria-label="Study statistics">
      <article class="stat-card"><span class="stat-icon">${icon("clock")}</span><div><p>Studied today</p><strong id="stat-today">0 sec</strong></div><span class="stat-tag">TODAY</span></article>
      <article class="stat-card"><span class="stat-icon">${icon("chart")}</span><div><p>This week</p><strong id="stat-week">0 sec</strong></div><span class="stat-tag">THIS WEEK</span></article>
      <article class="stat-card"><span class="stat-icon">${icon("sprout")}</span><div><p>Days of learning</p><strong><span id="stat-days">0</span><small> days</small></strong></div><span class="stat-tag">GROWING</span></article>
    </section>

    <div class="workspace-grid">
      <section class="timer-card" aria-labelledby="timer-title">
        <div class="card-heading"><h2 id="timer-title">${icon("clock")} Your moment to focus</h2><span class="session-label">FOCUS TIME</span></div>
        <div class="timer-stage">
          <div class="timer-halo" aria-hidden="true"><div class="halo-inner"></div><span class="halo-dot"></span></div>
          <div class="timer-content"><span class="timer-status" id="timer-status">Ready when you are</span><div class="timer-digits" id="timer" role="timer" aria-label="Current study duration">00:00:00</div><p class="timer-caption" id="timer-caption">A little uninterrupted time, just for you.</p></div>
        </div>
        <button type="button" class="timer-button" id="toggle-timer">${icon("play")}<span>Start studying</span></button>
        <p class="timer-hint" id="timer-hint">Press start. Let everything else wait.</p>
        <div class="timer-bottom"><span class="mini-sprout">${icon("sprout")}</span><p>Every minute you put in<br>is a little gift to your future self.</p><span class="bottom-spark" aria-hidden="true">✳</span></div>
      </section>

      <section class="calendar-card" aria-labelledby="calendar-title">
        <div class="card-heading"><h2 id="calendar-title">${icon("calendar")} Study calendar</h2><button class="text-button" id="go-today" type="button">Today</button></div>
        <div class="month-navigation"><h3 id="month-title"></h3><div class="month-controls"><button class="icon-button previous" id="previous-month" type="button" aria-label="Previous month">${icon("arrow")}</button><button class="icon-button" id="next-month" type="button" aria-label="Next month">${icon("arrow")}</button></div></div>
        <div class="weekdays" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        <div id="calendar-grid" class="calendar-grid" role="group" aria-label="Choose a date to view study sessions"></div>
        <div class="calendar-footer"><span><i class="today-key"></i> Today</span><div class="heat-legend"><span>Study time</span><span>Less</span><i class="heat-0"></i><i class="heat-1"></i><i class="heat-2"></i><i class="heat-3"></i><i class="heat-4"></i><span>More</span></div></div>
      </section>
    </div>

    <section class="tasks-card" id="tasks-panel" aria-labelledby="tasks-title"></section>

    <section class="records-card" aria-labelledby="records-title">
      <div class="records-heading"><div><div class="records-title-line"><h2 id="records-title">A day of progress</h2><span id="selected-date" class="selected-date"></span></div><p id="day-summary" class="day-summary"></p></div><button type="button" class="export-button" id="export-records">${icon("download")} Export records</button></div>
      <div id="day-records"></div>
    </section>
    <div class="save-notice">${icon("shield")}<span>Your progress is saved automatically in this browser.<span class="notice-detail"> Records do not sync across devices. Export a copy to keep.</span></span></div>
  </main>
  <footer class="site-footer"><span>Study Journal · A little progress, every day</span><span>SMALL STEPS, EVERY DAY.</span></footer>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <div class="storage-error" id="storage-error" role="alert" hidden>Study records could not be read or saved. Allow local storage and check available space, then refresh. Your saved records have not been replaced.</div>
`;

const $ = (selector) => document.querySelector(selector);
let toastTimeout;
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    $("#toast").hidden = true;
  }, 4500);
}

function setStorageError() {
  storageHealthy = false;
  $("#storage-error").hidden = false;
  $("#toggle-timer").disabled = true;
}

function heatLevel(duration) {
  if (!duration) return 0;
  if (duration < 30 * 60000) return 1;
  if (duration < 60 * 60000) return 2;
  if (duration < 120 * 60000) return 3;
  return 4;
}

let calendarSignature = "";
function renderCalendar(totals, current) {
  const { year, month } = visibleMonth;
  const signature = JSON.stringify([
    year,
    month,
    selectedDay,
    dayKey(current),
    [...totals].map(([key, value]) => [
      key,
      formatDuration(value, true),
      heatLevel(value),
    ]),
  ]);
  if (calendarSignature === signature) return;
  calendarSignature = signature;
  $("#month-title").textContent = new Date(year, month, 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  );
  const { offset, count } = calendarDays(year, month);
  const markup = Array.from(
    { length: offset },
    () => '<span class="calendar-blank" aria-hidden="true"></span>',
  );
  for (let day = 1; day <= count; day++) {
    const date = new Date(year, month, day);
    const key = dayKey(date);
    const duration = totals.get(key) ?? 0;
    const isToday = key === dayKey(current);
    const isSelected = key === selectedDay;
    const future = key > dayKey(current);
    markup.push(
      `<button type="button" class="calendar-day heat-${heatLevel(duration)}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${future ? " is-future" : ""}" data-day="${key}" aria-label="${date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}, studied ${formatDuration(duration)}${isToday ? ", today" : ""}" aria-pressed="${isSelected}"${isToday ? ' aria-current="date"' : ""}><span class="day-number">${day}</span><span class="day-duration">${duration ? formatDuration(duration, true) : ""}</span>${isToday ? '<i class="today-dot"></i>' : ""}</button>`,
    );
  }
  $("#calendar-grid").innerHTML = markup.join("");
}

const timeLabel = (timestamp) =>
  new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
let recordSignature = "";
function renderRecords(totals, current) {
  const records = sessionsForDay(state, selectedDay, current);
  const signature = JSON.stringify([
    selectedDay,
    records.map((r) => [r.id, r.clippedEnd, r.running]),
  ]);
  if (recordSignature === signature) return;
  recordSignature = signature;
  const date = dateFromKey(selectedDay);
  $("#selected-date").textContent = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  $("#day-summary").textContent = records.length
    ? `${records.length} ${records.length === 1 ? "session" : "sessions"} · ${formatDuration(totals.get(selectedDay) ?? 0)} studied`
    : "Every little step counts.";
  if (!records.length) {
    const future = selectedDay > dayKey(current);
    $("#day-records").innerHTML =
      `<div class="empty-records"><span class="empty-icon">${icon("book")}</span><div><h3>${future ? "A little progress is waiting for you" : "No study sessions on this day yet"}</h3><p>${selectedDay === dayKey(current) ? "Press “Start studying” to make a little progress today." : future ? "Focus on today. There is time to grow." : "Your next focused moment is a fresh start."}</p></div></div>`;
    return;
  }
  $("#day-records").innerHTML =
    `<div class="session-list">${records.map((session, index) => `<article class="session-row"><span class="session-icon${session.running ? " running" : ""}">${icon(session.running ? "book" : "check")}</span><div class="session-info"><h3>${session.running ? "Studying now" : "Focused study"}<span class="session-number">#${String(records.length - index).padStart(2, "0")}</span></h3><p>${timeLabel(session.clippedStart)} — ${session.running && session.clippedEnd < session.dayEnd ? "In progress" : session.clippedEnd === session.dayEnd ? "24:00" : timeLabel(session.clippedEnd)}</p></div><strong>${formatDuration(session.clippedEnd - session.clippedStart)}</strong><span class="session-state${session.running ? " active" : ""}">${session.running ? "In progress" : "Completed"}</span></article>`).join("")}</div>`;
}

let previousActive;
function render() {
  const current = Date.now();
  const totals = dailyTotals(state, current);
  const today = dayKey(current);
  const monday = weekStart(current);
  const weekTotal = [...totals]
    .filter(([key]) => key >= monday && key <= today)
    .reduce((sum, [, duration]) => sum + duration, 0);
  $("#header-date").textContent = new Date(current).toLocaleDateString(
    "en-US",
    { year: "numeric", month: "long", day: "numeric", weekday: "long" },
  );
  $("#stat-today").textContent = formatDuration(totals.get(today) ?? 0);
  $("#stat-week").textContent = formatDuration(weekTotal);
  $("#stat-days").textContent = [...totals.values()].filter(
    (value) => value > 0,
  ).length;
  $("#timer").textContent = formatClock(
    state.active ? current - state.active.startedAt : 0,
  );
  const active = Boolean(state.active);
  if (active !== previousActive) {
    previousActive = active;
    $(".timer-card").classList.toggle("is-running", active);
    $("#toggle-timer").innerHTML =
      `${icon(active ? "stop" : "play")}<span>${active ? "Stop & save" : "Start studying"}</span>`;
    $("#toggle-timer").setAttribute(
      "aria-label",
      active ? "Stop and save study session" : "Start studying",
    );
    $("#timer-status").innerHTML = active
      ? '<span class="live-dot"></span> Studying now · one moment at a time'
      : "Ready when you are";
    $("#timer-caption").textContent = active
      ? "A little effort now. A little growth ahead."
      : "A little uninterrupted time, just for you.";
    $("#timer-hint").textContent = active
      ? "Keeps running after you leave. Stop when you finish."
      : "Press start. Let everything else wait.";
  }
  renderCalendar(totals, current);
  renderRecords(totals, current);
}

async function toggleTimer() {
  if (!storageHealthy) return;
  // Web Locks serialize changes across tabs; re-read before every mutation.
  const update = () => {
    try {
      const fresh = readState();
      const current = Date.now();
      const next = fresh.active
        ? {
            ...fresh,
            active: null,
            sessions: [
              ...fresh.sessions,
              {
                ...fresh.active,
                endedAt: Math.max(current, fresh.active.startedAt),
              },
            ],
          }
        : { ...fresh, active: { id: crypto.randomUUID(), startedAt: current } };
      writeState(next);
      state = next;
      if (fresh.active) {
        selectedDay = dayKey(current);
        visibleMonth = {
          year: new Date(current).getFullYear(),
          month: new Date(current).getMonth(),
        };
        toast(
          `Session saved · ${formatDuration(current - fresh.active.startedAt)}`,
        );
      }
      render();
    } catch {
      setStorageError();
    }
  };
  $("#toggle-timer").disabled = true;
  try {
    if (navigator.locks) await navigator.locks.request(STORAGE_KEY, update);
    else update();
  } catch {
    toast("The timer could not be updated. Please try again.");
  } finally {
    $("#toggle-timer").disabled = !storageHealthy;
  }
}

$("#toggle-timer").addEventListener("click", toggleTimer);
$("#calendar-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-day]");
  if (!button) return;
  selectedDay = button.dataset.day;
  render();
  $(`[data-day="${selectedDay}"]`)?.focus({ preventScroll: true });
});
function changeMonth(direction) {
  const date = new Date(visibleMonth.year, visibleMonth.month + direction, 1);
  visibleMonth = { year: date.getFullYear(), month: date.getMonth() };
  render();
}
$("#previous-month").addEventListener("click", () => changeMonth(-1));
$("#next-month").addEventListener("click", () => changeMonth(1));
$("#go-today").addEventListener("click", () => {
  const date = new Date();
  selectedDay = dayKey(date);
  visibleMonth = { year: date.getFullYear(), month: date.getMonth() };
  render();
});
$("#export-records").addEventListener("click", () => {
  try {
    state = readState();
  } catch {
    setStorageError();
    return;
  }
  if (!state.sessions.length && !state.active) {
    toast("No study records yet. Finish a session to export your progress.");
    return;
  }
  const totals = dailyTotals(state);
  const rows = [
    "Date,Study seconds,Study duration",
    ...[...totals]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, value]) =>
          `${key},${Math.floor(value / 1000)},${formatDuration(value)}`,
      ),
  ];
  const blob = new Blob(["\uFEFF" + rows.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `study-journal-${dayKey(Date.now())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Your study records have been exported.");
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    state = readState();
    render();
  } catch {
    setStorageError();
  }
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    try {
      state = readState();
      render();
    } catch {
      setStorageError();
    }
  }
});
mountTasks($("#tasks-panel"));
if (!storageHealthy) setStorageError();
render();
setInterval(render, 1000);
