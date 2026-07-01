import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AffiliateApplicationPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    social_links: "",
    reason: ""
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setShowLoginPrompt(false);

    try {
      if (!form.password || form.password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }

      // Check current session
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserEmail = sessionData?.session?.user?.email;

      // If not logged in as the applying user, try to sign up or sign in
      if (!currentUserEmail || currentUserEmail.toLowerCase() !== form.email.toLowerCase()) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { name: form.name }
          }
        });

        // Supabase returns an empty user/session or identities=[] if user already exists
        const userAlreadyExists = signUpError?.message?.includes("already registered") || (signUpData?.user && signUpData?.user?.identities?.length === 0);

        if (userAlreadyExists) {
          setShowLoginPrompt(true);
          throw new Error("An account with this email already exists. Please log in first or apply from your account.");
        } else if (signUpError) {
          throw new Error(signUpError.message || "Failed to create account");
        }
      }

      // Submit application to Edge Function
      const { data, error: functionError } = await supabase.functions.invoke("admin-affiliate-applications/submit", {
        body: form
      });

      if (functionError) {
        throw new Error(functionError.message || "Failed to submit application");
      }

      if (data?.error) {
        throw new Error(data.error || "Failed to submit application");
      }

      setSuccess(true);
      setForm({ name: "", email: "", phone: "", password: "", social_links: "", reason: "" });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <div className="bg-[#D4AF37]/10 border border-[#D4AF37]/30 rounded-2xl p-10 backdrop-blur-sm shadow-xl shadow-[#D4AF37]/5">
          <div className="w-20 h-20 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-serif text-[#D4AF37] mb-4">Application Submitted!</h1>
          <p className="text-lg text-white/80 mb-4">
            Thank you for applying to the Advaya Affiliate Program. We have received your details and our team will review your application shortly.
          </p>
          <div className="bg-[#D4AF37]/20 border border-[#D4AF37]/50 rounded-xl p-4 mb-8">
            <p className="text-[#D4AF37] font-medium">Please check your email to confirm your account.</p>
            <p className="text-sm text-white/60 mt-1">If you don't see it, be sure to check your spam folder.</p>
          </div>
          <Link to="/" className="inline-block bg-white text-black font-semibold px-8 py-3 rounded-full hover:bg-neutral-200 transition shadow-[0_0_20px_rgba(255,255,255,0.2)]">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif tracking-tight text-[#D4AF37] mb-6">
          Become an Affiliate
        </h1>
        <p className="text-lg text-white/80 leading-relaxed max-w-2xl mx-auto">
          Join the Advaya family and earn commissions by sharing our premium aesthetic living products with your audience. Fill out the form below to apply.
        </p>
        <p className="mt-4 text-sm text-white/60">
          Already an affiliate? <Link to="/affiliate/dashboard" className="text-[#D4AF37] hover:underline">Log in to your Dashboard</Link>
        </p>
      </div>

      <div className="bg-black/40 border border-neutral-800 rounded-2xl p-8 sm:p-12 backdrop-blur-sm shadow-2xl">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-red-900/30 border border-red-800/50 rounded-xl text-red-200 text-sm">
              {error}
              {showLoginPrompt && (
                <div className="mt-3">
                  <Link to="/membership?mode=sign-in" className="text-[#D4AF37] hover:underline font-medium">Click here to log in</Link>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium text-white/80">
                Full Name <span className="text-[#D4AF37]">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                disabled={loading}
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-black/60 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37] transition"
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-white/80">
                Email Address <span className="text-[#D4AF37]">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                disabled={loading}
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
                className="w-full bg-black/60 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37] transition"
                placeholder="jane@example.com"
              />
            </div>
            
            <div className="space-y-2 sm:col-span-2">
              <label htmlFor="phone" className="block text-sm font-medium text-white/80">
                Phone Number <span className="text-[#D4AF37]">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                required
                disabled={loading}
                value={form.phone}
                onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full bg-black/60 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37] transition"
                placeholder="+1 234 567 8900"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-white/80">
              Account Password <span className="text-[#D4AF37]">*</span>
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              disabled={loading}
              value={form.password}
              onChange={e => setForm({...form, password: e.target.value})}
              className="w-full bg-black/60 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37] transition"
              placeholder="Minimum 6 characters"
            />
            <p className="text-xs text-white/40">This will be used to log into your Affiliate Dashboard.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="socials" className="block text-sm font-medium text-white/80">
              Social Media Links or Website <span className="text-[#D4AF37]">*</span>
            </label>
            <input
              id="socials"
              type="text"
              required
              disabled={loading}
              value={form.social_links}
              onChange={e => setForm({...form, social_links: e.target.value})}
              className="w-full bg-black/60 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37] transition"
              placeholder="Instagram, YouTube, or your Blog URL"
            />
            <p className="text-xs text-white/40">Where will you be promoting Advaya products?</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="reason" className="block text-sm font-medium text-white/80">
              Why do you want to join? <span className="text-white/40 font-normal">(Optional)</span>
            </label>
            <textarea
              id="reason"
              rows={4}
              disabled={loading}
              value={form.reason}
              onChange={e => setForm({...form, reason: e.target.value})}
              className="w-full bg-black/60 border border-neutral-700 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#D4AF37] transition resize-y"
              placeholder="Tell us a little about your audience and why our products are a good fit."
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-8 py-3 bg-[#D4AF37] hover:bg-[#c4a130] text-black font-semibold rounded-full transition disabled:opacity-50 shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:shadow-[0_0_25px_rgba(212,175,55,0.5)]"
            >
              {loading ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
