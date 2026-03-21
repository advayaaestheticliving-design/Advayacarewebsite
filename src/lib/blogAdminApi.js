import { adminSupabase } from "./adminSupabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
const NETWORK_ERROR_MESSAGE = "Network interrupted. Check your internet connection and retry.";

function getFunctionUrl(functionName) {
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

async function clearInvalidAdminSession() {
  await adminSupabase.auth.signOut({ scope: "local" }).catch(() => undefined);
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

    if (isJwtRejected(firstDetails)) {
      const {
        data: { session },
      } = await adminSupabase.auth.getSession();

      if (session?.refresh_token) {
        let refreshData = null;
        let refreshError = null;

        try {
          const refreshResult = await adminSupabase.auth.refreshSession();
          refreshData = refreshResult.data;
          refreshError = refreshResult.error;
        } catch (refreshException) {
          if (isNetworkError(refreshException)) {
            throw new Error(NETWORK_ERROR_MESSAGE);
          }
          throw refreshException;
        }

        if (!refreshError) {
          const refreshedAccessToken = String(refreshData?.session?.access_token || "").trim();
          response = await execute(refreshedAccessToken);
          if (response.status !== 401) {
            return response;
          }
        }
      }
    }

    const {
      data: { session },
    } = await adminSupabase.auth.getSession();

    if (!session?.refresh_token) {
      await clearInvalidAdminSession();
      throw new Error("Admin session expired. Please sign in again from /admin.");
    }

    let refreshError = null;
    let refreshData = null;
    try {
      const refreshResult = await adminSupabase.auth.refreshSession();
      refreshData = refreshResult.data;
      refreshError = refreshResult.error;
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

    const refreshedAccessToken = String(refreshData?.session?.access_token || "").trim();
    response = await execute(refreshedAccessToken);

    if (response.status === 401) {
      const finalBody = await response.clone().json().catch(() => null);
      const finalDetails = getAuthErrorDetails(finalBody);

      await clearInvalidAdminSession();

      if (isJwtRejected(finalDetails)) {
        throw new Error("Admin session expired. Please sign in again from /admin.");
      }

      throw new Error("Admin session expired. Please sign in again from /admin.");
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
  return {
    title: String(body?.title || ""),
    contentPlan: String(body?.contentPlan || ""),
  };
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

export async function generateBlogSeoMetadata(title, content, shortDescription = "") {
  const body = await invokeAdminBlog({
    action: "generate_metadata",
    title,
    content,
    shortDescription,
  });

  return {
    tags: Array.isArray(body?.tags) ? body.tags.join(", ") : "",
    seoTitle: String(body?.seoTitle || ""),
    seoDescription: String(body?.seoDescription || ""),
  };
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

export async function listBlogPosts({ limit = 60, includeArchived = true } = {}) {
  const body = await invokeAdminBlog({ action: "list_posts", limit, includeArchived });
  return Array.isArray(body?.posts) ? body.posts : [];
}

export async function updatePublishedBlog(payload) {
  const body = await invokeAdminBlog({ action: "update_post", ...payload });
  return body?.post || null;
}

export async function archivePublishedBlog(postId) {
  const body = await invokeAdminBlog({ action: "archive_post", postId });
  return body?.post || null;
}

export async function restorePublishedBlog(postId) {
  const body = await invokeAdminBlog({ action: "restore_post", postId });
  return body?.post || null;
}

export async function deletePublishedBlog(postId) {
  await invokeAdminBlog({ action: "delete_post", postId });
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
