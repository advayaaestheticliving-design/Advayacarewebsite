import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { useAdminAccess } from "../lib/useAdminAccess";
import {
  generateCouponsForMembers,
  disableCoupon,
  listMemberCoupons,
  searchCoupons,
} from "../lib/adminCouponsApi";

function AdminCouponsPage() {
  const navigate = useNavigate();
  const { authorized: isAuthenticated, checkingAccess, authLoading } = useAdminAccess();

  // Form states
  const [memberEmails, setMemberEmails] = useState("");
  const [amountInr, setAmountInr] = useState(100);
  const [expiryDays, setExpiryDays] = useState(30);
  const [reason, setReason] = useState("admin_generated");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateSuccess, setGenerateSuccess] = useState(null);
  const [generateError, setGenerateError] = useState(null);

  // List states
  const [coupons, setCoupons] = useState([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(true);
  const [couponsError, setCouponsError] = useState(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCoupons, setTotalCoupons] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const ITEMS_PER_PAGE = 20;

  // Load coupons on mount and when page/status changes
  useEffect(() => {
    if (!isAuthenticated) return;
    loadCoupons();
  }, [isAuthenticated, currentPage, selectedStatus]);

  async function loadCoupons() {
    try {
      setIsLoadingCoupons(true);
      setCouponsError(null);
      const result = await listMemberCoupons({
        limit: ITEMS_PER_PAGE,
        offset: currentPage * ITEMS_PER_PAGE,
        status: selectedStatus,
      });
      setCoupons(result.coupons);
      setTotalCoupons(result.total);
    } catch (error) {
      setCouponsError(error instanceof Error ? error.message : "Failed to load coupons");
      console.error("Error loading coupons:", error);
    } finally {
      setIsLoadingCoupons(false);
    }
  }

  async function handleGenerateCoupons(e) {
    e.preventDefault();
    setGenerateError(null);
    setGenerateSuccess(null);

    if (!memberEmails.trim()) {
      setGenerateError("Please enter at least one email address");
      return;
    }

    try {
      setIsGenerating(true);
      const emails = memberEmails
        .split("\n")
        .map((e) => e.trim())
        .filter((e) => e.length > 0);

      if (emails.length === 0) {
        setGenerateError("No valid email addresses found");
        return;
      }

      const result = await generateCouponsForMembers({
        memberEmails: emails,
        amountInr: parseInt(amountInr),
        expiryDays: parseInt(expiryDays),
        reason,
      });

      setGenerateSuccess(`Generated ${result.created || emails.length} coupon(s) successfully`);
      setMemberEmails("");
      setAmountInr(100);
      setExpiryDays(30);
      setReason("admin_generated");
      setCurrentPage(0);
      
      // Reload list
      setTimeout(() => loadCoupons(), 500);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : "Failed to generate coupons");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSearchCoupons(e) {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      loadCoupons();
      return;
    }

    try {
      setIsSearching(true);
      const results = await searchCoupons({ query: searchQuery });
      setCoupons(results);
      setTotalCoupons(results.length);
    } catch (error) {
      setCouponsError(error instanceof Error ? error.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  }

  async function handleDisableCoupon(couponCode) {
    if (!confirm(`Disable coupon ${couponCode}?`)) return;

    try {
      await disableCoupon({ couponCode });
      loadCoupons();
    } catch (error) {
      setCouponsError(error instanceof Error ? error.message : "Failed to disable coupon");
    }
  }

  function handleSignOut() {
    navigate("/admin");
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-black/80 text-white flex items-center justify-center">
        <div>Checking access...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <div className="min-h-screen bg-black/80 text-white flex items-center justify-center">Unauthorized</div>;
  }

  return (
    <div className="min-h-screen bg-black/80 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <AdminSidebar onSignOut={handleSignOut} authLoading={authLoading} />

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Generate Coupons Section */}
            <div className="rounded-2xl border border-neutral-700 bg-black/50 p-6">
              <h1 className="text-2xl font-bold mb-6">Generate Coupon Codes</h1>

              {generateSuccess && (
                <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded text-green-200 text-sm">
                  ✓ {generateSuccess}
                </div>
              )}

              {generateError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-200 text-sm">
                  ✗ {generateError}
                </div>
              )}

              <form onSubmit={handleGenerateCoupons} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Member Email Addresses (one per line)
                  </label>
                  <textarea
                    value={memberEmails}
                    onChange={(e) => setMemberEmails(e.target.value)}
                    placeholder="user1@example.com&#10;user2@example.com"
                    rows="5"
                    className="w-full rounded-lg bg-neutral-900 border border-neutral-700 text-white px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Amount (₹)</label>
                    <input
                      type="number"
                      value={amountInr}
                      onChange={(e) => setAmountInr(e.target.value)}
                      min="1"
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 text-white px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Expiry (days)</label>
                    <input
                      type="number"
                      value={expiryDays}
                      onChange={(e) => setExpiryDays(e.target.value)}
                      min="1"
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 text-white px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Reason</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-lg bg-neutral-900 border border-neutral-700 text-white px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                    >
                      <option value="admin_generated">Admin Generated</option>
                      <option value="promotional">Promotional</option>
                      <option value="refund">Refund</option>
                      <option value="loyalty">Loyalty</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full bg-[#D4AF37] text-black font-semibold py-2 rounded-lg hover:bg-[#E5C158] disabled:opacity-60 transition"
                >
                  {isGenerating ? "Generating..." : "Generate Coupons"}
                </button>
              </form>
            </div>

            {/* Coupons List Section */}
            <div className="rounded-2xl border border-neutral-700 bg-black/50 p-6">
              <h2 className="text-xl font-bold mb-6">Member Coupons</h2>

              {couponsError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-red-200 text-sm">
                  ✗ {couponsError}
                </div>
              )}

              {/* Search */}
              <form onSubmit={handleSearchCoupons} className="mb-6 flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by coupon code..."
                  className="flex-1 rounded-lg bg-neutral-900 border border-neutral-700 text-white px-3 py-2 focus:outline-none focus:border-[#D4AF37]"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2 bg-neutral-700 rounded-lg hover:bg-neutral-600 disabled:opacity-60 transition"
                >
                  {isSearching ? "..." : "Search"}
                </button>
              </form>

              {/* Status Filter */}
              <div className="mb-6 flex gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setSelectedStatus(null);
                    setCurrentPage(0);
                  }}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    selectedStatus === null
                      ? "bg-[#D4AF37] text-black"
                      : "border border-neutral-700 text-white hover:border-[#D4AF37]"
                  }`}
                >
                  All
                </button>
                {["active", "consumed", "expired", "revoked"].map((status) => (
                  <button
                    key={status}
                    onClick={() => {
                      setSelectedStatus(status);
                      setCurrentPage(0);
                    }}
                    className={`px-3 py-1 rounded-full text-sm transition capitalize ${
                      selectedStatus === status
                        ? "bg-[#D4AF37] text-black"
                        : "border border-neutral-700 text-white hover:border-[#D4AF37]"
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              {/* Table */}
              {isLoadingCoupons ? (
                <div className="text-center py-8 text-gray-400">Loading coupons...</div>
              ) : coupons.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No coupons found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-neutral-700">
                      <tr>
                        <th className="text-left py-3 px-2">Code</th>
                        <th className="text-left py-3 px-2">Amount</th>
                        <th className="text-left py-3 px-2">Status</th>
                        <th className="text-left py-3 px-2">Reason</th>
                        <th className="text-left py-3 px-2">Expires</th>
                        <th className="text-left py-3 px-2">Issued</th>
                        <th className="text-left py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-700">
                      {coupons.map((coupon) => (
                        <tr key={coupon.id} className="hover:bg-neutral-900/50">
                          <td className="py-3 px-2 font-mono text-[#D4AF37]">{coupon.code}</td>
                          <td className="py-3 px-2">₹{coupon.amount_inr}</td>
                          <td className="py-3 px-2">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                coupon.status === "active"
                                  ? "bg-green-900/30 text-green-200"
                                  : coupon.status === "consumed"
                                  ? "bg-blue-900/30 text-blue-200"
                                  : coupon.status === "expired"
                                  ? "bg-yellow-900/30 text-yellow-200"
                                  : "bg-red-900/30 text-red-200"
                              }`}
                            >
                              {coupon.status}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-xs text-gray-400 capitalize">
                            {coupon.issued_reason?.replace("_", " ")}
                          </td>
                          <td className="py-3 px-2 text-xs">
                            {coupon.expires_at
                              ? new Date(coupon.expires_at).toLocaleDateString()
                              : "Never"}
                          </td>
                          <td className="py-3 px-2 text-xs">
                            {new Date(coupon.issued_at).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-2">
                            {coupon.status === "active" && (
                              <button
                                onClick={() => handleDisableCoupon(coupon.code)}
                                className="text-red-400 hover:text-red-300 text-xs font-medium"
                              >
                                Disable
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {totalCoupons > ITEMS_PER_PAGE && !searchQuery && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-400">
                    Showing {currentPage * ITEMS_PER_PAGE + 1} -{" "}
                    {Math.min((currentPage + 1) * ITEMS_PER_PAGE, totalCoupons)} of{" "}
                    {totalCoupons}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                      disabled={currentPage === 0}
                      className="px-3 py-1 rounded border border-neutral-700 hover:border-[#D4AF37] disabled:opacity-50"
                    >
                      ← Prev
                    </button>
                    <button
                      onClick={() =>
                        setCurrentPage(
                          Math.min(
                            Math.ceil(totalCoupons / ITEMS_PER_PAGE) - 1,
                            currentPage + 1
                          )
                        )
                      }
                      disabled={
                        (currentPage + 1) * ITEMS_PER_PAGE >= totalCoupons
                      }
                      className="px-3 py-1 rounded border border-neutral-700 hover:border-[#D4AF37] disabled:opacity-50"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminCouponsPage;
