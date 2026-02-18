import { supabase } from "./supabaseClient";

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!RAZORPAY_KEY_ID || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // eslint-disable-next-line no-console
  console.warn("Missing Razorpay/Supabase env vars; payments may not work.");
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authToken = session?.access_token || SUPABASE_ANON_KEY;
    const amountInPaise = Math.round((Number(amount) || 0) * 100);
    
    const payload = {
      amount: amountInPaise, // Amount in paise (smallest currency unit)
      orderId, // Your order ID from database
      customerDetails,
      items,
    };
    
    // eslint-disable-next-line no-console
    console.log("📤 Sending to Edge Function:");
    // eslint-disable-next-line no-console
    console.log("   Amount INR:", amount, "Type:", typeof amount);
    // eslint-disable-next-line no-console
    console.log("   Amount Paise:", amountInPaise, "Type:", typeof amountInPaise);
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
        Authorization: `Bearer ${authToken}`,
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
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authToken = session?.access_token || SUPABASE_ANON_KEY;
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
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
