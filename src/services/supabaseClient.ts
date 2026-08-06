import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "https://zpsxiysnpkpkmetwqgwn.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpwc3hpeXNucGtwa21ldHdxZ3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzU2MTksImV4cCI6MjEwMDgxMTYxOX0.MnHPVb-yA666gGDYvXE20SR338AEkPUcLe1FI3VLfos";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  };
}
