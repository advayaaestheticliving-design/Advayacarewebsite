import { authorizedAdminFetch, getAdminFunctionUrl } from "./adminOrdersApi";

async function invokeAdminBlog(payload) {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-blog"), {
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
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-blog-upload-image"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl, title }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("Upload failed with body:", body);
    throw new Error(body?.error || `Image upload failed (${response.status})`);
  }

  return {
    publicUrl: String(body?.publicUrl || ""),
    storagePath: String(body?.storagePath || ""),
  };
}
