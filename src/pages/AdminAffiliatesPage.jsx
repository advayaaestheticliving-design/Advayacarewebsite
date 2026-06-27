import React, { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import AdminLoginCard from "../components/AdminLoginCard";
import AdminSidebar from "../components/AdminSidebar";
import { useAdminAccess } from "../lib/useAdminAccess";
import { getAdminAffiliates, createAdminAffiliateCoupon } from "../lib/adminAffiliatesApi";

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

const defaultForm = {
  affiliate_name: "",
  code: "",
  commission_type: "percentage",
  commission_rate: 10,
  discount_type: "percentage",
  percentage_discount: 10,
  fixed_amount_inr: 0,
};

export default function AdminAffiliatesPage() {
  const admin = useAdminAccess();
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const loadAffiliates = useCallback(async () => {
    if (!admin.authorized) return;
    setLoading(true);
    setError("");
    try {
      const data = await getAdminAffiliates(period);
      setAffiliates(data);
    } catch (err) {
      setError(err.message || "Failed to load affiliates");
    } finally {
      setLoading(false);
    }
  }, [admin.authorized, period]);

  useEffect(() => {
    if (!admin.checkingAccess && admin.authorized) {
      loadAffiliates();
    }
  }, [admin.checkingAccess, admin.authorized, loadAffiliates]);

  if (admin.checkingAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-900 text-[#D4AF37]">
        Checking access...
      </div>
    );
  }

  if (!admin.authorized) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-900">
        <AdminLoginCard />
      </div>
    );
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    
    try {
      await createAdminAffiliateCoupon(form);
      setForm(defaultForm);
      setShowForm(false);
      loadAffiliates();
    } catch (err) {
      setError(err.message || "Failed to create affiliate");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen bg-[#050505] text-white overflow-hidden font-sans">
      <AdminSidebar currentRoute="/admin/affiliates" />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="p-8 max-w-7xl mx-auto w-full">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-serif tracking-wide text-white">Affiliate Tracking</h1>
              <p className="text-white/50 mt-1">Manage affiliate coupons and track commissions.</p>
            </div>
            <div className="flex gap-4">
              <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto">
                <option value="all">All Time</option>
                <option value="yearly">Last Year</option>
                <option value="half_yearly">Last 6 Months</option>
                <option value="quarterly">Last Quarter</option>
                <option value="monthly">Last Month</option>
              </Select>
              <button
                onClick={() => setShowForm(!showForm)}
                className="bg-[#D4AF37] hover:bg-[#c4a130] text-black px-4 py-2 rounded-lg font-medium transition"
              >
                {showForm ? "Cancel" : "New Affiliate Coupon"}
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-800/50 rounded-lg text-red-200">
              {error}
            </div>
          )}

          {showForm && (
            <div className="mb-8 p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
              <h2 className="text-xl font-serif mb-6">Create Affiliate Coupon</h2>
              <form onSubmit={handleCreate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <FieldLabel>Affiliate Name</FieldLabel>
                    <Input 
                      required 
                      value={form.affiliate_name} 
                      onChange={e => setForm({...form, affiliate_name: e.target.value})} 
                      placeholder="e.g. John Doe"
                    />
                  </div>
                  <div>
                    <FieldLabel>Coupon Code</FieldLabel>
                    <Input 
                      required 
                      value={form.code} 
                      onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} 
                      placeholder="e.g. JOHNDOE10"
                    />
                  </div>

                  <div>
                    <FieldLabel>Coupon Discount Type</FieldLabel>
                    <Select 
                      value={form.discount_type} 
                      onChange={e => setForm({...form, discount_type: e.target.value})}
                    >
                      <option value="percentage">Percentage Off</option>
                      <option value="fixed">Fixed Amount Off</option>
                    </Select>
                  </div>
                  
                  {form.discount_type === 'percentage' ? (
                    <div>
                      <FieldLabel>Coupon Discount %</FieldLabel>
                      <Input 
                        type="number" 
                        min="1" 
                        max="100" 
                        value={form.percentage_discount} 
                        onChange={e => setForm({...form, percentage_discount: e.target.value})} 
                      />
                    </div>
                  ) : (
                    <div>
                      <FieldLabel>Coupon Discount (INR)</FieldLabel>
                      <Input 
                        type="number" 
                        min="1" 
                        value={form.fixed_amount_inr} 
                        onChange={e => setForm({...form, fixed_amount_inr: e.target.value})} 
                      />
                    </div>
                  )}

                  <div>
                    <FieldLabel>Commission Type</FieldLabel>
                    <Select 
                      value={form.commission_type} 
                      onChange={e => setForm({...form, commission_type: e.target.value})}
                    >
                      <option value="percentage">Percentage of Sale</option>
                      <option value="fixed">Fixed Amount per Sale</option>
                    </Select>
                  </div>

                  <div>
                    <FieldLabel>
                      {form.commission_type === 'percentage' ? 'Commission Rate (%)' : 'Commission Amount (INR)'}
                    </FieldLabel>
                    <Input 
                      type="number" 
                      min="0" 
                      step="0.01"
                      required
                      value={form.commission_rate} 
                      onChange={e => setForm({...form, commission_rate: e.target.value})} 
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-white text-black px-6 py-2 rounded-lg font-medium hover:bg-neutral-200 transition disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Create Affiliate Coupon"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading && affiliates.length === 0 ? (
            <div className="py-20 text-center text-white/50">Loading affiliates...</div>
          ) : affiliates.length === 0 ? (
            <div className="py-20 text-center text-white/50 border border-neutral-800 rounded-xl bg-neutral-900/20">
              No affiliates found. Create one to get started.
            </div>
          ) : (
            <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 text-white/50 uppercase tracking-wider text-xs">
                    <th className="px-6 py-4 font-medium">Affiliate</th>
                    <th className="px-6 py-4 font-medium">Coupon</th>
                    <th className="px-6 py-4 font-medium text-right">Uses</th>
                    <th className="px-6 py-4 font-medium text-right">Gross Rev</th>
                    <th className="px-6 py-4 font-medium text-right">Net Rev</th>
                    <th className="px-6 py-4 font-medium text-right text-[#D4AF37]">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {affiliates.map((aff) => (
                    <tr key={aff.id} className="hover:bg-white/[0.02] transition">
                      <td className="px-6 py-4">
                        <div className="font-medium text-white">{aff.affiliate_name}</div>
                        <div className="text-xs text-white/40 mt-1">
                          {aff.commission_type === 'percentage' ? `${aff.commission_rate}% of Net` : `${formatCurrency(aff.commission_rate)} fixed`}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white font-mono bg-white/10 px-2 py-0.5 rounded inline-block">
                          {aff.coupon_code}
                        </div>
                        {!aff.is_active && (
                          <span className="ml-2 text-xs text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">Inactive</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums">
                        {aff.metrics.uses}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-white/70">
                        {formatCurrency(aff.metrics.gross_revenue)}
                      </td>
                      <td className="px-6 py-4 text-right tabular-nums text-white/90">
                        {formatCurrency(aff.metrics.net_revenue)}
                      </td>
                      <td className="px-6 py-4 text-right font-medium tabular-nums text-[#D4AF37]">
                        {formatCurrency(aff.metrics.commission)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
