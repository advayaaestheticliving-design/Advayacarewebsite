import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function getAffiliateDashboardMetrics() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("You must be logged in to view the affiliate dashboard");
  }

  const url = `${SUPABASE_URL}/functions/v1/affiliate-dashboard`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    }
  });

  const body = await response.json().catch(() => null);

  if (response.status === 404) {
    return { metrics: null }; // Not an approved affiliate yet
  }

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch affiliate metrics (${response.status})`);
  }

  return body;
}
