export const STORAGE_KEY = "shiguang.study.v1";

export function emptyState() {
  return { version: 1, active: null, sessions: [] };
}

function validStart(value) {
  return (
    value &&
    typeof value.id === "string" &&
    Number.isFinite(value.startedAt) &&
    value.startedAt >= 0 &&
    value.startedAt < 8640000000000000
  );
}

export function readState(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return emptyState();
  const state = JSON.parse(raw);
  if (
    state?.version !== 1 ||
    !Array.isArray(state.sessions) ||
    (state.active !== null && !validStart(state.active)) ||
    !state.sessions.every(
      (session) =>
        validStart(session) &&
        Number.isFinite(session.endedAt) &&
        session.endedAt >= session.startedAt &&
        session.endedAt < 8640000000000000,
    )
  ) {
    throw new Error("Invalid saved study data");
  }
  return state;
}

export function writeState(state, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
