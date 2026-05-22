import React from "react";
import { Navigate } from "react-router-dom";
import AdminLoginCard from "../components/AdminLoginCard";
import AdminSidebar from "../components/AdminSidebar";
import { useAdminAccess } from "../lib/useAdminAccess";
import {
  createGeneralCoupon,
  updateGeneralCoupon,
  listAllGeneralCoupons,
  issueMemberCouponByEmail,
  listMemberCoupons,
  updateMemberCoupon,
} from "../lib/adminCouponsApi";

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatCurrency(v) {
  return Number(v || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const PROMO_ADJECTIVES = ["SUMMER", "WINTER", "DIWALI", "NEW", "ADVAYA", "GLOW", "CARE", "BEAUTY", "LUXE", "BLOOM"];
const PROMO_NUMBERS = [10, 15, 20, 25, 30, 40, 50];

function suggestPromoCode() {
  const adj = PROMO_ADJECTIVES[Math.floor(Math.random() * PROMO_ADJECTIVES.length)];
  const num = PROMO_NUMBERS[Math.floor(Math.random() * PROMO_NUMBERS.length)];
  return `${adj}${num}`;
}

// ─── Default form states ────────────────────────────────────────────────────

const defaultPromoForm = {
  code: "",
  description: "",
  discount_type: "percentage",
  fixed_amount_inr: 0,
  percentage_discount: 10,
  max_discount_inr: null,
  min_order_amount_inr: null,
  global_usage_limit: null,
  expires_at: null,
  all_orders: true,
  require_membership: false,
};

const defaultGeneralForm = {
  code: "",
  description: "",
  discount_type: "fixed",
  fixed_amount_inr: 0,
  percentage_discount: 0,
  max_discount_inr: null,
  min_order_amount_inr: null,
  require_membership: true,
  global_usage_limit: null,
  per_member_usage_limit: 1,
  all_orders: false,
  expires_at: null,
};

const defaultMemberForm = {
  email: "",
  amountInr: 100,
  expiresAt: null,
  reason: "admin_issued",
};

// ─── Shared sub-components ──────────────────────────────────────────────────

function Banner({ type, message, onClose }) {
  if (!message) return null;
  const styles = type === "success"
    ? "bg-green-950/60 border-green-600/40 text-green-300"
    : "bg-red-950/60 border-red-600/40 text-red-300";
  return (
    <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${styles}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
      )}
    </div>
  );
}

function FieldLabel({ children, optional }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 mb-1">
      {children} {optional && <span className="font-normal normal-case text-white/40">(optional)</span>}
    </label>
  );
}

function Input({ className = "", ...props }) {
  return (
    <input
      className={`w-full rounded-lg border border-neutral-700 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none transition ${className}`}
      {...props}
    />
  );
}

function Select({ children, className = "", ...props }) {
  return (
    <select
      className={`w-full rounded-lg border border-neutral-700 bg-black/60 px-3 py-2 text-sm text-white focus:border-[#D4AF37] focus:outline-none transition ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors ${checked ? "bg-[#D4AF37]" : "bg-neutral-700"}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </div>
      <span className="text-sm text-white/80">{label}</span>
    </label>
  );
}

function StatusBadge({ value }) {
  const map = {
    active: "bg-green-900/50 text-green-300 border-green-700/40",
    consumed: "bg-neutral-800 text-neutral-400 border-neutral-700",
    expired: "bg-orange-900/50 text-orange-300 border-orange-700/40",
    revoked: "bg-red-900/50 text-red-300 border-red-700/40",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${map[value] || "bg-neutral-800 text-white/60 border-neutral-700"}`}>
      {value}
    </span>
  );
}

function SubmitButton({ loading, children, loadingText = "Saving..." }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full rounded-full bg-[#D4AF37] py-2.5 text-sm font-bold text-black hover:bg-[#e3c458] disabled:opacity-50 transition"
    >
      {loading ? loadingText : children}
    </button>
  );
}

// ─── Coupon preview card ────────────────────────────────────────────────────

function PromoPreviewCard({ form }) {
  const hasCode = form.code.trim().length > 0;
  const discountLabel = () => {
    if (form.discount_type === "fixed") return formatCurrency(form.fixed_amount_inr) + " off";
    if (form.discount_type === "percentage") return `${form.percentage_discount}% off`;
    return `₹${form.fixed_amount_inr} + ${form.percentage_discount}% off`;
  };

  return (
    <div className="rounded-2xl border border-[#D4AF37]/30 bg-gradient-to-br from-black/60 to-[#D4AF37]/5 p-5 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#D4AF37]/70">Customer Preview</p>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 rounded-xl border-2 border-dashed border-[#D4AF37]/40 bg-black/40 px-4 py-2">
          <p className="font-mono text-lg font-bold text-[#D4AF37]">
            {hasCode ? form.code : "YOURCODE"}
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{hasCode ? discountLabel() : "— discount —"}</p>
          <p className="text-xs text-white/50">
            {form.all_orders ? "All users" : "Members only"} · Once per account
          </p>
        </div>
      </div>
      {form.description && <p className="text-xs text-white/60 italic">"{form.description}"</p>}
      <div className="flex flex-wrap gap-2 text-xs">
        {form.min_order_amount_inr && (
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-white/50">
            Min order {formatCurrency(form.min_order_amount_inr)}
          </span>
        )}
        {form.max_discount_inr && (
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-white/50">
            Cap {formatCurrency(form.max_discount_inr)}
          </span>
        )}
        {form.expires_at && (
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-white/50">
            Expires {formatDate(form.expires_at)}
          </span>
        )}
        {form.global_usage_limit && (
          <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-white/50">
            Max {form.global_usage_limit} uses
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Promo Codes ────────────────────────────────────────────────────────

function PromoTab() {
  const [form, setForm] = React.useState(defaultPromoForm);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [coupons, setCoupons] = React.useState([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [view, setView] = React.useState("create"); // create | list

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const loadCoupons = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const result = await listAllGeneralCoupons({ limit: 100, offset: 0 });
      // Promo coupons are ones with per_member_usage_limit = 1
      setCoupons((result.coupons || []).filter(c => c.per_member_usage_limit === 1));
    } catch (err) {
      // silently fail on list
    } finally {
      setLoadingList(false);
    }
  }, []);

  React.useEffect(() => {
    if (view === "list") loadCoupons();
  }, [view, loadCoupons]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.code.trim()) { setError("Coupon code is required."); return; }
    if (form.discount_type !== "fixed" && form.percentage_discount <= 0) { setError("Percentage must be > 0."); return; }
    if (form.discount_type !== "percentage" && form.fixed_amount_inr <= 0) { setError("Fixed amount must be > 0."); return; }

    setLoading(true);
    try {
      await createGeneralCoupon({
        ...form,
        code: form.code.trim().toUpperCase(),
        per_member_usage_limit: 1, // always 1 for promo codes
        require_membership: form.all_orders ? false : form.require_membership,
      });
      setSuccess(`Promo code "${form.code.toUpperCase()}" created!`);
      setForm(defaultPromoForm);
      setTimeout(() => setSuccess(""), 6000);
    } catch (err) {
      setError(err.message || "Failed to create promo code.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (coupon) => {
    try {
      await updateGeneralCoupon(coupon.id, { is_active: !coupon.is_active });
      await loadCoupons();
    } catch (err) {
      setError(err.message || "Failed to update coupon.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex gap-2 border-b border-neutral-800 pb-1">
        {["create", "list"].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition ${view === v ? "bg-[#D4AF37]/10 text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/50 hover:text-white/80"}`}
          >
            {v === "create" ? "Create New" : "All Promo Codes"}
          </button>
        ))}
      </div>

      <Banner type="success" message={success} onClose={() => setSuccess("")} />
      <Banner type="error" message={error} onClose={() => setError("")} />

      {view === "create" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-800 bg-black/40 p-6">
            <p className="text-xs text-white/50 leading-relaxed">
              Promo codes are public, shareable codes (e.g. <strong className="text-white/70">DIWALI20</strong>). They can be used by anyone, but each user account can only use them <strong className="text-white/70">once</strong>.
            </p>

            {/* Code */}
            <div>
              <FieldLabel>Coupon Code *</FieldLabel>
              <div className="flex gap-2">
                <Input
                  value={form.code}
                  onChange={e => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                  placeholder="e.g. DIWALI20"
                  disabled={loading}
                  className="font-mono text-base"
                />
                <button
                  type="button"
                  onClick={() => set("code", suggestPromoCode())}
                  className="shrink-0 rounded-lg border border-neutral-700 px-3 py-2 text-xs text-white/60 hover:border-[#D4AF37] hover:text-[#D4AF37] transition"
                >
                  Suggest
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <FieldLabel optional>Description</FieldLabel>
              <Input
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="e.g. Diwali festive discount"
                disabled={loading}
              />
            </div>

            {/* Discount Type */}
            <div>
              <FieldLabel>Discount Type *</FieldLabel>
              <div className="flex gap-2">
                {["percentage", "fixed", "both"].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("discount_type", t)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${form.discount_type === t ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]" : "border-neutral-700 text-white/50 hover:border-neutral-500"}`}
                  >
                    {t === "percentage" ? "%" : t === "fixed" ? "₹ Fixed" : "₹ + %"}
                  </button>
                ))}
              </div>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-2 gap-3">
              {(form.discount_type === "percentage" || form.discount_type === "both") && (
                <div>
                  <FieldLabel>Percentage (%)</FieldLabel>
                  <Input
                    type="number" min="0" max="100" step="0.5"
                    value={form.percentage_discount}
                    onChange={e => set("percentage_discount", parseFloat(e.target.value) || 0)}
                    disabled={loading}
                  />
                </div>
              )}
              {(form.discount_type === "fixed" || form.discount_type === "both") && (
                <div>
                  <FieldLabel>Fixed Amount (₹)</FieldLabel>
                  <Input
                    type="number" min="0" step="1"
                    value={form.fixed_amount_inr}
                    onChange={e => set("fixed_amount_inr", parseFloat(e.target.value) || 0)}
                    disabled={loading}
                  />
                </div>
              )}
              <div>
                <FieldLabel optional>Max Discount Cap (₹)</FieldLabel>
                <Input
                  type="number" min="0" step="1"
                  value={form.max_discount_inr || ""}
                  onChange={e => set("max_discount_inr", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="No cap"
                  disabled={loading}
                />
              </div>
              <div>
                <FieldLabel optional>Min Order Amount (₹)</FieldLabel>
                <Input
                  type="number" min="0" step="1"
                  value={form.min_order_amount_inr || ""}
                  onChange={e => set("min_order_amount_inr", e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="No minimum"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Limits & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel optional>Global Usage Limit</FieldLabel>
                <Input
                  type="number" min="1"
                  value={form.global_usage_limit || ""}
                  onChange={e => set("global_usage_limit", e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Unlimited"
                  disabled={loading}
                />
              </div>
              <div>
                <FieldLabel optional>Expiry Date</FieldLabel>
                <Input
                  type="datetime-local"
                  value={form.expires_at || ""}
                  onChange={e => set("expires_at", e.target.value || null)}
                  disabled={loading}
                />
              </div>
            </div>

            {/* Audience toggle */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Audience</p>
              <Toggle
                checked={form.all_orders}
                onChange={v => set("all_orders", v)}
                label="Open to all users (guests & members)"
              />
              {!form.all_orders && (
                <Toggle
                  checked={form.require_membership}
                  onChange={v => set("require_membership", v)}
                  label="Require membership account"
                />
              )}
            </div>

            <SubmitButton loading={loading} loadingText="Creating...">Create Promo Code</SubmitButton>
          </form>

          {/* Live Preview */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/40">Live Preview</p>
            <PromoPreviewCard form={form} />
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-4 text-xs text-white/50 space-y-1">
              <p>✓ Non-unique code — shareable publicly</p>
              <p>✓ Per-user limit: <strong className="text-white/70">1 use per account</strong></p>
              <p>✓ Tracked via {form.all_orders ? "all orders" : "member accounts"}</p>
            </div>
          </div>
        </div>
      )}

      {view === "list" && (
        <div className="rounded-2xl border border-neutral-800 bg-black/40 overflow-hidden">
          {loadingList ? (
            <p className="p-6 text-sm text-white/50">Loading...</p>
          ) : coupons.length === 0 ? (
            <p className="p-6 text-sm text-white/50">No promo codes yet. Create one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left">
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">Code</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">Discount</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">Usage</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">Audience</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">Expires</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {coupons.map(c => {
                    const usedPct = c.global_usage_limit ? Math.min(100, (c.global_usage_count / c.global_usage_limit) * 100) : 0;
                    return (
                      <tr key={c.id} className="hover:bg-white/2 transition">
                        <td className="px-4 py-3 font-mono font-bold text-[#D4AF37]">{c.code}</td>
                        <td className="px-4 py-3 text-white/80">
                          {c.discount_type === "fixed" && formatCurrency(c.fixed_amount_inr)}
                          {c.discount_type === "percentage" && `${c.percentage_discount}%`}
                          {c.discount_type === "both" && `₹${c.fixed_amount_inr} + ${c.percentage_discount}%`}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <span className="text-white/70">
                              {c.global_usage_count || 0}
                              {c.global_usage_limit ? ` / ${c.global_usage_limit}` : ""}
                            </span>
                            {c.global_usage_limit > 0 && (
                              <div className="h-1 w-20 rounded-full bg-neutral-800">
                                <div
                                  className="h-1 rounded-full bg-[#D4AF37] transition-all"
                                  style={{ width: `${usedPct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-white/60 text-xs">
                          {c.all_orders ? "All users" : "Members only"}
                        </td>
                        <td className="px-4 py-3 text-white/60 text-xs">{formatDate(c.expires_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${c.is_active ? "bg-green-900/40 text-green-300 border-green-700/40" : "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
                            {c.is_active ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggle(c)}
                            className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-white/60 hover:border-[#D4AF37] hover:text-[#D4AF37] transition"
                          >
                            {c.is_active ? "Disable" : "Enable"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: General Coupons ────────────────────────────────────────────────────

function GeneralTab() {
  const [form, setForm] = React.useState(defaultGeneralForm);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [coupons, setCoupons] = React.useState([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [view, setView] = React.useState("create");

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const loadCoupons = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const result = await listAllGeneralCoupons({ limit: 100, offset: 0 });
      setCoupons(result.coupons || []);
    } catch {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, []);

  React.useEffect(() => {
    if (view === "list") loadCoupons();
  }, [view, loadCoupons]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.code.trim()) { setError("Coupon code is required."); return; }
    if (form.discount_type === "fixed" && form.fixed_amount_inr <= 0) { setError("Fixed amount must be > 0."); return; }
    if (form.discount_type === "percentage" && form.percentage_discount <= 0) { setError("Percentage must be > 0."); return; }

    setLoading(true);
    try {
      await createGeneralCoupon({ ...form, code: form.code.trim().toUpperCase() });
      setSuccess(`Coupon "${form.code.toUpperCase()}" created!`);
      setForm(defaultGeneralForm);
      setTimeout(() => setSuccess(""), 6000);
    } catch (err) {
      setError(err.message || "Failed to create coupon.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (coupon) => {
    try {
      await updateGeneralCoupon(coupon.id, { is_active: !coupon.is_active });
      await loadCoupons();
    } catch (err) {
      setError(err.message || "Failed to update.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-neutral-800 pb-1">
        {["create", "list"].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition ${view === v ? "bg-[#D4AF37]/10 text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/50 hover:text-white/80"}`}
          >
            {v === "create" ? "Create New" : "All General Coupons"}
          </button>
        ))}
      </div>

      <Banner type="success" message={success} onClose={() => setSuccess("")} />
      <Banner type="error" message={error} onClose={() => setError("")} />

      {view === "create" && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-800 bg-black/40 p-6">
          <p className="text-xs text-white/50 leading-relaxed">
            General coupons have full configuration. Use for targeted campaigns, partnerships, or advanced use-cases with custom per-user limits.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel>Coupon Code *</FieldLabel>
              <Input
                value={form.code}
                onChange={e => set("code", e.target.value.toUpperCase().replace(/\s/g, ""))}
                placeholder="e.g. PARTNER30"
                disabled={loading}
                className="font-mono"
              />
            </div>
            <div>
              <FieldLabel optional>Description</FieldLabel>
              <Input
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="Internal note"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Discount Type *</FieldLabel>
            <div className="flex gap-2">
              {["fixed", "percentage", "both"].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("discount_type", t)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition ${form.discount_type === t ? "border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37]" : "border-neutral-700 text-white/50 hover:border-neutral-500"}`}
                >
                  {t === "fixed" ? "₹ Fixed" : t === "percentage" ? "% Percentage" : "₹ + % Both"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(form.discount_type === "fixed" || form.discount_type === "both") && (
              <div>
                <FieldLabel>Fixed Amount (₹)</FieldLabel>
                <Input type="number" min="0" step="0.01" value={form.fixed_amount_inr} onChange={e => set("fixed_amount_inr", parseFloat(e.target.value) || 0)} disabled={loading} />
              </div>
            )}
            {(form.discount_type === "percentage" || form.discount_type === "both") && (
              <div>
                <FieldLabel>Percentage (%)</FieldLabel>
                <Input type="number" min="0" max="100" step="0.5" value={form.percentage_discount} onChange={e => set("percentage_discount", parseFloat(e.target.value) || 0)} disabled={loading} />
              </div>
            )}
            <div>
              <FieldLabel optional>Max Discount Cap (₹)</FieldLabel>
              <Input type="number" min="0" value={form.max_discount_inr || ""} onChange={e => set("max_discount_inr", e.target.value ? parseFloat(e.target.value) : null)} placeholder="No cap" disabled={loading} />
            </div>
            <div>
              <FieldLabel optional>Min Order Amount (₹)</FieldLabel>
              <Input type="number" min="0" value={form.min_order_amount_inr || ""} onChange={e => set("min_order_amount_inr", e.target.value ? parseFloat(e.target.value) : null)} placeholder="No minimum" disabled={loading} />
            </div>
            <div>
              <FieldLabel optional>Global Usage Limit</FieldLabel>
              <Input type="number" min="1" value={form.global_usage_limit || ""} onChange={e => set("global_usage_limit", e.target.value ? parseInt(e.target.value) : null)} placeholder="Unlimited" disabled={loading} />
            </div>
            <div>
              <FieldLabel>Per-User Usage Limit</FieldLabel>
              <Input type="number" min="1" value={form.per_member_usage_limit} onChange={e => set("per_member_usage_limit", parseInt(e.target.value) || 1)} disabled={loading} />
            </div>
          </div>

          <div>
            <FieldLabel optional>Expiry Date</FieldLabel>
            <Input type="datetime-local" value={form.expires_at || ""} onChange={e => set("expires_at", e.target.value || null)} disabled={loading} className="max-w-xs" />
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Settings</p>
            <Toggle checked={form.require_membership} onChange={v => set("require_membership", v)} label="Require membership account" />
            <Toggle checked={form.all_orders} onChange={v => set("all_orders", v)} label="All orders (bypass member check)" />
          </div>

          <SubmitButton loading={loading} loadingText="Creating...">Create Coupon</SubmitButton>
        </form>
      )}

      {view === "list" && (
        <div className="rounded-2xl border border-neutral-800 bg-black/40 overflow-hidden">
          {loadingList ? (
            <p className="p-6 text-sm text-white/50">Loading...</p>
          ) : coupons.length === 0 ? (
            <p className="p-6 text-sm text-white/50">No coupons found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left">
                    {["Code", "Type", "Discount", "Per-User Limit", "Usage", "Status", "Action"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {coupons.map(c => (
                    <tr key={c.id} className="hover:bg-white/2 transition">
                      <td className="px-4 py-3 font-mono font-bold text-[#D4AF37]">{c.code}</td>
                      <td className="px-4 py-3 text-white/70 capitalize">{c.discount_type}</td>
                      <td className="px-4 py-3 text-white/80">
                        {c.discount_type === "fixed" && formatCurrency(c.fixed_amount_inr)}
                        {c.discount_type === "percentage" && `${c.percentage_discount}%`}
                        {c.discount_type === "both" && `₹${c.fixed_amount_inr} + ${c.percentage_discount}%`}
                      </td>
                      <td className="px-4 py-3 text-white/60">{c.per_member_usage_limit}</td>
                      <td className="px-4 py-3 text-white/70">{c.global_usage_count || 0}{c.global_usage_limit ? ` / ${c.global_usage_limit}` : ""}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${c.is_active ? "bg-green-900/40 text-green-300 border-green-700/40" : "bg-neutral-800 text-neutral-400 border-neutral-700"}`}>
                          {c.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggle(c)}
                          className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-white/60 hover:border-[#D4AF37] hover:text-[#D4AF37] transition"
                        >
                          {c.is_active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Member Coupons ─────────────────────────────────────────────────────

function MemberTab() {
  const [form, setForm] = React.useState(defaultMemberForm);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [coupons, setCoupons] = React.useState([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [view, setView] = React.useState("create");

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const loadCoupons = React.useCallback(async () => {
    setLoadingList(true);
    try {
      const result = await listMemberCoupons({ limit: 100, offset: 0 });
      setCoupons(result.coupons || []);
    } catch {
      // silent
    } finally {
      setLoadingList(false);
    }
  }, []);

  React.useEffect(() => {
    if (view === "list") loadCoupons();
  }, [view, loadCoupons]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.email.trim()) { setError("Email is required."); return; }
    if (!form.amountInr || form.amountInr <= 0) { setError("Amount must be greater than 0."); return; }

    setLoading(true);
    try {
      const result = await issueMemberCouponByEmail({
        email: form.email.trim(),
        amountInr: Number(form.amountInr),
        expiresAt: form.expiresAt || null,
        reason: form.reason || "admin_issued",
      });
      setSuccess(`Coupon ${result.coupon?.code} (₹${form.amountInr}) issued to ${form.email}!`);
      setForm(defaultMemberForm);
      setTimeout(() => setSuccess(""), 8000);
    } catch (err) {
      setError(err.message || "Failed to issue coupon.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (coupon) => {
    if (!window.confirm(`Revoke coupon ${coupon.code}? This cannot be undone.`)) return;
    try {
      await updateMemberCoupon(coupon.id, { status: "revoked" });
      await loadCoupons();
    } catch (err) {
      setError(err.message || "Failed to revoke coupon.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-neutral-800 pb-1">
        {["create", "list"].map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 rounded-t-lg text-sm font-medium transition ${view === v ? "bg-[#D4AF37]/10 text-[#D4AF37] border-b-2 border-[#D4AF37]" : "text-white/50 hover:text-white/80"}`}
          >
            {v === "create" ? "Issue to Email" : "All Member Coupons"}
          </button>
        ))}
      </div>

      <Banner type="success" message={success} onClose={() => setSuccess("")} />
      <Banner type="error" message={error} onClose={() => setError("")} />

      {view === "create" && (
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-800 bg-black/40 p-6 max-w-lg">
          <p className="text-xs text-white/50 leading-relaxed">
            Issue a personal coupon code directly to a user by their email address. The user must already have an account on the platform. The coupon will appear in their account wallet.
          </p>

          <div>
            <FieldLabel>Customer Email *</FieldLabel>
            <Input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="customer@example.com"
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Amount (₹) *</FieldLabel>
              <Input
                type="number" min="1" step="1"
                value={form.amountInr}
                onChange={e => set("amountInr", parseFloat(e.target.value) || 0)}
                disabled={loading}
              />
            </div>
            <div>
              <FieldLabel optional>Expiry Date</FieldLabel>
              <Input
                type="datetime-local"
                value={form.expiresAt || ""}
                onChange={e => set("expiresAt", e.target.value || null)}
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <FieldLabel optional>Reason / Internal Note</FieldLabel>
            <Select value={form.reason} onChange={e => set("reason", e.target.value)} disabled={loading}>
              <option value="admin_issued">Admin issued</option>
              <option value="goodwill">Goodwill / apology</option>
              <option value="referral">Referral reward</option>
              <option value="loyalty">Loyalty reward</option>
              <option value="campaign">Campaign</option>
              <option value="refund_credit">Refund credit</option>
            </Select>
          </div>

          <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-3 text-xs text-white/60 space-y-1">
            <p>✓ A unique code (e.g. <strong className="text-white/70">ADM-XXXXXXXX</strong>) will be auto-generated.</p>
            <p>✓ The user sees this code in their account under "My Coupons".</p>
            <p>✓ It can only be used by the assigned email account.</p>
          </div>

          <SubmitButton loading={loading} loadingText="Issuing...">Issue Coupon to User</SubmitButton>
        </form>
      )}

      {view === "list" && (
        <div className="rounded-2xl border border-neutral-800 bg-black/40 overflow-hidden">
          {loadingList ? (
            <p className="p-6 text-sm text-white/50">Loading...</p>
          ) : coupons.length === 0 ? (
            <p className="p-6 text-sm text-white/50">No member coupons found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-left">
                    {["Code", "Amount", "Status", "Reason", "Issued", "Expires", "Action"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white/40">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {coupons.map(c => (
                    <tr key={c.id} className="hover:bg-white/2 transition">
                      <td className="px-4 py-3 font-mono text-xs text-[#D4AF37]">{c.code}</td>
                      <td className="px-4 py-3 text-white/80">{formatCurrency(c.amount_inr)}</td>
                      <td className="px-4 py-3"><StatusBadge value={c.status} /></td>
                      <td className="px-4 py-3 text-white/60 capitalize text-xs">{(c.issued_reason || "").replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 text-white/60 text-xs">{formatDateTime(c.issued_at)}</td>
                      <td className="px-4 py-3 text-white/60 text-xs">{formatDate(c.expires_at)}</td>
                      <td className="px-4 py-3">
                        {c.status === "active" ? (
                          <button
                            onClick={() => handleRevoke(c)}
                            className="rounded-full border border-red-800/50 px-3 py-1 text-xs text-red-400 hover:border-red-500 hover:bg-red-900/20 transition"
                          >
                            Revoke
                          </button>
                        ) : (
                          <span className="text-xs text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const TABS = [
  { id: "promo", label: "🎯 Promo Codes", description: "Shareable codes · once per account" },
  { id: "general", label: "🌐 General Coupons", description: "Full-featured campaign coupons" },
  { id: "member", label: "🎁 Member Coupons", description: "Issue directly to an email" },
];

export default function AdminCouponsPage() {
  const admin = useAdminAccess();
  const [activeTab, setActiveTab] = React.useState("promo");

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">Coupon Manager</h1>
        <p className="text-sm text-white/70 mt-1">
          Create and manage all discount codes from one place.
        </p>
      </div>

      {admin.checkingAccess ? (
        <p className="text-sm text-white/70">Checking admin access...</p>
      ) : !admin.authorized ? (
        <Navigate to="/admin" replace />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <AdminSidebar onSignOut={admin.logout} authLoading={admin.authLoading} />

          <section className="space-y-6 min-w-0">
            {/* Tab Navigation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    activeTab === tab.id
                      ? "border-[#D4AF37] bg-[#D4AF37]/10"
                      : "border-neutral-800 bg-black/30 hover:border-neutral-600"
                  }`}
                >
                  <p className={`text-sm font-semibold ${activeTab === tab.id ? "text-[#D4AF37]" : "text-white/80"}`}>
                    {tab.label}
                  </p>
                  <p className="text-xs text-white/40 mt-0.5">{tab.description}</p>
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div>
              {activeTab === "promo" && <PromoTab />}
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "member" && <MemberTab />}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
