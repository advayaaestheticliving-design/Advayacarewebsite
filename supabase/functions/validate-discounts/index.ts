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

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const {
      data: { user },
    } = await authClient.auth.getUser();

    const service = createClient(supabaseUrl, supabaseServiceKey);

    let remaining = subtotal;

    const coupon = {
      code: couponCode,
      amountInr: 0,
      status: couponCode ? "invalid" : "not_applied",
      message: "",
    };

    if (couponCode) {
      if (!user?.id) {
        coupon.status = "signin_required";
        coupon.message = "Sign in to use member coupons.";
      } else {
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

        if (!couponRow) {
          coupon.status = "invalid";
          coupon.message = "Coupon code not found.";
        } else if (couponRow.auth_user_id !== user.id) {
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
