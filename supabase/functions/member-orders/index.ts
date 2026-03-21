import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

async function getRequestUser(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string
) {
  const token = parseBearerToken(req);
  if (!token || token === "undefined" || token === "null") {
    return { user: null, error: "Missing authorization token" };
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: serviceData,
    error: serviceError,
  } = await serviceClient.auth.getUser(token);

  if (!serviceError && serviceData?.user) {
    return { user: serviceData.user, error: null };
  }

  if (anonKey) {
    const anonClient = createClient(supabaseUrl, anonKey);
    const {
      data: anonData,
      error: anonError,
    } = await anonClient.auth.getUser(token);

    if (!anonError && anonData?.user) {
      return { user: anonData.user, error: null };
    }

    return {
      user: null,
      error: anonError?.message || serviceError?.message || "Invalid or expired authorization token",
    };
  }

  return {
    user: null,
    error: serviceError?.message || "Invalid or expired authorization token",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Server configuration error: Supabase credentials missing" }, 500);
  }

  const { user, error: authError } = await getRequestUser(
    req,
    supabaseUrl,
    supabaseServiceKey,
    supabaseAnonKey
  );
  if (authError || !user) {
    return jsonResponse({ error: authError || "Unauthorized" }, 401);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select(
      "id, created_at, updated_at, amount, currency, status, fulfillment_status, fulfillment_updated_at, items, customer_name"
    )
    .eq("auth_user_id", user.id)
    .order("created_at", { ascending: false });

  if (ordersError) {
    return jsonResponse({ error: "Failed to fetch member orders", details: ordersError.message }, 500);
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
});