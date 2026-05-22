import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CouponValidationRequest {
  couponCode: string;
  subtotal: number;
  guestSessionId?: string;
}

interface CouponValidationResponse {
  valid: boolean;
  code: string;
  discountType: string;
  discountAmount?: number;
  discountPercentage?: number;
  maxDiscount?: number;
  finalDiscount: number;
  message: string;
  requiresMembership?: boolean;
  isMember?: boolean;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { couponCode, subtotal, guestSessionId } = (await req.json()) as CouponValidationRequest;

    if (!couponCode || !subtotal) {
      return new Response(
        JSON.stringify({ valid: false, message: "Missing couponCode or subtotal" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get coupon
    const { data: coupon, error: couponError } = await supabase
      .from("general_coupons")
      .select("*")
      .ilike("code", couponCode)
      .single();

    if (couponError || !coupon) {
      return new Response(
        JSON.stringify({ valid: false, message: "Coupon not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if active
    if (!coupon.is_active) {
      return new Response(
        JSON.stringify({ valid: false, message: "Coupon is no longer active" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, message: "Coupon has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check global usage limit
    if (coupon.global_usage_limit && coupon.global_usage_count >= coupon.global_usage_limit) {
      return new Response(
        JSON.stringify({ valid: false, message: "Coupon usage limit reached" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check minimum order amount
    if (coupon.min_order_amount_inr && subtotal < coupon.min_order_amount_inr) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: Minimum order amount is ₹\,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get auth user
    const authHeader = req.headers.get("authorization");
    let userId: string | null = null;
    let isMember = false;

    if (authHeader) {
      try {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;

        // Check if user is a member
        if (userId) {
          const { data: member } = await supabase
            .from("members")
            .select("id")
            .eq("auth_user_id", userId)
            .single();
          isMember = !!member;
        }
      } catch {
        // Continue without auth
      }
    }

    // Check membership requirement
    if (coupon.require_membership && !isMember && !coupon.all_orders) {
      return new Response(
        JSON.stringify({
          valid: false,
          message: "This coupon requires a membership account",
          requiresMembership: true,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check per-member usage if user is member
    if (userId && coupon.per_member_usage_limit) {
      const { count } = await supabase
        .from("general_coupon_usages")
        .select("*", { count: "exact" })
        .eq("coupon_id", coupon.id)
        .eq("auth_user_id", userId);

      if (count! >= coupon.per_member_usage_limit) {
        return new Response(
          JSON.stringify({
            valid: false,
            message: You have already used this coupon (limit: \),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Calculate discount
    let finalDiscount = 0;

    if (coupon.discount_type === "fixed") {
      finalDiscount = coupon.fixed_amount_inr || 0;
    } else if (coupon.discount_type === "percentage") {
      finalDiscount = (subtotal * (coupon.percentage_discount || 0)) / 100;
      if (coupon.max_discount_inr) {
        finalDiscount = Math.min(finalDiscount, coupon.max_discount_inr);
      }
    } else if (coupon.discount_type === "both") {
      // Apply fixed first, then percentage on remaining
      const afterFixed = subtotal - (coupon.fixed_amount_inr || 0);
      const percentageDiscount = (afterFixed * (coupon.percentage_discount || 0)) / 100;
      finalDiscount = (coupon.fixed_amount_inr || 0) + percentageDiscount;
      if (coupon.max_discount_inr) {
        finalDiscount = Math.min(finalDiscount, coupon.max_discount_inr);
      }
    }

    // Don't discount more than subtotal
    finalDiscount = Math.min(finalDiscount, subtotal);

    return new Response(
      JSON.stringify({
        valid: true,
        code: coupon.code,
        discountType: coupon.discount_type,
        discountAmount: coupon.fixed_amount_inr,
        discountPercentage: coupon.percentage_discount,
        maxDiscount: coupon.max_discount_inr,
        finalDiscount: Math.round(finalDiscount * 100) / 100,
        message: "Coupon is valid",
        isMember,
      } as CouponValidationResponse),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(
      JSON.stringify({ valid: false, message: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
