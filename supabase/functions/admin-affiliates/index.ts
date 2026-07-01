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
    const singleId = url.searchParams.get("id"); // this is now profile_id
    
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

    // Fetch affiliate profiles
    let profilesQuery = supabase
      .from("affiliate_profiles")
      .select(`*`);
      
    if (singleId) {
      profilesQuery = profilesQuery.eq("id", singleId);
    }
    
    const { data: profiles, error: profilesError } = await profilesQuery;
      
    if (profilesError) {
      return jsonResponse({ error: "Failed to fetch affiliates", details: profilesError.message }, 500);
    }
    
    if (!profiles || profiles.length === 0) {
      return jsonResponse({ affiliates: [] });
    }

    const profileIds = profiles.map((p: any) => p.id);

    // Fetch coupons for these profiles
    const { data: affiliateCoupons, error: acError } = await supabase
      .from("affiliate_coupons")
      .select(`
        id, profile_id, coupon_id, commission_type, commission_rate, created_at,
        general_coupons (
          id, code, discount_type, fixed_amount_inr, percentage_discount, is_active
        )
      `)
      .in("profile_id", profileIds);

    if (acError) {
      return jsonResponse({ error: "Failed to fetch affiliate coupons", details: acError.message }, 500);
    }

    const allCouponIds = affiliateCoupons?.map((ac: any) => {
      let gId = ac.coupon_id;
      if (!gId && ac.general_coupons) {
        gId = Array.isArray(ac.general_coupons) ? ac.general_coupons[0]?.id : ac.general_coupons.id;
      }
      return gId;
    }).filter(Boolean) || [];

    // Fetch usages for these coupons
    let usagesQuery = supabase
      .from("general_coupon_usages")
      .select("id, coupon_id, discount_amount_inr, used_at, order_id, is_affiliate_paid, affiliate_paid_at")
      .in("coupon_id", allCouponIds);
      
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
    
    const ordersMap = new Map(orders.map(o => [o.id, Number(o.amount) || 0]));

    // We will aggregate metrics per profile
    const responseData = profiles.map((profile: any) => {
      // Find all affiliate_coupons for this profile
      const myCoupons = affiliateCoupons?.filter((ac: any) => ac.profile_id === profile.id) || [];
      
      const profileMetrics = {
        uses: 0,
        gross_revenue: 0,
        net_revenue: 0,
        commission: 0,
        unpaid_commission: 0,
        paid_commission: 0,
        transactions: [] as any[]
      };

      const myCouponsProcessed = myCoupons.map((ac: any) => {
        let cId = ac.coupon_id;
        if (!cId && ac.general_coupons) {
            cId = Array.isArray(ac.general_coupons) ? ac.general_coupons[0]?.id : ac.general_coupons.id;
        }

        const myUsages = usages?.filter((u: any) => u.coupon_id === cId) || [];
        
        const couponMetrics = {
          uses: 0,
          gross_revenue: 0,
          net_revenue: 0,
          commission: 0
        };

        for (const usage of myUsages) {
          couponMetrics.uses += 1;
          profileMetrics.uses += 1;
          
          const netRev = ordersMap.get(usage.order_id) || 0;
          const discountAmt = Number(usage.discount_amount_inr) || 0;
          const grossRev = netRev + discountAmt;
          
          couponMetrics.net_revenue += netRev;
          couponMetrics.gross_revenue += grossRev;
          profileMetrics.net_revenue += netRev;
          profileMetrics.gross_revenue += grossRev;
          
          let comm = 0;
          if (ac.commission_type === "fixed") {
            comm = Number(ac.commission_rate);
          } else {
            comm = netRev * (Number(ac.commission_rate) / 100);
          }

          couponMetrics.commission += comm;
          profileMetrics.commission += comm;

          if (usage.is_affiliate_paid) {
            profileMetrics.paid_commission += comm;
          } else {
            profileMetrics.unpaid_commission += comm;
          }
          
          profileMetrics.transactions.push({
            id: usage.id,
            order_id: usage.order_id,
            used_at: usage.used_at,
            net_revenue: netRev,
            commission: comm,
            is_paid: usage.is_affiliate_paid || false,
            paid_at: usage.affiliate_paid_at,
            coupon_code: ac.general_coupons.code
          });
        }

        const gCoupons = Array.isArray(ac.general_coupons) ? ac.general_coupons[0] : ac.general_coupons;

        return {
          id: ac.id,
          coupon_id: cId,
          commission_type: ac.commission_type,
          commission_rate: ac.commission_rate,
          coupon_code: gCoupons?.code,
          discount_type: gCoupons?.discount_type,
          is_active: gCoupons?.is_active,
          metrics: couponMetrics,
          created_at: ac.created_at
        };
      });

      // Sort transactions descending
      profileMetrics.transactions.sort((a, b) => new Date(b.used_at).getTime() - new Date(a.used_at).getTime());

      return {
        id: profile.id, // profile id
        name: profile.name,
        email: profile.email,
        phone: profile.phone,
        social_links: profile.social_links,
        reason: profile.reason,
        status: profile.status,
        created_at: profile.created_at,
        metrics: profileMetrics,
        coupons: myCouponsProcessed
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

    if (req.url.includes("/issue-coupon")) {
      const {
        profile_id,
        commission_type,
        commission_rate,
        code,
        description,
        discount_type,
        percentage_discount
      } = body;

      if (!profile_id || !commission_type || !commission_rate || !code || !discount_type) {
        return jsonResponse({ error: "Missing required fields" }, 400);
      }

      // 1. Fetch profile to get name for description
      const { data: profileData } = await supabase
        .from("affiliate_profiles")
        .select("name")
        .eq("id", profile_id)
        .single();

      if (!profileData) {
        return jsonResponse({ error: "Profile not found" }, 404);
      }

      // 2. Create general coupon
      const { data: couponData, error: couponError } = await supabase
        .from("general_coupons")
        .insert({
          code: code.trim().toUpperCase(),
          description: description || `Affiliate coupon for ${profileData.name}`,
          discount_type,
          percentage_discount: discount_type === 'percentage' ? percentage_discount : null,
          is_active: true,
          all_orders: true,
          require_membership: false
        })
        .select()
        .single();

      if (couponError) {
        return jsonResponse({ error: "Failed to create base coupon", details: couponError.message }, 500);
      }

      // 3. Create affiliate tracking record linked to profile
      const { data: affiliateData, error: affiliateError } = await supabase
        .from("affiliate_coupons")
        .insert({
          profile_id,
          coupon_id: couponData.id,
          commission_type,
          commission_rate
        })
        .select()
        .single();

      if (affiliateError) {
        return jsonResponse({ error: "Failed to create affiliate link", details: affiliateError.message }, 500);
      }

      return jsonResponse({ success: true, affiliate: affiliateData, coupon: couponData });
    }
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
