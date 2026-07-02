import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useMemberSession } from "../context/MemberSessionContext";
import { getMyCoupons, getMyGiftCards } from "../lib/walletApi";
import { getActiveGeneralCoupons, getMyGeneralCouponUsages } from "../lib/generalCouponsApi";
import { getOrCreateSessionId } from "../lib/cartApi";
import RazorpayCheckout from "../components/RazorpayCheckout";

function CartPage() {
  const navigate = useNavigate();
  const {
    items,
    subtotal,
    discountedTotal,
    discount,
    discountSnapshot,
    discountError,
    couponCode,
    giftCardCode,
    setCouponCode,
    setGiftCardCode,
    clearCouponCode,
    clearGiftCardCode,
    updateQuantity,
    removeFromCart,
    clearCart,
    checkout,
  } = useCart();

  const [localCoupon, setLocalCoupon] = useState(couponCode || "");
  const [localGiftCard, setLocalGiftCard] = useState(giftCardCode || "");

  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutSuccess, setCheckoutSuccess] = useState("");

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [paymentError, setPaymentError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  // Customer details for payment
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    addressLine2: "",
    pinCode: "",
  });

  const { user } = useMemberSession();
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [availableGiftCards, setAvailableGiftCards] = useState([]);

  useEffect(() => {
    async function fetchCoupons() {
      try {
        let memberCoupons = [];
        if (user) {
          const res = await getMyCoupons();
          if (res && !res.error) {
            memberCoupons = res.filter(c => c.status === 'active');
          }
          
          getMyGiftCards().then(res => {
            if (res && !res.error) setAvailableGiftCards(res.filter(g => g.status === 'active' && g.balance_amount_inr > 0));
          }).catch(console.error);
        }

        const guestSessionId = user ? null : getOrCreateSessionId();
        const [activeGeneral, myUsages] = await Promise.all([
          getActiveGeneralCoupons().catch(() => []),
          getMyGeneralCouponUsages(guestSessionId).catch(() => [])
        ]);

        const usageMap = {};
        myUsages.forEach(u => {
          usageMap[u.coupon_id] = (usageMap[u.coupon_id] || 0) + 1;
        });

        const generalCoupons = activeGeneral.filter(c => {
          if (c.min_order_amount_inr && subtotal < c.min_order_amount_inr) return false;
          if (c.global_usage_limit && c.global_usage_count >= c.global_usage_limit) return false;
          if (!user && !c.all_orders) return false; // Guest can't use member-only
          
          const myUsageCount = usageMap[c.id] || 0;
          if (c.per_member_usage_limit && myUsageCount >= c.per_member_usage_limit) return false;
          
          return true;
        }).map(c => {
          let amountLabel = "";
          if (c.discount_type === "fixed") amountLabel = `₹${c.fixed_amount_inr} Off`;
          else if (c.discount_type === "percentage") amountLabel = `${c.percentage_discount}% Off`;
          else amountLabel = `₹${c.fixed_amount_inr} + ${c.percentage_discount}% Off`;

          return {
            id: c.id,
            code: c.code,
            discountLabel: amountLabel,
            is_general: true
          };
        });

        setAvailableCoupons([...memberCoupons, ...generalCoupons]);
      } catch (err) {
        console.error("Failed to load coupons", err);
      }
    }

    fetchCoupons();
  }, [user, subtotal]);

  const formattedSubtotal = subtotal.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
  const formattedDiscountedTotal = discountedTotal.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
  const formattedDiscount = discount.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const handleCheckout = async () => {
    if (!items.length) return;
    setCheckoutError("");
    setCheckoutSuccess("");
    setPaymentError("");

    // Check if customer details are provided
    if (!customerDetails.name || !customerDetails.email || !customerDetails.phone || !customerDetails.address || !customerDetails.pinCode) {
      setCheckoutError("Please provide all details: name, email, phone, address, and pin code.");
      return;
    }

    setIsCheckingOut(true);
    try {
      const finalAddress = customerDetails.addressLine2 
        ? `${customerDetails.address}, ${customerDetails.addressLine2}`
        : customerDetails.address;
        
      const checkoutPayload = {
        ...customerDetails,
        address: finalAddress
      };

      const order = await checkout(checkoutPayload);
      if (order) {
        setCurrentOrder(order);
        setShowPaymentModal(true);
        setCheckoutSuccess("Order created. Please complete payment.");
      }
    } catch (err) {
      setCheckoutError("Failed to create order. Please try again.");
      // eslint-disable-next-line no-console
      console.error(err);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handlePaymentSuccess = (result) => {
    setShowPaymentModal(false);
    setPaymentSuccess(true);
    setCheckoutSuccess(
      `Payment successful! Transaction ID: ${result.transactionId}`
    );
    setPaymentError("");
    // Clear form
    setCustomerDetails({ name: "", email: "", phone: "", address: "", addressLine2: "", pinCode: "" });
    // Clear cart after successful payment
    clearCart();
    // Redirect to home after 2 seconds
    setTimeout(() => {
      navigate("/");
    }, 2000);
  };

  const handlePaymentError = (error) => {
    setPaymentError(error?.message || "Payment failed. Please try again.");
  };

  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-6 text-[#FFD700]">
        Your Cart
      </h1>

      {items.length === 0 ? (
        <p className="text-sm text-slate-600">Your cart is currently empty.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,_1.4fr)_minmax(0,_1fr)]">
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.productId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-[#FFD700] px-4 py-3 shadow-sm"
              >
                <div className="flex-1">
                  <h2 className="text-sm sm:text-base font-medium text-slate-900">
                    {item.name}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {Number(item.price_inr || 0).toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    })}
                  </p>
                  {Number.isFinite(Number(item.available_stock)) && (
                    <p className="text-[11px] text-slate-600 mt-1">
                      {Number(item.available_stock) > 0
                        ? `Available now: ${Number(item.available_stock)}`
                        : "Currently out of stock"}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={1}
                    max={Number.isFinite(Number(item.available_stock)) ? Math.max(1, Number(item.available_stock)) : undefined}
                    value={item.quantity}
                    onChange={(e) =>
                      updateQuantity(item.productId, Number(e.target.value))
                    }
                    className="w-16 rounded-full border border-slate-200 bg-white px-2 py-1 text-center text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                  />
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.productId)}
                    className="text-xs rounded-full bg-black text-white px-3 py-1 hover:bg-slate-800 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <aside className="space-y-5 rounded-2xl border border-slate-100 bg-[#FFD700] p-5 shadow-sm">
            <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
              Summary
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium text-slate-900">
                  {formattedSubtotal}
                </span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Discounts (coupon &amp; gift card)</span>
                <span>-{formattedDiscount}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between text-sm font-semibold text-slate-900">
                <span>Total</span>
                <span>{formattedDiscountedTotal}</span>
              </div>
            </div>

            <div className="space-y-3 pt-2 text-sm">
              {/* Customer Details Section */}
              <div className="space-y-3 bg-white bg-opacity-50 rounded-lg p-4 border border-slate-200">
                <h3 className="text-xs font-semibold text-slate-900 uppercase">
                  Delivery Details
                </h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={customerDetails.name}
                    onChange={(e) =>
                      setCustomerDetails({
                        ...customerDetails,
                        name: e.target.value,
                      })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                    placeholder="Full Name *"
                  />
                  <input
                    type="email"
                    value={customerDetails.email}
                    onChange={(e) =>
                      setCustomerDetails({
                        ...customerDetails,
                        email: e.target.value,
                      })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                    placeholder="Email Address *"
                  />
                  <input
                    type="tel"
                    value={customerDetails.phone}
                    onChange={(e) =>
                      setCustomerDetails({
                        ...customerDetails,
                        phone: e.target.value,
                      })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                    placeholder="Phone Number (10 digits) *"
                  />
                  <input
                    type="text"
                    value={customerDetails.address}
                    onChange={(e) =>
                      setCustomerDetails({
                        ...customerDetails,
                        address: e.target.value,
                      })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                    placeholder="Address Line 1 *"
                  />
                  <input
                    type="text"
                    value={customerDetails.addressLine2 || ""}
                    onChange={(e) =>
                      setCustomerDetails({
                        ...customerDetails,
                        addressLine2: e.target.value,
                      })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                    placeholder="Address Line 2 (Optional)"
                  />
                  <input
                    type="text"
                    value={customerDetails.pinCode}
                    onChange={(e) =>
                      setCustomerDetails({
                        ...customerDetails,
                        pinCode: e.target.value,
                      })
                    }
                    className="w-full rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                    placeholder="Pin Code *"
                  />
                </div>
              </div>

              {/* Available Coupons & Gift Cards */}
              {(availableCoupons.length > 0 || availableGiftCards.length > 0) && (
                <div className="space-y-3 bg-white bg-opacity-50 rounded-lg p-4 border border-slate-200">
                  <h3 className="text-xs font-semibold text-slate-900 uppercase">
                    Available For You
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                    {availableCoupons.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setLocalCoupon(c.code);
                          setCouponCode(c.code);
                        }}
                        className={`w-full text-left rounded-md px-3 py-2 text-xs font-medium border transition-colors ${
                          couponCode === c.code 
                            ? "border-[#b58b2f] bg-[#FFD700] bg-opacity-20 text-[#b58b2f]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[#b58b2f]"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>{c.code}</span>
                          <span className="font-semibold text-[#b58b2f]">
                            {c.discountLabel ? c.discountLabel : `₹${c.amount_inr} Off`}
                          </span>
                        </div>
                      </button>
                    ))}
                    {availableGiftCards.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setLocalGiftCard(g.code);
                          setGiftCardCode(g.code);
                        }}
                        className={`w-full text-left rounded-md px-3 py-2 text-xs font-medium border transition-colors ${
                          giftCardCode === g.code 
                            ? "border-[#b58b2f] bg-[#FFD700] bg-opacity-20 text-[#b58b2f]"
                            : "border-slate-200 bg-white text-slate-700 hover:border-[#b58b2f]"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span>Gift Card: {g.code.substring(0, 4)}...</span>
                          <span className="font-semibold text-[#b58b2f]">Balance: ₹{g.balance_amount_inr}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Coupon Code */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Coupon Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localCoupon}
                    onChange={(e) => setLocalCoupon(e.target.value)}
                    className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                    placeholder="Enter coupon (e.g. GLOW10)"
                  />
                  <button
                    type="button"
                    onClick={() => setCouponCode(localCoupon.trim())}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:border-[#b58b2f] hover:text-[#b58b2f] transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {couponCode && (
                  <p className="text-[11px] text-slate-700">
                    Coupon status: {discountSnapshot?.coupon?.status || "checking"}
                    {discountSnapshot?.coupon?.amountInr > 0
                      ? ` (−₹${Number(discountSnapshot.coupon.amountInr).toLocaleString("en-IN")})`
                      : ""}
                  </p>
                )}
              </div>

              {/* Gift Card Code */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700">
                  Gift Card Code
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={localGiftCard}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLocalGiftCard(v);
                      if (v === "") {
                        clearGiftCardCode();
                      }
                    }}
                    className="flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
                    placeholder="Enter gift card code"
                  />
                  {giftCardCode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setGiftCardCode(localGiftCard.trim());
                        }}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:border-[#b58b2f] hover:text-[#b58b2f] transition-colors"
                      >
                        Update
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          clearGiftCardCode();
                          setLocalGiftCard("");
                        }}
                        className="rounded-full bg-black text-white px-3 py-1.5 text-xs font-medium hover:bg-slate-800 transition-colors"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setGiftCardCode(localGiftCard.trim())}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 hover:border-[#b58b2f] hover:text-[#b58b2f] transition-colors"
                    >
                      Apply
                    </button>
                  )}
                </div>
                {giftCardCode && (
                  <p className="text-[11px] text-slate-700">
                    Gift card status: {discountSnapshot?.giftCard?.status || "checking"}
                    {discountSnapshot?.giftCard?.amountInr > 0
                      ? ` (−₹${Number(discountSnapshot.giftCard.amountInr).toLocaleString("en-IN")})`
                      : ""}
                  </p>
                )}
                {giftCardCode && (
                  <p className="text-[11px] text-slate-700 flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200">
                      Applied: {giftCardCode.toUpperCase()}
                    </span>
                    <span className="text-slate-600">(removing resets discount)</span>
                  </p>
                )}
              </div>
            </div>

            {/* Error Messages */}
            {checkoutError && (
              <p className="text-xs text-red-600 pt-1">{checkoutError}</p>
            )}
            {paymentError && (
              <p className="text-xs text-red-600 pt-1">{paymentError}</p>
            )}
            {discountError && (
              <p className="text-xs text-red-600 pt-1">{discountError}</p>
            )}
            
            {/* Success Messages */}
            {checkoutSuccess && !paymentSuccess && (
              <p className="text-xs text-emerald-700 pt-1">{checkoutSuccess}</p>
            )}
            {paymentSuccess && (
              <p className="text-xs text-emerald-700 pt-1">
                ✓ Payment successful! Redirecting...
              </p>
            )}

            {/* Checkout Button */}
            <button
              className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
              type="button"
              disabled={isCheckingOut || !items.length || paymentSuccess}
              onClick={handleCheckout}
            >
              {isCheckingOut ? "Processing..." : "Proceed to Checkout"}
            </button>
          </aside>
        </div>
      )}

      {/* Razorpay Payment Modal */}
      <RazorpayCheckout
        isOpen={showPaymentModal}
        orderId={currentOrder?.id}
        amount={discountedTotal}
        items={items}
        customerName={customerDetails.name}
        customerEmail={customerDetails.email}
        customerPhone={customerDetails.phone}
        customerAddress={customerDetails.address}
        customerPinCode={customerDetails.pinCode}
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        onCancel={handlePaymentCancel}
      />
    </div>
  );
}

export default CartPage;
