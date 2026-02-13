import { supabase } from "./supabaseClient";

export function getOrCreateSessionId() {
  let sessionId = localStorage.getItem("ac_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("ac_session_id", sessionId);
  }
  return sessionId;
}

export async function fetchCartItems() {
  const sessionId = getOrCreateSessionId();
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, product_id, quantity")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    productId: row.product_id,
    name: "",
    price_inr: 0,
    quantity: row.quantity ?? 1,
  }));
}

export async function addCartItem(productId, quantity = 1) {
  const sessionId = getOrCreateSessionId();
  const { data, error } = await supabase
    .from("cart_items")
    .insert({ product_id: productId, quantity, session_id: sessionId })
    .select("id, product_id, quantity").single();

  if (error) throw error;
  return data;
}

export async function updateCartItem(id, quantity) {
  const { data, error } = await supabase
    .from("cart_items")
    .update({ quantity })
    .eq("id", id)
    .select("id, product_id, quantity").single();

  if (error) throw error;
  return data;
}

export async function removeCartItem(id) {
  const { error } = await supabase.from("cart_items").delete().eq("id", id);
  if (error) throw error;
}

export async function clearCartRemote() {
  const sessionId = getOrCreateSessionId();
  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("session_id", sessionId);
  if (error) throw error;
}

export async function createOrder(totalAmountInr, items, customerDetails = {}) {
  // eslint-disable-next-line no-console
  console.log("🛒 Creating order with customer details:", customerDetails);

  const orderItems = Array.isArray(items)
    ? items.map((item) => ({
        productId: item.productId,
        name: item.name || "",
        quantity: Number(item.quantity) || 1,
        price_inr: Number(item.price_inr) || 0,
      }))
    : [];
  
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      customer_name: customerDetails.name || "",
      customer_email: customerDetails.email || "",
      customer_phone: customerDetails.phone || "",
      customer_address: customerDetails.address || "",
      customer_pin_code: customerDetails.pinCode || "",
      amount: totalAmountInr,
      currency: "INR",
      status: "pending",
      items: orderItems,
    })
    .select("id")
    .single();

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
