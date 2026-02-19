import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

function getFunctionUrl(functionName) {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

async function getAuthToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || SUPABASE_ANON_KEY;
}

export async function getMyOrdersWithTimeline() {
  const authToken = await getAuthToken();
  const response = await fetch(getFunctionUrl("member-orders"), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch member orders (${response.status})`);
  }

  return Array.isArray(body?.orders) ? body.orders : [];
}
