import { supabase } from "./supabaseClient";

const STORAGE_PREFIX = "vetconnect";

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}:${key}`;
}

function readFromLocalStorage<T>(key: string): T | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(key));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeToLocalStorage<T>(key: string, value: T): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(getStorageKey(key), JSON.stringify(value));
}

async function readFromSupabase<T>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase.from("app_storage").select("value").eq("key", getStorageKey(key)).maybeSingle();

    if (error) {
      console.error("Supabase read failed", error.message);
      return null;
    }

    if (!data?.value) {
      return null;
    }

    return data.value as T;
  } catch (error) {
    console.error("Supabase unavailable", error);
    return null;
  }
}

async function writeToSupabase<T>(key: string, value: T): Promise<void> {
  try {
    const payload = { key: getStorageKey(key), value };
    const { error } = await supabase.from("app_storage").upsert(payload, { onConflict: "key" });
    if (error) {
      console.error("Supabase write failed", error.message);
      throw error;
    }
  } catch (error) {
    console.error("Supabase unavailable", error);
    throw error;
  }
}

export async function readPersisted<T>(key: string, fallback: T): Promise<T> {
  const localValue = readFromLocalStorage<T>(key);
  if (localValue !== null) {
    return localValue;
  }

  const remoteValue = await readFromSupabase<T>(key);
  if (remoteValue !== null) {
    writeToLocalStorage(key, remoteValue);
    return remoteValue;
  }

  return fallback;
}

export async function writePersisted<T>(key: string, value: T): Promise<void> {
  writeToLocalStorage(key, value);

  try {
    await writeToSupabase(key, value);
  } catch {
    // Keep local persistence working even if Supabase is temporarily unavailable.
  }
}

export const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
