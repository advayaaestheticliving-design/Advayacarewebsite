import { supabase, isSupabaseConfigured } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getAuthTokenOrAnon() {
  try {
    const { data: refreshData } = await supabase.auth.refreshSession();
    const token = refreshData?.session?.access_token;
    if (token) return token;
  } catch {
    // Continue to fallback
  }

  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || SUPABASE_ANON_KEY;
}

// Get all active general coupons
export async function getActiveGeneralCoupons() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase
    .from("general_coupons")
    .select("id, code, description, discount_type, fixed_amount_inr, percentage_discount, max_discount_inr, min_order_amount_inr, global_usage_limit, global_usage_count, per_member_usage_limit, all_orders, expires_at")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

// Validate and apply general coupon
export async function validateGeneralCoupon({ couponCode, subtotal, guestSessionId = null }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const token = await getAuthTokenOrAnon();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-general-coupon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      couponCode: String(couponCode || "").trim().toUpperCase(),
      subtotal: Number(subtotal) || 0,
      guestSessionId,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Coupon validation failed (${response.status})`);
  }

  return body;
}

// Record coupon usage
export async function recordGeneralCouponUsage({ couponCode, discountAmount, orderID = null, guestSessionId = null }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/record-general-coupon-usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
    },
    body: JSON.stringify({
      couponCode: String(couponCode || "").trim().toUpperCase(),
      discountAmount: Number(discountAmount) || 0,
      orderID,
      guestSessionId,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || "Failed to record coupon usage");
  }

  return body;
}

// Admin: Create general coupon
export async function createGeneralCoupon(couponData) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage-general-coupons`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      action: "create",
      coupon: couponData,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || "Failed to create coupon");
  }

  return body;
}

// Admin: Update general coupon
export async function updateGeneralCoupon(couponId, updates) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Authentication required");
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage-general-coupons`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      action: "update",
      couponId,
      updates,
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || "Failed to update coupon");
  }

  return body;
}

// Admin: List all general coupons
export async function listAllGeneralCoupons({ limit = 50, offset = 0 } = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Authentication required");
  }

  const { data, error, count } = await supabase
    .from("general_coupons")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw error;
  }

  return {
    coupons: data || [],
    total: count || 0,
  };
}
