import React from "react";
import { Link } from "react-router-dom";

const copyByVariant = {
  A: {
    badge: "New Member Welcome",
    title: "Unlock your free AI skincare recommendation",
    body:
      "Join as a member in minutes and get your personalized product match tailored for you.",
    timerLabel: "Offer window on this page:",
    cta: "Register As Member",
    secondary: "Maybe Later",
  },
  B: {
    badge: "AI Skin Match",
    title: "Get your smartest routine in under 3 minutes",
    body:
      "Create your member account to receive an AI-powered skin routine built for your goals, concerns, and lifestyle.",
    timerLabel: "Priority access countdown:",
    cta: "Start Free Recommendation",
    secondary: "Not Right Now",
  },
};

const entranceMotion = {
  card: { animation: "slideUp 0.55s ease-out 0ms both" },
  badge: { animation: "fadeIn 0.45s ease-out 90ms both" },
  title: { animation: "slideUp 0.5s ease-out 160ms both" },
  body: { animation: "fadeIn 0.5s ease-out 220ms both" },
  timer: { animation: "slideUp 0.45s ease-out 300ms both" },
  ctas: { animation: "fadeIn 0.45s ease-out 380ms both" },
  note: { animation: "fadeIn 0.45s ease-out 460ms both" },
};

function formatCountdown(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function MembershipPromoPopup({
  isOpen,
  onClose,
  onRegister,
  secondsLeft = 120,
  variant = "A",
}) {
  const selectedVariant = copyByVariant[variant] ? variant : "A";
  const promoCopy = copyByVariant[selectedVariant];

  React.useEffect(() => {
    if (!isOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-5 sm:items-center sm:px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="membership-promo-title"
      aria-describedby="membership-promo-description"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#D4AF37]/50 bg-[#0b0b0b] shadow-[0_16px_70px_rgba(0,0,0,0.65)]"
        style={entranceMotion.card}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#D4AF37]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-[#f2d690]/20 blur-3xl" aria-hidden="true" />

        <div className="relative space-y-4 p-5 sm:p-7">
          <div
            className="inline-flex items-center rounded-full border border-[#D4AF37]/70 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f2d690]"
            style={entranceMotion.badge}
          >
            {promoCopy.badge}
          </div>

          <h2
            id="membership-promo-title"
            className="text-2xl font-semibold leading-tight text-[#f4d88f] sm:text-3xl"
            style={entranceMotion.title}
          >
            {promoCopy.title}
          </h2>

          <p
            id="membership-promo-description"
            className="text-sm leading-relaxed text-white/90 sm:text-base"
            style={entranceMotion.body}
          >
            {promoCopy.body} Your signup also generates a unique welcome coupon code in this format:{" "}
            <span className="badge-gold-glow ml-1 inline-flex rounded-full bg-[#D4AF37] px-2 py-0.5 font-semibold text-black">
              MEM100-XXXX
            </span>
          </p>

          <div
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/90"
            style={entranceMotion.timer}
          >
            {promoCopy.timerLabel}{" "}
            <span className="font-semibold text-[#f4d88f]">{formatCountdown(secondsLeft)}</span>
          </div>

          <div className="flex flex-col gap-2 pt-1 sm:flex-row" style={entranceMotion.ctas}>
            <Link
              to="/membership?mode=sign-up&source=shop-promo"
              onClick={onRegister}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-[#e4c25c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              {promoCopy.cta}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium text-white transition hover:border-[#D4AF37] hover:text-[#f4d88f]"
            >
              {promoCopy.secondary}
            </button>
          </div>

          <p className="text-[11px] text-white/60" style={entranceMotion.note}>
            Coupon is generated after successful signup and can be used on your first qualifying order.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MembershipPromoPopup;
