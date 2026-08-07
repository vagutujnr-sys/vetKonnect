import { supabase } from "./supabaseClient";

const STORAGE_PREFIX = "vetconnect";

async function readFromSupabase<T>(key: string, fallback: T): Promise<T> {
  try {
    const { data, error } = await supabase.from("app_storage").select("value").eq("key", `${STORAGE_PREFIX}:${key}`).maybeSingle();

    if (error) {
      console.error("Supabase read failed", error.message);
      return fallback;
    }

    if (!data?.value) {
      return fallback;
    }

    return data.value as T;
  } catch (error) {
    console.error("Supabase unavailable", error);
    return fallback;
  }
}

async function writeToSupabase<T>(key: string, value: T): Promise<void> {
  try {
    const payload = { key: `${STORAGE_PREFIX}:${key}`, value };
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
  return readFromSupabase<T>(key, fallback);
}

export async function writePersisted<T>(key: string, value: T): Promise<void> {
  await writeToSupabase(key, value);
}

export const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));
