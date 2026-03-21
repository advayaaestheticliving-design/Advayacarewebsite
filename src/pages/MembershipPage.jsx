import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  signInWithGoogle,
  signOutMembership,
  getMembershipIdentity,
} from "../lib/membershipApi";
import { supabase } from "../lib/supabaseClient";
import { ensureSignupCouponIssued } from "../lib/walletApi";

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
  const [memberEmail, setMemberEmail] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");

  const loadMemberIdentity = React.useCallback(async () => {
    const identity = await getMembershipIdentity();
    setMemberEmail(identity.user?.email || "");
  }, []);

  React.useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        await loadMemberIdentity();
      } catch (bootError) {
        if (!mounted) return;
        setError(bootError.message || "Failed to load membership state.");
      }
    };

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        return;
      }

      setMemberEmail(session?.user?.email || "");
      setError("");

      const createdAtMs = new Date(session?.user?.created_at || 0).getTime();
      const isRecentlyCreated =
        Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 10 * 60 * 1000;

      if (session?.user?.id && event === "SIGNED_IN" && isRecentlyCreated) {
        try {
          const couponResult = await ensureSignupCouponIssued();
          if (couponResult?.issued) {
            setStatus("Welcome! Your ₹100 member coupon is now active.");
          }
        } catch {
          // silent: coupon issuance should not block auth refresh
        }
      }

      try {
        await loadMemberIdentity();
      } catch (reloadError) {
        if (!mounted) return;
        setError(reloadError.message || "Failed to refresh membership state.");
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadMemberIdentity]);

  React.useEffect(() => {
    const queryMode = searchParams.get("mode");
    if (queryMode === "sign-up" || queryMode === "sign-in") {
      setAuthMode(queryMode);
    }
  }, [searchParams]);

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
          // silent: auth listener will retry if session propagation is delayed
        }
        const signedUpEmail = data?.user?.email || authEmail;
        const isConfirmed = Boolean(data?.session || data?.user?.email_confirmed_at);

        if (isConfirmed) {
          setMemberEmail(signedUpEmail);
          setStatus("Account created. Your ₹100 member coupon is active. Continue to My Account to set up your AI recommendation profile.");
        } else {
          setStatus("Account created. Please confirm your email first, then sign in to manage your AI recommendation profile.");
        }
      } else {
        const data = await signInWithEmailPassword(authEmail, authPassword);
        setMemberEmail(data?.user?.email || authEmail);
        setStatus("Signed in successfully. Your AI recommendation profile is available in My Account.");
      }
    } catch (authError) {
      setError(authError.message || "Authentication failed.");
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setStatus("");

    try {
      await signInWithGoogle();
      setStatus("Redirecting to Google sign-in...");
    } catch (authError) {
      setError(authError.message || "Could not start Google sign-in.");
    }
  };

  const handleSignOut = async () => {
    setError("");
    setStatus("");

    try {
      await signOutMembership();
      setMemberEmail("");
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
          Create your account or log in to access member pricing, coupons, orders, and your saved AI recommendation profile.
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
              Manage your AI recommendation profile and saved recommendations from My Account.
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
              {authMode === "sign-up" ? (
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 sm:col-span-1"
                  required
                  minLength={6}
                />
              ) : (
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 sm:col-span-1"
                  required
                  minLength={6}
                />
              )}
              <button
                type="submit"
                className="sm:col-span-1 rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black hover:bg-[#e3c458]"
              >
                {authMode === "sign-up" ? "Create Account" : "Sign In"}
              </button>
            </form>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="rounded-full border border-neutral-500 px-4 py-2 text-sm font-medium text-white hover:border-neutral-300"
            >
              Continue with Google
            </button>
          </div>
        )}
      </section>

      {memberEmail && showProfileForm && (
      <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-white space-y-2">
            <span>Skin Type *</span>
            <select
              name="skin_type"
              value={form.skin_type}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white"
              required
            >
              <option value="">Select skin type</option>
              <option value="Oily">Oily</option>
              <option value="Dry">Dry</option>
              <option value="Combination">Combination</option>
              <option value="Sensitive">Sensitive</option>
              <option value="Normal">Normal</option>
            </select>
          </label>

          <label className="text-sm text-white space-y-2">
            <span>Main Concerns (comma separated) *</span>
            <input
              name="concerns"
              value={form.concerns}
              onChange={handleChange}
              placeholder="acne, pigmentation, sensitivity"
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
              required
            />
          </label>

          <label className="text-sm text-white space-y-2">
            <span>Allergies (comma separated)</span>
            <input
              name="allergies"
              value={form.allergies}
              onChange={handleChange}
              placeholder="rose oil, peppermint oil"
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
            />
          </label>

          <label className="text-sm text-white space-y-2">
            <span>Avoid Ingredients (comma separated)</span>
            <input
              name="avoid_ingredients"
              value={form.avoid_ingredients}
              onChange={handleChange}
              placeholder="fragrance, essential oil"
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
            />
          </label>

          <label className="text-sm text-white space-y-2">
            <span>Sun Exposure</span>
            <select
              name="sun_exposure"
              value={form.sun_exposure}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white"
            >
              <option value="">Select</option>
              <option value="Low">Low (mostly indoors)</option>
              <option value="Medium">Medium (some outdoor time)</option>
              <option value="High">High (daily strong sun exposure)</option>
            </select>
          </label>

          <label className="text-sm text-white space-y-2">
            <span>Sleep</span>
            <select
              name="sleep_hours"
              value={form.sleep_hours}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white"
            >
              <option value="">Select</option>
              <option value="Less than 6">Less than 6 hours</option>
              <option value="6 to 8">6 to 8 hours</option>
              <option value="More than 8">More than 8 hours</option>
            </select>
          </label>

          <label className="text-sm text-white space-y-2">
            <span>Stress Level</span>
            <select
              name="stress_level"
              value={form.stress_level}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white"
            >
              <option value="">Select</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </label>

          <label className="text-sm text-white space-y-2">
            <span>Water Intake</span>
            <select
              name="water_intake"
              value={form.water_intake}
              onChange={handleChange}
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white"
            >
              <option value="">Select</option>
              <option value="Less than 1L">Less than 1L/day</option>
              <option value="1 to 2L">1–2L/day</option>
              <option value="More than 2L">More than 2L/day</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-sm text-white space-y-2">
            <span>Current Routine</span>
            <textarea
              name="routine_steps"
              value={form.routine_steps}
              onChange={handleChange}
              rows={4}
              placeholder="AM cleanser + SPF, PM cleanser + serum..."
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
            />
          </label>

          <label className="text-sm text-white space-y-2">
            <span>Products You Already Use</span>
            <textarea
              name="current_products"
              value={form.current_products}
              onChange={handleChange}
              rows={4}
              placeholder="Any products currently in your routine"
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
            />
          </label>
        </div>

        <div className="space-y-3 rounded-xl border border-neutral-700 bg-black/40 p-4">
          <label className="flex items-start gap-3 text-sm text-white">
            <input
              type="checkbox"
              name="consent_to_process"
              checked={form.consent_to_process}
              onChange={handleChange}
              className="mt-1"
              required
            />
            <span>
              I consent to Advayacare processing my skin profile data to personalize product recommendations.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-white">
            <input
              type="checkbox"
              name="consent_to_ai"
              checked={form.consent_to_ai}
              onChange={handleChange}
              className="mt-1"
              required
            />
            <span>
              I consent to AI-assisted recommendation generation and understand it is informational, not medical advice.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-medium text-black hover:bg-[#e3c458] disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save Profile & Generate Recommendations"}
        </button>

      </form>
      )}

      {status && <p className="text-sm text-emerald-300">{status}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!memberEmail && (
        <p className="text-sm text-white/80">Sign in or create an account to access your account dashboard and AI recommendation profile.</p>
      )}
    </div>
  );
}

export default MembershipPage;
