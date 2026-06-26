import { supabase, isSupabaseConfigured } from "./supabaseClient";

const COMMENT_COLUMNS = [
  "id",
  "target_type",
  "product_id",
  "auth_user_id",
  "display_name",
  "city",
  "headline",
  "body",
  "rating",
  "status",
  "created_at",
].join(",");

function normalizeText(value, maxLength = 0) {
  const normalized = String(value || "").trim().replace(/\s+/g, " ");
  if (!maxLength || normalized.length <= maxLength) {
    return normalized;
  }
  return normalized.slice(0, maxLength).trim();
}

function formatErrorMessage(error, fallbackMessage) {
  const message = String(error?.message || "").trim();
  if (!message) {
    return fallbackMessage;
  }

  if (message.toLowerCase().includes("row-level security")) {
    return "Please sign in with your member account to submit your comment.";
  }

  return message;
}

function normalizeComment(row = {}) {
  return {
    id: String(row.id || ""),
    targetType: String(row.target_type || "home"),
    productId: row.product_id ? String(row.product_id) : "",
    authUserId: String(row.auth_user_id || ""),
    displayName: normalizeText(row.display_name, 80),
    city: normalizeText(row.city, 80),
    headline: normalizeText(row.headline, 120),
    body: normalizeText(row.body, 1200),
    rating: Number.isFinite(Number(row.rating)) ? Number(row.rating) : null,
    status: String(row.status || "pending"),
    createdAt: String(row.created_at || ""),
  };
}

function validatePayload(targetType, payload = {}) {
  const displayName = normalizeText(payload.displayName, 80);
  const city = normalizeText(payload.city, 80);
  const headline = normalizeText(payload.headline, 120);
  const body = normalizeText(payload.body, 1200);
  const parsedRating = Number(payload.rating);
  const rating = Number.isInteger(parsedRating) ? parsedRating : null;

  if (displayName.length < 2) {
    throw new Error("Enter the name you want shown with your comment.");
  }

  if (body.length < 20) {
    throw new Error("Write at least 20 characters so your comment feels useful.");
  }

  if (targetType === "product" && !(rating >= 1 && rating <= 5)) {
    throw new Error("Choose a rating between 1 and 5 stars.");
  }

  return {
    display_name: displayName,
    city,
    headline,
    body,
    rating: targetType === "product" ? rating : null,
  };
}

async function getRequiredMemberSession() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Comments are unavailable until Supabase is configured.");
  }

  let { data: { session } } = await supabase.auth.getSession();

  // If getSession() returns nothing (e.g. after a Google OAuth redirect where
  // the token hasn't fully persisted yet), attempt a refresh before giving up.
  if (!session?.user?.id) {
    const refreshResult = await supabase.auth.refreshSession().catch(() => ({ data: { session: null } }));
    session = refreshResult?.data?.session ?? null;
  }

  if (!session?.user?.id) {
    throw new Error("Please sign in with your member account to submit your comment.");
  }

  return session;
}

export async function listHomeTestimonials(limit = 6) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 12);
  const { data, error } = await supabase
    .from("member_comments")
    .select(COMMENT_COLUMNS)
    .eq("target_type", "home")
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((row) => normalizeComment(row));
}

export async function listProductComments(productId, limit = 20) {
  const normalizedProductId = normalizeText(productId, 120);
  if (!normalizedProductId || !isSupabaseConfigured || !supabase) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
  const { data, error } = await supabase
    .from("member_comments")
    .select(COMMENT_COLUMNS)
    .eq("target_type", "product")
    .eq("product_id", normalizedProductId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.map((row) => normalizeComment(row));
}

export async function createHomeTestimonial(payload = {}) {
  const session = await getRequiredMemberSession();
  const normalized = validatePayload("home", payload);

  const { data, error } = await supabase
    .from("member_comments")
    .insert({
      target_type: "home",
      auth_user_id: session.user.id,
      ...normalized,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(formatErrorMessage(error, "Could not submit your testimonial right now."));
  }

  return normalizeComment(data);
}

export async function createProductComment(productId, payload = {}) {
  const normalizedProductId = normalizeText(productId, 120);
  if (!normalizedProductId) {
    throw new Error("This product comment could not be linked to a product.");
  }

  const session = await getRequiredMemberSession();
  const normalized = validatePayload("product", payload);

  const { data, error } = await supabase
    .from("member_comments")
    .insert({
      target_type: "product",
      product_id: normalizedProductId,
      auth_user_id: session.user.id,
      ...normalized,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (error || !data) {
    throw new Error(formatErrorMessage(error, "Could not submit your review right now."));
  }

  return normalizeComment(data);
}