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

const paths = {
  sprout:
    '<path d="M12 21V11m0 5C4 17 2 10 3 6c6-1 10 3 9 10Zm0-4C11 5 16 2 22 3c0 6-4 10-10 9Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
  chart: '<path d="M5 20V13m7 7V4m7 16V9"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  shield:
    '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  book: '<path d="M12 5c-3-2-7-2-10 0v15c3-2 7-2 10 0 3-2 7-2 10 0V5c-3-2-7-2-10 0Zm0 0v15"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
};
const icon = (name, className = "") =>
  `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
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
    <a href="./" class="brand" aria-label="拾光首页"><span class="brand-mark">${icon("sprout")}</span><span>拾光<span class="brand-en">STUDY JOURNAL</span></span></a>
    <div class="header-right"><span class="header-date" id="header-date"></span><span class="local-badge"><span></span> 你的私人学习空间</span></div>
  </header>
  <main class="page-shell">
    <section class="welcome" aria-labelledby="page-title">
      <div><p class="eyebrow"><span class="little-line"></span> A LITTLE EVERY DAY</p><h1 id="page-title">把时间，留给<span>成长。</span></h1><p class="welcome-copy">每一次专注都值得被记住。慢慢来，你一直在向前。</p></div>
      <div class="welcome-note">${icon("sun")}<span>不必一下子很厉害<br><strong>每天进步一点点，就很好。</strong></span></div>
    </section>

    <section class="stats-grid" aria-label="学习统计">
      <article class="stat-card"><span class="stat-icon">${icon("clock")}</span><div><p>今日学习</p><strong id="stat-today">0 秒</strong></div><span class="stat-tag">TODAY</span></article>
      <article class="stat-card"><span class="stat-icon">${icon("chart")}</span><div><p>本周累计</p><strong id="stat-week">0 秒</strong></div><span class="stat-tag">THIS WEEK</span></article>
      <article class="stat-card"><span class="stat-icon">${icon("sprout")}</span><div><p>累计学习天数</p><strong><span id="stat-days">0</span><small> 天</small></strong></div><span class="stat-tag">GROWING</span></article>
    </section>

    <div class="workspace-grid">
      <section class="timer-card" aria-labelledby="timer-title">
        <div class="card-heading"><h2 id="timer-title">${icon("clock")} 此刻，专注就好</h2><span class="session-label">FOCUS TIME</span></div>
        <div class="timer-stage">
          <div class="timer-halo" aria-hidden="true"><div class="halo-inner"></div><span class="halo-dot"></span></div>
          <div class="timer-content"><span class="timer-status" id="timer-status">准备好开始了吗</span><div class="timer-digits" id="timer" role="timer" aria-label="本次学习时长">00:00:00</div><p class="timer-caption" id="timer-caption">给自己一段不被打扰的时间</p></div>
        </div>
        <button type="button" class="timer-button" id="toggle-timer">${icon("play")}<span>开始学习</span></button>
        <p class="timer-hint" id="timer-hint">点击开始，让专注从这一刻发生</p>
        <div class="timer-bottom"><span class="mini-sprout">${icon("sprout")}</span><p>你投入的每一分钟，<br>都在悄悄成为未来的底气。</p><span class="bottom-spark" aria-hidden="true">✳</span></div>
      </section>

      <section class="calendar-card" aria-labelledby="calendar-title">
        <div class="card-heading"><h2 id="calendar-title">${icon("calendar")} 学习日历</h2><button class="text-button" id="go-today" type="button">回到今天</button></div>
        <div class="month-navigation"><h3 id="month-title"></h3><div class="month-controls"><button class="icon-button previous" id="previous-month" type="button" aria-label="上个月">${icon("arrow")}</button><button class="icon-button" id="next-month" type="button" aria-label="下个月">${icon("arrow")}</button></div></div>
        <div class="weekdays" aria-hidden="true"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span>日</span></div>
        <div id="calendar-grid" class="calendar-grid" role="group" aria-label="选择日期查看学习记录"></div>
        <div class="calendar-footer"><span><i class="today-key"></i> 今天</span><div class="heat-legend"><span>学习时长</span><span>少</span><i class="heat-0"></i><i class="heat-1"></i><i class="heat-2"></i><i class="heat-3"></i><i class="heat-4"></i><span>多</span></div></div>
      </section>
    </div>

    <section class="records-card" aria-labelledby="records-title">
      <div class="records-heading"><div><div class="records-title-line"><h2 id="records-title">这一天的足迹</h2><span id="selected-date" class="selected-date"></span></div><p id="day-summary" class="day-summary"></p></div><button type="button" class="export-button" id="export-records">${icon("download")} 导出记录</button></div>
      <div id="day-records"></div>
    </section>
    <div class="save-notice">${icon("shield")}<span>记录自动保存在当前浏览器，安心专注每一刻。<span class="notice-detail">换设备不会同步，记得偶尔导出备份。</span></span></div>
  </main>
  <footer class="site-footer"><span>拾光 · 让成长有迹可循</span><span>SMALL STEPS, EVERY DAY.</span></footer>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
  <div class="storage-error" id="storage-error" role="alert" hidden>无法读取或保存学习记录。请允许浏览器使用本地存储，并检查存储空间后刷新页面；已有记录不会被覆盖。</div>
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
  $("#month-title").innerHTML =
    `${year}<span>年</span> ${month + 1}<span>月</span>`;
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
      `<button type="button" class="calendar-day heat-${heatLevel(duration)}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${future ? " is-future" : ""}" data-day="${key}" aria-label="${month + 1}月${day}日，学习${formatDuration(duration)}${isToday ? "，今天" : ""}" aria-pressed="${isSelected}"${isToday ? ' aria-current="date"' : ""}><span class="day-number">${day}</span><span class="day-duration">${duration ? formatDuration(duration, true) : ""}</span>${isToday ? '<i class="today-dot"></i>' : ""}</button>`,
    );
  }
  $("#calendar-grid").innerHTML = markup.join("");
}

const timeLabel = (timestamp) =>
  new Date(timestamp).toLocaleTimeString("zh-CN", {
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
  $("#selected-date").textContent = date.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  $("#day-summary").textContent = records.length
    ? `${records.length} 次专注 · 共学习 ${formatDuration(totals.get(selectedDay) ?? 0)}`
    : "每一小步，都算数。";
  if (!records.length) {
    const future = selectedDay > dayKey(current);
    $("#day-records").innerHTML =
      `<div class="empty-records"><span class="empty-icon">${icon("book")}</span><div><h3>${future ? "未来的精彩，等待你来书写" : "这一天，还没有学习记录"}</h3><p>${selectedDay === dayKey(current) ? "点击「开始学习」，种下今天的第一颗进步种子。" : future ? "先把握当下，一点点积累属于你的成长。" : "日历会记住你的每一份努力，下一次专注就从今天开始。"}</p></div></div>`;
    return;
  }
  $("#day-records").innerHTML =
    `<div class="session-list">${records.map((session, index) => `<article class="session-row"><span class="session-icon${session.running ? " running" : ""}">${icon(session.running ? "book" : "check")}</span><div class="session-info"><h3>${session.running ? "正在专注" : "专注学习"}<span class="session-number">#${String(records.length - index).padStart(2, "0")}</span></h3><p>${timeLabel(session.clippedStart)} — ${session.running && session.clippedEnd < session.dayEnd ? "进行中" : session.clippedEnd === session.dayEnd ? "24:00" : timeLabel(session.clippedEnd)}</p></div><strong>${formatDuration(session.clippedEnd - session.clippedStart)}</strong><span class="session-state${session.running ? " active" : ""}">${session.running ? "进行中" : "已完成"}</span></article>`).join("")}</div>`;
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
    "zh-CN",
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
      `${icon(active ? "stop" : "play")}<span>${active ? "停止并保存" : "开始学习"}</span>`;
    $("#toggle-timer").setAttribute(
      "aria-label",
      active ? "停止并保存学习记录" : "开始学习",
    );
    $("#timer-status").innerHTML = active
      ? '<span class="live-dot"></span> 正在专注，慢慢积累'
      : "准备好开始了吗";
    $("#timer-caption").textContent = active
      ? "此刻的努力，都在为未来铺路"
      : "给自己一段不被打扰的时间";
    $("#timer-hint").textContent = active
      ? "刷新或关闭页面后仍会计时，结束时记得点击停止"
      : "点击开始，让专注从这一刻发生";
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
          `已保存本次学习记录 · ${formatDuration(current - fresh.active.startedAt)}`,
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
    toast("暂时无法开始计时，请稍后再试。");
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
    toast("还没有学习记录，完成第一次专注后就可以导出啦。");
    return;
  }
  const totals = dailyTotals(state);
  const rows = [
    "日期,学习秒数,学习时长",
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
  link.download = `拾光-学习记录-${dayKey(Date.now())}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("学习记录已导出，继续积累你的成长吧。");
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
if (!storageHealthy) setStorageError();
render();
setInterval(render, 1000);
