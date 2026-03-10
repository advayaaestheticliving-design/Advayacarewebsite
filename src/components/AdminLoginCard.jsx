import React from "react";
import { getAdminEmail } from "../lib/adminOrdersApi";

function AdminLoginCard({
  authLoading,
  signedInEmail,
  otpCode,
  setOtpCode,
  otpSent,
  otpCooldownSeconds,
  status,
  error,
  onSendOtp,
  onVerifyOtp,
  onSignOut,
}) {
  async function handleSend(event) {
    event.preventDefault();
    await onSendOtp();
  }

  async function handleVerify(event) {
    event.preventDefault();
    await onVerifyOtp();
  }

  return (
    <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white">Admin Login</h2>
      <p className="text-sm text-white/80">
        This is an independent admin workflow. Sign in only with {getAdminEmail()}.
      </p>

      {signedInEmail && signedInEmail !== getAdminEmail() ? (
        <div className="rounded-xl border border-amber-700 bg-amber-950/40 px-4 py-3 text-xs text-amber-200 space-y-2">
          <p>Signed in as {signedInEmail}. This account is not authorized for admin access.</p>
          <button
            type="button"
            onClick={onSignOut}
            disabled={authLoading}
            className="rounded-full border border-amber-500 px-3 py-1 font-medium hover:bg-amber-500/10 disabled:opacity-60"
          >
            {authLoading ? "Signing out..." : "Sign Out Current Session"}
          </button>
        </div>
      ) : null}

      <form onSubmit={handleSend} className="space-y-3">
        <button
          type="submit"
          disabled={authLoading || otpCooldownSeconds > 0}
          className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e3c458] disabled:opacity-60"
        >
          {authLoading
            ? "Sending code..."
            : otpCooldownSeconds > 0
              ? `Resend in ${otpCooldownSeconds}s`
              : otpSent
                ? "Resend Code"
                : "Send OTP Code"}
        </button>
      </form>

      {otpSent ? (
        <form onSubmit={handleVerify} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <input
            type="text"
            value={otpCode}
            onChange={(event) => setOtpCode(event.target.value)}
            placeholder="Enter OTP code"
            className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
            required
          />
          <button
            type="submit"
            disabled={authLoading}
            className="rounded-full border border-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-60"
          >
            {authLoading ? "Verifying..." : "Verify OTP"}
          </button>
        </form>
      ) : null}

      {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </section>
  );
}

export default AdminLoginCard;
