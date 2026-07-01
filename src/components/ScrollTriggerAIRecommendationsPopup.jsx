import React from "react";
import { useNavigate } from "react-router-dom";
import {
  signUpWithEmailPassword,
  signInWithEmailPassword,
  saveMembershipProfile,
  initialMembershipProfileForm,
} from "../lib/membershipApi";

const POPUP_DISMISSED_KEY = "ai_popup_dismissed_session";

function isValidIndianPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return /^[6-9]\d{9}$/.test(digits) || /^91[6-9]\d{9}$/.test(digits);
}

function ScrollTriggerAIRecommendationsPopup({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [step, setStep] = React.useState("auth"); // "auth" or "profile"
  
  // Auth fields
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [phone, setPhone] = React.useState("");
  
  // Profile fields
  const [profile, setProfile] = React.useState(initialMembershipProfileForm);
  
  // UI states
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [createdUser, setCreatedUser] = React.useState(null);

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

  const handleAuthChange = (e) => {
    const { name, value } = e.target;
    if (name === "email") setEmail(value);
    if (name === "password") setPassword(value);
    if (name === "phone") setPhone(value);
  };

  const handleProfileChange = (e) => {
    const { name, value, type, checked } = e.target;
    setProfile((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email || !password || !phone) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (!isValidIndianPhone(phone)) {
      setError("Please enter a valid 10-digit Indian mobile number");
      return;
    }

    setLoading(true);
    try {
      const data = await signUpWithEmailPassword(email, password, phone);
      
      // Sign in to establish session for profile creation
      try {
        await signInWithEmailPassword(email, password);
      } catch (signInError) {
        setError("Account created. Please check your email for confirmation and sign in to continue.");
        return;
      }
      
      setCreatedUser(data?.user);
      setStep("profile");
    } catch (err) {
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!profile.skin_type) {
      setError("Please select your skin type");
      return;
    }

    if (!profile.concerns) {
      setError("Please enter your main concerns");
      return;
    }

    if (!profile.consent_to_process) {
      setError("Please consent to process your profile");
      return;
    }

    setLoading(true);
    try {
      // Pass the user ID from signup to avoid session timing issues
      await saveMembershipProfile(profile, { userId: createdUser?.id });

      // Mark popup as dismissed for this session
      sessionStorage.setItem(POPUP_DISMISSED_KEY, "true");
      
      // Close and redirect
      onClose?.();
      navigate("/account?signup=success");
    } catch (err) {
      setError(err.message || "Failed to save profile. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 px-4 py-5 sm:items-center sm:px-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recommendation-popup-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[#D4AF37]/50 bg-[#0b0b0b] shadow-[0_16px_70px_rgba(0,0,0,0.65)] my-auto"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Background orbs */}
        <div className="absolute -left-16 -top-16 h-48 w-48 rounded-full bg-[#D4AF37]/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-[#f2d690]/20 blur-3xl" aria-hidden="true" />

        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 inline-flex items-center justify-center rounded-full w-8 h-8 text-white/60 hover:text-white transition"
          aria-label="Close popup"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="relative space-y-4 p-5 sm:p-7 max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="space-y-2 pb-2">
            <div className="inline-flex items-center rounded-full border border-[#D4AF37]/70 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f2d690]">
              {step === "auth" ? "Personalized Skincare Profile" : "Your Skin Profile"}
            </div>
            <h2
              id="recommendation-popup-title"
              className="text-2xl font-semibold leading-tight text-[#f4d88f] sm:text-3xl"
            >
              {step === "auth"
                ? "Create Your Personalized Skincare Profile"
                : "Tell Us About Your Skin"}
            </h2>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {/* Auth Step */}
          {step === "auth" && (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <p className="text-sm text-white/80">
                Sign up in minutes to get your personalized skincare routine tailored just for you.
              </p>

              <label className="block text-sm text-white space-y-2">
                <span>Email Address *</span>
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={handleAuthChange}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none"
                  required
                  disabled={loading}
                />
              </label>

              <label className="block text-sm text-white space-y-2">
                <span>Password (min 8 characters) *</span>
                <input
                  type="password"
                  name="password"
                  value={password}
                  onChange={handleAuthChange}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none"
                  required
                  disabled={loading}
                />
              </label>

              <label className="block text-sm text-white space-y-2">
                <span>Mobile Number (10-digit) *</span>
                <input
                  type="tel"
                  name="phone"
                  value={phone}
                  onChange={handleAuthChange}
                  placeholder="98765 43210"
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none"
                  required
                  disabled={loading}
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#e4c25c] disabled:opacity-60 transition"
              >
                {loading ? "Creating Account..." : "Next: Tell Us Your Skin"}
              </button>

              <p className="text-[11px] text-white/60">
                A confirmation email will be sent to verify your account.
              </p>
            </form>
          )}

          {/* Profile Step */}
          {step === "profile" && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <p className="text-sm text-white/80">
                Answer a few quick questions so we can tailor recommendations just for you.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm text-white space-y-2">
                  <span>Skin Type *</span>
                  <select
                    name="skin_type"
                    value={profile.skin_type}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    required
                    disabled={loading}
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
                    value={profile.concerns}
                    onChange={handleProfileChange}
                    placeholder="acne, pigmentation, sensitivity"
                    className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none"
                    required
                    disabled={loading}
                  />
                </label>

                <label className="text-sm text-white space-y-2">
                  <span>Allergies (comma separated)</span>
                  <input
                    name="allergies"
                    value={profile.allergies}
                    onChange={handleProfileChange}
                    placeholder="rose oil, peppermint oil"
                    className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none"
                    disabled={loading}
                  />
                </label>

                <label className="text-sm text-white space-y-2">
                  <span>Avoid Ingredients (comma separated)</span>
                  <input
                    name="avoid_ingredients"
                    value={profile.avoid_ingredients}
                    onChange={handleProfileChange}
                    placeholder="fragrance, essential oil"
                    className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none"
                    disabled={loading}
                  />
                </label>

                <label className="text-sm text-white space-y-2">
                  <span>Sun Exposure</span>
                  <select
                    name="sun_exposure"
                    value={profile.sun_exposure}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    disabled={loading}
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
                    value={profile.sleep_hours}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    disabled={loading}
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
                    value={profile.stress_level}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    disabled={loading}
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
                    value={profile.water_intake}
                    onChange={handleProfileChange}
                    className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                    disabled={loading}
                  >
                    <option value="">Select</option>
                    <option value="Less than 1L">Less than 1L/day</option>
                    <option value="1 to 2L">1-2L/day</option>
                    <option value="More than 2L">More than 2L/day</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm text-white space-y-2">
                <span>Current Routine</span>
                <textarea
                  name="routine_steps"
                  value={profile.routine_steps}
                  onChange={handleProfileChange}
                  rows={3}
                  placeholder="AM cleanser + SPF, PM cleanser + serum..."
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none"
                  disabled={loading}
                />
              </label>

              <label className="block text-sm text-white space-y-2">
                <span>Products You Already Use</span>
                <textarea
                  name="current_products"
                  value={profile.current_products}
                  onChange={handleProfileChange}
                  rows={3}
                  placeholder="Any products currently in your routine"
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none"
                  disabled={loading}
                />
              </label>

              {/* Consent checkboxes */}
              <div className="space-y-2 rounded-xl border border-neutral-700 bg-black/40 p-4">
                <label className="flex items-start gap-3 text-sm text-white">
                  <input
                    type="checkbox"
                    name="consent_to_process"
                    checked={profile.consent_to_process}
                    onChange={handleProfileChange}
                    className="mt-1"
                    required
                    disabled={loading}
                  />
                  <span>
                    I consent to Advayacare processing my skin profile data to personalize product recommendations. *
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-white">
                  <input
                    type="checkbox"
                    name="consent_to_ai"
                    checked={profile.consent_to_ai}
                    onChange={handleProfileChange}
                    className="mt-1"
                    disabled={loading}
                  />
                  <span>
                    I consent to personalized recommendation generation and understand it is informational, not medical advice.
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setStep("auth");
                    setError("");
                  }}
                  disabled={loading}
                  className="flex-1 rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium text-white transition hover:border-[#D4AF37] hover:text-[#f4d88f] disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 rounded-full bg-[#D4AF37] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#e4c25c] disabled:opacity-60 transition"
                >
                  {loading ? "Creating Profile..." : "Create My Recommendation"}
                </button>
              </div>

              <p className="text-[11px] text-white/60">
                Your profile helps us generate personalized recommendations. You can update this anytime in your account.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ScrollTriggerAIRecommendationsPopup;
export { POPUP_DISMISSED_KEY };
