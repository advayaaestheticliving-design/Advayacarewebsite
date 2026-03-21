import React from "react";

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatList(items, emptyLabel = "Not added yet") {
  if (!Array.isArray(items) || items.length === 0) {
    return emptyLabel;
  }

  return items.join(", ");
}

function SummaryRow({ label, value }) {
  return (
    <div className="rounded-xl border border-neutral-700 bg-black/60 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-1 text-sm text-white">{value || "Not added yet"}</p>
    </div>
  );
}

function MembershipProfileSummary({ profile, onEdit }) {
  if (!profile) {
    return null;
  }

  return (
    <section className="rounded-[28px] border border-neutral-700 bg-gradient-to-br from-black/70 via-black/55 to-[#201407]/70 p-5 sm:p-6 space-y-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">AI Recommendation Profile</h2>
          <p className="text-sm text-white/70 mt-1">
            Your recommendations stay saved until you update this profile again.
          </p>
          {profile.updated_at ? (
            <p className="text-xs text-white/50 mt-2">Last updated {formatDateTime(profile.updated_at)}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-[#D4AF37] px-4 py-2 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/10"
        >
          Edit Profile
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
          Profile saved
        </span>
        <span
          className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${
            profile.consent_to_ai
              ? "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#f6df93]"
              : "border-neutral-500/40 bg-neutral-500/10 text-white/70"
          }`}
        >
          {profile.consent_to_ai ? "AI refresh enabled" : "AI refresh paused"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryRow label="Skin Type" value={profile.skin_type} />
        <SummaryRow label="Concerns" value={formatList(profile.concerns)} />
        <SummaryRow label="Allergies" value={formatList(profile.allergies)} />
        <SummaryRow label="Avoid Ingredients" value={formatList(profile.avoid_ingredients)} />
        <SummaryRow label="Sun Exposure" value={profile.sun_exposure} />
        <SummaryRow label="Sleep" value={profile.sleep_hours} />
        <SummaryRow label="Stress Level" value={profile.stress_level} />
        <SummaryRow label="Water Intake" value={profile.water_intake} />
        <SummaryRow
          label="AI Consent"
          value={profile.consent_to_ai ? "Enabled for saved recommendations" : "Disabled"}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <SummaryRow label="Current Routine" value={profile.routine_steps} />
        <SummaryRow label="Current Products" value={profile.current_products} />
      </div>
    </section>
  );
}

export default MembershipProfileSummary;
