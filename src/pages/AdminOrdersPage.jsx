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

function StatusPill({ status }) {
  let colorClass = "bg-neutral-500/20 text-neutral-300 border-neutral-500/30";
  const lower = String(status || "").toLowerCase();
  
  if (lower === "paid" || lower === "delivered") {
    colorClass = "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  } else if (lower === "processing" || lower === "packed") {
    colorClass = "bg-amber-500/20 text-amber-400 border-amber-500/30";
  } else if (lower === "shipped") {
    colorClass = "bg-blue-500/20 text-blue-400 border-blue-500/30";
  } else if (lower === "cancelled" || lower === "failed" || lower === "returned") {
    colorClass = "bg-red-500/20 text-red-400 border-red-500/30";
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${colorClass}`}>
      {toLabel(status)}
    </span>
  );
}

function AdminOrdersPage() {
  const admin = useAdminAccess();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [orders, setOrders] = React.useState([]);
  
  // New UI state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [expandedOrderId, setExpandedOrderId] = React.useState(null);

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

  const filteredOrders = React.useMemo(() => {
    return orders.filter((order) => {
      const matchesSearch =
        (order.id && order.id.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (order.customer_name &&
          order.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === "all" ||
        (order.fulfillment_status || "processing").toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [orders, searchQuery, statusFilter]);

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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <input
                  type="text"
                  placeholder="Search by ID or Name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white placeholder:text-white/40 min-w-[250px] focus:border-[#D4AF37] focus:outline-none"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  {FULFILLMENT_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {toLabel(status)}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => loadOrders()}
                className="shrink-0 rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37] transition-colors"
              >
                Refresh
              </button>
            </div>

            {error || admin.error ? <p className="text-sm text-red-400">{error || admin.error}</p> : null}

            {loading ? (
              <p className="text-sm text-white/80">Loading admin orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-sm text-white/70">No orders found.</p>
            ) : filteredOrders.length === 0 ? (
              <p className="text-sm text-white/70">No orders match your search criteria.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-neutral-700 bg-black/40">
                <table className="w-full text-left text-sm text-white/90">
                  <thead className="bg-neutral-800/50 text-xs uppercase text-white/70">
                    <tr>
                      <th className="px-4 py-4 font-medium">Order ID</th>
                      <th className="px-4 py-4 font-medium">Date</th>
                      <th className="px-4 py-4 font-medium">Customer</th>
                      <th className="px-4 py-4 font-medium">Amount</th>
                      <th className="px-4 py-4 font-medium">Payment</th>
                      <th className="px-4 py-4 font-medium">Fulfillment</th>
                      <th className="px-4 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-700/50">
                    {filteredOrders.map((order) => {
                      const isExpanded = expandedOrderId === order.id;
                      const selectedStatus = pendingStatusByOrder[order.id] || order.fulfillment_status || "processing";
                      const orderItems = Array.isArray(order.items) ? order.items : [];

                      return (
                        <React.Fragment key={order.id}>
                          <tr
                            className={`group cursor-pointer transition-colors hover:bg-neutral-800/30 ${
                              isExpanded ? "bg-neutral-800/40" : ""
                            }`}
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          >
                            <td className="px-4 py-3 font-medium">
                              <span className="truncate block max-w-[100px] sm:max-w-none" title={order.id}>
                                {order.id.slice(0, 8)}...
                              </span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-white/70">
                              {formatDateTime(order.created_at)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="block truncate max-w-[150px]">{order.customer_name || "—"}</span>
                              {order.order_type && order.order_type !== "consumer" && (
                                <span className="text-[10px] text-[#D4AF37] uppercase tracking-wider block mt-0.5">
                                  {toLabel(order.order_type)}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium">{formatCurrency(order.amount)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusPill status={order.status} />
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusPill status={order.fulfillment_status} />
                            </td>
                            <td className="px-4 py-3 text-right text-white/40 group-hover:text-white/80">
                              <svg
                                className={`inline-block h-4 w-4 transition-transform ${
                                  isExpanded ? "rotate-180 text-[#D4AF37]" : ""
                                }`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                              </svg>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="bg-neutral-900/40 px-4 sm:px-6 py-6 border-b border-neutral-700/50">
                                <div className="grid gap-8 lg:grid-cols-3">
                                  {/* Column 1: Customer Details */}
                                  <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-[#D4AF37] flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                                      Customer Details
                                    </h4>
                                    <div className="space-y-3 text-sm text-white/80">
                                      <p className="flex justify-between border-b border-neutral-800 pb-2">
                                        <span className="text-white/50">Email</span> 
                                        <span className="font-medium text-white">{order.customer_email || "—"}</span>
                                      </p>
                                      <p className="flex justify-between border-b border-neutral-800 pb-2">
                                        <span className="text-white/50">Phone</span> 
                                        <span className="font-medium text-white">{order.customer_phone || "—"}</span>
                                      </p>
                                      <div className="pt-1">
                                        <span className="text-white/50 block mb-1">Shipping Address</span>
                                        <p className="leading-relaxed bg-black/40 p-3 rounded-lg border border-neutral-800">
                                          {order.customer_address || "No address provided."}
                                          {order.customer_pin_code && (
                                            <span className="block mt-1 font-medium text-white/90">
                                              PIN: {order.customer_pin_code}
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Column 2: Order Items */}
                                  <div className="space-y-4">
                                    <h4 className="text-sm font-semibold text-[#D4AF37] flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                                      Order Items
                                    </h4>
                                    {orderItems.length > 0 ? (
                                      <div className="space-y-2">
                                        {orderItems.map((item, index) => {
                                          const quantity = Math.max(1, Number(item?.quantity) || 1);
                                          const unitPrice = Number(item?.price_inr || 0);
                                          const lineTotal = quantity * unitPrice;

                                          return (
                                            <div
                                              key={`${order.id}-item-${item?.product_id || item?.name || index}`}
                                              className="flex items-start justify-between rounded-lg border border-neutral-800 bg-black/40 px-3 py-3 text-sm transition-colors hover:border-neutral-700"
                                            >
                                              <div className="pr-2">
                                                <p className="font-medium text-white/90">{item?.name || "Unknown product"}</p>
                                                <p className="text-xs text-white/50 mt-1">Qty: {quantity} &times; {formatCurrency(unitPrice)}</p>
                                              </div>
                                              <p className="font-medium text-white">{formatCurrency(lineTotal)}</p>
                                            </div>
                                          );
                                        })}
                                        {/* Discounts */}
                                        {(order.coupon_code || order.gift_card_code) && (
                                          <div className="pt-2 pb-1 border-t border-neutral-800/50 space-y-1">
                                            {order.coupon_code && (
                                              <div className="flex justify-between items-center text-sm px-1">
                                                <span className="text-white/60">Coupon ({order.coupon_code})</span>
                                                <span className="text-emerald-400">-{formatCurrency(order.coupon_amount_inr)}</span>
                                              </div>
                                            )}
                                            {order.gift_card_code && (
                                              <div className="flex justify-between items-center text-sm px-1">
                                                <span className="text-white/60">Gift Card ({order.gift_card_code})</span>
                                                <span className="text-emerald-400">-{formatCurrency(order.gift_card_amount_inr)}</span>
                                              </div>
                                            )}
                                          </div>
                                        )}

                                        <div className="flex justify-between items-center pt-3 border-t border-neutral-800 px-1">
                                          <span className="text-sm text-white/50">Total Amount</span>
                                          <span className="font-semibold text-[#D4AF37]">{formatCurrency(order.amount)}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm text-white/50 italic bg-black/40 p-4 rounded-lg border border-neutral-800">No items found for this order.</p>
                                    )}
                                  </div>

                                  {/* Column 3: Timeline & Update */}
                                  <div className="space-y-5">
                                    <div className="space-y-3">
                                      <h4 className="text-sm font-semibold text-[#D4AF37] flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                        Update Fulfillment
                                      </h4>
                                      <div className="bg-black/40 p-3 rounded-lg border border-neutral-800 space-y-3">
                                        <select
                                          value={selectedStatus}
                                          onChange={(event) =>
                                            setPendingStatusByOrder((prev) => ({
                                              ...prev,
                                              [order.id]: event.target.value,
                                            }))
                                          }
                                          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] focus:outline-none"
                                        >
                                          {FULFILLMENT_OPTIONS.map((status) => (
                                            <option key={status} value={status}>
                                              {toLabel(status)}
                                            </option>
                                          ))}
                                        </select>
                                        <textarea
                                          rows={2}
                                          value={pendingNotesByOrder[order.id] || ""}
                                          onChange={(event) =>
                                            setPendingNotesByOrder((prev) => ({
                                              ...prev,
                                              [order.id]: event.target.value,
                                            }))
                                          }
                                          placeholder="Add a note to the timeline..."
                                          className="w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-[#D4AF37] focus:ring-1 focus:ring-[#D4AF37] focus:outline-none resize-none"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleStatusUpdate(order)}
                                          disabled={updatingOrderId === order.id}
                                          className="w-full rounded-md bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e3c458] disabled:opacity-60 transition-colors"
                                        >
                                          {updatingOrderId === order.id ? "Updating..." : "Save Changes"}
                                        </button>
                                      </div>
                                    </div>

                                    <div className="space-y-3">
                                      <h4 className="text-sm font-semibold text-white/80 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Status Timeline
                                      </h4>
                                      {Array.isArray(order.events) && order.events.length > 0 ? (
                                        <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                          {order.events.map((event) => (
                                            <div
                                              key={event.id}
                                              className="relative pl-4 border-l-2 border-neutral-800 pb-4 last:pb-0"
                                            >
                                              <div className="absolute w-2 h-2 bg-[#D4AF37] rounded-full -left-[5px] top-1"></div>
                                              <div className="bg-black/40 p-2.5 rounded-lg border border-neutral-800 text-[12px]">
                                                <div className="flex justify-between items-start gap-2 mb-1">
                                                  <span className="font-semibold text-white">{toLabel(event.status)}</span>
                                                  <span className="text-white/50 text-[10px] whitespace-nowrap">{formatDateTime(event.created_at)}</span>
                                                </div>
                                                <span className="inline-block px-1.5 py-0.5 rounded bg-neutral-800 text-white/60 text-[10px] mb-1">
                                                  {toLabel(event.status_kind)}
                                                </span>
                                                {event.notes && <p className="text-white/80 mt-1 italic leading-relaxed border-t border-neutral-800/50 pt-1">"{event.notes}"</p>}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-white/50 bg-black/20 p-3 rounded-lg border border-neutral-800/50">No timeline events recorded.</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminOrdersPage;
