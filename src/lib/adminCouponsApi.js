import { adminSupabase } from "./adminSupabaseClient";
import {
  createGeneralCoupon,
  updateGeneralCoupon,
  listAllGeneralCoupons,
} from "./generalCouponsApi";

// Re-export general coupon admin functions
export { createGeneralCoupon, updateGeneralCoupon, listAllGeneralCoupons };

/**
 * Issue a member_coupon to a specific user identified by email.
 * Uses adminSupabase which is authenticated as the admin user.
 */
export async function issueMemberCouponByEmail({
  email,
  amountInr,
  expiresAt = null,
  reason = "admin_issued",
}) {
  if (!adminSupabase) throw new Error("Supabase is not configured.");

  const trimmedEmail = String(email || "").trim().toLowerCase();
  if (!trimmedEmail) throw new Error("Email is required.");
  if (!amountInr || amountInr <= 0) throw new Error("Amount must be greater than 0.");

  // Look up the user by email in auth.users via the admin API
  // adminSupabase uses the anon key — we need the admin's own session token
  // to call the edge function or a service-role-backed lookup.
  // We use the admin-manage-general-coupons edge function with a new action.
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const { data: { session } } = await adminSupabase.auth.getSession();
  if (!session?.access_token) throw new Error("Admin authentication required.");

  const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-manage-general-coupons`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      action: "issue-member-coupon",
      email: trimmedEmail,
      amountInr: Number(amountInr),
      expiresAt: expiresAt || null,
      reason,
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error || `Failed to issue coupon (${response.status})`);
  }

  return body;
}

/**
 * List all member_coupons (admin view, all users).
 * Uses adminSupabase with the admin's auth session.
 */
export async function listMemberCoupons({ limit = 50, offset = 0 } = {}) {
  if (!adminSupabase) throw new Error("Supabase is not configured.");

  const { data, error, count } = await adminSupabase
    .from("member_coupons")
    .select("*", { count: "exact" })
    .order("issued_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return { coupons: data || [], total: count || 0 };
}

/**
 * Update a member_coupon status (e.g. revoke it).
 */
export async function updateMemberCoupon(couponId, updates) {
  if (!adminSupabase) throw new Error("Supabase is not configured.");

  const { data, error } = await adminSupabase
    .from("member_coupons")
    .update(updates)
    .eq("id", couponId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
