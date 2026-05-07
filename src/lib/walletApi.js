import { supabase, isSupabaseConfigured } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Get auth token from session or fallback to anon key
 */
async function getAuthTokenOrAnon() {
  try {
    // Refresh session to ensure token is current
    const { data: refreshData } = await supabase.auth.refreshSession();
    const token = refreshData?.session?.access_token;
    if (token) return token;
  } catch {
    // Continue to fallback
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || SUPABASE_ANON_KEY;
}

/**
 * Ensure user is authenticated and session is valid
 * Throws error if not authenticated
 */
async function ensureAuthenticated() {
  try {
    const { data: refreshData } = await supabase.auth.refreshSession();
    const session = refreshData?.session;
    
    if (!session?.user?.id) {
      throw new Error("User not authenticated");
    }
    
    return session.access_token;
  } catch (error) {
    throw new Error("Authentication required: " + (error instanceof Error ? error.message : "Unknown error"));
  }
}

export async function validateDiscounts({ subtotal = 0, couponCode = "", giftCardCode = "" }) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured.");
  }

  const token = await getAuthTokenOrAnon();

  const response = await fetch(`${SUPABASE_URL}/functions/v1/validate-discounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      subtotal: Number(subtotal) || 0,
      couponCode: String(couponCode || "").trim(),
      giftCardCode: String(giftCardCode || "").trim(),
    }),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Discount validation failed (${response.status})`);
  }

  return {
    subtotal: Number(body?.subtotal || 0),
    totalDiscount: Number(body?.totalDiscount || 0),
    payableAmount: Number(body?.payableAmount || 0),
    coupon: body?.coupon || { status: "not_applied", amountInr: 0, code: "" },
    giftCard: body?.giftCard || { status: "not_applied", amountInr: 0, code: "" },
  };
}

export async function ensureSignupCouponIssued() {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, issued: false };
  }

  try {
    const token = await ensureAuthenticated();

    const response = await fetch(`${SUPABASE_URL}/functions/v1/issue-signup-coupon`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("❌ Issue coupon error:", body?.error);
      return { success: false, issued: false, error: body?.error };
    }

    return body || { success: false, issued: false };
  } catch (error) {
    console.warn("⚠️ Signup coupon issue:", error instanceof Error ? error.message : "Unknown error");
    return { success: false, issued: false };
  }
}

export async function getMyCoupons() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    // Ensure session is fresh before querying
    await supabase.auth.refreshSession();

    const { data, error } = await supabase
      .from("member_coupons")
      .select("id, code, amount_inr, status, issued_reason, expires_at, issued_at, consumed_at")
      .order("issued_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching coupons:", error.message);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("❌ getMyCoupons error:", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}

export async function getMyGiftCards() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  try {
    // Ensure session is fresh before querying
    await supabase.auth.refreshSession();

    const { data, error } = await supabase
      .from("gift_cards")
      .select("id, code, initial_amount_inr, balance_amount_inr, status, owner_email, issued_to_name, expires_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching gift cards:", error.message);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("❌ getMyGiftCards error:", error instanceof Error ? error.message : "Unknown error");
    throw error;
  }
}
