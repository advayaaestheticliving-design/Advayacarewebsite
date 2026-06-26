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
  const code = String(error?.code || "").trim();

  // Log the real error so it's visible in DevTools — helps diagnose RLS vs session issues.
  // eslint-disable-next-line no-console
  console.error("[commentsApi] insert error:", { code, message, error });

  if (!message) {
    return fallbackMessage;
  }

  // Don't mask RLS violations as a sign-in prompt — show a permission error instead.
  if (message.toLowerCase().includes("row-level security") || code === "42501") {
    return "Submission blocked by a database permission error. Please contact support if this keeps happening.";
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

/**
 * Resolves a valid Supabase session.
 *
 * Accepts an optional `accessToken` that callers (e.g. React components that
 * already hold a session via MemberSessionContext) can pass directly, avoiding
 * a redundant and potentially-stale getSession() round-trip.
 *
 * Falls back to getSession() → refreshSession() for non-React callers.
 */
async function getRequiredMemberSession(accessToken = null) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Comments are unavailable until Supabase is configured.");
  }

  // Fast path: caller passed an access token directly from context.
  if (accessToken) {
    // Decode user id from the JWT payload (no network call needed).
    try {
      const payloadBase64 = accessToken.split(".")[1];
      const payloadJson = atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/"));
      const payload = JSON.parse(payloadJson);
      const userId = payload.sub;
      if (userId) {
        return { user: { id: userId }, access_token: accessToken };
      }
    } catch {
      // Fall through to getSession() if JWT decode fails.
    }
  }

  // Slow path: resolve session from Supabase client's local storage.
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();

  // eslint-disable-next-line no-console
  console.log("[commentsApi] getSession result:", { userId: session?.user?.id ?? null, sessionError });

  // If getSession() returns nothing, attempt a token refresh before giving up.
  if (!session?.user?.id) {
    // eslint-disable-next-line no-console
    console.log("[commentsApi] no session from getSession, attempting refreshSession...");
    const refreshResult = await supabase.auth.refreshSession().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn("[commentsApi] refreshSession failed:", err);
      return { data: { session: null } };
    });
    session = refreshResult?.data?.session ?? null;
    // eslint-disable-next-line no-console
    console.log("[commentsApi] refreshSession result userId:", session?.user?.id ?? null);
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

/**
 * @param {object} payload - comment fields
 * @param {string} [accessToken] - JWT from MemberSessionContext (optional but recommended)
 */
export async function createHomeTestimonial(payload = {}, accessToken) {
  const session = await getRequiredMemberSession(accessToken);
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

/**
 * @param {string} productId
 * @param {object} payload - comment fields
 * @param {string} [accessToken] - JWT from MemberSessionContext (optional but recommended)
 */
export async function createProductComment(productId, payload = {}, accessToken) {
  const normalizedProductId = normalizeText(productId, 120);
  if (!normalizedProductId) {
    throw new Error("This product comment could not be linked to a product.");
  }

  const session = await getRequiredMemberSession(accessToken);
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