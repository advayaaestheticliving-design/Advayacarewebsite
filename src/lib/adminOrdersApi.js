import { adminSupabase } from "./adminSupabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
const NETWORK_ERROR_MESSAGE = "Network interrupted. Check your internet connection and retry.";

export function getAdminEmail() {
  return ADMIN_EMAIL;
}

export function getAdminFunctionUrl(functionName) {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

function getSupabaseProjectRef() {
  const match = String(SUPABASE_URL || "").match(/^https:\/\/([a-z0-9-]+)\.supabase\.co$/i);
  return match ? String(match[1] || "").toLowerCase() : "";
}

function decodeJwtExpiryEpochSeconds(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    const payloadText = atob(padded);
    const payload = JSON.parse(payloadText);
    const exp = Number(payload?.exp);
    return Number.isFinite(exp) ? exp : null;
  } catch {
    return null;
  }
}

function decodeJwtPayload(accessToken) {
  const token = String(accessToken || "").trim();
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function isJwtStructurallyValidForProject(accessToken) {
  const payload = decodeJwtPayload(accessToken);
  if (!payload) return false;

  const iss = String(payload?.iss || "").trim().toLowerCase();
  const projectRef = getSupabaseProjectRef();
  if (!projectRef) return true;

  return iss.includes(`${projectRef}.supabase.co/auth/v1`);
}

function isNetworkError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("err_") ||
    message.includes("name not resolved") ||
    message.includes("internet disconnected")
  );
}

function getAuthErrorDetails(body) {
  const details = String(body?.error || body?.message || "").trim();
  if (details) return details;

  const code = Number(body?.code);
  if (Number.isFinite(code) && code > 0) {
    return `code ${code}`;
  }

  return "";
}

function isJwtRejected(details) {
  const text = String(details || "").toLowerCase();
  return text.includes("invalid jwt") || text.includes("token is malformed");
}

async function isAdminAccessTokenValid(accessToken) {
  const token = String(accessToken || "").trim();
  if (!token) return false;

  let user = null;
  let error = null;

  try {
    const { data, error: getUserError } = await adminSupabase.auth.getUser(token);
    user = data?.user || null;
    error = getUserError;
  } catch (getUserError) {
    if (isNetworkError(getUserError)) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw getUserError;
  }

  if (error || !user?.email) {
    return false;
  }

  return String(user.email).trim().toLowerCase() === ADMIN_EMAIL;
}

async function getAuthToken() {
  const {
    data: { session },
  } = await adminSupabase.auth.getSession();

  const accessToken = String(session?.access_token || "").trim();

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  const sessionExpiry = Number(session?.expires_at);
  const tokenExpiry = decodeJwtExpiryEpochSeconds(accessToken);
  const effectiveExpiry = Number.isFinite(sessionExpiry) ? sessionExpiry : tokenExpiry;
  const isTokenStructurallyValid = isJwtStructurallyValidForProject(accessToken);
  const isTokenFresh =
    Boolean(accessToken) &&
    isTokenStructurallyValid &&
    Number.isFinite(effectiveExpiry) && effectiveExpiry - 30 > nowEpochSeconds;

  if (isTokenFresh && (await isAdminAccessTokenValid(accessToken))) {
    return accessToken;
  }

  if (!session?.refresh_token) {
    throw new Error("Admin session expired. Please sign in again from /admin.");
  }

  let refreshData = null;
  let refreshError = null;

  try {
    const { data, error } = await adminSupabase.auth.refreshSession();
    refreshData = data;
    refreshError = error;
  } catch (refreshException) {
    if (isNetworkError(refreshException)) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw refreshException;
  }

  if (refreshError) {
    if (isNetworkError(refreshError)) {
      throw new Error(NETWORK_ERROR_MESSAGE);
    }
    throw new Error("Admin session expired. Please sign in again from /admin.");
  }

  if (
    refreshData?.session?.access_token &&
    (await isAdminAccessTokenValid(refreshData.session.access_token))
  ) {
    return refreshData.session.access_token;
  }

  throw new Error("Admin session expired. Please sign in again from /admin.");
}

export async function authorizedAdminFetch(url, options = {}) {
  const execute = async (authTokenOverride = "") => {
    const authToken = String(authTokenOverride || "").trim() || (await getAuthToken());
    try {
      const baseHeaders = {
        ...(options.headers || {}),
        Authorization: `Bearer ${authToken}`,
      };

      const headers = SUPABASE_ANON_KEY
        ? { ...baseHeaders, apikey: SUPABASE_ANON_KEY }
        : baseHeaders;

      return await fetch(url, {
        ...options,
        headers,
      });
    } catch (fetchError) {
      if (isNetworkError(fetchError)) {
        throw new Error(NETWORK_ERROR_MESSAGE);
      }
      throw fetchError;
    }
  };

  let response = await execute();
  if (response.status === 401) {
    const firstBody = await response.clone().json().catch(() => null);
    const firstDetails = getAuthErrorDetails(firstBody);

    // Recover once when an edge gateway rejects a stale/rotated JWT.
    if (isJwtRejected(firstDetails)) {
      const {
        data: { session },
      } = await adminSupabase.auth.getSession();

      if (session?.refresh_token) {
        const { data: refreshData, error: refreshError } = await adminSupabase.auth.refreshSession();

        if (!refreshError) {
          const refreshedAccessToken = String(refreshData?.session?.access_token || "").trim();
          response = await execute(refreshedAccessToken);
          if (response.status !== 401) {
            return response;
          }
        }
      }
    }

    const finalBody = await response.clone().json().catch(() => null);
    const finalDetails = getAuthErrorDetails(finalBody);

    throw new Error(
      finalDetails
        ? `Admin authorization failed (401): ${finalDetails}`
        : "Admin authorization failed (401). Please sign in again from /admin if this keeps happening."
    );
  }

  return response;
}

export async function isCurrentUserAdmin() {
  const {
    data: { session },
  } = await adminSupabase.auth.getSession();

  const sessionEmail = String(session?.user?.email || "").trim().toLowerCase();
  if (sessionEmail) {
    return sessionEmail === ADMIN_EMAIL;
  }

  const {
    data: { user },
  } = await adminSupabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAIL) {
    return false;
  }

  return String(user.email).trim().toLowerCase() === ADMIN_EMAIL;
}

export async function sendAdminOtpCode() {
  const { data, error } = await adminSupabase.auth.signInWithOtp({
    email: ADMIN_EMAIL,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: "https://advayacare.com/admin",
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function verifyAdminOtpCode(token) {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    throw new Error("Enter the OTP code from your email");
  }

  // Start from a clean local auth state so a stale token cannot survive OTP login.
  await adminSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);

  const { data, error } = await adminSupabase.auth.verifyOtp({
    email: ADMIN_EMAIL,
    token: normalizedToken,
    type: "email",
  });

  if (error) {
    throw error;
  }

  const sessionAccessToken = String(data?.session?.access_token || "").trim();
  let effectiveAccessToken = sessionAccessToken;

  if (!effectiveAccessToken) {
    const {
      data: { session },
    } = await adminSupabase.auth.getSession();
    effectiveAccessToken = String(session?.access_token || "").trim();
  }

  if (!effectiveAccessToken) {
    throw new Error("Could not establish admin session. Please request a new OTP and try again.");
  }

  const tokenLooksValid = isJwtStructurallyValidForProject(effectiveAccessToken);
  const tokenBelongsToAdmin = await isAdminAccessTokenValid(effectiveAccessToken);
  if (!tokenLooksValid || !tokenBelongsToAdmin) {
    await adminSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    throw new Error("Admin session setup failed. Please request a new OTP and sign in again.");
  }

  return data;
}

export async function signOutAdmin() {
  const { error } = await adminSupabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getAdminOrders(limit = 120) {
  const response = await authorizedAdminFetch(`${getAdminFunctionUrl("admin-orders")}?limit=${Number(limit) || 120}`, {
    method: "GET",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch admin orders (${response.status})`);
  }

  return Array.isArray(body?.orders) ? body.orders : [];
}

export async function updateAdminOrderStatus(orderId, fulfillmentStatus, notes = "") {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-orders"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId,
      fulfillmentStatus,
      notes,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to update order status (${response.status})`);
  }

  return body?.order || null;
}
