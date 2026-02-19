import React from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getMyCoupons, getMyGiftCards } from "../lib/walletApi";
import { getMyOrdersWithTimeline } from "../lib/ordersApi";

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

function AccountPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [user, setUser] = React.useState(null);
  const [coupons, setCoupons] = React.useState([]);
  const [giftCards, setGiftCards] = React.useState([]);
  const [orders, setOrders] = React.useState([]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: activeUser },
      } = await supabase.auth.getUser();

      setUser(activeUser || null);

      if (!activeUser?.id) {
        setCoupons([]);
        setGiftCards([]);
        setOrders([]);
        return;
      }

      const [couponRows, giftCardRows, orderRows] = await Promise.all([
        getMyCoupons(),
        getMyGiftCards(),
        getMyOrdersWithTimeline(),
      ]);
      setCoupons(couponRows);
      setGiftCards(giftCardRows);
      setOrders(orderRows);
    } catch (loadError) {
      setError(loadError?.message || "Could not load account data.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadData().catch(() => undefined);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadData]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">My Account</h1>
          <p className="text-sm text-white/80 mt-1">
            View your order status timeline, linked coupons, and purchased gift cards.
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
          <p>Sign in to view your order timeline, coupons, and purchased gift cards.</p>
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
