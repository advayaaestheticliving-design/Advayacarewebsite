import { authorizedAdminFetch, getAdminFunctionUrl } from "./adminOrdersApi";

function normalizeAdminComment(row = {}) {
  return {
    id: String(row.id || ""),
    target_type: String(row.target_type || "home"),
    product_id: row.product_id ? String(row.product_id) : "",
    display_name: String(row.display_name || "").trim(),
    city: String(row.city || "").trim(),
    headline: String(row.headline || "").trim(),
    body: String(row.body || "").trim(),
    rating: Number.isFinite(Number(row.rating)) ? Number(row.rating) : null,
    status: String(row.status || "pending"),
    moderation_notes: String(row.moderation_notes || "").trim(),
    moderated_by_email: String(row.moderated_by_email || "").trim(),
    moderated_at: String(row.moderated_at || ""),
    created_at: String(row.created_at || ""),
    product_name: String(row.product_name || "").trim(),
  };
}

export async function getAdminComments(filters = {}) {
  const searchParams = new URLSearchParams();

  if (filters.status && filters.status !== "all") {
    searchParams.set("status", String(filters.status));
  }

  if (filters.targetType && filters.targetType !== "all") {
    searchParams.set("targetType", String(filters.targetType));
  }

  if (filters.search) {
    searchParams.set("search", String(filters.search).trim());
  }

  searchParams.set("limit", String(Number(filters.limit) || 120));

  const response = await authorizedAdminFetch(`${getAdminFunctionUrl("admin-comments")}?${searchParams.toString()}`, {
    method: "GET",
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to fetch comments (${response.status})`);
  }

  return Array.isArray(body?.comments) ? body.comments.map((row) => normalizeAdminComment(row)) : [];
}

export async function updateAdminCommentStatus(commentId, status, moderationNotes = "") {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-comments"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      commentId,
      status,
      moderationNotes,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to update comment (${response.status})`);
  }

  return normalizeAdminComment(body?.comment || {});
}

export async function createAdminComment(payload = {}) {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-comments"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create",
      ...payload,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Failed to create comment (${response.status})`);
  }

  return normalizeAdminComment(body?.comment || {});
}