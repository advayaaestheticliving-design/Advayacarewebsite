import React, { useEffect, useState } from "react";
import {
  initializeRazorpayPayment,
  handlePaymentSuccess,
  loadRazorpayScript,
  releaseOrderInventory,
} from "../lib/razorpayApi";

export default function RazorpayCheckout({
  orderId,
  amount,
  items = [],
  customerEmail,
  customerName,
  customerPhone,
  customerAddress,
  customerPinCode,
  onSuccess,
  onError,
  onCancel,
  isOpen,
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const releaseReservation = async (reason) => {
    if (!orderId) return;

    try {
      await releaseOrderInventory(orderId, reason);
    } catch (releaseError) {
      // eslint-disable-next-line no-console
      console.warn("Could not release reserved inventory", releaseError);
    }
  };

  const handlePayment = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay script");
      }

      // Initialize payment with backend
      const razorpayOrderData = await initializeRazorpayPayment(
        amount,
        orderId,
        {
          name: customerName,
          email: customerEmail,
          phone: customerPhone,
          address: customerAddress,
          pinCode: customerPinCode,
        },
        items
      );

      // Open Razorpay checkout
      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID,
        // Do not pass `amount` when using `order_id` to avoid unit/display mismatches.
        currency: razorpayOrderData.currency || "INR",
        name: "Advayacare",
        description: "Skincare Products Purchase",
        order_id: razorpayOrderData.razorpayOrderId,
        prefill: {
          name: customerName || "",
          email: customerEmail || "",
          contact: customerPhone || "",
        },
        handler: async (response) => {
          try {
            // Verify payment on backend
            const verificationResult = await handlePaymentSuccess({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });

            // Call success callback
            if (onSuccess) {
              onSuccess(verificationResult);
            }
          } catch (err) {
            setError(
              err.message || "Payment verification failed. Please contact support."
            );
            if (onError) {
              onError(err);
            }
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: async () => {
            setIsProcessing(false);
            await releaseReservation("checkout_dismissed");
            if (onCancel) {
              onCancel();
            }
          },
        },
        theme: {
          color: "#FFD700",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setError(err.message || "Failed to initialize payment");
      await releaseReservation("checkout_initialization_failed");
      setIsProcessing(false);
      if (onError) {
        onError(err);
      }
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-lg mx-4">
        {/* Close button */}
        <button
          onClick={async () => {
            setIsProcessing(false);
            await releaseReservation("checkout_closed");
            if (onCancel) onCancel();
          }}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          disabled={isProcessing}
        >
          <svg
            className="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          Complete Your Payment
        </h2>
        <p className="text-sm text-slate-600 mb-6">
          Secure payment powered by Razorpay
        </p>

        {/* Order Details */}
        <div className="space-y-3 bg-slate-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Order ID</span>
            <span className="text-sm font-mono text-slate-900">{orderId}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-600">Amount</span>
            <span className="text-lg font-semibold text-[#FFD700]">
              ₹{amount.toLocaleString("en-IN", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="space-y-3 mb-6 text-sm">
          {customerName && (
            <div>
              <p className="text-xs text-slate-600">Name</p>
              <p className="text-slate-900">{customerName}</p>
            </div>
          )}
          {customerEmail && (
            <div>
              <p className="text-xs text-slate-600">Email</p>
              <p className="text-slate-900">{customerEmail}</p>
            </div>
          )}
          {customerPhone && (
            <div>
              <p className="text-xs text-slate-600">Phone</p>
              <p className="text-slate-900">{customerPhone}</p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={async () => {
              setIsProcessing(false);
              await releaseReservation("checkout_cancelled");
              if (onCancel) onCancel();
            }}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-200 rounded-full hover:bg-slate-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handlePayment}
            disabled={isProcessing}
            className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#FFD700] text-slate-900 rounded-full hover:bg-[#e6c200] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {isProcessing ? "Processing..." : "Pay Now"}
          </button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          Your payment is secured and encrypted
        </p>
      </div>
    </div>
  );
}
