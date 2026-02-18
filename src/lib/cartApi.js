import { supabase, isSupabaseConfigured } from "./supabaseClient";

export function getOrCreateSessionId() {
  let sessionId = localStorage.getItem("ac_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("ac_session_id", sessionId);
  }
  return sessionId;
}

export async function createOrder(totalAmountInr, items, customerDetails = {}, discountDetails = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local and restart the dev server.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const normalizedCouponCode = String(discountDetails?.couponCode || "").trim().toUpperCase();
  const normalizedGiftCardCode = String(discountDetails?.giftCardCode || "").trim().toUpperCase();

  // eslint-disable-next-line no-console
  console.log("🛒 Creating order with customer details:", customerDetails);

  const orderItems = Array.isArray(items)
    ? items.map((item) => ({
        product_id: item.productId,
        name: item.name || "",
        quantity: Number(item.quantity) || 1,
        price_inr: Number(item.price_inr) || 0,
      }))
    : [];

  const baseOrderPayload = {
    customer_name: customerDetails.name || "",
    customer_address: customerDetails.address || "",
    customer_phone: customerDetails.phone || "",
    customer_email: customerDetails.email || "",
    customer_pin_code: customerDetails.pinCode || "",
    amount: Number(totalAmountInr) || 0,
    currency: "INR",
    status: "pending",
    items: orderItems,
    auth_user_id: user?.id ?? null,
    guest_session_id: user?.id ? null : getOrCreateSessionId(),
    coupon_code: normalizedCouponCode || null,
    gift_card_code: normalizedGiftCardCode || null,
    coupon_amount_inr: Number(discountDetails?.couponAmountInr || 0),
    gift_card_amount_inr: Number(discountDetails?.giftCardAmountInr || 0),
    discount_total_inr: Number(discountDetails?.totalDiscountInr || 0),
    discount_snapshot: discountDetails?.snapshot || {},
  };

  let order = null;
  let orderError = null;

  ({ data: order, error: orderError } = await supabase
    .from("orders")
    .insert(baseOrderPayload)
    .select("id")
    .single());

  if (orderError) {
    // Provide detailed logging to help diagnose 400 errors from PostgREST
    // eslint-disable-next-line no-console
    console.error("❌ Failed to create order - supabase error:", {
      message: orderError.message,
      status: orderError.status,
      statusText: orderError.statusText,
      code: orderError.code,
      hint: orderError.hint,
      details: orderError.details,
      fullError: orderError,
    });
    throw orderError;
  }

  return order;
}
