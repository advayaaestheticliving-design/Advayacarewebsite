import React, { useState } from "react";
import { useCart } from "../context/CartContext";

// Default quick-pick gift card amounts
const GIFT_AMOUNTS = [500, 1000, 2000];

function GiftCardPage() {
  const [selected, setSelected] = useState(GIFT_AMOUNTS[1]);
  const [customAmount, setCustomAmount] = useState("");
  const { addToCart } = useCart();

  const handleAddGiftCard = () => {
    const amount = Number(selected);
    if (!amount || amount <= 0) return;
    const id = `gift-card-${amount}`;
    const product = {
      id,
      name: `Advayacare Gift Card ${amount.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      })}`,
      price_inr: amount,
    };
    addToCart(product, 1);
  };

  const handleCustomBlur = () => {
    const amt = Number(customAmount);
    if (amt && amt > 0) {
      setSelected(amt);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#b58b2f]">
        Gift Cards
      </h1>
      <p className="text-sm sm:text-base leading-relaxed text-white max-w-prose">
        Share the quiet luxury of Advayacare with someone you love. Choose a
        gift card amount and we&apos;ll help you apply it to their ritual when
        checkout goes live.
      </p>

      <section className="rounded-3xl border border-[#b58b2f] bg-[#b58b2f] p-5 sm:p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-slate-900 uppercase">
          Choose an amount
        </h2>
        <div className="flex flex-wrap gap-3">
          {GIFT_AMOUNTS.map((amount) => {
            const isActive = amount === selected;
            return (
              <button
                key={amount}
                type="button"
                onClick={() => setSelected(amount)}
                className={`rounded-full px-4 py-2 text-sm font-medium border transition-colors ${
                  isActive
                    ? "border-[#b58b2f] bg-white text-slate-900 shadow-sm"
                    : "border-white/40 bg-white/80 text-slate-700 hover:border-white"
                }`}
              >
                {amount.toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                  maximumFractionDigits: 0,
                })}
              </button>
            );
          })}
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              placeholder="Custom"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onBlur={handleCustomBlur}
              className="w-24 rounded-full border border-white/60 bg-white/90 px-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/70"
            />
            <button
              type="button"
              onClick={() => {
                const amt = Number(customAmount);
                if (amt && amt > 0) setSelected(amt);
              }}
              className="rounded-full px-3 py-2 text-xs font-medium border border-white/70 bg-white/90 text-slate-700 hover:bg-white"
            >
              Set
            </button>
          </div>
        </div>
        <button type="button" onClick={handleAddGiftCard} className="btn-primary mt-2">
          Add Gift Card to Cart
        </button>
        <p className="text-[11px] text-slate-500 pt-1">
          Gift card codes are generated only after successful payment and then
          appear in your Account page.
        </p>
      </section>
    </div>
  );
}

export default GiftCardPage;
