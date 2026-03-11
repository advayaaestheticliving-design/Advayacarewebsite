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
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("err_") ||
    message.includes("name not resolved") ||
    message.includes("internet disconnected")
  );
}

async function clearInvalidAdminSession() {
  await adminSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);
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
    Boolean(session?.access_token) &&
    Number.isFinite(effectiveExpiry) && effectiveExpiry - 30 > nowEpochSeconds;

  if (isTokenFresh && (await isAdminAccessTokenValid(session?.access_token))) {
    return session.access_token;
  }

  if (!session?.refresh_token) {
    await clearInvalidAdminSession();
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
    await clearInvalidAdminSession();
    throw new Error("Admin session expired. Please sign in again from /admin.");
  }

  if (
    refreshData?.session?.access_token &&
    (await isAdminAccessTokenValid(refreshData.session.access_token))
  ) {
    return refreshData.session.access_token;
  }

  await clearInvalidAdminSession();
  throw new Error("Admin session expired. Please sign in again from /admin.");
}

async function authorizedFetch(url, options = {}) {
  const execute = async () => {
    const authToken = await getAuthToken();
    try {
      return await fetch(url, {
        ...options,
        headers: {
          ...(options.headers || {}),
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${authToken}`,
        },
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
    const {
      data: { session },
    } = await adminSupabase.auth.getSession();

    if (!session?.refresh_token) {
      throw new Error("Admin session expired. Please sign in again from /admin.");
    }

    let refreshError = null;
    try {
      ({ error: refreshError } = await adminSupabase.auth.refreshSession());
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
      await clearInvalidAdminSession();
      throw new Error("Admin session expired. Please sign in again from /admin.");
    }

    response = await execute();

    if (response.status === 401) {
      throw new Error("Admin authorization failed (401). Please retry once from /admin/blogwriter.");
    }
  }

  return response;
}

async function invokeAdminBlog(payload) {
  const response = await authorizedFetch(getFunctionUrl("admin-blog"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Blog action failed (${response.status})`);
  }

  return body;
}

export async function generateBlogTitle(contentPlan = "") {
  const body = await invokeAdminBlog({ action: "generate_title", contentPlan });
  return String(body?.title || "");
}

export async function generateBlogContent(title, contentPlan = "") {
  const body = await invokeAdminBlog({ action: "generate_content", title, contentPlan });
  return String(body?.content || "");
}

export async function generateBlogShortDescription(title, content) {
  const body = await invokeAdminBlog({ action: "generate_description", title, content });
  return String(body?.shortDescription || "");
}

export async function generateBlogImageSearchTerms(title, content) {
  const body = await invokeAdminBlog({ action: "generate_image_terms", title, content });
  return Array.isArray(body?.terms) ? body.terms.join(", ") : "";
}

export async function saveBlogDraft(payload) {
  const body = await invokeAdminBlog({ action: "save_draft", ...payload });
  return body?.draft || null;
}

export async function publishBlog(payload) {
  const body = await invokeAdminBlog({ action: "publish", ...payload });
  return body?.post || null;
}

export async function listBlogDrafts(limit = 20) {
  const body = await invokeAdminBlog({ action: "list_drafts", limit });
  return Array.isArray(body?.drafts) ? body.drafts : [];
}

export async function deleteBlogDraft(draftId) {
  await invokeAdminBlog({ action: "delete_draft", draftId });
}

export async function uploadBlogImageFromUrl(imageUrl, title = "") {
  const response = await authorizedFetch(getFunctionUrl("admin-blog-upload-image"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl, title }),
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
