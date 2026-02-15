import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getOrCreateSessionId } from "./cartApi";

const TOKEN_KEY = "ac_guest_access_token";

export async function ensureSupabaseGuestSession() {
  if (!isSupabaseConfigured || !supabase) {
    return;
  }

  const existingToken = localStorage.getItem(TOKEN_KEY);
  if (existingToken) {
    await supabase.auth.setSession({
      access_token: existingToken,
      refresh_token: "",
    });
    return;
  }

  const sessionId = getOrCreateSessionId();
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${baseUrl}/functions/v1/mint-guest-token`;

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

  // eslint-disable-next-line no-console
  console.log("mint-guest-token status", res.status, "body", body);

  if (!res.ok) {
    const msg =
      (body && (body.error || body.message)) ||
      `Failed to fetch guest token (status ${res.status})`;
    throw new Error(msg);
  }

  const accessToken = body?.access_token;
  if (!accessToken) {
    throw new Error("No access_token in mint-guest-token response");
  }

  localStorage.setItem(TOKEN_KEY, accessToken);

  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: "",
  });
}
