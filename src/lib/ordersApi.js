import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MEMBER_SESSION_EXPIRED_MESSAGE = "Member session expired. Please sign in again from /membership.";

function getFunctionUrl(functionName) {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

async function getAuthToken({ forceRefresh = false } = {}) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const currentToken = String(session?.access_token || "").trim();

  if (currentToken && !forceRefresh) {
    return currentToken;
  }

  if (session?.refresh_token) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    const refreshedToken = String(refreshData?.session?.access_token || "").trim();

    if (!refreshError && refreshedToken) {
      return refreshedToken;
    }

    if (forceRefresh) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw new Error(MEMBER_SESSION_EXPIRED_MESSAGE);
    }
  }

  if (currentToken) {
    return currentToken;
  }

  throw new Error(MEMBER_SESSION_EXPIRED_MESSAGE);
}

export async function getMyOrdersWithTimeline() {
  const executeFetch = async (authToken) =>
    fetch(getFunctionUrl("member-orders"), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
    });

  let authToken = await getAuthToken();
  let response = await executeFetch(authToken);
  let body = await response.clone().json().catch(() => null);

  if (response.status === 401) {
    authToken = await getAuthToken({ forceRefresh: true });
    response = await executeFetch(authToken);
    body = await response.clone().json().catch(() => null);

    if (response.status === 401) {
      const details = String(body?.error || "").toLowerCase();
      const tokenRejected =
        details.includes("invalid") ||
        details.includes("expired") ||
        details.includes("jwt") ||
        details.includes("authorization");

      if (tokenRejected) {
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        throw new Error(MEMBER_SESSION_EXPIRED_MESSAGE);
      }
    }
  }

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch member orders (${response.status})`);
  }

  return Array.isArray(body?.orders) ? body.orders : [];
}
