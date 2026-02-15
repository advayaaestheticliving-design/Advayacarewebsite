import React from "react";
import ProductCard from "../components/ProductCard";
import productsData from "../data/products.json";
import {
  getMembershipProfile,
  getMembershipRecommendations,
  saveMembershipProfile,
  sendMagicLink,
  signOutMembership,
  getMembershipIdentity,
} from "../lib/membershipApi";

const initialForm = {
  skin_type: "",
  concerns: "",
  allergies: "",
  avoid_ingredients: "",
  sun_exposure: "",
  sleep_hours: "",
  stress_level: "",
  water_intake: "",
  routine_steps: "",
  current_products: "",
  consent_to_process: false,
  consent_to_ai: false,
};

function MembershipPage() {
  const [form, setForm] = React.useState(initialForm);
  const [profileId, setProfileId] = React.useState(null);
  const [recommendations, setRecommendations] = React.useState([]);
  const [authEmail, setAuthEmail] = React.useState("");
  const [memberEmail, setMemberEmail] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        const identity = await getMembershipIdentity();
        if (!mounted) return;
        setMemberEmail(identity.user?.email || "");

        const profile = await getMembershipProfile();
        if (!mounted || !profile) return;

        setProfileId(profile.id);
        setForm({
          skin_type: profile.skin_type || "",
          concerns: (profile.concerns || []).join(", "),
          allergies: (profile.allergies || []).join(", "),
          avoid_ingredients: (profile.avoid_ingredients || []).join(", "),
          sun_exposure: profile.sun_exposure || "",
          sleep_hours: profile.sleep_hours || "",
          stress_level: profile.stress_level || "",
          water_intake: profile.water_intake || "",
          routine_steps: profile.routine_steps || "",
          current_products: profile.current_products || "",
          consent_to_process: Boolean(profile.consent_to_process),
          consent_to_ai: Boolean(profile.consent_to_ai),
        });

        const recs = await getMembershipRecommendations(profile.id, productsData);
        if (!mounted) return;
        setRecommendations(recs);
      } catch (bootError) {
        if (!mounted) return;
        setError(bootError.message || "Failed to load membership profile.");
      }
    };

    boot();

    return () => {
      mounted = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, type, value, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleMagicLink = async (event) => {
    event.preventDefault();
    setError("");
    setStatus("");

    try {
      await sendMagicLink(authEmail);
      setStatus("Magic link sent. Check your email to complete sign-in.");
    } catch (authError) {
      setError(authError.message || "Could not send magic link.");
    }
  };

  const handleSignOut = async () => {
    setError("");
    setStatus("");

    try {
      await signOutMembership();
      setMemberEmail("");
      setStatus("Signed out. Your guest profile is still available on this device.");
    } catch (authError) {
      setError(authError.message || "Could not sign out.");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStatus("");

    try {
      const profile = await saveMembershipProfile(form);
      setProfileId(profile.id);
      const recs = await getMembershipRecommendations(profile.id, productsData);
      setRecommendations(recs);
      setStatus("Profile saved. Your personalized recommendations are ready.");
    } catch (saveError) {
      setError(saveError.message || "Could not save profile.");
    } finally {
      setLoading(false);
    }
  };

  const recommendedProducts = recommendations
    .map((item) => {
      const product = productsData.find((p) => p.id === item.id);
      if (!product) return null;
      return {
        ...item,
        product,
      };
    })
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
      <div className="max-w-3xl space-y-3">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#D4AF37]">
          Membership Skin Profile
        </h1>
        <p className="text-sm sm:text-base text-white">
          Save your skin facts once and get product recommendations personalized to your concerns,
          routine, and ingredient preferences.
        </p>
        {profileId && <p className="text-xs text-white/70">Profile ID: {profileId}</p>}
      </div>

      <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4">
        <h2 className="text-xl font-semibold text-white">Member Sign-in (Optional)</h2>
        {memberEmail ? (
          <div className="space-y-3">
            <p className="text-sm text-white/90">Signed in as {memberEmail}</p>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black hover:bg-[#e3c458]"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              placeholder="Enter your email for a magic link"
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
              required
            />
            <button
              type="submit"
              className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black hover:bg-[#e3c458]"
            >
              Send Magic Link
            </button>
          </form>
        )}
      </section>

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

        {status && <p className="text-sm text-emerald-300">{status}</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-[#D4AF37]">Recommended for You</h2>
        {recommendedProducts.length === 0 ? (
          <p className="text-sm text-white/80">Complete your profile to get personalized recommendations.</p>
        ) : (
          <div className="space-y-6">
            {recommendedProducts.map((item) => (
              <div key={item.id} className="space-y-2">
                <div className="rounded-xl border border-neutral-700 bg-black/40 p-3">
                  <p className="text-sm text-white">
                    <span className="font-semibold">Why this match:</span> {item.reason}
                  </p>
                  {item.caution ? (
                    <p className="text-xs text-amber-300 mt-1">
                      <span className="font-semibold">Caution:</span> {item.caution}
                    </p>
                  ) : null}
                </div>
                <ProductCard product={item.product} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default MembershipPage;
