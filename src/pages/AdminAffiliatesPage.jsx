import React, { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { useAdminAccess } from "../lib/useAdminAccess";
import { 
  getAdminAffiliates, 
  createAdminAffiliateCoupon, 
  getAdminAffiliateApplications, 
  approveAdminAffiliateApplication, 
  rejectAdminAffiliateApplication 
} from "../lib/adminAffiliatesApi";

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
  const [activeTab, setActiveTab] = useState("approved"); // 'approved' or 'pending'

  // Approved Affiliates state
  const [affiliates, setAffiliates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(defaultForm);

  // Pending Applications state
  const [applications, setApplications] = useState([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [processingApp, setProcessingApp] = useState(null);

  // Approval Modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [appToApprove, setAppToApprove] = useState(null);
  const [approvalForm, setApprovalForm] = useState({ commission_rate: 10, custom_code: "" });

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

  const loadApplications = useCallback(async () => {
    if (!admin.authorized) return;
    setLoadingApps(true);
    try {
      const data = await getAdminAffiliateApplications("pending");
      setApplications(data);
    } catch (err) {
      setError(err.message || "Failed to load applications");
    } finally {
      setLoadingApps(false);
    }
  }, [admin.authorized]);

  useEffect(() => {
    if (admin.authorized) {
      if (activeTab === "approved") {
        loadAffiliates();
      } else {
        loadApplications();
      }
    }
  }, [admin.authorized, activeTab, loadAffiliates, loadApplications]);

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

  function openApprovalModal(app) {
    const sanitizedName = app.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const suggestedCode = `${sanitizedName}${Math.floor(1000 + Math.random() * 9000)}`;
    setAppToApprove(app);
    setApprovalForm({ commission_rate: 10, custom_code: suggestedCode });
    setShowApprovalModal(true);
  }

  async function handleApproveSubmit(e) {
    e.preventDefault();
    if (!appToApprove) return;
    setProcessingApp(appToApprove.id);
    setError("");
    try {
      await approveAdminAffiliateApplication(appToApprove.id, approvalForm.commission_rate, approvalForm.custom_code);
      setShowApprovalModal(false);
      setAppToApprove(null);
      loadApplications();
    } catch (err) {
      setError(err.message || "Failed to approve application");
    } finally {
      setProcessingApp(null);
    }
  }

  async function handleRejectApp(id) {
    if (!window.confirm("Reject this affiliate application?")) return;
    setProcessingApp(id);
    setError("");
    try {
      await rejectAdminAffiliateApplication(id);
      loadApplications();
    } catch (err) {
      setError(err.message || "Failed to reject application");
    } finally {
      setProcessingApp(null);
    }
  }

  if (admin.checkingAccess) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-sm text-white/80">Checking admin access...</p>
      </div>
    );
  }

  if (!admin.authorized) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37] mb-8">Admin Affiliates</h1>

        <div className="flex flex-col md:flex-row gap-8">
          <div className="w-full md:w-64 shrink-0">
            <AdminSidebar onSignOut={admin.logout} authLoading={admin.authLoading} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex gap-4 mb-8 border-b border-neutral-800">
              <button
                onClick={() => setActiveTab("approved")}
                className={`pb-4 px-2 text-sm font-medium transition ${activeTab === "approved" ? "border-b-2 border-[#D4AF37] text-white" : "text-white/50 hover:text-white"}`}
              >
                Approved Affiliates
              </button>
              <button
                onClick={() => setActiveTab("pending")}
                className={`pb-4 px-2 text-sm font-medium transition flex items-center gap-2 ${activeTab === "pending" ? "border-b-2 border-[#D4AF37] text-white" : "text-white/50 hover:text-white"}`}
              >
                Pending Applications
                {applications.length > 0 && (
                  <span className="bg-[#D4AF37] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {applications.length}
                  </span>
                )}
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-900/30 border border-red-800/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {activeTab === "approved" && (
              <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <div>
                    <h2 className="text-xl font-serif tracking-wide text-white">Affiliate Tracking</h2>
                    <p className="text-white/50 mt-1">Manage affiliate coupons and track commissions.</p>
                  </div>
                  <div className="flex gap-4 items-center">
                    <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="w-auto">
                      <option value="all">All Time</option>
                      <option value="yearly">Last Year</option>
                      <option value="half_yearly">Last 6 Months</option>
                      <option value="quarterly">Last Quarter</option>
                      <option value="monthly">Last Month</option>
                    </Select>
                    <button
                      onClick={() => setShowForm(!showForm)}
                      className="bg-[#D4AF37] hover:bg-[#c4a130] text-black px-4 py-2 rounded-lg font-medium transition whitespace-nowrap"
                    >
                      {showForm ? "Cancel" : "New Affiliate Coupon"}
                    </button>
                  </div>
                </div>

                {showForm && (
                  <div className="mb-8 p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                    <h2 className="text-lg font-serif mb-6">Create Affiliate Coupon</h2>
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
            )}

            {activeTab === "pending" && (
              <div className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="mb-8">
                  <h2 className="text-xl font-serif tracking-wide text-white">Pending Applications</h2>
                  <p className="text-white/50 mt-1">Review and approve new affiliate applications.</p>
                </div>

                {loadingApps ? (
                   <div className="py-20 text-center text-white/50">Loading applications...</div>
                ) : applications.length === 0 ? (
                  <div className="py-20 text-center text-white/50 border border-neutral-800 rounded-xl bg-neutral-900/20">
                    No pending applications.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {applications.map(app => (
                      <div key={app.id} className="p-6 bg-neutral-900/40 border border-neutral-800 rounded-xl flex flex-col md:flex-row justify-between gap-6">
                        <div className="space-y-2 flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-medium text-white">{app.name}</h3>
                              <a href={`mailto:${app.email}`} className="text-sm text-amber-500 hover:underline">{app.email}</a>
                            </div>
                            <span className="text-xs text-white/40">{formatDate(app.created_at)}</span>
                          </div>
                          {app.social_links && (
                            <p className="text-sm text-white/80"><span className="text-white/50 font-semibold uppercase text-xs">Social:</span> {app.social_links}</p>
                          )}
                          {app.reason && (
                            <p className="text-sm text-white/80"><span className="text-white/50 font-semibold uppercase text-xs">Reason:</span> {app.reason}</p>
                          )}
                        </div>
                        <div className="flex flex-row md:flex-col gap-3 shrink-0 pt-2">
                          <button 
                            onClick={() => openApprovalModal(app)}
                            disabled={processingApp === app.id}
                            className="flex-1 md:flex-none bg-[#D4AF37] hover:bg-[#c4a130] text-black px-4 py-2 rounded-lg font-medium transition text-sm disabled:opacity-50"
                          >
                            {processingApp === app.id ? "Processing..." : "Approve"}
                          </button>
                          <button 
                            onClick={() => handleRejectApp(app.id)}
                            disabled={processingApp === app.id}
                            className="flex-1 md:flex-none bg-neutral-800 hover:bg-red-900 hover:text-red-100 text-white px-4 py-2 rounded-lg font-medium transition text-sm disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h2 className="text-xl font-serif text-white mb-2">Approve Affiliate</h2>
            <p className="text-sm text-white/50 mb-6">Customize the coupon code and commission rate for {appToApprove?.name}.</p>
            
            <form onSubmit={handleApproveSubmit} className="space-y-4">
              <div>
                <FieldLabel>Coupon Code</FieldLabel>
                <Input
                  required
                  value={approvalForm.custom_code}
                  onChange={e => setApprovalForm({...approvalForm, custom_code: e.target.value.toUpperCase()})}
                />
              </div>
              <div>
                <FieldLabel>Commission Rate (%)</FieldLabel>
                <Input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={approvalForm.commission_rate}
                  onChange={e => setApprovalForm({...approvalForm, commission_rate: parseFloat(e.target.value) || 0})}
                />
              </div>
              
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowApprovalModal(false)}
                  disabled={processingApp}
                  className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingApp}
                  className="bg-[#D4AF37] text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#c4a130] transition disabled:opacity-50"
                >
                  {processingApp ? "Approving..." : "Approve & Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
