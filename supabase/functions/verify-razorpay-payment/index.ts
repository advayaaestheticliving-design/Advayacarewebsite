import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { data: updatedOrder, error: dbError } = await supabase
      .from("orders")
      .update({
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
        status: "paid",
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("razorpay_order_id", razorpayOrderId)
      .select()
      .single();

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

    console.log("✅ Order status updated to 'paid'");
    console.log("📧 Customer email:", updatedOrder.customer_email);

    const response = {
      success: true,
      message: "Payment verified and order updated successfully",
      orderId: updatedOrder.id,
      paymentId: razorpayPaymentId,
      amount: updatedOrder.amount,
      customerEmail: updatedOrder.customer_email,
      customerName: updatedOrder.customer_name,
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
