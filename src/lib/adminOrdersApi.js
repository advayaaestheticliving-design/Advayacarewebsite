import { supabase } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";

export function getAdminEmail() {
  return ADMIN_EMAIL;
}

function getFunctionUrl(functionName) {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

async function getAuthToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  const isTokenFresh =
    Boolean(session?.access_token) &&
    (typeof session?.expires_at !== "number" || session.expires_at - 30 > nowEpochSeconds);

  if (isTokenFresh) {
    return session.access_token;
  }

  const { data: refreshData } = await supabase.auth.refreshSession();
  if (refreshData?.session?.access_token) {
    return refreshData.session.access_token;
  }

  throw new Error("Admin session expired. Please sign in again from /admin.");
}

export async function isCurrentUserAdmin() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email || !ADMIN_EMAIL) {
    return false;
  }

  return String(user.email).trim().toLowerCase() === ADMIN_EMAIL;
}

export async function sendAdminOtpCode() {
  const { data, error } = await supabase.auth.signInWithOtp({
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

  const { data, error } = await supabase.auth.verifyOtp({
    email: ADMIN_EMAIL,
    token: normalizedToken,
    type: "email",
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signOutAdmin() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function getAdminOrders(limit = 120) {
  const authToken = await getAuthToken();
  const response = await fetch(`${getFunctionUrl("admin-orders")}?limit=${Number(limit) || 120}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch admin orders (${response.status})`);
  }

  return Array.isArray(body?.orders) ? body.orders : [];
}

export async function updateAdminOrderStatus(orderId, fulfillmentStatus, notes = "") {
  const authToken = await getAuthToken();
  const response = await fetch(getFunctionUrl("admin-orders"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
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
