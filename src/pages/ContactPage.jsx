import React, { useState } from "react";
import { submitGeneralInquiry } from "../lib/b2bApi";

function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "", companyWebsite: "" });
  const [startedAt] = useState(() => Date.now());
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus("");
    setError("");
    try {
      const result = await submitGeneralInquiry({ ...form, startedAt, consentToContact: true });
      setStatus(result.message || "Thanks. We received your message.");
      setForm({ name: "", email: "", message: "", companyWebsite: "" });
    } catch (submitError) {
      setError(submitError?.message || "Could not send your message.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 grid gap-10 lg:grid-cols-[minmax(0,_1.2fr)_minmax(0,_0.8fr)]">
      <section>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#b58b2f] mb-4">
          Contact Us
        </h1>
        <p className="text-sm text-white mb-6 max-w-prose">
          We&apos;d love to hear from you. Share a question, a ritual you
          love, or feedback on your Advayacare experience.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <input
            className="hidden"
            name="companyWebsite"
            value={form.companyWebsite}
            onChange={handleChange}
            tabIndex="-1"
            autoComplete="off"
          />
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-white" htmlFor="message">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              rows={4}
              value={form.message}
              onChange={handleChange}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 focus:border-[#b58b2f] focus:outline-none focus:ring-0 resize-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-full px-5 py-2 text-sm font-semibold bg-[#b58b2f] text-black hover:bg-[#d4aa3b] transition disabled:opacity-60"
          >
            {submitting ? "Sending..." : "Send Message"}
          </button>
          {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <p className="text-xs text-white/50">
            By submitting, you consent to Advaya Care using these details to respond to your inquiry.
          </p>
        </form>
      </section>

      <aside className="rounded-3xl p-6 shadow-sm text-sm bg-[#b58b2f] text-black flex flex-col">
        <h2 className="text-base font-semibold tracking-wide uppercase mb-3">
          Customer Service
        </h2>
        <p className="text-sm leading-loose mb-4">
          Whatsapp: +91 8050403745
          <br />
          Email: support@advayacare.com
          <br />
          Whitefield, Bangalore
          <br />
          INDIA - 560066
        </p>
        <a
          href="https://instagram.com/advaya_care"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#b58b2f] bg-black px-4 py-2 text-sm font-semibold text-[#b58b2f] hover:bg-[#111] transition mt-auto"
          aria-label="Follow us on Instagram"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            className=""
          >
            <path d="M7 2C4.243 2 2 4.243 2 7v10c0 2.757 2.243 5 5 5h10c2.757 0 5-2.243 5-5V7c0-2.757-2.243-5-5-5H7zm0 2h10c1.654 0 3 1.346 3 3v10c0 1.654-1.346 3-3 3H7c-1.654 0-3-1.346-3-3V7c0-1.654 1.346-3 3-3zm10.5 1a1 1 0 100 2 1 1 0 000-2zM12 7a5 5 0 100 10 5 5 0 000-10zm0 2a3 3 0 110 6 3 3 0 010-6z" />
          </svg>
          Follow us on Instagram
        </a>
      </aside>
    </div>
  );
}

export default ContactPage;
