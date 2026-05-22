import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { validateGeneralCoupon, recordGeneralCouponUsage } from "../lib/generalCouponsApi";
import { useMemberSession } from "../context/MemberSessionContext";

export default function CouponRedemptionPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useMemberSession();
  
  const [couponCode, setCouponCode] = useState("");
  const [subtotal, setSubtotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationResult, setValidationResult] = useState(null);
  const [step, setStep] = useState("input"); // input, validated, applied

  useEffect(() => {
    // Get subtotal from cart context if available
    const cartData = localStorage.getItem("cartData");
    if (cartData) {
      try {
        const { subtotal: cartSubtotal } = JSON.parse(cartData);
        setSubtotal(cartSubtotal || 0);
      } catch {
        setSubtotal(0);
      }
    }
  }, []);

  const handleValidate = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await validateGeneralCoupon({
        couponCode,
        subtotal,
        guestSessionId: !isAuthenticated ? localStorage.getItem("guestSessionId") : null,
      });

      setValidationResult(result);
      setStep("validated");
    } catch (err) {
      setError(err.message || "Failed to validate coupon");
      setStep("input");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async () => {
    if (!validationResult || !validationResult.valid) {
      setError("Invalid coupon");
      return;
    }

    setLoading(true);
    try {
      await recordGeneralCouponUsage({
        couponCode,
        discountAmount: validationResult.finalDiscount,
      });

      // Store coupon in cart
      localStorage.setItem("appliedCoupon", JSON.stringify(validationResult));
      setStep("applied");
      
      setTimeout(() => {
        navigate("/cart");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to apply coupon");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = () => {
    navigate("/signup?from=coupon");
  };

  const handleReset = () => {
    setCouponCode("");
    setError("");
    setValidationResult(null);
    setStep("input");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">Apply Coupon</h1>
          <p className="text-purple-200 text-lg">
            Use your coupon code to get an exclusive discount
          </p>
        </div>

        {/* Main Card */}
        <div className="max-w-md mx-auto bg-slate-800/50 backdrop-blur border border-purple-500/30 rounded-lg p-8">
          {/* Input Step */}
          {step === "input" && (
            <form onSubmit={handleValidate} className="space-y-6">
              <div>
                <label className="block text-white font-medium mb-2">
                  Coupon Code
                </label>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="w-full px-4 py-3 bg-slate-700 border border-purple-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-purple-500"
                  disabled={loading}
                />
              </div>

              {subtotal > 0 && (
                <div className="bg-purple-900/30 border border-purple-500/20 rounded-lg p-4">
                  <p className="text-slate-300 text-sm">Order Subtotal</p>
                  <p className="text-white text-2xl font-bold">₹{subtotal.toFixed(2)}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4">
                  <p className="text-red-200 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !couponCode}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {loading ? "Validating..." : "Validate Coupon"}
              </button>
            </form>
          )}

          {/* Validated Step */}
          {step === "validated" && validationResult && validationResult.valid && (
            <div className="space-y-6">
              <div className="bg-green-900/30 border border-green-500/30 rounded-lg p-4">
                <p className="text-green-200 text-sm mb-2">✓ Coupon Valid</p>
                <p className="text-white text-lg font-semibold">{validationResult.code}</p>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Discount Type</span>
                  <span className="text-white font-medium capitalize">
                    {validationResult.discountType}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-300">Your Discount</span>
                  <span className="text-green-400 font-bold text-lg">
                    ₹{validationResult.finalDiscount.toFixed(2)}
                  </span>
                </div>

                {validationResult.discountPercentage && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-300">Percentage</span>
                    <span className="text-white">{validationResult.discountPercentage}%</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-700 mt-4">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-300">New Total</span>
                    <span className="text-white text-lg font-bold">
                      ₹{(subtotal - validationResult.finalDiscount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleApply}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  {loading ? "Applying..." : "Apply Coupon"}
                </button>

                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Change Coupon
                </button>
              </div>
            </div>
          )}

          {/* Applied Step */}
          {step === "applied" && (
            <div className="text-center space-y-6">
              <div className="text-5xl">✓</div>
              <div>
                <h3 className="text-white text-xl font-bold mb-2">Coupon Applied!</h3>
                <p className="text-slate-300 text-sm">
                  You saved ₹{validationResult?.finalDiscount?.toFixed(2)}
                </p>
              </div>
              <p className="text-slate-400 text-sm">Redirecting to cart...</p>
            </div>
          )}

          {/* Membership Required Message */}
          {step === "input" && !isAuthenticated && (
            <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 mt-6">
              <p className="text-blue-200 text-sm mb-3">
                Create an account to use this coupon
              </p>
              <button
                onClick={handleSignUp}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition-colors text-sm"
              >
                Create Account
              </button>
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="text-center mt-8">
          <button
            onClick={() => navigate("/cart")}
            className="text-purple-300 hover:text-purple-200 text-sm font-medium transition-colors"
          >
            ← Back to Cart
          </button>
        </div>
      </div>
    </div>
  );
}
