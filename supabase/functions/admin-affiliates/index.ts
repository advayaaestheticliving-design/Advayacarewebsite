import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (!requesterEmail || requesterEmail !== ADMIN_EMAIL) {
    return jsonResponse({ error: "Forbidden: admin access required" }, 403);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "all";
    const singleId = url.searchParams.get("id");
    
    let dateFilter = null;
    const now = new Date();
    
    if (period === "monthly") {
      now.setMonth(now.getMonth() - 1);
      dateFilter = now.toISOString();
    } else if (period === "quarterly") {
      now.setMonth(now.getMonth() - 3);
      dateFilter = now.toISOString();
    } else if (period === "half_yearly") {
      now.setMonth(now.getMonth() - 6);
      dateFilter = now.toISOString();
    } else if (period === "yearly") {
      now.setFullYear(now.getFullYear() - 1);
      dateFilter = now.toISOString();
    }

    // Fetch affiliate coupons
    let query = supabase
      .from("affiliate_coupons")
      .select(`
        id, affiliate_name, commission_type, commission_rate, created_at,
        email, phone, social_links, reason,
        general_coupons (
          id, code, discount_type, fixed_amount_inr, percentage_discount, is_active
        )
      `);
      
    if (singleId) {
      query = query.eq("id", singleId);
    }
    
    const { data: affiliates, error: affiliatesError } = await query;
      
    if (affiliatesError) {
      return jsonResponse({ error: "Failed to fetch affiliates", details: affiliatesError.message }, 500);
    }
    
    if (!affiliates || affiliates.length === 0) {
      return jsonResponse({ affiliates: [] });
    }
    
    const couponIds = affiliates.map((a: any) => a.general_coupons.id);
    
    // Fetch usages for these coupons
    let usagesQuery = supabase
      .from("general_coupon_usages")
      .select("id, coupon_id, discount_amount_inr, used_at, order_id, is_affiliate_paid, affiliate_paid_at")
      .in("coupon_id", couponIds);
      
    if (dateFilter) {
      usagesQuery = usagesQuery.gte("used_at", dateFilter);
    }
    
    const { data: usages, error: usagesError } = await usagesQuery;
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
        commission: 0,
        unpaid_commission: 0,
        paid_commission: 0,
        transactions: []
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
        
        metrics.transactions.push({
          id: usage.id,
          order_id: usage.order_id,
          used_at: usage.used_at,
          net_revenue: netRev,
          is_paid: usage.is_affiliate_paid || false,
          paid_at: usage.affiliate_paid_at
        });
      }
    }
    
    // Calculate commission
    const responseData = affiliates.map((aff: any) => {
      const cId = aff.general_coupons.id;
      const metrics = metricsMap[cId];
      
      let commission = 0;
      if (aff.commission_type === "fixed") {
        commission = metrics.uses * Number(aff.commission_rate);
        
        metrics.transactions.forEach((t: any) => {
          t.commission = Number(aff.commission_rate);
          if (t.is_paid) metrics.paid_commission += t.commission;
          else metrics.unpaid_commission += t.commission;
        });
      } else if (aff.commission_type === "percentage") {
        commission = metrics.net_revenue * (Number(aff.commission_rate) / 100);
        
        metrics.transactions.forEach((t: any) => {
          t.commission = t.net_revenue * (Number(aff.commission_rate) / 100);
          if (t.is_paid) metrics.paid_commission += t.commission;
          else metrics.unpaid_commission += t.commission;
        });
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
        email: aff.email,
        phone: aff.phone,
        social_links: aff.social_links,
        reason: aff.reason,
        metrics: {
          ...metrics,
          commission
        },
        created_at: aff.created_at
      };
    });

    return jsonResponse({ affiliates: responseData });
  }

  if (req.method === "POST") {
    const bodyText = await req.text();
    let body;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    if (req.url.includes("/payout")) {
      const { usage_ids, is_paid } = body;
      if (!usage_ids || !Array.isArray(usage_ids)) {
        return jsonResponse({ error: "Missing or invalid usage_ids" }, 400);
      }

      const updateData: any = { is_affiliate_paid: is_paid };
      if (is_paid) {
        updateData.affiliate_paid_at = new Date().toISOString();
      } else {
        updateData.affiliate_paid_at = null;
      }

      const { data, error } = await supabase
        .from("general_coupon_usages")
        .update(updateData)
        .in("id", usage_ids)
        .select();

      if (error) {
        return jsonResponse({ error: "Failed to update payouts", details: error.message }, 500);
      }

      return jsonResponse({ success: true, updated: data?.length || 0 });
    }

    const {
      affiliate_name,
      commission_type,
      commission_rate,
      code,
      description,
      discount_type,
      fixed_amount_inr,
      percentage_discount,
      min_order_amount_inr,
      max_discount_inr
    } = body;

    if (!affiliate_name || !commission_type || !commission_rate || !code || !discount_type) {
      return jsonResponse({ error: "Missing required fields" }, 400);
    }

    // 1. Create general coupon
    const { data: couponData, error: couponError } = await supabase
      .from("general_coupons")
      .insert({
        code: code.trim().toUpperCase(),
        description: description || `Affiliate coupon for ${affiliate_name}`,
        discount_type,
        fixed_amount_inr: discount_type !== 'percentage' ? fixed_amount_inr : null,
        percentage_discount: discount_type !== 'fixed' ? percentage_discount : null,
        min_order_amount_inr,
        max_discount_inr,
        is_active: true,
        all_orders: true, // Affiliate coupons usually apply to all orders
        require_membership: false
      })
      .select()
      .single();

    if (couponError) {
      return jsonResponse({ error: "Failed to create base coupon", details: couponError.message }, 500);
    }

    // 2. Create affiliate tracking record
    const { data: affiliateData, error: affiliateError } = await supabase
      .from("affiliate_coupons")
      .insert({
        coupon_id: couponData.id,
        affiliate_name: affiliate_name.trim(),
        commission_type,
        commission_rate
      })
      .select()
      .single();

    if (affiliateError) {
      // rollback coupon if possible, but edge function doesn't easily support transactions here.
      return jsonResponse({ error: "Failed to create affiliate record", details: affiliateError.message }, 500);
    }

    return jsonResponse({ affiliate: affiliateData, coupon: couponData });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
