import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getOrCreateSessionId } from "./cartApi";

const TOKEN_KEY = "ac_guest_access_token";
let guestBootstrapPromise = null;
let guestBootstrapDisabled = false;

export function getStoredGuestAccessToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function hasAuthenticatedMemberSession(session) {
  return Boolean(session?.user?.id && String(session?.refresh_token || "").trim());
}

function hasGuestLikeSession(session) {
  return Boolean(session?.access_token && !hasAuthenticatedMemberSession(session));
}

export async function clearLegacyGuestAuthState() {
  localStorage.removeItem(TOKEN_KEY);
  guestBootstrapPromise = null;
  guestBootstrapDisabled = false;

  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (hasGuestLikeSession(session)) {
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
  }
}

export async function ensureSupabaseGuestSession() {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  if (guestBootstrapDisabled) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (hasAuthenticatedMemberSession(session)) {
    localStorage.removeItem(TOKEN_KEY);
    guestBootstrapPromise = null;
    return;
  }

  const existingToken = localStorage.getItem(TOKEN_KEY);
  if (existingToken) {
    return existingToken;
  }

  if (guestBootstrapPromise) {
    return guestBootstrapPromise;
  }

  const sessionId = getOrCreateSessionId();
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${baseUrl}/functions/v1/mint-guest-token`;

  guestBootstrapPromise = (async () => {
    let res;
    let body;

    try {
      res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      body = await res.json().catch(() => null);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("ensureSupabaseGuestSession network error", err);
      throw err;
    }

    if (!res.ok) {
      const errorMessage =
        (body && (body.error || body.message)) ||
        `Failed to fetch guest token (status ${res.status})`;

      if (res.status >= 500 && errorMessage.toLowerCase().includes("jwt secret")) {
        guestBootstrapDisabled = true;
        // eslint-disable-next-line no-console
        console.warn("Guest session bootstrap disabled because mint-guest-token is misconfigured.");
        return null;
      }

      throw new Error(errorMessage);
    }

    const accessToken = body?.access_token;
    if (!accessToken) {
      throw new Error("No access_token in mint-guest-token response");
    }

    localStorage.setItem(TOKEN_KEY, accessToken);
    return accessToken;
  })();

  try {
    return await guestBootstrapPromise;
  } finally {
    guestBootstrapPromise = null;
  }
}
