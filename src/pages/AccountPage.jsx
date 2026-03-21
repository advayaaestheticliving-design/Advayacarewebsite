import React from "react";
import { Link } from "react-router-dom";
import { getMyCoupons, getMyGiftCards } from "../lib/walletApi";
import { getMyOrdersWithTimeline } from "../lib/ordersApi";
import productsData from "../data/products.json";
import MembershipProfileEditor from "../components/MembershipProfileEditor";
import MembershipProfileSummary from "../components/MembershipProfileSummary";
import MembershipRecommendationsPanel from "../components/MembershipRecommendationsPanel";
import { useMemberSession } from "../context/MemberSessionContext";
import {
  getLatestMembershipRecommendationRun,
  getMembershipProfile,
  getMembershipRecommendations,
  initialMembershipProfileForm,
  isRecommendationRunFresh,
  mapMembershipProfileToForm,
  saveMembershipProfile,
} from "../lib/membershipApi";

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapRecommendationsToProducts(recommendations) {
  if (!Array.isArray(recommendations)) {
    return [];
  }

  return recommendations
    .map((item) => {
      const product = productsData.find((entry) => entry.id === item.id);
      if (!product) {
        return null;
      }

      return {
        ...item,
        product,
      };
    })
    .filter(Boolean);
}

function getProfileProgress(profile) {
  if (!profile) {
    return 0;
  }

  const checks = [
    Boolean(profile.skin_type),
    Array.isArray(profile.concerns) && profile.concerns.length > 0,
    Boolean(profile.sun_exposure),
    Boolean(profile.sleep_hours),
    Boolean(profile.stress_level),
    Boolean(profile.water_intake),
    Boolean(profile.routine_steps),
    Boolean(profile.current_products),
    Boolean(profile.consent_to_process),
  ];

  const completed = checks.filter(Boolean).length;
  return Math.round((completed / checks.length) * 100);
}

function AccountPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [coupons, setCoupons] = React.useState([]);
  const [giftCards, setGiftCards] = React.useState([]);
  const [orders, setOrders] = React.useState([]);
  const [membershipProfile, setMembershipProfile] = React.useState(null);
  const [membershipForm, setMembershipForm] = React.useState(initialMembershipProfileForm);
  const [membershipRecommendations, setMembershipRecommendations] = React.useState([]);
  const [membershipRecommendationSavedAt, setMembershipRecommendationSavedAt] = React.useState("");
  const [membershipRecommendationsStale, setMembershipRecommendationsStale] = React.useState(false);
  const [membershipStatus, setMembershipStatus] = React.useState("");
  const [membershipError, setMembershipError] = React.useState("");
  const [membershipSaving, setMembershipSaving] = React.useState(false);
  const [membershipEditing, setMembershipEditing] = React.useState(false);
  const loadRequestIdRef = React.useRef(0);
  const { authReady, user } = useMemberSession();
  const profileProgress = getProfileProgress(membershipProfile);
  const recommendationStatusLabel = !membershipProfile
    ? "Set up needed"
    : !membershipProfile?.consent_to_ai
      ? "AI paused"
      : membershipRecommendationsStale
        ? "Out of date"
        : membershipRecommendations.length > 0
          ? "Saved and current"
          : "Ready to generate";

  const resetMembershipState = React.useCallback(() => {
    setMembershipProfile(null);
    setMembershipForm({ ...initialMembershipProfileForm });
    setMembershipRecommendations([]);
    setMembershipRecommendationSavedAt("");
    setMembershipRecommendationsStale(false);
    setMembershipStatus("");
    setMembershipError("");
    setMembershipEditing(false);
  }, []);

  const loadMembershipData = React.useCallback(async () => {
    const profile = await getMembershipProfile();
    setMembershipProfile(profile);
    setMembershipForm(mapMembershipProfileToForm(profile));

    if (!profile) {
      setMembershipRecommendations([]);
      setMembershipRecommendationSavedAt("");
      setMembershipRecommendationsStale(false);
      return;
    }

    if (!profile.consent_to_ai) {
      setMembershipRecommendations([]);
      setMembershipRecommendationSavedAt("");
      setMembershipRecommendationsStale(false);
      return;
    }

    const latestRun = await getLatestMembershipRecommendationRun(profile.id);
    setMembershipRecommendationSavedAt(latestRun?.created_at || "");
    setMembershipRecommendations(mapRecommendationsToProducts(latestRun?.recommendations));
    setMembershipRecommendationsStale(Boolean(latestRun) && !isRecommendationRunFresh(profile, latestRun));
  }, []);

  const loadData = React.useCallback(async () => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setLoading(true);
    setError("");

    try {
      const activeUser = user || null;

      if (loadRequestIdRef.current !== requestId) {
        return;
      }

      if (!activeUser?.id) {
        setCoupons([]);
        setGiftCards([]);
        setOrders([]);
        resetMembershipState();
        return;
      }

      const [couponRows, giftCardRows, orderRows] = await Promise.allSettled([
        getMyCoupons(),
        getMyGiftCards(),
        getMyOrdersWithTimeline(),
      ]);

      setCoupons(couponRows.status === "fulfilled" ? couponRows.value : []);
      setGiftCards(giftCardRows.status === "fulfilled" ? giftCardRows.value : []);
      setOrders(orderRows.status === "fulfilled" ? orderRows.value : []);

      if (orderRows.status === "rejected") {
        setError(orderRows.reason?.message || "Could not load member orders right now.");
      }

      await loadMembershipData();
    } catch (loadError) {
      if (loadRequestIdRef.current !== requestId) {
        return;
      }
      setError(loadError?.message || "Could not load account data.");
    } finally {
      if (loadRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, [loadMembershipData, resetMembershipState, user]);

  React.useEffect(() => {
    if (!authReady) {
      return;
    }

    loadData().catch(() => undefined);
  }, [authReady, loadData]);

  const handleMembershipChange = (event) => {
    const { name, type, value, checked } = event.target;
    setMembershipForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const openMembershipEditor = () => {
    setMembershipError("");
    setMembershipStatus("");
    setMembershipForm(mapMembershipProfileToForm(membershipProfile));
    setMembershipEditing(true);
  };

  const handleMembershipCancel = () => {
    setMembershipError("");
    setMembershipStatus("");
    setMembershipForm(mapMembershipProfileToForm(membershipProfile));
    setMembershipEditing(false);
  };

  const handleMembershipSubmit = async (event) => {
    event.preventDefault();
    setMembershipSaving(true);
    setMembershipError("");
    setMembershipStatus("");

    try {
      const savedProfile = await saveMembershipProfile(membershipForm);
      setMembershipProfile(savedProfile);
      setMembershipForm(mapMembershipProfileToForm(savedProfile));

      if (!savedProfile.consent_to_ai) {
        setMembershipRecommendations([]);
        setMembershipRecommendationSavedAt("");
        setMembershipRecommendationsStale(false);
        setMembershipEditing(false);
        setMembershipStatus("Profile saved. Enable AI consent whenever you want recommendations refreshed.");
        return;
      }

      try {
        const generatedRecommendations = await getMembershipRecommendations(savedProfile.id, productsData);
        const latestRun = await getLatestMembershipRecommendationRun(savedProfile.id);
        const savedRecommendations = latestRun?.recommendations || generatedRecommendations;

        setMembershipRecommendationSavedAt(latestRun?.created_at || new Date().toISOString());
        setMembershipRecommendations(mapRecommendationsToProducts(savedRecommendations));
        setMembershipRecommendationsStale(Boolean(latestRun) && !isRecommendationRunFresh(savedProfile, latestRun));
        setMembershipEditing(false);
        setMembershipStatus("Profile saved. Your latest AI recommendations were refreshed and stored.");
      } catch (recommendationError) {
        setMembershipRecommendationsStale(true);
        setMembershipEditing(false);
        setMembershipStatus("Profile saved, but recommendations could not be refreshed. Save again when you are ready to retry.");
        setMembershipError(recommendationError?.message || "Could not refresh recommendations.");
        return;
      }
    } catch (saveError) {
      setMembershipError(saveError?.message || "Could not save your AI recommendation profile.");
    } finally {
      setMembershipSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">My Account</h1>
          <p className="text-sm text-white/80 mt-1">
            View your AI recommendation profile, order status timeline, linked coupons, and purchased gift cards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadData()}
          className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/80">Loading account wallet...</p>
      ) : !user ? (
        <div className="rounded-2xl border border-neutral-700 bg-black/50 p-5 text-sm text-white/90 space-y-3">
          <p>Sign in to view your AI recommendation profile, order timeline, coupons, and purchased gift cards.</p>
          <Link
            to="/membership"
            className="inline-flex rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black hover:bg-[#e3c458]"
          >
            Go to Membership Sign In
          </Link>
        </div>
      ) : (
        <>
          {error && <p className="text-sm text-red-400">{error}</p>}

          {membershipStatus && <p className="text-sm text-emerald-300">{membershipStatus}</p>}
          {membershipError && <p className="text-sm text-red-400">{membershipError}</p>}

          <section className="rounded-[32px] border border-[#D4AF37]/20 bg-[radial-gradient(circle_at_top_left,_rgba(212,175,55,0.2),_rgba(0,0,0,0.15)_35%,_rgba(0,0,0,0.82)_72%)] p-5 sm:p-6 lg:p-7 space-y-5 overflow-hidden">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#f0d682]">AI Recommendation Studio</p>
                <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  Keep one saved profile and refresh recommendations only when your skin story changes.
                </h2>
                <p className="text-sm text-white/72">
                  Your account now stores the latest successful recommendation run so returning visits reuse saved results instead of triggering AI again.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={openMembershipEditor}
                  className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black hover:bg-[#e3c458]"
                >
                  {membershipProfile ? "Update AI Profile" : "Create AI Profile"}
                </button>
                {membershipProfile ? (
                  <span className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80">
                    Recommendation status: {recommendationStatusLabel}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Profile coverage</p>
                <p className="mt-3 text-3xl font-semibold text-white">{membershipProfile ? `${profileProgress}%` : "0%"}</p>
                <p className="mt-2 text-sm text-white/70">
                  {membershipProfile
                    ? "A richer profile usually produces more useful saved recommendations."
                    : "Start once, then update only when your routine or concerns change."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">Last refreshed</p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {membershipRecommendationSavedAt ? formatDateTime(membershipRecommendationSavedAt) : "Not saved yet"}
                </p>
                <p className="mt-2 text-sm text-white/70">
                  {membershipRecommendationsStale
                    ? "The current recommendation set is older than the latest profile update."
                    : "Returning visits reuse the most recent saved recommendation set."}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">AI refresh policy</p>
                <p className="mt-3 text-xl font-semibold text-white">
                  {membershipProfile?.consent_to_ai ? "On profile save" : "Paused"}
                </p>
                <p className="mt-2 text-sm text-white/70">
                  {membershipProfile?.consent_to_ai
                    ? "We do not regenerate recommendations on page load."
                    : "Enable AI consent to refresh and store a new recommendation set."}
                </p>
              </div>
            </div>
          </section>

          {membershipEditing ? (
            <MembershipProfileEditor
              form={membershipForm}
              onChange={handleMembershipChange}
              onSubmit={handleMembershipSubmit}
              onCancel={membershipProfile ? handleMembershipCancel : null}
              loading={membershipSaving}
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] items-start">
              <MembershipProfileSummary profile={membershipProfile} onEdit={openMembershipEditor} />
              <MembershipRecommendationsPanel
                hasProfile={Boolean(membershipProfile)}
                hasAiConsent={Boolean(membershipProfile?.consent_to_ai)}
                recommendations={membershipRecommendations}
                stale={membershipRecommendationsStale}
                generatedAt={membershipRecommendationSavedAt}
                profileUpdatedAt={membershipProfile?.updated_at}
                onOpenEditor={openMembershipEditor}
              />
            </div>
          )}

          <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">My Orders</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-white/70">No member orders linked to this account yet.</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border border-neutral-700 bg-black/60 px-4 py-4 text-sm text-white space-y-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <p className="font-medium">Order: {order.id}</p>
                      <p>Amount: {formatCurrency(order.amount)}</p>
                      <p>Payment: {toLabel(order.status)}</p>
                      <p>Fulfillment: {toLabel(order.fulfillment_status)}</p>
                      <p>Placed: {formatDateTime(order.created_at)}</p>
                      <p>Updated: {formatDateTime(order.fulfillment_updated_at || order.updated_at)}</p>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-white/80">Status Timeline</h3>
                      {Array.isArray(order.events) && order.events.length > 0 ? (
                        <div className="space-y-2">
                          {order.events.map((event) => (
                            <div
                              key={event.id}
                              className="rounded-lg border border-neutral-700 bg-black/70 px-3 py-2 text-xs"
                            >
                              <p>
                                <span className="font-medium">{toLabel(event.status)}</span> • {toLabel(event.status_kind)}
                              </p>
                              <p className="text-white/70">{formatDateTime(event.created_at)}</p>
                              {event.notes ? <p className="text-white/80 mt-1">{event.notes}</p> : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-white/60">No status updates yet.</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Coupon Codes</h2>
            {coupons.length === 0 ? (
              <p className="text-sm text-white/70">No coupons linked to this account yet.</p>
            ) : (
              <div className="space-y-3">
                {coupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="rounded-xl border border-neutral-700 bg-black/60 px-4 py-3 text-sm text-white grid gap-2 sm:grid-cols-4"
                  >
                    <p className="font-medium">{coupon.code}</p>
                    <p>Value: {formatCurrency(coupon.amount_inr)}</p>
                    <p>Status: {coupon.status}</p>
                    <p>Expires: {formatDate(coupon.expires_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Gift Cards</h2>
            {giftCards.length === 0 ? (
              <p className="text-sm text-white/70">No purchased gift cards linked to this account yet.</p>
            ) : (
              <div className="space-y-3">
                {giftCards.map((giftCard) => (
                  <div
                    key={giftCard.id}
                    className="rounded-xl border border-neutral-700 bg-black/60 px-4 py-3 text-sm text-white grid gap-2 sm:grid-cols-5"
                  >
                    <p className="font-medium">{giftCard.code}</p>
                    <p>Initial: {formatCurrency(giftCard.initial_amount_inr)}</p>
                    <p>Balance: {formatCurrency(giftCard.balance_amount_inr)}</p>
                    <p>Status: {giftCard.status}</p>
                    <p>Issued: {formatDate(giftCard.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default AccountPage;
