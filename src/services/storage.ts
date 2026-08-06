import { supabase } from "./supabaseClient";

const STORAGE_PREFIX = "vetconnect";

async function readFromSupabase<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await supabase.from("app_storage").select("value").eq("key", `${STORAGE_PREFIX}:${key}`).maybeSingle();

    if (error) {
      console.warn("Supabase read failed, falling back to localStorage", error.message);
      return readLocal<T>(key, fallback);
    }

    if (!data?.value) {
      return fallback;
    }

    return data.value as T;
  } catch (error) {
    console.warn("Supabase unavailable, falling back to localStorage", error);
    return readLocal<T>(key, fallback);
  }
}

async function writeToSupabase<T>(key: string, value: T): Promise<void> {
  try {
    const payload = { key: `${STORAGE_PREFIX}:${key}`, value };
    const { error } = await supabase.from("app_storage").upsert(payload, { onConflict: "key" });
    if (error) {
      console.warn("Supabase write failed, using localStorage", error.message);
      writeLocal(key, value);
    }
  } catch (error) {
    console.warn("Supabase unavailable, using localStorage", error);
    writeLocal(key, value);
  }
}

export async function readLocal<T>(key: string, fallback: T): Promise<T> {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw) as T;
    }
  } catch {
    // ignore
  }

  return fallback;
}

export async function writeLocal<T>(key: string, value: T): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export async function readPersisted<T>(key: string, fallback: T): Promise<T> {
  return readFromSupabase<T>(key, fallback);
}

export async function writePersisted<T>(key: string, value: T): Promise<void> {
  await writeToSupabase(key, value);
}

export const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
