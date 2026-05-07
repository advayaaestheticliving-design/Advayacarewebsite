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

function generateCouponCode() {
  const prefix = "ADM";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { coupons } = body;

    if (!Array.isArray(coupons) || coupons.length === 0) {
      return jsonResponse({ error: "Invalid or empty coupons array" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const created = [];

    for (const coupon of coupons) {
      const { member_email, amount_inr, expires_at, issued_reason } = coupon;

      if (!member_email || !amount_inr) {
        console.error("Skipping invalid coupon:", coupon);
        continue;
      }

      // Find member by email
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) {
        console.error("Error listing users:", authError);
        continue;
      }

      const memberUser = authUsers?.users?.find(
        (u) => String(u.email || "").trim().toLowerCase() === String(member_email || "").trim().toLowerCase()
      );

      if (!memberUser) {
        console.warn(`Member not found for email: ${member_email}`);
        continue;
      }

      // Generate unique code
      const code = generateCouponCode();

      // Insert coupon
      const { error: insertError, data: insertedCoupon } = await supabase
        .from("member_coupons")
        .insert({
          auth_user_id: memberUser.id,
          code,
          amount_inr: parseFloat(amount_inr),
          status: "active",
          issued_reason: issued_reason || "admin_generated",
          expires_at: expires_at || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select();

      if (insertError) {
        console.error("Error inserting coupon:", insertError);
        continue;
      }

      created.push({
        code,
        member_email,
        amount_inr,
      });
    }

    return jsonResponse({
      success: true,
      created: created.length,
      coupons: created,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500
    );
  }
});
