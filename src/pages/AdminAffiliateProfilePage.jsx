import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { getAdminAffiliateProfile, markAffiliateCommissionsPaid } from "../lib/adminAffiliatesApi";

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

export default function AdminAffiliateProfilePage() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [selectedTransactions, setSelectedTransactions] = useState([]);
  const [updating, setUpdating] = useState(false);

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
                  <h2 className="text-2xl font-semibold mb-1">{profile.affiliate_name}</h2>
                  <div className="flex gap-4 text-sm text-white/50">
                    <p>Code: <strong className="text-white">{profile.coupon_code}</strong></p>
                    <p>Rate: <strong className="text-white">{profile.commission_type === 'percentage' ? `${profile.commission_rate}%` : formatCurrency(profile.commission_rate)}</strong></p>
                    <p>Joined: {formatDate(profile.created_at)}</p>
                  </div>
                </div>
                {!profile.is_active && (
                  <span className="bg-red-900/50 text-red-300 px-3 py-1 rounded text-sm font-medium">Inactive Code</span>
                )}
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

            {/* Transaction History / Payouts */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
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
