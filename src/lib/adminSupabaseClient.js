import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isAdminSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isAdminSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn("Admin Supabase env vars are missing; configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const adminSupabase = isAdminSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: "ac_admin_auth",
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  : null;
