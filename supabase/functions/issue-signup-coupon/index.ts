import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function makeCouponCode() {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `MEM100-${random}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase env vars" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || "";

    const {
      data: { user },
      error: userError,
    } = token ? await authClient.auth.getUser(token) : { data: { user: null }, error: new Error("Missing token") };

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const service = createClient(supabaseUrl, supabaseServiceKey);

    const { data: existingCoupon, error: existingError } = await service
      .from("member_coupons")
      .select("id, code, amount_inr, status, expires_at")
      .eq("auth_user_id", user.id)
      .eq("issued_reason", "member_signup")
      .limit(1)
      .maybeSingle();

    if (existingError) {
      return new Response(JSON.stringify({ error: existingError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingCoupon) {
      return new Response(
        JSON.stringify({
          success: true,
          issued: false,
          coupon: existingCoupon,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    let inserted = null;
    let lastError = null;

    for (let i = 0; i < 5; i += 1) {
      const code = makeCouponCode();
      const { data, error } = await service
        .from("member_coupons")
        .insert({
          auth_user_id: user.id,
          code,
          amount_inr: 100,
          status: "active",
          issued_reason: "member_signup",
          expires_at: expiresAt,
        })
        .select("id, code, amount_inr, status, expires_at")
        .single();

      if (!error && data) {
        inserted = data;
        lastError = null;
        break;
      }

      lastError = error;
      if (error?.code !== "23505") {
        break;
      }
    }

    if (!inserted) {
      return new Response(JSON.stringify({ error: lastError?.message || "Could not issue coupon" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        issued: true,
        coupon: inserted,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
