import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signOutMembership,
  signInWithGoogle,
  updateAuthUserPhone,
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
  const [missingPhone, setMissingPhone] = React.useState("");
  const { authReady, user, lastAuthEvent } = useMemberSession();
  const memberEmail = user?.email || "";
  const needsPhone = memberEmail && !user?.user_metadata?.phone;

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

  const handleGoogleSignIn = async () => {
    setError("");
    setStatus("");
    try {
      await signInWithGoogle();
    } catch (authError) {
      setError(authError.message || "Google sign in failed.");
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    try {
      if (!isValidIndianPhone(missingPhone)) {
        setError("Please enter a valid 10-digit Indian mobile number");
        return;
      }
      await updateAuthUserPhone(missingPhone);
      setStatus("Phone number saved. Your profile is complete.");
      window.location.reload();
    } catch (err) {
      setError(err.message || "Failed to update phone number.");
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
        {needsPhone ? (
          <div className="space-y-4">
            <p className="text-sm text-white/90">
              Welcome, {memberEmail}! Please complete your profile by providing your mobile number.
            </p>
            <form onSubmit={handlePhoneSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="tel"
                value={missingPhone}
                onChange={(e) => setMissingPhone(e.target.value)}
                placeholder="Phone Number (e.g. 9876543210)"
                className="flex-1 w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                required
                inputMode="numeric"
                pattern="^(\+91|91)?[6-9][0-9]{9}$"
                title="Enter a valid Indian mobile number"
              />
              <button
                type="submit"
                className="rounded-full bg-[#D4AF37] px-6 py-2 text-sm font-medium text-black hover:bg-[#e3c458] whitespace-nowrap"
              >
                Save Phone Number
              </button>
            </form>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-white/50 hover:text-white underline mt-2"
            >
              Cancel and Sign Out
            </button>
          </div>
        ) : memberEmail ? (
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

            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-neutral-700"></div>
              <span className="text-xs text-white/50 uppercase tracking-widest">or</span>
              <div className="h-px flex-1 bg-neutral-700"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-neutral-600 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>
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
