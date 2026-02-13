import { supabase } from "./supabaseClient";

// Hardcoded values for GitHub Pages deployment (test keys are public, safe to hardcode)
const RAZORPAY_KEY_ID = "rzp_test_S1pqPZYLELIsdF";
const SUPABASE_URL = "https://uexezctcwupgaxqhgyeh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleGV6Y3Rjd3VwZ2F4cWhneWVoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4MjAxNTIsImV4cCI6MjA3OTM5NjE1Mn0.kUMmVMZ8EOGXSJREYJLDc446tZmhxywV6MghBpVV7bM";

if (!RAZORPAY_KEY_ID) {
  // eslint-disable-next-line no-console
  console.warn("Razorpay Key ID is missing");
}

/**
 * Initialize Razorpay payment
 * Calls Supabase Edge Function to create order in Razorpay
 */
export async function initializeRazorpayPayment(
  amount,
  orderId,
  customerDetails = {},
  items = []
) {
  try {
    const functionUrl = `${SUPABASE_URL}/functions/v1/create-razorpay-order`;
    
    const payload = {
      amount, // Amount in paise (smallest currency unit)
      orderId, // Your order ID from database
      customerDetails,
      items,
    };
    
    // eslint-disable-next-line no-console
    console.log("📤 Sending to Edge Function:");
    // eslint-disable-next-line no-console
    console.log("   Amount:", amount, "Type:", typeof amount);
    // eslint-disable-next-line no-console
    console.log("   OrderId:", orderId, "Type:", typeof orderId);
    // eslint-disable-next-line no-console
    console.log("   CustomerDetails:", JSON.stringify(customerDetails));
    // eslint-disable-next-line no-console
    console.log("   Full Payload:", JSON.stringify(payload));
    
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json();
      // eslint-disable-next-line no-console
      console.error("❌ Edge Function returned error:", error);
      throw new Error(error.error || `Failed to create Razorpay order: ${response.statusText}`);
    }

    const data = await response.json();
    // eslint-disable-next-line no-console
    console.log("📥 Received from Edge Function:", JSON.stringify(data));
    return data; // { razorpayOrderId, amount, currency }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error initializing Razorpay payment:", error);
    throw error;
  }
}

/**
 * Handle Razorpay payment success
 * Calls Supabase Edge Function to verify payment and update order
 */
export async function handlePaymentSuccess(paymentData) {
  try {
    const functionUrl = `${SUPABASE_URL}/functions/v1/verify-razorpay-payment`;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        razorpayPaymentId: paymentData.razorpay_payment_id,
        razorpayOrderId: paymentData.razorpay_order_id,
        razorpaySignature: paymentData.razorpay_signature,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Payment verification failed: ${response.statusText}`);
    }

    const result = await response.json();
    return result; // { success: true, orderId, transactionId }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error verifying payment:", error);
    throw error;
  }
}

/**
 * Get payment status from database
 */
export async function getPaymentStatus(orderId) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, razorpay_payment_id, razorpay_order_id")
      .eq("id", orderId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error fetching payment status:", error);
    throw error;
  }
}

/**
 * Load Razorpay script
 */
export function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
