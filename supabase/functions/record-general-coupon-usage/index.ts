import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { couponCode, discountAmount, orderID, guestSessionId } = await req.json();

    if (!couponCode || !discountAmount) {
      return new Response(
        JSON.stringify({ error: "Missing couponCode or discountAmount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth user
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;

    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch {
        // Continue without auth
      }
    }

    // Find coupon
    const { data: coupon, error: couponError } = await supabase
      .from("general_coupons")
      .select("id")
      .ilike("code", couponCode)
      .single();

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ error: "Coupon not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Record usage
    const { data: usage, error: usageError } = await supabase
      .from("general_coupon_usages")
      .insert([
        {
          coupon_id: coupon.id,
          coupon_code: String(couponCode).toUpperCase(),
          auth_user_id: userId,
          guest_session_id: guestSessionId,
          order_id: orderID,
          discount_amount_inr: discountAmount,
        },
      ])
      .select();

    if (usageError) {
      console.error("Error recording usage:", usageError);
      return new Response(
        JSON.stringify({ error: "Failed to record coupon usage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Increment global usage count
    const { error: updateError } = await supabase
      .from("general_coupons")
      .update({ global_usage_count: coupon.id })
      .eq("id", coupon.id);

    if (updateError) {
      console.error("Error updating usage count:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Coupon usage recorded",
        usage: usage?.[0],
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Recording error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
