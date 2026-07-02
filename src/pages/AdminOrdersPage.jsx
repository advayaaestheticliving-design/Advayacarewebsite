import React from "react";
import { Navigate } from "react-router-dom";
import AdminLoginCard from "../components/AdminLoginCard";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminOrders, updateAdminOrderStatus } from "../lib/adminOrdersApi";
import { useAdminAccess } from "../lib/useAdminAccess";

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
  const admin = useAdminAccess();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [orders, setOrders] = React.useState([]);
  const [pendingStatusByOrder, setPendingStatusByOrder] = React.useState({});
  const [pendingNotesByOrder, setPendingNotesByOrder] = React.useState({});
  const [updatingOrderId, setUpdatingOrderId] = React.useState("");

  const loadOrders = React.useCallback(async () => {
    if (!admin.authorized) {
      setOrders([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await getAdminOrders();
      setOrders(rows);
      setPendingStatusByOrder({});
      setPendingNotesByOrder({});
    } catch (loadError) {
      setError(loadError?.message || "Could not load admin orders.");
    } finally {
      setLoading(false);
    }
  }, [admin.authorized]);

  React.useEffect(() => {
    if (!admin.checkingAccess && admin.authorized) {
      loadOrders().catch(() => undefined);
      return;
    }

    if (!admin.authorized) {
      setOrders([]);
      setPendingNotesByOrder({});
      setPendingStatusByOrder({});
    }
  }, [admin.authorized, admin.checkingAccess, loadOrders]);

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
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 py-10 md:py-16">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">Admin Orders</h1>
        <p className="text-sm text-white/80 mt-1">
          Track sales and update order fulfillment statuses from one place.
        </p>
      </div>

      {admin.checkingAccess ? (
        <p className="text-sm text-white/80">Checking admin access...</p>
      ) : !admin.authorized ? (
        <Navigate to="/admin" replace />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <AdminSidebar onSignOut={admin.logout} authLoading={admin.authLoading} />

          <section className="space-y-4">
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => loadOrders()}
                className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
              >
                Refresh
              </button>
            </div>

            {error || admin.error ? <p className="text-sm text-red-400">{error || admin.error}</p> : null}

            {loading ? (
              <p className="text-sm text-white/80">Loading admin orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-white/70">No orders found.</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const selectedStatus =
                    pendingStatusByOrder[order.id] || order.fulfillment_status || "processing";
                  const orderItems = Array.isArray(order.items) ? order.items : [];

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
                        {order.order_type && order.order_type !== "consumer" ? (
                          <p className="text-[#D4AF37]">{toLabel(order.order_type)}</p>
                        ) : null}
                        <p className="sm:col-span-2">
                          <span className="text-white/70">Email:</span> {order.customer_email || "—"}
                        </p>
                        <p className="sm:col-span-2 lg:col-span-1">
                          <span className="text-white/70">Phone:</span> {order.customer_phone || "—"}
                        </p>
                        <p className="sm:col-span-2 lg:col-span-3">
                          <span className="text-white/70">Address:</span> {order.customer_address || "—"} {order.customer_pin_code ? `(${order.customer_pin_code})` : ""}
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
                                  <span className="font-medium">{toLabel(event.status)}</span> •{" "}
                                  {toLabel(event.status_kind)}
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

                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-white">Order Items</h3>
                        {orderItems.length > 0 ? (
                          <div className="space-y-2">
                            {orderItems.map((item, index) => {
                              const quantity = Math.max(1, Number(item?.quantity) || 1);
                              const unitPrice = Number(item?.price_inr || 0);
                              const lineTotal = quantity * unitPrice;

                              return (
                                <div
                                  key={`${order.id}-item-${item?.product_id || item?.name || index}`}
                                  className="rounded-lg border border-neutral-700 bg-black/60 px-3 py-2 text-xs text-white/90"
                                >
                                  <div className="grid gap-1 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-3">
                                    <p className="font-medium text-white">{item?.name || "Unknown product"}</p>
                                    <p className="text-white/70">Qty: {quantity}</p>
                                    <p className="text-white/70">{formatCurrency(unitPrice)}</p>
                                    <p className="sm:text-right">{formatCurrency(lineTotal)}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-white/60">No items in this order.</p>
                        )}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminOrdersPage;
