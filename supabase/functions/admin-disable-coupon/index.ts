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

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { couponCode } = body;

    if (!couponCode || typeof couponCode !== "string") {
      return jsonResponse({ error: "Invalid coupon code" }, 400);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update coupon status to revoked
    const { data, error } = await supabase
      .from("member_coupons")
      .update({ status: "revoked" })
      .eq("code", couponCode.toUpperCase())
      .select();

    if (error) {
      console.error("Error updating coupon:", error);
      return jsonResponse({ error: "Failed to disable coupon" }, 500);
    }

    if (!data || data.length === 0) {
      return jsonResponse({ error: "Coupon not found" }, 404);
    }

    return jsonResponse({
      success: true,
      message: `Coupon ${couponCode} has been disabled`,
      coupon: data[0],
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Internal server error" },
      500
    );
  }
});
