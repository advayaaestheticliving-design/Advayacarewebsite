import React from "react";

function MembershipProfileEditor({ form, onChange, onSubmit, onCancel, loading }) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-white">AI Recommendation Profile</h3>
          <p className="text-sm text-white/70">
            Update your skin profile when your routine changes. Recommendations refresh only after you save.
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
          >
            Cancel
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-sm text-white space-y-2">
          <span>Skin Type *</span>
          <select
            name="skin_type"
            value={form.skin_type}
            onChange={onChange}
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
            onChange={onChange}
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
            onChange={onChange}
            placeholder="rose oil, peppermint oil"
            className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
          />
        </label>

        <label className="text-sm text-white space-y-2">
          <span>Avoid Ingredients (comma separated)</span>
          <input
            name="avoid_ingredients"
            value={form.avoid_ingredients}
            onChange={onChange}
            placeholder="fragrance, essential oil"
            className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
          />
        </label>

        <label className="text-sm text-white space-y-2">
          <span>Sun Exposure</span>
          <select
            name="sun_exposure"
            value={form.sun_exposure}
            onChange={onChange}
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
            onChange={onChange}
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
            onChange={onChange}
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
            onChange={onChange}
            className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white"
          >
            <option value="">Select</option>
            <option value="Less than 1L">Less than 1L/day</option>
            <option value="1 to 2L">1-2L/day</option>
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
            onChange={onChange}
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
            onChange={onChange}
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
            onChange={onChange}
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
            onChange={onChange}
            className="mt-1"
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
        {loading ? "Saving..." : "Save Profile"}
      </button>
    </form>
  );
}

export default MembershipProfileEditor;
