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
      amount, 
      orderId, 
      customerDetails = {},
      items = [],
    } = body;

    // Validate required fields
    if (!amount || !customerDetails || !Array.isArray(items)) {
      console.error("❌ Missing required fields");
      console.error("   - amount check: !amount =", !amount, "value =", amount);
      console.error("   - customerDetails check: !customerDetails =", !customerDetails, "value =", JSON.stringify(customerDetails));
      console.error("   - items check: !Array.isArray(items) =", !Array.isArray(items));
      return new Response(
        JSON.stringify({
          error: "Missing required fields: amount, customerDetails, items",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✅ Validation passed");
    console.log("💰 Amount:", amount);
    console.log("👤 Customer:", customerDetails.name);
    console.log("🧺 Items count:", items.length);

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
        // `amount` is expected in paise from the frontend. Do NOT multiply again.
        amount: amount,
        currency: "INR",
        receipt: `order_${Date.now()}`,
        notes: {
          customer_name: customerDetails.name || "",
          customer_email: customerDetails.email || "",
          customer_phone: customerDetails.phone || "",
          customer_address: customerDetails.address || "",
          customer_pin_code: customerDetails.pinCode || "",
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

    // Save order to Supabase database
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
    console.log("📝 Saving order to database...");

    const { data: orderData, error: dbError } = await supabase
      .from("orders")
      .insert([
        {
          razorpay_order_id: razorpayData.id,
          customer_name: customerDetails.name,
          customer_email: customerDetails.email,
          customer_phone: customerDetails.phone,
          customer_address: customerDetails.address,
          customer_pin_code: customerDetails.pinCode,
          amount: amount,
          currency: "INR",
          status: "pending",
          items,
        },
      ])
      .select()
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

    console.log("✅ Order saved to database:", orderData.id);

    const response = {
      success: true,
      razorpayOrderId: razorpayData.id,
      orderId: orderData.id,
      amount: amount,
      currency: "INR",
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
