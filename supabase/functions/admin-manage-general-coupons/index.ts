import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";

function makeMemberCouponCode(prefix = "ADM") {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `${prefix}-${random}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, coupon, couponId, updates, email, amountInr, expiresAt, reason } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requesterEmail = String(user.email || "").trim().toLowerCase();
    if (!requesterEmail || requesterEmail !== ADMIN_EMAIL) {
      return new Response(
        JSON.stringify({ error: "Not authorized - admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle actions
    if (action === "create") {
      if (!coupon || !coupon.code) {
        return new Response(
          JSON.stringify({ error: "Missing coupon data or code" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: newCoupon, error: createError } = await supabase
        .from("general_coupons")
        .insert([
          {
            code: String(coupon.code).toUpperCase(),
            description: coupon.description || "",
            discount_type: coupon.discount_type || "fixed",
            fixed_amount_inr: coupon.fixed_amount_inr || 0,
            percentage_discount: coupon.percentage_discount || 0,
            max_discount_inr: coupon.max_discount_inr || null,
            min_order_amount_inr: coupon.min_order_amount_inr || null,
            is_active: coupon.is_active !== false,
            require_membership: coupon.require_membership !== false,
            global_usage_limit: coupon.global_usage_limit || null,
            per_member_usage_limit: coupon.per_member_usage_limit || 1,
            all_orders: coupon.all_orders || false,
            expires_at: coupon.expires_at || null,
          },
        ])
        .select();

      if (createError) {
        console.error("Create error:", createError);
        return new Response(
          JSON.stringify({ error: createError.message || "Failed to create coupon" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Coupon created",
          coupon: newCoupon?.[0],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update") {
      if (!couponId || !updates) {
        return new Response(
          JSON.stringify({ error: "Missing couponId or updates" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: updatedCoupon, error: updateError } = await supabase
        .from("general_coupons")
        .update(updates)
        .eq("id", couponId)
        .select();

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ error: "Failed to update coupon" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Coupon updated",
          coupon: updatedCoupon?.[0],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "delete") {
      if (!couponId) {
        return new Response(
          JSON.stringify({ error: "Missing couponId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: deleteError } = await supabase
        .from("general_coupons")
        .delete()
        .eq("id", couponId);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        return new Response(
          JSON.stringify({ error: "Failed to delete coupon (it might have usages)" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Coupon deleted",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "issue-member-coupon") {
      if (!email || !amountInr) {
        return new Response(
          JSON.stringify({ error: "Missing email or amountInr" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Look up the user by email using service role admin API
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
      if (listError) {
        return new Response(
          JSON.stringify({ error: "Failed to search users" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const targetUser = users.find(
        (u: { email?: string }) => u.email?.toLowerCase() === String(email).trim().toLowerCase()
      );

      if (!targetUser) {
        return new Response(
          JSON.stringify({ error: `No user account found with email: ${email}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate a unique member coupon code with retries
      let inserted = null;
      let lastError = null;

      for (let i = 0; i < 5; i++) {
        const code = makeMemberCouponCode("ADM");
        const { data, error } = await supabase
          .from("member_coupons")
          .insert({
            auth_user_id: targetUser.id,
            code,
            amount_inr: Number(amountInr),
            status: "active",
            issued_reason: reason || "admin_issued",
            expires_at: expiresAt || null,
          })
          .select("id, code, amount_inr, status, expires_at, issued_at")
          .single();

        if (!error && data) {
          inserted = data;
          break;
        }

        lastError = error;
        if (error?.code !== "23505") break; // not a unique violation
      }

      if (!inserted) {
        return new Response(
          JSON.stringify({ error: lastError?.message || "Could not issue member coupon" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Coupon issued to ${email}`,
          coupon: inserted,
          userEmail: email,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Management error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
