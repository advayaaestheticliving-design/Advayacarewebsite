import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🔵 === CREATE RAZORPAY ORDER FUNCTION STARTED ===");
    
    // Parse request body
    const body = await req.json();
    console.log("📖 Request body received:", JSON.stringify(body));
    console.log("   - amount:", body.amount, "type:", typeof body.amount);
    console.log("   - orderId:", body.orderId, "type:", typeof body.orderId);
    console.log("   - customerDetails:", JSON.stringify(body.customerDetails));
    
    const {
      orderId,
      customerDetails = {},
    } = body;

    // Validate required fields
    if (!orderId) {
      console.error("❌ Missing required fields");
      console.error("   - orderId check: !orderId =", !orderId, "value =", orderId);
      return new Response(
        JSON.stringify({
          error: "Missing required field: orderId",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Validation passed");
    // Get Supabase credentials
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("❌ Supabase credentials not found");
      return new Response(
        JSON.stringify({
          error: "Server configuration error: Supabase credentials missing",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch order from DB and use authoritative values for amount/customer
    const { data: order, error: orderFetchError } = await supabase
      .from("orders")
      .select("id, amount, currency, customer_name, customer_email, customer_phone, customer_address, customer_pin_code")
      .eq("id", orderId)
      .single();

    if (orderFetchError || !order) {
      console.error("❌ Failed to fetch order:", orderFetchError);
      return new Response(
        JSON.stringify({
          error: "Order not found",
          details: orderFetchError?.message,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountInInr = Number(order.amount ?? 0);
    if (!Number.isFinite(amountInInr) || amountInInr <= 0) {
      console.error("❌ Invalid order amount:", order.amount);
      return new Response(
        JSON.stringify({
          error: "Invalid order amount",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountInPaise = Math.round(amountInInr * 100);
    const resolvedCustomer = {
      name: order.customer_name || customerDetails.name || "",
      email: order.customer_email || customerDetails.email || "",
      phone: order.customer_phone || customerDetails.phone || "",
      address: order.customer_address || customerDetails.address || "",
      pinCode: order.customer_pin_code || customerDetails.pinCode || "",
    };

    console.log("💰 Amount INR (DB):", amountInInr);
    console.log("💰 Amount Paise (Razorpay):", amountInPaise);
    console.log("👤 Customer (DB preferred):", resolvedCustomer.name);

    // Get Razorpay credentials from environment
    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      console.error("❌ Razorpay credentials not found in environment");
      return new Response(
        JSON.stringify({
          error: "Server configuration error: Razorpay credentials missing",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("🔐 Razorpay credentials found");

    // Create Razorpay order via REST API
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    console.log("📡 Creating Razorpay order...");

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: order.currency || "INR",
        receipt: `order_${Date.now()}`,
        notes: {
          customer_name: resolvedCustomer.name,
          customer_email: resolvedCustomer.email,
          customer_phone: resolvedCustomer.phone,
          customer_address: resolvedCustomer.address,
          customer_pin_code: resolvedCustomer.pinCode,
        },
      }),
    });

    const razorpayData = await razorpayResponse.json();
    console.log("📊 Razorpay response status:", razorpayResponse.status);

    if (!razorpayResponse.ok) {
      console.error("❌ Razorpay API error:", razorpayData);
      return new Response(
        JSON.stringify({
          error: razorpayData.error?.description || "Failed to create Razorpay order",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Razorpay order created:", razorpayData.id);

    // Save Razorpay order ID to Supabase database
    console.log("📝 Saving order to database...");

    const { data: orderData, error: dbError } = await supabase
      .from("orders")
      .update({
        razorpay_order_id: razorpayData.id,
        status: "pending",
        fulfillment_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId)
      .select("id")
      .single();

    if (dbError) {
      console.error("❌ Database insert error:", dbError);
      return new Response(
        JSON.stringify({
          error: "Failed to save order to database",
          details: dbError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: existingPendingEvent } = await supabase
      .from("order_status_events")
      .select("id")
      .eq("order_id", orderData.id)
      .eq("status", "pending")
      .eq("status_kind", "payment")
      .limit(1)
      .maybeSingle();

    if (!existingPendingEvent?.id) {
      await supabase.from("order_status_events").insert({
        order_id: orderData.id,
        status: "pending",
        status_kind: "payment",
        notes: "Order created and payment initiated",
        metadata: { source: "create-razorpay-order" },
      });
    }

    console.log("✅ Order saved to database:", orderData.id);

    const response = {
      success: true,
      razorpayOrderId: razorpayData.id,
      orderId: orderData.id,
      amount: amountInPaise,
      currency: order.currency || "INR",
    };

    console.log("🎉 === FUNCTION COMPLETED SUCCESSFULLY ===");

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("💥 UNEXPECTED ERROR:", error);
    console.error("Error stack:", error.stack);

    return new Response(
      JSON.stringify({
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
