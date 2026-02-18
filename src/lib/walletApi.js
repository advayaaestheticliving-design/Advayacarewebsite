import { supabase, isSupabaseConfigured } from "./supabaseClient";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function getAuthTokenOrAnon() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token || SUPABASE_ANON_KEY;
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

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return { success: false, issued: false };
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/issue-signup-coupon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({}),
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error || `Could not issue signup coupon (${response.status})`);
  }

  return body;
}

export async function getMyCoupons() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("member_coupons")
    .select("id, code, amount_inr, status, issued_reason, expires_at, issued_at, consumed_at")
    .order("issued_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getMyGiftCards() {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("gift_cards")
    .select("id, code, initial_amount_inr, balance_amount_inr, status, owner_email, issued_to_name, expires_at, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}
