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

async function sendEmail(to: string, subject: string, html: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY is not configured.");
    return false;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: Deno.env.get("B2B_FROM_EMAIL") || "Advaya Affiliate <trade@advayacare.com>",
        to: [to],
        subject,
        html,
        reply_to: "support@advayacare.com",
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Resend API Error:", errorText);
    }
    return response.ok;
  } catch (err) {
    console.error("Failed to send email", err);
    return false;
  }
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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Allow POST for public submitting an application (no auth needed)
  if (req.method === "POST" && req.url.includes("/submit")) {
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const { name, email, phone, social_links, reason } = body;
    if (!name || !email || !phone) {
      return jsonResponse({ error: "Name, email, and phone are required" }, 400);
    }

    const { data, error } = await supabase
      .from("affiliate_applications")
      .insert({ name, email, phone, social_links, reason, status: 'pending' })
      .select()
      .single();

    if (error) {
      return jsonResponse({ error: "Failed to submit application", details: error.message }, 500);
    }

    // Send confirmation email
    await sendEmail(
      email,
      "Affiliate Application Received - Advaya",
      `<h1>Application Received!</h1><p>Hi ${name},</p><p>Thank you for applying to the Advaya Affiliate Program. We have received your application and our team will review it shortly. We'll be in touch soon!</p><p>Best,<br>The Advaya Team</p>`
    );

    return jsonResponse({ success: true, data });
  }

  // ALL other routes require ADMIN auth
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

  // GET: list applications
  if (req.method === "GET") {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") || "pending";
    
    const { data, error } = await supabase
      .from("affiliate_applications")
      .select("*")
      .eq("status", status)
      .order("created_at", { ascending: false });

    if (error) {
      return jsonResponse({ error: "Failed to fetch applications", details: error.message }, 500);
    }

    return jsonResponse({ applications: data || [] });
  }

  // POST to approve or reject
  if (req.method === "POST" && (req.url.includes("/approve") || req.url.includes("/reject"))) {
    let body;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }

    const { id } = body;
    if (!id) return jsonResponse({ error: "Application ID is required" }, 400);

    if (req.url.includes("/reject")) {
      const { data, error } = await supabase
        .from("affiliate_applications")
        .update({ status: "rejected" })
        .eq("id", id)
        .select()
        .single();
        
      if (error) return jsonResponse({ error: "Failed to reject", details: error.message }, 500);
      return jsonResponse({ success: true, data });
    }

    if (req.url.includes("/approve")) {
      const { commission_rate, custom_code } = body;
      const rate = commission_rate || 10;

      // fetch application
      const { data: appData, error: appError } = await supabase
        .from("affiliate_applications")
        .select("*")
        .eq("id", id)
        .single();

      if (appError || !appData) {
        return jsonResponse({ error: "Application not found" }, 404);
      }

      let code = custom_code;
      if (!code) {
        const sanitizedName = appData.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
        code = `${sanitizedName}${Math.floor(1000 + Math.random() * 9000)}`;
      }

      // Create general coupon
      const { data: couponData, error: couponError } = await supabase
        .from("general_coupons")
        .insert({
          code,
          description: `Affiliate coupon for ${appData.name}`,
          discount_type: "percentage",
          percentage_discount: 10, // customer discount
          is_active: true,
          all_orders: true,
          require_membership: false
        })
        .select()
        .single();

      if (couponError) {
        return jsonResponse({ error: "Failed to create coupon", details: couponError.message }, 500);
      }

      // Create affiliate record
      const { data: affiliateData, error: affiliateError } = await supabase
        .from("affiliate_coupons")
        .insert({
          coupon_id: couponData.id,
          affiliate_name: appData.name,
          commission_type: "percentage",
          commission_rate: rate,
          email: appData.email,
          phone: appData.phone || null,
          social_links: appData.social_links || null,
          reason: appData.reason || null
        })
        .select()
        .single();

      if (affiliateError) {
        return jsonResponse({ error: "Failed to create affiliate record", details: affiliateError.message }, 500);
      }

      // Mark application as approved
      const { data: updatedApp, error: updateError } = await supabase
        .from("affiliate_applications")
        .update({ status: "approved" })
        .eq("id", id)
        .select()
        .single();

      if (updateError) {
        return jsonResponse({ error: "Failed to update application status", details: updateError.message }, 500);
      }

      // Send approval email
      await sendEmail(
        appData.email,
        "Welcome to the Advaya Affiliate Program!",
        `<h1>You're Approved!</h1><p>Hi ${appData.name},</p><p>Congratulations! Your application to join the Advaya Affiliate Program has been approved.</p><p>Your unique discount code is: <strong>${code}</strong></p><p>You will earn a ${rate}% commission on all sales generated using this code. You can log into your Affiliate Dashboard at any time to check your performance.</p><p>Best,<br>The Advaya Team</p>`
      );

      return jsonResponse({ success: true, application: updatedApp, coupon: couponData, affiliate: affiliateData });
    }
  }

  return jsonResponse({ error: "Method not allowed or route not found" }, 405);
});
