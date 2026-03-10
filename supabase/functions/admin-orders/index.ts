import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_FULFILLMENT_STATUSES = new Set([
  "pending",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
]);

const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }
  return authHeader.slice("Bearer ".length).trim();
}

async function getRequestUser(req: Request, supabaseUrl: string, serviceRoleKey: string) {
  const token = parseBearerToken(req);
  if (!token) {
    return { user: null, error: "Missing authorization token" };
  }

  const authClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "Invalid or expired authorization token" };
  }

  return { user, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Server configuration error: Supabase credentials missing" }, 500);
  }

  const { user, error: authError } = await getRequestUser(req, supabaseUrl, supabaseServiceKey);
  if (authError || !user) {
    return jsonResponse({ error: authError || "Unauthorized" }, 401);
  }

  const requesterEmail = String(user.email || "").trim().toLowerCase();
  if (!requesterEmail || requesterEmail !== ADMIN_EMAIL) {
    return jsonResponse({ error: "Forbidden: admin access required" }, 403);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const parsedLimit = Number(url.searchParams.get("limit") || 120);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 300) : 120;

    const { data: orders, error: listError } = await supabase
      .from("orders")
      .select(
        "id, created_at, updated_at, amount, currency, status, fulfillment_status, fulfillment_updated_at, customer_name, customer_email, customer_phone, razorpay_order_id, razorpay_payment_id"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (listError) {
      return jsonResponse({ error: "Failed to fetch orders", details: listError.message }, 500);
    }

    const orderIds = Array.isArray(orders) ? orders.map((order) => order.id).filter(Boolean) : [];
    let eventsByOrder: Record<string, any[]> = {};

    if (orderIds.length > 0) {
      const { data: events, error: eventsError } = await supabase
        .from("order_status_events")
        .select("id, order_id, status, status_kind, notes, changed_by_email, created_at")
        .in("order_id", orderIds)
        .order("created_at", { ascending: true });

      if (eventsError) {
        return jsonResponse({ error: "Failed to fetch order status events", details: eventsError.message }, 500);
      }

      eventsByOrder = (events || []).reduce((acc: Record<string, any[]>, event: any) => {
        const key = String(event.order_id || "");
        if (!key) return acc;
        if (!acc[key]) acc[key] = [];
        acc[key].push(event);
        return acc;
      }, {});
    }

    const payload = (orders || []).map((order: any) => ({
      ...order,
      events: eventsByOrder[String(order.id)] || [],
    }));

    return jsonResponse({ orders: payload });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId || "").trim();
    const fulfillmentStatus = String(body?.fulfillmentStatus || "").trim().toLowerCase();
    const notes = String(body?.notes || "").trim();

    if (!orderId || !fulfillmentStatus) {
      return jsonResponse({ error: "orderId and fulfillmentStatus are required" }, 400);
    }

    if (!ALLOWED_FULFILLMENT_STATUSES.has(fulfillmentStatus)) {
      return jsonResponse({ error: "Invalid fulfillmentStatus value" }, 400);
    }

    const { data: existingOrder, error: existingError } = await supabase
      .from("orders")
      .select("id, fulfillment_status")
      .eq("id", orderId)
      .single();

    if (existingError || !existingOrder) {
      return jsonResponse({ error: "Order not found", details: existingError?.message }, 404);
    }

    if (existingOrder.fulfillment_status === fulfillmentStatus) {
      return jsonResponse({
        success: true,
        message: "Fulfillment status unchanged",
        order: existingOrder,
      });
    }

    const nowIso = new Date().toISOString();
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update({
        fulfillment_status: fulfillmentStatus,
        fulfillment_updated_at: nowIso,
        fulfillment_notes: notes,
        updated_at: nowIso,
      })
      .eq("id", orderId)
      .select(
        "id, created_at, updated_at, amount, currency, status, fulfillment_status, fulfillment_updated_at, customer_name, customer_email, customer_phone, razorpay_order_id, razorpay_payment_id"
      )
      .single();

    if (updateError || !updatedOrder) {
      return jsonResponse({ error: "Failed to update order", details: updateError?.message }, 500);
    }

    const { error: eventInsertError } = await supabase.from("order_status_events").insert({
      order_id: orderId,
      status: fulfillmentStatus,
      status_kind: "fulfillment",
      notes,
      changed_by_user_id: user.id,
      changed_by_email: user.email || null,
      metadata: { source: "admin-orders" },
    });

    if (eventInsertError) {
      return jsonResponse({ error: "Order updated but event logging failed", details: eventInsertError.message }, 500);
    }

    const { data: events, error: eventsError } = await supabase
      .from("order_status_events")
      .select("id, order_id, status, status_kind, notes, changed_by_email, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (eventsError) {
      return jsonResponse({ error: "Order updated but failed to fetch event timeline", details: eventsError.message }, 500);
    }

    return jsonResponse({
      success: true,
      message: "Order fulfillment status updated",
      order: {
        ...updatedOrder,
        events: events || [],
      },
    });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});