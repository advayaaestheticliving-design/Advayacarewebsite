import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toNumber(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function randomToken(length = 10) {
  return crypto.randomUUID().replace(/-/g, "").slice(0, length).toUpperCase();
}

function parseGiftCardAmount(item: any) {
  const productId = String(item?.product_id || item?.productId || "");
  const match = productId.match(/^gift-card-(\d+)$/i);
  if (match) {
    return toNumber(match[1]);
  }

  const price = toNumber(item?.price_inr ?? item?.price ?? 0);
  const name = String(item?.name || "").toLowerCase();
  if (name.includes("gift card") && price > 0) {
    return price;
  }

  return 0;
}

async function createGiftCardWithRetry(
  supabase: ReturnType<typeof createClient>,
  payload: Record<string, unknown>
) {
  let lastError: any = null;

  for (let i = 0; i < 5; i += 1) {
    const code = `GIFT-${randomToken(10)}`;
    const { data, error } = await supabase
      .from("gift_cards")
      .insert({ ...payload, code })
      .select("id, code, initial_amount_inr, balance_amount_inr, status")
      .single();

    if (!error && data) {
      return { data, error: null };
    }

    lastError = error;
    if (error?.code !== "23505") {
      break;
    }
  }

  return { data: null, error: lastError };
}

async function verifySignature(
  message: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(message);

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const expectedSignature = await crypto.subtle.sign("HMAC", key, messageData);
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return expectedHex === signature;
  } catch (error) {
    console.error("❌ Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🔵 === VERIFY RAZORPAY PAYMENT FUNCTION STARTED ===");

    const body = await req.json();
    console.log("📖 Request body received");

    const {
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
    } = body;

    // Validate required fields
    if (!razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      console.error("❌ Missing required payment fields");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: razorpayPaymentId, razorpayOrderId, razorpaySignature",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ All payment fields present");
    console.log("📊 Order ID:", razorpayOrderId);
    console.log("💳 Payment ID:", razorpayPaymentId);

    // Get Razorpay secret
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeySecret) {
      console.error("❌ Razorpay secret not found in environment");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Razorpay secret missing",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("🔐 Razorpay secret found");

    // Verify signature
    const message = `${razorpayOrderId}|${razorpayPaymentId}`;
    console.log("🔍 Verifying HMAC-SHA256 signature...");

    const isSignatureValid = await verifySignature(
      message,
      razorpaySignature,
      razorpayKeySecret
    );

    if (!isSignatureValid) {
      console.error("❌ Signature verification failed");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment signature verification failed - possible fraud attempt",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Signature verified successfully");

    // Update order in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Supabase credentials not found");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Server configuration error: Supabase credentials missing",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log("📝 Updating order status in database...");

    const updatePayload = {
      razorpay_payment_id: razorpayPaymentId,
      status: "paid",
      fulfillment_status: "processing",
      fulfillment_updated_at: new Date().toISOString(),
      payment_confirmed: true,
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    let updatedOrder: any = null;
    let dbError: any = null;

    ({ data: updatedOrder, error: dbError } = await supabase
      .from("orders")
      .update(updatePayload)
      .eq("razorpay_order_id", razorpayOrderId)
      .select()
      .single());

    // Backward compatibility: if payment_confirmed is generated/missing,
    // retry without explicitly setting it.
    if (
      /payment_confirmed/i.test(dbError?.message || "") &&
      (dbError?.code === "PGRST204" || dbError?.code === "428C9")
    ) {
      const { payment_confirmed: _ignored, ...payloadWithoutPaymentConfirmed } = updatePayload;
      ({ data: updatedOrder, error: dbError } = await supabase
        .from("orders")
        .update(payloadWithoutPaymentConfirmed)
        .eq("razorpay_order_id", razorpayOrderId)
        .select()
        .single());
    }

    if (dbError) {
      console.error("❌ Database update error:", dbError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to update order status",
          details: dbError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!updatedOrder) {
      console.error("❌ Order not found for update");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Order not found in database",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingPaidEvent } = await supabase
      .from("order_status_events")
      .select("id")
      .eq("order_id", updatedOrder.id)
      .eq("status", "paid")
      .eq("status_kind", "payment")
      .limit(1)
      .maybeSingle();

    if (!existingPaidEvent?.id) {
      await supabase.from("order_status_events").insert({
        order_id: updatedOrder.id,
        status: "paid",
        status_kind: "payment",
        notes: "Payment verified successfully",
        metadata: {
          source: "verify-razorpay-payment",
          razorpay_payment_id: razorpayPaymentId,
        },
      });
    }

    const { data: existingProcessingEvent } = await supabase
      .from("order_status_events")
      .select("id")
      .eq("order_id", updatedOrder.id)
      .eq("status", "processing")
      .eq("status_kind", "fulfillment")
      .limit(1)
      .maybeSingle();

    if (!existingProcessingEvent?.id) {
      await supabase.from("order_status_events").insert({
        order_id: updatedOrder.id,
        status: "processing",
        status_kind: "fulfillment",
        notes: "Order moved to processing queue",
        metadata: { source: "verify-razorpay-payment" },
      });
    }

    const couponCode = String(updatedOrder.coupon_code || "").trim().toUpperCase();
    const couponAmountInr = toNumber(updatedOrder.coupon_amount_inr);
    const giftCardCode = String(updatedOrder.gift_card_code || "").trim().toUpperCase();
    const giftCardAmountInr = toNumber(updatedOrder.gift_card_amount_inr);

    if (couponCode && couponAmountInr > 0) {
      const { data: couponRow, error: couponFetchError } = await supabase
        .from("member_coupons")
        .select("id, auth_user_id, status")
        .eq("code", couponCode)
        .maybeSingle();

      if (couponFetchError) {
        console.error("❌ Failed to fetch coupon for redemption:", couponFetchError);
      } else if (couponRow?.status === "active") {
        const { error: couponUpdateError } = await supabase
          .from("member_coupons")
          .update({ status: "consumed", consumed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", couponRow.id)
          .eq("status", "active");

        if (couponUpdateError) {
          console.error("❌ Failed to mark coupon consumed:", couponUpdateError);
        } else {
          const { error: redemptionError } = await supabase.from("coupon_redemptions").insert({
            coupon_id: couponRow.id,
            auth_user_id: couponRow.auth_user_id,
            code: couponCode,
            order_id: updatedOrder.id,
            amount_inr: couponAmountInr,
          });

          if (redemptionError) {
            console.error("❌ Failed to insert coupon redemption:", redemptionError);
          }
        }
      }
    }

    if (giftCardCode && giftCardAmountInr > 0) {
      const { data: giftCardRow, error: giftCardFetchError } = await supabase
        .from("gift_cards")
        .select("id, balance_amount_inr, status")
        .eq("code", giftCardCode)
        .maybeSingle();

      if (giftCardFetchError) {
        console.error("❌ Failed to fetch gift card for debit:", giftCardFetchError);
      } else if (giftCardRow?.status === "active") {
        const currentBalance = toNumber(giftCardRow.balance_amount_inr);
        const debitAmount = Math.min(currentBalance, giftCardAmountInr);
        const nextBalance = Math.max(0, currentBalance - debitAmount);
        const nextStatus = nextBalance <= 0 ? "depleted" : "active";

        const { error: giftCardUpdateError } = await supabase
          .from("gift_cards")
          .update({
            balance_amount_inr: nextBalance,
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", giftCardRow.id)
          .eq("status", "active");

        if (giftCardUpdateError) {
          console.error("❌ Failed to update gift card balance:", giftCardUpdateError);
        } else {
          const { error: txError } = await supabase.from("gift_card_transactions").insert({
            gift_card_id: giftCardRow.id,
            tx_type: "debit",
            amount_inr: debitAmount,
            balance_after_inr: nextBalance,
            order_id: updatedOrder.id,
            notes: "Applied during checkout",
          });

          if (txError) {
            console.error("❌ Failed to insert gift card debit transaction:", txError);
          }
        }
      }
    }

    const rawItems = Array.isArray(updatedOrder.items) ? updatedOrder.items : [];
    const purchasedGiftCards: any[] = [];

    for (const item of rawItems) {
      const amount = parseGiftCardAmount(item);
      const qty = Math.max(1, Math.floor(toNumber(item?.quantity || 1)));
      if (amount <= 0) {
        continue;
      }

      for (let i = 0; i < qty; i += 1) {
        const { data: createdGiftCard, error: createGiftCardError } = await createGiftCardWithRetry(supabase, {
          initial_amount_inr: amount,
          balance_amount_inr: amount,
          status: "active",
          owner_auth_user_id: updatedOrder.auth_user_id || null,
          owner_email: updatedOrder.customer_email || null,
          purchased_order_id: updatedOrder.id,
          issued_to_name: updatedOrder.customer_name || null,
        });

        if (createGiftCardError || !createdGiftCard) {
          console.error("❌ Failed to create purchased gift card:", createGiftCardError);
          continue;
        }

        purchasedGiftCards.push(createdGiftCard);

        const { error: creditTxError } = await supabase.from("gift_card_transactions").insert({
          gift_card_id: createdGiftCard.id,
          tx_type: "credit",
          amount_inr: amount,
          balance_after_inr: amount,
          order_id: updatedOrder.id,
          notes: "Gift card issued after successful purchase",
        });

        if (creditTxError) {
          console.error("❌ Failed to insert gift card credit transaction:", creditTxError);
        }
      }
    }

    console.log("✅ Order status updated to 'paid'");

    const response = {
      success: true,
      message: "Payment verified and order updated successfully",
      orderId: updatedOrder.id,
      transactionId: razorpayPaymentId,
      paymentId: razorpayPaymentId,
      amount: updatedOrder.amount ?? updatedOrder.total_amount_inr,
      issuedGiftCards: purchasedGiftCards.map((gc) => ({
        id: gc.id,
        code: gc.code,
        amountInr: gc.initial_amount_inr,
        status: gc.status,
      })),
    };

    console.log("🎉 === PAYMENT VERIFICATION COMPLETED SUCCESSFULLY ===");

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("💥 UNEXPECTED ERROR:", error);
    console.error("Error stack:", error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
