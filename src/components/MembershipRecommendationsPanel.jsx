import React from "react";
import ProductCard from "./ProductCard";

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

function MembershipRecommendationsPanel({
  hasProfile,
  hasAiConsent,
  recommendations,
  stale,
  generatedAt,
  profileUpdatedAt,
  onOpenEditor,
}) {
  const hasRecommendations = Array.isArray(recommendations) && recommendations.length > 0;
  const statusTone = !hasProfile
    ? "border-dashed border-neutral-600 bg-black/40 text-white/80"
    : !hasAiConsent
      ? "border-neutral-600 bg-black/40 text-white/80"
      : stale
        ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
        : hasRecommendations
          ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-100"
          : "border-neutral-600 bg-black/40 text-white/80";

  const statusLabel = !hasProfile
    ? "Profile needed"
    : !hasAiConsent
      ? "AI consent paused"
      : stale
        ? "Recommendations out of date"
        : hasRecommendations
          ? "Recommendations up to date"
          : "Recommendations not generated";

  const statusCopy = !hasProfile
    ? "Create your profile once and we will keep reusing the saved recommendation set until you change it."
    : !hasAiConsent
      ? "Your profile is saved, but AI refresh is disabled until consent is enabled again."
      : stale
        ? "Your profile was updated after these recommendations were saved. Save the profile again to refresh the set."
        : hasRecommendations
          ? "These recommendations are being served from the latest saved run. No new AI request is made on page load."
          : "No saved AI recommendation run exists yet for this profile.";

  return (
    <section className="rounded-[28px] border border-neutral-700 bg-gradient-to-br from-black/70 via-black/55 to-[#14191c]/70 p-5 sm:p-6 space-y-5 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Saved AI Recommendations</h2>
          <p className="text-sm text-white/70 mt-1">
            We reuse your last saved recommendations until you update your profile.
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Recommendation status</p>
          <p className="text-xs text-white/75">{generatedAt ? `Last saved ${formatDateTime(generatedAt)}` : "No saved run yet"}</p>
          {profileUpdatedAt ? <p className="text-xs text-white/50">Profile updated {formatDateTime(profileUpdatedAt)}</p> : null}
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${statusTone}`}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em]">{statusLabel}</p>
        <p className="mt-2 text-sm">{statusCopy}</p>
      </div>

      {!hasProfile ? (
        <div className="rounded-xl border border-dashed border-neutral-600 bg-black/40 p-5 text-sm text-white/80 space-y-3">
          <p>Create your AI recommendation profile to unlock a saved routine match for your skin needs.</p>
          <button
            type="button"
            onClick={onOpenEditor}
            className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black hover:bg-[#e3c458]"
          >
            Create AI Profile
          </button>
        </div>
      ) : !hasAiConsent ? (
        <div className="rounded-xl border border-neutral-700 bg-black/40 p-5 text-sm text-white/80 space-y-2">
          <p>AI recommendations are paused because AI consent is currently disabled on your profile.</p>
          <button
            type="button"
            onClick={onOpenEditor}
            className="rounded-full border border-[#D4AF37] px-4 py-2 text-xs font-medium text-[#D4AF37] hover:bg-[#D4AF37]/10"
          >
            Enable AI Consent
          </button>
        </div>
      ) : !hasRecommendations ? (
        <div className="rounded-xl border border-neutral-700 bg-black/40 p-5 text-sm text-white/80 space-y-2">
          <p>Your profile is saved, but there are no stored AI recommendations yet.</p>
          <p>Open the editor and save your profile to generate and store your recommendations.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {recommendations.map((item) => (
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
  );
}

export default MembershipRecommendationsPanel;
