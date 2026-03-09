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

async function invokeAdminBlog(payload) {
  const authToken = await getAuthToken();
  const response = await fetch(getFunctionUrl("admin-blog"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
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
  const authToken = await getAuthToken();
  const response = await fetch(getFunctionUrl("admin-blog-upload-image"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
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
