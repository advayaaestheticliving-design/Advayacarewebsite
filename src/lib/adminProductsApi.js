import { adminSupabase } from "./adminSupabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
const NETWORK_ERROR_MESSAGE = "Network interrupted. Check your internet connection and retry.";

function getFunctionUrl(functionName) {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
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

function isNetworkError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return (
    message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("err_")
    || message.includes("name not resolved")
    || message.includes("internet disconnected")
  );
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

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  const sessionExpiry = Number(session?.expires_at);
  const tokenExpiry = decodeJwtExpiryEpochSeconds(session?.access_token);
  const effectiveExpiry = Number.isFinite(sessionExpiry) ? sessionExpiry : tokenExpiry;
  const isTokenFresh =
    Boolean(session?.access_token)
    && Number.isFinite(effectiveExpiry) && effectiveExpiry - 30 > nowEpochSeconds;

  if (isTokenFresh && (await isAdminAccessTokenValid(session?.access_token))) {
    return session.access_token;
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
    refreshData?.session?.access_token
    && (await isAdminAccessTokenValid(refreshData.session.access_token))
  ) {
    return refreshData.session.access_token;
  }

  throw new Error("Admin session expired. Please sign in again from /admin.");
}

async function authorizedFetch(url, options = {}) {
  const execute = async () => {
    const authToken = await getAuthToken();
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

  const response = await execute();
  if (response.status === 401) {
    const body = await response.clone().json().catch(() => null);
    const details = String(body?.error || "").trim();
    throw new Error(
      details
        ? `Admin authorization failed (401): ${details}`
        : "Admin authorization failed (401). Please sign in again from /admin if this keeps happening."
    );
  }

  return response;
}

export async function listAdminProducts({ limit = 300, includeInactive = true } = {}) {
  const params = new URLSearchParams({
    limit: String(Number(limit) || 300),
    includeInactive: String(includeInactive),
  });

  const response = await authorizedFetch(`${getFunctionUrl("admin-products")}?${params.toString()}`, {
    method: "GET",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch products (${response.status})`);
  }

  return Array.isArray(body?.products) ? body.products : [];
}

export async function saveAdminProduct(productPayload = {}) {
  const response = await authorizedFetch(getFunctionUrl("admin-products"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "upsert",
      ...productPayload,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to save product (${response.status})`);
  }

  return body?.product || null;
}

export async function adjustAdminProductStock(productId, stockQuantity, notes = "") {
  const response = await authorizedFetch(getFunctionUrl("admin-products"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "adjust_stock",
      productId,
      stock_quantity: stockQuantity,
      notes,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to update stock (${response.status})`);
  }

  return body?.product || null;
}

export async function setAdminProductActive(productId, isActive) {
  const response = await authorizedFetch(getFunctionUrl("admin-products"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "set_active",
      productId,
      is_active: Boolean(isActive),
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to update product status (${response.status})`);
  }

  return body?.product || null;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read selected file"));
    reader.readAsDataURL(file);
  });
}

export async function uploadAdminProductImage(file, title = "") {
  if (!(file instanceof File)) {
    throw new Error("Select an image file to upload");
  }

  const base64Data = await toBase64(file);

  const response = await authorizedFetch(getFunctionUrl("admin-product-upload-image"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title,
      mimeType: file.type || "image/jpeg",
      base64Data,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Image upload failed (${response.status})`);
  }

  return {
    publicUrl: String(body?.publicUrl || ""),
    storagePath: String(body?.storagePath || ""),
  };
}
