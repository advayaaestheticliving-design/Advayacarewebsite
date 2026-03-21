import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const MEMBER_SESSION_EXPIRED_MESSAGE = "Member session expired. Please sign in again from /membership.";
const AUTH_RETRY_COOLDOWN_MS = 30000;
let lastMemberOrdersAuthFailureAt = 0;

function getFunctionUrl(functionName) {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

async function getAuthToken({ forceRefresh = false } = {}) {
  if (forceRefresh && Date.now() - lastMemberOrdersAuthFailureAt < AUTH_RETRY_COOLDOWN_MS) {
    throw new Error(MEMBER_SESSION_EXPIRED_MESSAGE);
  }

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
      lastMemberOrdersAuthFailureAt = Date.now();
      throw new Error(MEMBER_SESSION_EXPIRED_MESSAGE);
    }
  }

  if (currentToken) {
    return currentToken;
  }

  throw new Error(MEMBER_SESSION_EXPIRED_MESSAGE);
}

export async function getMyOrdersWithTimeline() {
  if (Date.now() - lastMemberOrdersAuthFailureAt < AUTH_RETRY_COOLDOWN_MS) {
    return [];
  }

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
        lastMemberOrdersAuthFailureAt = Date.now();
        return [];
      }
    }
  }

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch member orders (${response.status})`);
  }

  return Array.isArray(body?.orders) ? body.orders : [];
}
