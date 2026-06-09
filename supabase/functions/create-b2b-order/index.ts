import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  getServiceClient,
  jsonResponse,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  sha256,
  toNumber,
} from "../_shared/b2b.ts";

async function findQuote(token: string) {
  const supabase = getServiceClient();
  const { data: quote, error } = await supabase
    .from("b2b_quotes")
    .select("*, b2b_accounts(business_name), b2b_contacts(full_name, email, phone, whatsapp_phone)")
    .eq("token_hash", await sha256(token))
    .single();
  if (error || !quote) return { supabase, quote: null, error: "Quote not found" };
  if (new Date(quote.expires_at).getTime() <= Date.now() && quote.status !== "paid") {
    await supabase.from("b2b_quotes").update({ status: "expired" }).eq("id", quote.id);
    return { supabase, quote: null, error: "This quote has expired" };
  }
  if (!["approved", "sent", "viewed", "payment_pending", "paid"].includes(quote.status)) {
    return { supabase, quote: null, error: "This quote is not available for checkout" };
  }
  return { supabase, quote, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const token = normalizeText(body?.token, 200);
    const action = normalizeText(body?.action || "preview", 30);
    if (!token) return jsonResponse({ error: "Quote token is required." }, 400);
    const { supabase, quote, error } = await findQuote(token);
    if (error || !quote) return jsonResponse({ error: error || "Quote unavailable" }, 404);

    const items = Array.isArray(quote.items) ? quote.items : [];
    const subtotal = Math.round(items.reduce(
      (sum: number, item: any) =>
        sum + toNumber(item?.unit_price_inr) * Math.max(1, Math.floor(toNumber(item?.quantity, 1))),
      0
    ) * 100) / 100;
    const total = Math.max(0, Math.round(
      (subtotal + toNumber(quote.shipping_inr) - toNumber(quote.credit_inr)) * 100
    ) / 100);
    if (Math.abs(subtotal - toNumber(quote.subtotal_inr)) > 0.01 ||
        Math.abs(total - toNumber(quote.total_inr)) > 0.01) {
      return jsonResponse({ error: "Quote pricing validation failed." }, 409);
    }

    const productIds = items.map((item: any) => String(item.product_id || "")).filter(Boolean);
    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, stock_quantity, reserved_quantity, is_active")
      .in("id", productIds);
    if (productError) throw productError;
    const productMap = new Map((products || []).map((product: any) => [product.id, product]));
    for (const item of items) {
      const product: any = productMap.get(item.product_id);
      const available = toNumber(product?.stock_quantity) - toNumber(product?.reserved_quantity);
      if (!product?.is_active || available < toNumber(item.quantity)) {
        return jsonResponse({ error: `${item.name || "A quoted product"} is unavailable in the requested quantity.` }, 409);
      }
    }

    if (action === "preview") {
      if (["approved", "sent"].includes(quote.status)) {
        await supabase.from("b2b_quotes").update({
          status: "viewed",
          viewed_at: quote.viewed_at || new Date().toISOString(),
        }).eq("id", quote.id);
      }
      return jsonResponse({
        quote: {
          id: quote.id,
          quoteNumber: quote.quote_number,
          quoteType: quote.quote_type,
          status: quote.status,
          businessName: quote.b2b_accounts?.business_name || "",
          contact: quote.b2b_contacts || null,
          items,
          subtotalInr: quote.subtotal_inr,
          shippingInr: quote.shipping_inr,
          creditInr: quote.credit_inr,
          totalInr: quote.total_inr,
          deliveryAddress: quote.delivery_address,
          deliveryCity: quote.delivery_city,
          deliveryState: quote.delivery_state,
          deliveryPinCode: quote.delivery_pin_code,
          expiresAt: quote.expires_at,
          paidAt: quote.paid_at,
        },
      });
    }
    if (action !== "create_order") return jsonResponse({ error: "Unsupported action" }, 400);
    if (quote.status === "paid") return jsonResponse({ error: "This quote has already been paid." }, 409);

    if (quote.order_id) {
      const { data: existing } = await supabase.from("orders")
        .select("id, status, amount").eq("id", quote.order_id).maybeSingle();
      if (existing && existing.status !== "failed") return jsonResponse({ order: existing, reused: true });
    }

    const customer = body?.customer || {};
    const name = normalizeText(customer?.name || quote.b2b_contacts?.full_name, 160);
    const email = normalizeEmail(customer?.email || quote.b2b_contacts?.email);
    const phone = normalizePhone(customer?.phone || quote.b2b_contacts?.phone || quote.b2b_contacts?.whatsapp_phone);
    const address = normalizeText(customer?.address || quote.delivery_address, 900);
    const city = normalizeText(customer?.city || quote.delivery_city, 120);
    const state = normalizeText(customer?.state || quote.delivery_state, 120);
    const pinCode = normalizeText(customer?.pinCode || quote.delivery_pin_code, 12);
    if (!name || !email || !phone || !address || !pinCode) {
      return jsonResponse({ error: "Name, email, phone, address, and pin code are required." }, 400);
    }

    const orderType = quote.quote_type === "sample_kit"
      ? "b2b_sample"
      : quote.quote_type === "reorder" ? "b2b_reorder" : "b2b_opening";
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      customer_name: name,
      customer_email: email,
      customer_phone: phone,
      customer_address: [address, city, state].filter(Boolean).join(", "),
      customer_pin_code: pinCode,
      amount: quote.total_inr,
      currency: "INR",
      status: "pending",
      fulfillment_status: "pending",
      items: items.map((item: any) => ({
        product_id: item.product_id,
        name: item.name,
        quantity: item.quantity,
        price_inr: item.unit_price_inr,
        retail_price_inr: item.retail_price_inr,
      })),
      order_type: orderType,
      b2b_quote_id: quote.id,
      b2b_account_id: quote.account_id,
      discount_total_inr: quote.credit_inr,
      discount_snapshot: {
        b2b_quote_number: quote.quote_number,
        sample_credit_inr: quote.credit_inr,
        shipping_inr: quote.shipping_inr,
      },
    }).select("id, amount, status").single();
    if (orderError || !order) throw orderError || new Error("Could not create order");

    await supabase.from("b2b_quotes").update({
      status: "payment_pending",
      order_id: order.id,
      delivery_address: address,
      delivery_city: city,
      delivery_state: state,
      delivery_pin_code: pinCode,
    }).eq("id", quote.id);
    await supabase.from("b2b_activities").insert({
      account_id: quote.account_id,
      contact_id: quote.contact_id,
      activity_type: "payment",
      title: "Trade checkout started",
      details: quote.quote_number,
      metadata: { quote_id: quote.id, order_id: order.id },
    });
    return jsonResponse({ order }, 201);
  } catch (error) {
    console.error("create-b2b-order failed", error);
    return jsonResponse({ error: "Could not prepare the trade checkout." }, 500);
  }
});
