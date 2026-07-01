import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function normalizeCode(value: unknown) {
  return String(value || "").trim().toUpperCase();
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

    const body = await req.json().catch(() => ({}));
    const subtotal = Math.max(0, Number(body?.subtotal || 0));
    const couponCode = normalizeCode(body?.couponCode);
    const giftCardCode = normalizeCode(body?.giftCardCode);

    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() || "";

    const {
      data: { user },
    } = token ? await authClient.auth.getUser(token) : { data: { user: null } };

    const service = createClient(supabaseUrl, supabaseServiceKey);

    let remaining = subtotal;

    const coupon = {
      code: couponCode,
      amountInr: 0,
      status: couponCode ? "invalid" : "not_applied",
      message: "",
    };

    if (couponCode) {
      let foundMemberCoupon = false;

      if (user?.id) {
        const { data: couponRow, error: couponError } = await service
          .from("member_coupons")
          .select("id, auth_user_id, amount_inr, status, expires_at")
          .eq("code", couponCode)
          .maybeSingle();

        if (couponError) {
          return new Response(JSON.stringify({ error: couponError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (couponRow) {
          foundMemberCoupon = true;
          if (couponRow.auth_user_id !== user.id) {
            coupon.status = "invalid_owner";
            coupon.message = "This coupon belongs to another account.";
          } else if (couponRow.status !== "active") {
            coupon.status = "inactive";
            coupon.message = "This coupon is no longer active.";
          } else if (couponRow.expires_at && new Date(couponRow.expires_at).getTime() < Date.now()) {
            coupon.status = "expired";
            coupon.message = "This coupon has expired.";
          } else {
            const amount = Math.min(remaining, Number(couponRow.amount_inr || 0));
            remaining = Math.max(0, remaining - amount);
            coupon.amountInr = amount;
            coupon.status = "applied";
          }
        }
      }

      if (!foundMemberCoupon) {
        // Fallback to checking general_coupons
        const { data: generalRow, error: generalError } = await service
          .from("general_coupons")
          .select("*")
          .eq("code", couponCode)
          .maybeSingle();

        if (generalError) {
          return new Response(JSON.stringify({ error: generalError.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (!generalRow) {
          coupon.status = "invalid";
          coupon.message = "Coupon code not found.";
        } else if (!generalRow.is_active) {
          coupon.status = "inactive";
          coupon.message = "This coupon is no longer active.";
        } else if (generalRow.require_membership && !user?.id) {
          coupon.status = "signin_required";
          coupon.message = "Sign in to use this coupon.";
        } else if (generalRow.expires_at && new Date(generalRow.expires_at).getTime() < Date.now()) {
          coupon.status = "expired";
          coupon.message = "This coupon has expired.";
        } else if (generalRow.min_order_amount_inr && subtotal < Number(generalRow.min_order_amount_inr)) {
          coupon.status = "invalid_subtotal";
          coupon.message = `Minimum order amount of ₹${generalRow.min_order_amount_inr} is required.`;
        } else if (generalRow.global_usage_limit && generalRow.global_usage_count >= generalRow.global_usage_limit) {
          coupon.status = "limit_reached";
          coupon.message = "This coupon has reached its maximum global usage limit.";
        } else {
          let limitReached = false;
          if (generalRow.per_member_usage_limit && user?.id) {
            const { count, error: countError } = await service
              .from("general_coupon_usages")
              .select("id", { count: 'exact', head: true })
              .eq("coupon_id", generalRow.id)
              .eq("auth_user_id", user.id);

            if (!countError && count != null && count >= generalRow.per_member_usage_limit) {
              coupon.status = "limit_reached";
              coupon.message = "You have reached your maximum usage limit for this coupon.";
              limitReached = true;
            }
          }

          if (!limitReached) {
            let amount = 0;
            if (generalRow.discount_type === 'percentage') {
              amount = (remaining * Number(generalRow.percentage_discount || 0)) / 100;
            } else if (generalRow.discount_type === 'fixed') {
              amount = Number(generalRow.fixed_amount_inr || 0);
            } else if (generalRow.discount_type === 'both') {
              amount = (remaining * Number(generalRow.percentage_discount || 0)) / 100 + Number(generalRow.fixed_amount_inr || 0);
            }

            if (generalRow.max_discount_inr && amount > Number(generalRow.max_discount_inr)) {
              amount = Number(generalRow.max_discount_inr);
            }

            amount = Math.min(remaining, amount);

            if (amount > 0) {
              remaining = Math.max(0, remaining - amount);
              coupon.amountInr = amount;
              coupon.status = "applied";
            } else {
              coupon.status = "invalid";
              coupon.message = "Coupon did not provide any discount.";
            }
          }
        }
      }
    }

    const giftCard = {
      code: giftCardCode,
      amountInr: 0,
      status: giftCardCode ? "invalid" : "not_applied",
      message: "",
    };

    if (giftCardCode) {
      const { data: giftCardRow, error: giftCardError } = await service
        .from("gift_cards")
        .select("id, balance_amount_inr, status, expires_at")
        .eq("code", giftCardCode)
        .maybeSingle();

      if (giftCardError) {
        return new Response(JSON.stringify({ error: giftCardError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!giftCardRow) {
        giftCard.status = "invalid";
        giftCard.message = "Gift card not found.";
      } else if (giftCardRow.status !== "active") {
        giftCard.status = "inactive";
        giftCard.message = "Gift card is not active.";
      } else if (giftCardRow.expires_at && new Date(giftCardRow.expires_at).getTime() < Date.now()) {
        giftCard.status = "expired";
        giftCard.message = "Gift card has expired.";
      } else {
        const balance = Number(giftCardRow.balance_amount_inr || 0);
        if (balance <= 0) {
          giftCard.status = "insufficient_balance";
          giftCard.message = "Gift card has no remaining balance.";
        } else {
          const amount = Math.min(remaining, balance);
          remaining = Math.max(0, remaining - amount);
          giftCard.amountInr = amount;
          giftCard.status = "applied";
        }
      }
    }

    const totalDiscount = Math.max(0, subtotal - remaining);

    return new Response(
      JSON.stringify({
        success: true,
        subtotal,
        totalDiscount,
        payableAmount: remaining,
        coupon,
        giftCard,
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
