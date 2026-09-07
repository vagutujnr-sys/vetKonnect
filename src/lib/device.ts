const DEVICE_KEY = "vetkonnect:device_id";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `dev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode / storage blocked — device binding may not persist.
  }
}

/** Stable per-browser/device identifier used for account binding. */
export function getDeviceId(): string {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = readStorage(DEVICE_KEY);
  if (existing) return existing;

  const created = randomId();
  writeStorage(DEVICE_KEY, created);
  return created;
}
