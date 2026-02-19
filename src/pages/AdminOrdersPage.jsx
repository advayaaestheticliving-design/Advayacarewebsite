import React from "react";
import {
  getAdminEmail,
  getAdminOrders,
  isCurrentUserAdmin,
  signInAdminWithPassword,
  signOutAdmin,
  updateAdminOrderStatus,
} from "../lib/adminOrdersApi";
import { supabase } from "../lib/supabaseClient";

const FULFILLMENT_OPTIONS = [
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
];

function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
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

function AdminOrdersPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [authorized, setAuthorized] = React.useState(false);
  const [orders, setOrders] = React.useState([]);
  const [pendingStatusByOrder, setPendingStatusByOrder] = React.useState({});
  const [pendingNotesByOrder, setPendingNotesByOrder] = React.useState({});
  const [updatingOrderId, setUpdatingOrderId] = React.useState("");
  const [authEmail, setAuthEmail] = React.useState(getAdminEmail());
  const [authPassword, setAuthPassword] = React.useState("");
  const [authLoading, setAuthLoading] = React.useState(false);
  const [signedInEmail, setSignedInEmail] = React.useState("");

  const loadOrders = React.useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const isAdmin = await isCurrentUserAdmin();
      setAuthorized(isAdmin);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSignedInEmail(String(user?.email || ""));

      if (!isAdmin) {
        setOrders([]);
        return;
      }

      const rows = await getAdminOrders();
      setOrders(rows);
      setPendingStatusByOrder({});
      setPendingNotesByOrder({});
    } catch (loadError) {
      setError(loadError?.message || "Could not load admin orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  React.useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadOrders().catch(() => undefined);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [loadOrders]);

  async function handleAdminLogin(event) {
    event.preventDefault();
    setError("");
    setAuthLoading(true);

    try {
      await signInAdminWithPassword(authEmail, authPassword);
      setAuthPassword("");
      await loadOrders();
    } catch (authError) {
      setError(authError?.message || "Admin login failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleAdminSignOut() {
    setError("");
    setAuthLoading(true);

    try {
      await signOutAdmin();
      setOrders([]);
      setAuthorized(false);
      setSignedInEmail("");
      setPendingNotesByOrder({});
      setPendingStatusByOrder({});
    } catch (authError) {
      setError(authError?.message || "Could not sign out admin session.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleStatusUpdate(order) {
    const nextStatus = String(
      pendingStatusByOrder[order.id] || order.fulfillment_status || "processing"
    ).toLowerCase();
    const nextNotes = String(pendingNotesByOrder[order.id] || "").trim();

    setUpdatingOrderId(order.id);
    setError("");

    try {
      const updatedOrder = await updateAdminOrderStatus(order.id, nextStatus, nextNotes);
      setOrders((prev) => prev.map((item) => (item.id === order.id ? updatedOrder : item)));
      setPendingStatusByOrder((prev) => ({ ...prev, [order.id]: updatedOrder.fulfillment_status }));
      setPendingNotesByOrder((prev) => ({ ...prev, [order.id]: "" }));
    } catch (updateError) {
      setError(updateError?.message || "Could not update order status.");
    } finally {
      setUpdatingOrderId("");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">Admin Orders</h1>
          <p className="text-sm text-white/80 mt-1">
            Track sales and update order fulfillment statuses from one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadOrders()}
          className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-white/80">Loading admin orders...</p>
      ) : !authorized ? (
        <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Admin Login</h2>
          <p className="text-sm text-white/80">
            This is an independent admin workflow. Sign in only with {getAdminEmail()}.
          </p>
          {signedInEmail && signedInEmail !== getAdminEmail() ? (
            <div className="rounded-xl border border-amber-700 bg-amber-950/40 px-4 py-3 text-xs text-amber-200 space-y-2">
              <p>Signed in as {signedInEmail}. This account is not authorized for admin access.</p>
              <button
                type="button"
                onClick={handleAdminSignOut}
                disabled={authLoading}
                className="rounded-full border border-amber-500 px-3 py-1 font-medium hover:bg-amber-500/10 disabled:opacity-60"
              >
                {authLoading ? "Signing out..." : "Sign Out Current Session"}
              </button>
            </div>
          ) : null}

          <form onSubmit={handleAdminLogin} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="email"
              value={authEmail}
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="Admin email"
              className="sm:col-span-1 w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
              required
            />
            <input
              type="password"
              value={authPassword}
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Password"
              className="sm:col-span-1 w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
              required
              minLength={6}
            />
            <button
              type="submit"
              disabled={authLoading}
              className="sm:col-span-1 rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e3c458] disabled:opacity-60"
            >
              {authLoading ? "Signing in..." : "Sign In as Admin"}
            </button>
          </form>
        </section>
      ) : (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdminSignOut}
              disabled={authLoading}
              className="rounded-full border border-neutral-500 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37] disabled:opacity-60"
            >
              {authLoading ? "Signing out..." : "Sign Out Admin"}
            </button>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {orders.length === 0 ? (
            <p className="text-sm text-white/70">No orders found.</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => {
                const selectedStatus =
                  pendingStatusByOrder[order.id] || order.fulfillment_status || "processing";

                return (
                  <section
                    key={order.id}
                    className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4"
                  >
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm text-white">
                      <p>
                        <span className="text-white/70">Order:</span> {order.id}
                      </p>
                      <p>
                        <span className="text-white/70">Customer:</span> {order.customer_name || "—"}
                      </p>
                      <p>
                        <span className="text-white/70">Amount:</span> {formatCurrency(order.amount)}
                      </p>
                      <p>
                        <span className="text-white/70">Created:</span> {formatDateTime(order.created_at)}
                      </p>
                      <p>
                        <span className="text-white/70">Payment:</span> {toLabel(order.status)}
                      </p>
                      <p>
                        <span className="text-white/70">Fulfillment:</span> {toLabel(order.fulfillment_status)}
                      </p>
                      <p className="sm:col-span-2">
                        <span className="text-white/70">Email:</span> {order.customer_email || "—"}
                      </p>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[220px_1fr_auto]">
                      <select
                        value={selectedStatus}
                        onChange={(event) =>
                          setPendingStatusByOrder((prev) => ({
                            ...prev,
                            [order.id]: event.target.value,
                          }))
                        }
                        className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white"
                      >
                        {FULFILLMENT_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {toLabel(status)}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        value={pendingNotesByOrder[order.id] || ""}
                        onChange={(event) =>
                          setPendingNotesByOrder((prev) => ({
                            ...prev,
                            [order.id]: event.target.value,
                          }))
                        }
                        placeholder="Optional note (visible in timeline)"
                        className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white placeholder:text-white/40"
                      />

                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(order)}
                        disabled={updatingOrderId === order.id}
                        className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black hover:bg-[#e3c458] disabled:opacity-60"
                      >
                        {updatingOrderId === order.id ? "Updating..." : "Update"}
                      </button>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-white">Status Timeline</h3>
                      {Array.isArray(order.events) && order.events.length > 0 ? (
                        <div className="space-y-2">
                          {order.events.map((event) => (
                            <div
                              key={event.id}
                              className="rounded-lg border border-neutral-700 bg-black/60 px-3 py-2 text-xs text-white/90"
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
                        <p className="text-xs text-white/60">No timeline events yet.</p>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default AdminOrdersPage;
