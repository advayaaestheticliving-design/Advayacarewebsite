import { supabase, isSupabaseConfigured } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Generate a unique coupon code
 */
function generateCouponCode() {
  const prefix = "ADM";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Generate coupons for specific members
 */
export async function generateCouponsForMembers({ memberEmails = [], amountInr = 100, expiryDays = 30, reason = "admin_generated" }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  try {
    // Get auth session for authorization
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error("Authentication required");
    }

    const token = session.access_token;

    // Prepare coupon data
    const coupons = memberEmails.map(email => ({
      code: generateCouponCode(),
      amount_inr: amountInr,
      status: "active",
      issued_reason: reason,
      expires_at: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
      member_email: email,
    }));

    // Call admin function to create coupons
    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-generate-coupons`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        coupons,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error || `Coupon generation failed (${response.status})`);
    }

    return body;
  } catch (error) {
    console.error("❌ Generate coupons error:", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Generate a single coupon for a member
 */
export async function generateCouponForMember({ memberEmail, amountInr = 100, expiryDays = 30, reason = "admin_generated" }) {
  return generateCouponsForMembers({
    memberEmails: [memberEmail],
    amountInr,
    expiryDays,
    reason,
  });
}

/**
 * Disable a coupon
 */
export async function disableCoupon({ couponCode }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error("Authentication required");
    }

    const token = session.access_token;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/admin-disable-coupon`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        couponCode,
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(body?.error || `Disable coupon failed (${response.status})`);
    }

    return body;
  } catch (error) {
    console.error("❌ Disable coupon error:", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * List all member coupons with pagination
 */
export async function listMemberCoupons({ limit = 50, offset = 0, status = null }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error("Authentication required");
    }

    let query = supabase
      .from("member_coupons")
      .select("id, auth_user_id, code, amount_inr, status, issued_reason, expires_at, issued_at, consumed_at", {
        count: "exact",
      })
      .order("issued_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      coupons: data || [],
      total: count || 0,
      limit,
      offset,
    };
  } catch (error) {
    console.error("❌ List coupons error:", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

/**
 * Search coupons by code or member email
 */
export async function searchCoupons({ query }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error("Authentication required");
    }

    // Search by code
    const { data, error } = await supabase
      .from("member_coupons")
      .select("id, auth_user_id, code, amount_inr, status, issued_reason, expires_at, issued_at, consumed_at")
      .ilike("code", `%${query}%`)
      .limit(20);

    if (error) {
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("❌ Search coupons error:", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}
