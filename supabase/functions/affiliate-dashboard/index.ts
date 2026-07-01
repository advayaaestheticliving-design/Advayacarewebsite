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
  }

  return {
    user: null,
    error: "Invalid or expired authorization token",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

  const requesterEmail = String(user.email || "").trim().toLowerCase();
  
  if (!requesterEmail) {
    return jsonResponse({ error: "User email not found" }, 400);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method === "GET") {
    // 1. Find the approved application for this email
    const { data: appData, error: appError } = await supabase
      .from("affiliate_applications")
      .select("name")
      .eq("email", requesterEmail)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (appError || !appData) {
      return jsonResponse({ error: "No approved affiliate application found for this email" }, 404);
    }

    const affiliateName = appData.name;

    // 2. Fetch all affiliate coupons for this name
    const { data: affiliates, error: affiliatesError } = await supabase
      .from("affiliate_coupons")
      .select(`
        id, affiliate_name, commission_type, commission_rate, created_at,
        general_coupons (
          id, code, discount_type, fixed_amount_inr, percentage_discount, is_active
        )
      `)
      .eq("affiliate_name", affiliateName);
      
    if (affiliatesError) {
      return jsonResponse({ error: "Failed to fetch affiliate details", details: affiliatesError.message }, 500);
    }
    
    if (!affiliates || affiliates.length === 0) {
      return jsonResponse({ metrics: null }); // Approved but no coupon yet?
    }

    // Usually they only have 1 active coupon, but let's take the first one or sum them up. We will return a list.
    const couponIds = affiliates.map((a: any) => a.general_coupons.id);
    
    // Fetch usages for these coupons
    const { data: usages, error: usagesError } = await supabase
      .from("general_coupon_usages")
      .select("coupon_id, discount_amount_inr, used_at, order_id")
      .in("coupon_id", couponIds);
      
    if (usagesError) {
      return jsonResponse({ error: "Failed to fetch coupon usages", details: usagesError.message }, 500);
    }
    
    const orderIds = usages?.map((u: any) => u.order_id).filter(Boolean) || [];
    
    let orders: any[] = [];
    if (orderIds.length > 0) {
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select("id, amount")
        .in("id", orderIds);
        
      if (!ordersError && ordersData) {
        orders = ordersData;
      }
    }
    
    const metricsMap: Record<string, any> = {};
    for (const aff of affiliates) {
      metricsMap[aff.general_coupons.id] = {
        uses: 0,
        gross_revenue: 0,
        net_revenue: 0,
        commission: 0
      };
    }
    
    const ordersMap = new Map(orders.map(o => [o.id, Number(o.amount) || 0]));
    
    if (usages) {
      for (const usage of usages) {
        const cId = usage.coupon_id;
        const metrics = metricsMap[cId];
        if (!metrics) continue;
        
        metrics.uses += 1;
        
        const netRev = ordersMap.get(usage.order_id) || 0;
        const discountAmt = Number(usage.discount_amount_inr) || 0;
        const grossRev = netRev + discountAmt;
        
        metrics.net_revenue += netRev;
        metrics.gross_revenue += grossRev;
      }
    }
    
    // Calculate commission
    const responseData = affiliates.map((aff: any) => {
      const cId = aff.general_coupons.id;
      const metrics = metricsMap[cId];
      
      let commission = 0;
      if (aff.commission_type === "fixed") {
        commission = metrics.uses * Number(aff.commission_rate);
      } else if (aff.commission_type === "percentage") {
        commission = metrics.net_revenue * (Number(aff.commission_rate) / 100);
      }
      
      return {
        id: aff.id,
        coupon_id: cId,
        affiliate_name: aff.affiliate_name,
        commission_type: aff.commission_type,
        commission_rate: aff.commission_rate,
        coupon_code: aff.general_coupons.code,
        discount_type: aff.general_coupons.discount_type,
        is_active: aff.general_coupons.is_active,
        metrics: {
          ...metrics,
          commission
        },
        created_at: aff.created_at
      };
    });

    return jsonResponse({ metrics: responseData });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
