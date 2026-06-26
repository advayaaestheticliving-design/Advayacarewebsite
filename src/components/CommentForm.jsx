import React from "react";
import { Link } from "react-router-dom";
import { useMemberSession } from "../context/MemberSessionContext";

function buildInitialForm(user) {
  const metadataName = String(
    user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.display_name || "",
  ).trim();
  const emailPrefix = String(user?.email || "").split("@")[0]?.trim() || "";

  return {
    displayName: metadataName || emailPrefix,
    city: "",
    headline: "",
    body: "",
    rating: 5,
  };
}

function CommentForm({
  title,
  description,
  submitLabel,
  successMessage,
  onSubmit,
  variant = "product",
}) {
  const { authReady, user, isAuthenticated, accessToken } = useMemberSession();
  const [form, setForm] = React.useState(() => buildInitialForm(user));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    setForm((current) => ({
      ...buildInitialForm(user),
      city: current.city,
      headline: current.headline,
      body: current.body,
      rating: current.rating,
    }));
  }, [user]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setStatus("");

    try {
      // Pass accessToken directly so the API doesn't need to call getSession() independently.
      await onSubmit(form, accessToken);
      setForm((current) => ({
        ...current,
        headline: "",
        body: "",
        rating: 5,
      }));
      setStatus(successMessage);
    } catch (submitError) {
      setError(submitError?.message || "Could not submit your comment right now.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold text-[#D4AF37]">{title}</h3>
        <p className="text-sm text-white/80">{description}</p>
      </div>

      {!authReady ? <p className="text-sm text-white/70">Checking member session...</p> : null}

      {authReady && !isAuthenticated ? (
        <div className="space-y-3">
          <p className="text-sm text-white/80">
            Sign in with your member account to leave a testimonial or review.
          </p>
          <Link
            to="/membership?mode=sign-in"
            className="inline-flex items-center rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-medium text-white hover:bg-[#e3c458]"
          >
            Sign In to Comment
          </Link>
        </div>
      ) : null}

      {authReady && isAuthenticated ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="text"
              value={form.displayName}
              onChange={(event) => updateField("displayName", event.target.value)}
              placeholder="Name shown publicly"
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
              maxLength={80}
              required
            />
            <input
              type="text"
              value={form.city}
              onChange={(event) => updateField("city", event.target.value)}
              placeholder="City (optional)"
              className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
              maxLength={80}
            />
          </div>

          <input
            type="text"
            value={form.headline}
            onChange={(event) => updateField("headline", event.target.value)}
            placeholder={variant === "product" ? "Short headline for your review" : "Optional short headline"}
            className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
            maxLength={120}
          />

          {variant === "product" ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-white">Your rating</p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => {
                  const active = Number(form.rating) === value;
                  return (
                    <button
                      key={`rating-${value}`}
                      type="button"
                      onClick={() => updateField("rating", value)}
                      className={`rounded-full px-4 py-2 text-sm transition ${
                        active
                          ? "bg-[#D4AF37] text-white"
                          : "border border-neutral-600 text-white hover:border-[#D4AF37]"
                      }`}
                    >
                      {value} Star{value > 1 ? "s" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <textarea
            value={form.body}
            onChange={(event) => updateField("body", event.target.value)}
            placeholder={
              variant === "product"
                ? "Share what stood out in the ritual, texture, results, or consistency."
                : "Share what makes Advaya Care feel worth returning to."
            }
            className="min-h-[132px] w-full rounded-2xl border border-neutral-600 bg-black px-4 py-3 text-sm leading-relaxed text-white placeholder:text-white/40"
            maxLength={1200}
            required
          />

          {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-medium text-white hover:bg-[#e3c458] disabled:opacity-60"
          >
            {submitting ? "Submitting..." : submitLabel}
          </button>
        </form>
      ) : null}
    </section>
  );
}

export default CommentForm;