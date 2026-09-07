const DEVICE_KEY = "vetkonnect:device_id";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Stable per-browser/device identifier used for account binding. */
export function getDeviceId(): string {
  if (typeof window === "undefined" || !window.localStorage) {
    return "server";
  }

  const existing = window.localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;

  const created = randomId();
  window.localStorage.setItem(DEVICE_KEY, created);
  return created;
}
