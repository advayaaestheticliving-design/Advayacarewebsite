import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminAffiliateProfile, markAffiliateCommissionsPaid, issueAdminAffiliateCoupon } from "../lib/adminAffiliatesApi";
import { updateGeneralCoupon, deleteGeneralCoupon } from "../lib/adminCouponsApi";

function formatCurrency(v) {
  return Number(v || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

function formatDate(isoString) {
  if (!isoString) return "N/A";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function FieldLabel({ children }) {
  return <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 mb-1">{children}</label>;
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

export default function AdminAffiliateProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [updating, setUpdating] = useState(false);

  // New Coupon Form state
  const [showIssueForm, setShowIssueForm] = useState(false);
  const [submittingCoupon, setSubmittingCoupon] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: "",
    discount_type: "percentage",
    percentage_discount: 10,
    commission_type: "percentage",
    commission_rate: 10,
  });

  useEffect(() => {
    loadProfile();
  }, [id]);

  async function loadProfile() {
    try {
      setLoading(true);
      const data = await getAdminAffiliateProfile(id);
      if (!data) throw new Error("Profile not found");
      setProfile(data);
    } catch (err) {
      setError(err.message || "Failed to load affiliate profile");
    } finally {
      setLoading(false);
    }
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTransactions(profile.metrics.transactions.map(t => t.id));
    } else {
      setSelectedTransactions([]);
    }
  };

  const handleSelectOne = (e, tId) => {
    if (e.target.checked) {
      setSelectedTransactions(prev => [...prev, tId]);
    } else {
      setSelectedTransactions(prev => prev.filter(id => id !== tId));
    }
  };

  const handleMarkPaid = async () => {
    if (selectedTransactions.length === 0) return;
    if (!window.confirm(`Mark ${selectedTransactions.length} transaction(s) as PAID?`)) return;

    try {
      setUpdating(true);
      await markAffiliateCommissionsPaid(selectedTransactions, true);
      setSelectedTransactions([]);
      await loadProfile();
    } catch (err) {
      alert("Failed to update payouts: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleMarkUnpaid = async () => {
    if (selectedTransactions.length === 0) return;
    if (!window.confirm(`Mark ${selectedTransactions.length} transaction(s) as UNPAID?`)) return;

    try {
      setUpdating(true);
      await markAffiliateCommissionsPaid(selectedTransactions, false);
      setSelectedTransactions([]);
      await loadProfile();
    } catch (err) {
      alert("Failed to update payouts: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleCoupon = async (couponId, currentStatus) => {
    if (!couponId) {
      alert("Error: couponId is missing!");
      return;
    }
    try {
      setUpdating(true);
      await updateGeneralCoupon(couponId, { is_active: !currentStatus });
      await loadProfile();
    } catch (err) {
      alert(err.message || "Failed to update affiliate coupon.");
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteCoupon = async (couponId, couponCode) => {
    if (!window.confirm(`Are you sure you want to delete coupon ${couponCode}?`)) return;
    try {
      setUpdating(true);
      await deleteGeneralCoupon(couponId);
      await loadProfile();
    } catch (err) {
      alert(err.message || "Failed to delete coupon.");
    } finally {
      setUpdating(false);
    }
  };

  const handleIssueCouponSubmit = async (e) => {
    e.preventDefault();
    setSubmittingCoupon(true);
    try {
      await issueAdminAffiliateCoupon({
        profile_id: id,
        ...couponForm
      });
      setShowIssueForm(false);
      setCouponForm({
        code: "",
        discount_type: "percentage",
        percentage_discount: 10,
        commission_type: "percentage",
        commission_rate: 10,
      });
      await loadProfile();
    } catch (err) {
      alert(err.message || "Failed to issue new coupon: " + err.message);
    } finally {
      setSubmittingCoupon(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex">
      <AdminSidebar />

      <main className="flex-1 ml-64 p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link to="/admin/affiliates" className="text-white/50 hover:text-white mb-2 inline-block text-sm">
              &larr; Back to Affiliates
            </Link>
            <h1 className="text-3xl font-serif text-[#D4AF37]">Affiliate Profile</h1>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-900/30 border border-red-800/50 rounded-xl text-red-200 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-white/50">Loading profile...</p>
        ) : profile ? (
          <div className="space-y-8">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-4 bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold mb-1">{profile.name}</h2>
                  <div className="flex gap-4 text-sm text-white/50">
                    <p>Status: <strong className="text-white capitalize">{profile.status}</strong></p>
                    <p>Joined: {formatDate(profile.created_at)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                <p className="text-white/50 text-sm mb-1">Total Uses</p>
                <p className="text-2xl font-semibold">{profile.metrics.uses}</p>
              </div>
              <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
                <p className="text-white/50 text-sm mb-1">Lifetime Commission</p>
                <p className="text-2xl font-semibold">{formatCurrency(profile.metrics.commission)}</p>
              </div>
              <div className="bg-neutral-900/50 border border-[#D4AF37]/30 rounded-2xl p-6">
                <p className="text-[#D4AF37]/70 text-sm mb-1">Total Paid</p>
                <p className="text-2xl font-semibold text-[#D4AF37]">{formatCurrency(profile.metrics.paid_commission)}</p>
              </div>
              <div className="bg-neutral-900/50 border border-red-900/50 rounded-2xl p-6">
                <p className="text-red-400/70 text-sm mb-1">Unpaid Balance</p>
                <p className="text-2xl font-semibold text-red-400">{formatCurrency(profile.metrics.unpaid_commission)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Contact Details */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-1">
                <h3 className="text-xl font-medium mb-4">Profile Details</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-white/50 text-sm uppercase tracking-wide font-semibold mb-1">Email</p>
                    <p className="text-white">{profile.email ? <a href={`mailto:${profile.email}`} className="text-[#D4AF37] hover:underline">{profile.email}</a> : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm uppercase tracking-wide font-semibold mb-1">Phone</p>
                    <p className="text-white">{profile.phone ? <a href={`tel:${profile.phone}`} className="text-[#D4AF37] hover:underline">{profile.phone}</a> : "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm uppercase tracking-wide font-semibold mb-1">Social/Website</p>
                    <p className="text-white">{profile.social_links || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm uppercase tracking-wide font-semibold mb-1">Reason for joining</p>
                    <p className="text-white">{profile.reason || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* Coupons Section */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:col-span-2">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-medium">Affiliate Coupons</h3>
                  <button 
                    onClick={() => setShowIssueForm(!showIssueForm)}
                    className="bg-[#D4AF37] hover:bg-[#c4a130] text-black px-3 py-1.5 rounded-lg text-sm font-medium transition"
                  >
                    {showIssueForm ? "Cancel" : "Issue New Coupon"}
                  </button>
                </div>

                {showIssueForm && (
                  <div className="mb-6 p-4 bg-neutral-950 border border-neutral-800 rounded-xl">
                    <form onSubmit={handleIssueCouponSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <FieldLabel>Coupon Code</FieldLabel>
                          <Input required value={couponForm.code} onChange={e => setCouponForm({...couponForm, code: e.target.value.toUpperCase()})} placeholder="e.g. SUMMER10" />
                        </div>
                        <div>
                          <FieldLabel>Discount Type</FieldLabel>
                          <Select value={couponForm.discount_type} onChange={e => setCouponForm({...couponForm, discount_type: e.target.value})}>
                            <option value="percentage">Percentage</option>
                          </Select>
                        </div>
                        <div>
                          <FieldLabel>Discount %</FieldLabel>
                          <Input required type="number" min="1" max="100" value={couponForm.percentage_discount} onChange={e => setCouponForm({...couponForm, percentage_discount: e.target.value})} />
                        </div>
                        <div>
                          <FieldLabel>Commission Rate (%)</FieldLabel>
                          <Input required type="number" min="0" max="100" step="0.01" value={couponForm.commission_rate} onChange={e => setCouponForm({...couponForm, commission_rate: e.target.value})} />
                        </div>
                      </div>
                      <div className="flex justify-end pt-2">
                        <button type="submit" disabled={submittingCoupon} className="bg-white hover:bg-neutral-200 text-black px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                          {submittingCoupon ? "Issuing..." : "Create Coupon"}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="space-y-3">
                  {profile.coupons?.map(c => (
                    <div key={c.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-neutral-950 border border-neutral-800 rounded-lg gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-white font-medium tracking-wider">{c.coupon_code}</span>
                          {!c.is_active && <span className="text-xs text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded border border-red-800/50">Inactive</span>}
                        </div>
                        <div className="text-xs text-white/50 flex gap-4">
                          <span>Disc: {c.discount_type === 'percentage' ? `${c.metrics.uses ? '?' : c.percentage_discount || 10}%` : 'Fixed'}</span>
                          <span>Comm: {c.commission_type === 'percentage' ? `${c.commission_rate}%` : `₹${c.commission_rate}`}</span>
                          <span>Uses: {c.metrics?.uses || 0}</span>
                        </div>
                        <div className="text-xs text-red-500 break-all max-w-sm mt-2 font-mono">DEBUG: {JSON.stringify(c)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleToggleCoupon(c.coupon_id, c.is_active)} disabled={updating} className="px-3 py-1.5 text-xs font-medium border border-neutral-700 hover:border-[#D4AF37] hover:text-[#D4AF37] rounded-lg transition disabled:opacity-50">
                          {c.is_active ? "Disable" : "Enable"}
                        </button>
                        <button onClick={() => handleDeleteCoupon(c.coupon_id, c.coupon_code)} disabled={updating} className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-900/50 hover:bg-red-900/30 rounded-lg transition disabled:opacity-50">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {(!profile.coupons || profile.coupons.length === 0) && (
                    <p className="text-white/50 text-sm">No coupons issued yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction History / Payouts */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden mt-8">
              <div className="p-6 border-b border-neutral-800 flex justify-between items-center">
                <h3 className="text-xl font-medium">Transaction History</h3>
                <div className="space-x-3">
                  <button 
                    onClick={handleMarkUnpaid}
                    disabled={updating || selectedTransactions.length === 0}
                    className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition"
                  >
                    Mark as Unpaid
                  </button>
                  <button 
                    onClick={handleMarkPaid}
                    disabled={updating || selectedTransactions.length === 0}
                    className="px-4 py-2 bg-[#D4AF37] hover:bg-[#c4a130] text-black text-sm font-medium rounded-lg disabled:opacity-50 transition"
                  >
                    Mark as Paid
                  </button>
                </div>
              </div>
              
              {profile.metrics.transactions.length === 0 ? (
                <div className="p-6 text-center text-white/50">No transactions found for this affiliate.</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-black/40 text-white/60">
                    <tr>
                      <th className="p-4 w-12">
                        <input 
                          type="checkbox" 
                          className="rounded border-neutral-700 bg-neutral-800 text-[#D4AF37] focus:ring-[#D4AF37]"
                          onChange={handleSelectAll}
                          checked={selectedTransactions.length === profile.metrics.transactions.length && profile.metrics.transactions.length > 0}
                        />
                      </th>
                      <th className="p-4 font-medium">Order Date</th>
                      <th className="p-4 font-medium">Coupon</th>
                      <th className="p-4 font-medium">Net Revenue</th>
                      <th className="p-4 font-medium">Commission</th>
                      <th className="p-4 font-medium">Status</th>
                      <th className="p-4 font-medium">Paid On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {profile.metrics.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-neutral-800/50 transition">
                        <td className="p-4">
                          <input 
                            type="checkbox" 
                            className="rounded border-neutral-700 bg-neutral-800 text-[#D4AF37] focus:ring-[#D4AF37]"
                            checked={selectedTransactions.includes(t.id)}
                            onChange={(e) => handleSelectOne(e, t.id)}
                          />
                        </td>
                        <td className="p-4 text-white">{formatDate(t.used_at)}</td>
                        <td className="p-4 font-mono text-xs">{t.coupon_code}</td>
                        <td className="p-4 text-white/70">{formatCurrency(t.net_revenue)}</td>
                        <td className="p-4 text-[#D4AF37] font-medium">{formatCurrency(t.commission)}</td>
                        <td className="p-4">
                          {t.is_paid ? (
                            <span className="bg-green-900/30 text-green-400 px-2 py-1 rounded text-xs font-medium border border-green-800/50">Paid</span>
                          ) : (
                            <span className="bg-orange-900/30 text-orange-400 px-2 py-1 rounded text-xs font-medium border border-orange-800/50">Unpaid</span>
                          )}
                        </td>
                        <td className="p-4 text-white/50">{t.is_paid ? formatDate(t.paid_at) : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
