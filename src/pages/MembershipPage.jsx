import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signOutMembership,
} from "../lib/membershipApi";
import { ensureSignupCouponIssued } from "../lib/walletApi";
import { useMemberSession } from "../context/MemberSessionContext";

function isValidIndianPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits);
}

function MembershipPage() {
  const [searchParams] = useSearchParams();
  const [authEmail, setAuthEmail] = React.useState("");
  const [authPassword, setAuthPassword] = React.useState("");
  const [authPhone, setAuthPhone] = React.useState("");
  const [authMode, setAuthMode] = React.useState(
    searchParams.get("mode") === "sign-up" ? "sign-up" : "sign-in",
  );
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const { authReady, user, lastAuthEvent } = useMemberSession();
  const memberEmail = user?.email || "";

  React.useEffect(() => {
    const queryMode = searchParams.get("mode");
    if (queryMode === "sign-up" || queryMode === "sign-in") {
      setAuthMode(queryMode);
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (!authReady) {
      return;
    }

    setError("");
  }, [authReady, memberEmail]);

  React.useEffect(() => {
    if (!authReady || !user?.id || lastAuthEvent !== "SIGNED_IN") {
      return;
    }

    const createdAtMs = new Date(user.created_at || 0).getTime();
    const isRecentlyCreated = Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 10 * 60 * 1000;

    if (!isRecentlyCreated) {
      return;
    }

    ensureSignupCouponIssued()
      .then((couponResult) => {
        if (couponResult?.issued) {
          setStatus("Welcome! Your ₹100 member coupon is now active.");
        }
      })
      .catch(() => undefined);
  }, [authReady, lastAuthEvent, user]);

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    try {
      if (authMode === "sign-up") {
        if (!isValidIndianPhone(authPhone)) {
          setError("Please enter a valid 10-digit Indian mobile number");
          return;
        }

        const data = await signUpWithEmailPassword(authEmail, authPassword, authPhone);

        try {
          await ensureSignupCouponIssued();
        } catch {
          // silent: coupon issuance should not block auth completion
        }

        const isConfirmed = Boolean(data?.session || data?.user?.email_confirmed_at);

        if (isConfirmed) {
          setStatus("Account created. Your ₹100 member coupon is active. Continue to My Account to set up your personalized profile.");
        } else {
          setStatus("Account created. Please confirm your email first, then sign in to manage your personalized profile.");
        }
      } else {
        await signInWithEmailPassword(authEmail, authPassword);
        setStatus("Signed in successfully. Your personalized profile is available in My Account.");
      }
    } catch (authError) {
      setError(authError.message || "Authentication failed.");
    }
  };

  const handleSignOut = async () => {
    setError("");
    setStatus("");

    try {
      await signOutMembership();
      setStatus("Signed out.");
    } catch (authError) {
      setError(authError.message || "Could not sign out.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <div className="max-w-3xl space-y-3">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#D4AF37]">
          Log In / Sign Up
        </h1>
        <p className="text-sm sm:text-base text-white">
          Create your account or log in to access member pricing, coupons, orders, and your saved personalized profile.
        </p>
      </div>

      <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4">
        <h2 className="text-xl font-semibold text-white">Account Access</h2>
        {memberEmail ? (
          <div className="space-y-3">
            <p className="text-sm text-white/90">Signed in as {memberEmail}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/account"
                className="rounded-full border border-[#D4AF37] px-4 py-2 text-sm font-medium text-[#D4AF37] hover:bg-[#D4AF37]/10"
              >
                Go to My Account
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black hover:bg-[#e3c458]"
              >
                Sign Out
              </button>
            </div>
            <p className="text-sm text-white/70">
              Manage your personalized profile and saved recommendations from My Account.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("sign-in")}
                className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                  authMode === "sign-in"
                    ? "bg-[#D4AF37] text-black"
                    : "border border-neutral-600 text-white"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("sign-up")}
                className={`rounded-full px-4 py-1.5 text-xs font-medium ${
                  authMode === "sign-up"
                    ? "bg-[#D4AF37] text-black"
                    : "border border-neutral-600 text-white"
                }`}
              >
                Sign Up
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="Email"
                className="sm:col-span-1 w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                required
              />
              {authMode === "sign-up" && (
                <input
                  type="tel"
                  value={authPhone}
                  onChange={(e) => setAuthPhone(e.target.value)}
                  placeholder="Phone Number (e.g. 9876543210)"
                  className="sm:col-span-1 w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                  required
                  inputMode="numeric"
                  pattern="^(\\+91|91)?[6-9][0-9]{9}$"
                  title="Enter a valid Indian mobile number"
                />
              )}
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="Password"
                className="sm:col-span-1 w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                required
                minLength={6}
              />
              <button
                type="submit"
                className="sm:col-span-1 rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black hover:bg-[#e3c458]"
              >
                {authMode === "sign-up" ? "Create Account" : "Sign In"}
              </button>
            </form>
          </div>
        )}
      </section>

      {status && <p className="text-sm text-emerald-300">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!memberEmail && (
        <p className="text-sm text-white/80">
          Sign in or create an account to access your account dashboard and personalized profile.
        </p>
      )}
    </div>
  );
}

export default MembershipPage;
