import React, { useState, useEffect } from "react";
import { Navigate, Link } from "react-router-dom";
import { useMemberSession } from "../context/MemberSessionContext";
import { getAffiliateDashboardMetrics } from "../lib/affiliateApi";
import { supabase } from "../lib/supabaseClient";

function formatCurrency(v) {
  return Number(v || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export default function AffiliateDashboardPage() {
  const { user, isAuthenticated, authReady } = useMemberSession();
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notApproved, setNotApproved] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    if (authReady && isAuthenticated) {
      loadMetrics();
    } else if (authReady && !isAuthenticated) {
      setLoading(false);
    }
  }, [authReady, isAuthenticated]);

  async function loadMetrics() {
    try {
      const data = await getAffiliateDashboardMetrics();
      if (data.metrics === null) {
        setNotApproved(true);
      } else {
        setMetrics(data.metrics || []);
      }
    } catch (err) {
      setError(err.message || "Failed to load affiliate metrics");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      // context will update automatically
    } catch (err) {
      setLoginError(err.message || "Failed to sign in.");
    } finally {
      setLoginLoading(false);
    }
  }

  if (!authReady || loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <p className="text-white/50 text-sm">Loading dashboard...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto pt-10 pb-20">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-serif text-[#D4AF37] mb-3">Affiliate Login</h1>
          <p className="text-white/70">Enter the email you applied with to access your dashboard.</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-4">
            {loginError && (
              <div className="p-3 bg-red-900/30 border border-red-800/50 rounded-xl text-red-200 text-xs">
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full rounded-xl border border-neutral-700 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 mb-1">Password</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-neutral-700 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-[#D4AF37] focus:outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={loginLoading}
              className="w-full bg-[#D4AF37] hover:bg-[#c4a130] text-black font-semibold rounded-xl py-3 transition disabled:opacity-50 mt-2"
            >
              {loginLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (notApproved) {
    return (
      <div className="max-w-2xl mx-auto py-20 text-center">
        <div className="w-16 h-16 bg-neutral-800 text-white/50 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H9m3-3V9m0-2a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
        </div>
        <h1 className="text-2xl font-serif text-white mb-3">Application Not Found</h1>
        <p className="text-white/60 mb-6">We couldn't find an approved affiliate application linked to {user?.email}. If you recently applied, please wait for our team to review your application.</p>
        <Link to="/affiliate" className="text-[#D4AF37] hover:underline">Apply for the Affiliate Program</Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <div className="mb-10 text-center">
        <h1 className="text-3xl md:text-4xl font-serif text-[#D4AF37] mb-2">Welcome, {metrics[0]?.affiliate_name || 'Affiliate'}</h1>
        <p className="text-white/60">Track your referral metrics and earnings.</p>
      </div>

      {error && (
        <div className="p-4 bg-red-900/30 border border-red-800/50 rounded-xl text-red-200 mb-8">
          {error}
        </div>
      )}

      {metrics.length === 0 ? (
        <div className="text-center py-10 bg-neutral-900/40 border border-neutral-800 rounded-2xl text-white/50">
          You don't have any active coupon codes yet. Please contact support.
        </div>
      ) : (
        <div className="space-y-12">
          {metrics.map(metric => (
            <div key={metric.id} className="space-y-6">
              <div className="bg-neutral-900/80 border border-neutral-700/50 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <svg className="w-40 h-40" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                  </svg>
                </div>
                
                <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-neutral-700/50 pb-6">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wider text-[#D4AF37] mb-2">Your Coupon Code</p>
                    <div className="flex items-center gap-4">
                      <span className="text-3xl font-mono text-white tracking-widest bg-black/50 px-4 py-2 rounded-xl border border-neutral-700">{metric.coupon_code}</span>
                      {!metric.is_active && <span className="text-xs bg-red-900/50 text-red-300 px-2 py-1 rounded">Inactive</span>}
                    </div>
                  </div>
                  <div className="text-left md:text-right">
                    <p className="text-sm text-white/50 uppercase tracking-wide mb-1">Commission Rate</p>
                    <p className="text-2xl text-white font-serif">
                      {metric.commission_type === 'percentage' ? `${metric.commission_rate}%` : formatCurrency(metric.commission_rate)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                  <div className="bg-black/40 rounded-2xl p-6 border border-neutral-800">
                    <p className="text-sm text-white/50 mb-1">Total Uses</p>
                    <p className="text-3xl text-white font-medium">{metric.metrics.uses}</p>
                  </div>
                  <div className="bg-black/40 rounded-2xl p-6 border border-neutral-800">
                    <p className="text-sm text-white/50 mb-1">Sales Generated</p>
                    <p className="text-3xl text-white font-medium">{formatCurrency(metric.metrics.net_revenue)}</p>
                  </div>
                  <div className="bg-[#D4AF37]/10 rounded-2xl p-6 border border-[#D4AF37]/30">
                    <p className="text-sm text-[#D4AF37] mb-1">Total Earnings</p>
                    <p className="text-3xl text-[#D4AF37] font-semibold">{formatCurrency(metric.metrics.commission)}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
