import React from "react";
import { Link } from "react-router-dom";
import { submitTradeApplication } from "../lib/b2bApi";

const initialForm = {
  businessName: "",
  businessType: "salon_spa",
  contactName: "",
  jobTitle: "",
  email: "",
  phone: "",
  whatsappPhone: "",
  websiteUrl: "",
  instagramHandle: "",
  locality: "",
  city: "Bangalore",
  state: "Karnataka",
  pinCode: "",
  locationCount: 1,
  premiumPositioning: false,
  retailsProducts: false,
  socialActive: false,
  goals: "",
  referralSource: "",
  emailConsent: true,
  whatsappConsent: false,
  privacyAccepted: false,
  companyWebsite: "",
};

const fieldClass = "w-full rounded-xl border border-white/20 bg-white px-4 py-3 text-sm text-black outline-none transition focus:border-[#D4AF37]";

function TradePage() {
  const [form, setForm] = React.useState(initialForm);
  const [startedAt] = React.useState(() => Date.now());
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  function update(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const result = await submitTradeApplication({ ...form, startedAt });
      setSuccess(result.duplicate
        ? "We already have this contact on file. The trade team will review the existing application."
        : "Application received. We review each partner manually and will contact suitable businesses.");
      setForm(initialForm);
    } catch (submitError) {
      setError(submitError?.message || "Could not submit the application.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-16 text-white">
      <section className="grid gap-10 overflow-hidden rounded-3xl border border-[#D4AF37]/40 bg-black/70 p-7 sm:p-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D4AF37]">Advaya Care Trade</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            Considered skincare retail for salons and spas.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-white/75">
            A Bangalore-led partner programme with prepaid trial kits, selected wholesale products,
            guided opening orders, and delivery across India.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="#apply" className="rounded-full bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-black hover:bg-[#e3c45e]">
              Apply for trade
            </a>
            <a href="#terms" className="rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:border-[#D4AF37]">
              View commercial terms
            </a>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {[
            ["Up to 35%", "target resale margin on eligible products"],
            ["₹12,000", "minimum prepaid opening order"],
            ["3 products", "paid sample kit, selected by Advaya"],
            ["30 days", "sample merchandise credit window"],
          ].map(([value, label]) => (
            <div key={value} className="rounded-2xl border border-white/15 bg-white/5 p-5">
              <p className="text-2xl font-semibold text-[#D4AF37]">{value}</p>
              <p className="mt-1 text-sm text-white/70">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {[
          ["Curated assortment", "Only products that pass Advaya and partner margin checks are activated for trade."],
          ["Human support", "Quotes, opening selections, and first outreach are reviewed by a person, not sent in bulk."],
          ["Practical delivery", "Free Bangalore delivery for qualifying opening orders; courier charges are quoted elsewhere."],
        ].map(([title, copy]) => (
          <article key={title} className="rounded-2xl border border-white/15 bg-black/55 p-6">
            <h2 className="text-lg font-semibold text-[#D4AF37]">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{copy}</p>
          </article>
        ))}
      </section>

      <section id="terms" className="rounded-3xl bg-[#D4AF37] p-7 text-black sm:p-10">
        <h2 className="text-3xl font-semibold">Trade terms at a glance</h2>
        <div className="mt-7 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="font-semibold">Opening order</h3>
            <p className="mt-2 text-sm leading-relaxed">At least ₹12,000 and 12 mixed units, with a minimum of two units per selected SKU. Payment is 100% prepaid.</p>
          </div>
          <div>
            <h3 className="font-semibold">Reorders</h3>
            <p className="mt-2 text-sm leading-relaxed">At least ₹7,500 and six units. Availability and current trade pricing are confirmed in each quote.</p>
          </div>
          <div>
            <h3 className="font-semibold">Sample kit</h3>
            <p className="mt-2 text-sm leading-relaxed">Three Advaya-selected products at 70% of retail, subject to the same sustainable margin floor.</p>
          </div>
          <div>
            <h3 className="font-semibold">Sample credit</h3>
            <p className="mt-2 text-sm leading-relaxed">The paid merchandise value is credited against a qualifying first order placed within 30 days.</p>
          </div>
        </div>
      </section>

      <section id="apply" className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#D4AF37]">Partner application</p>
          <h2 className="mt-3 text-3xl font-semibold">Tell us about your business.</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/70">
            We currently prioritize Bangalore salons, spas, aesthetic studios, and wellness businesses.
            Karnataka and India-wide delivery is available as the programme expands.
          </p>
          <p className="mt-4 text-xs leading-relaxed text-white/50">
            Exact wholesale prices are shared only in approved quotes. Product descriptions supplied
            for resale must not be changed into medical or guaranteed-result claims.
          </p>
        </div>
        <form onSubmit={submit} className="grid gap-4 rounded-3xl border border-white/15 bg-black/60 p-6 sm:grid-cols-2 sm:p-8">
          <input className="hidden" name="companyWebsite" value={form.companyWebsite} onChange={update} tabIndex="-1" autoComplete="off" />
          <label className="text-xs text-white/80">Business name
            <input className={`${fieldClass} mt-2`} name="businessName" value={form.businessName} onChange={update} required />
          </label>
          <label className="text-xs text-white/80">Business type
            <select className={`${fieldClass} mt-2`} name="businessType" value={form.businessType} onChange={update}>
              <option value="salon_spa">Salon and spa</option><option value="salon">Salon</option>
              <option value="spa">Spa</option><option value="aesthetic_studio">Aesthetic studio</option>
              <option value="wellness">Wellness business</option><option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs text-white/80">Contact name
            <input className={`${fieldClass} mt-2`} name="contactName" value={form.contactName} onChange={update} required />
          </label>
          <label className="text-xs text-white/80">Role
            <input className={`${fieldClass} mt-2`} name="jobTitle" value={form.jobTitle} onChange={update} placeholder="Owner, manager, buyer" />
          </label>
          <label className="text-xs text-white/80">Business email
            <input className={`${fieldClass} mt-2`} type="email" name="email" value={form.email} onChange={update} required />
          </label>
          <label className="text-xs text-white/80">Phone
            <input className={`${fieldClass} mt-2`} name="phone" value={form.phone} onChange={update} required />
          </label>
          <label className="text-xs text-white/80">Business WhatsApp
            <input className={`${fieldClass} mt-2`} name="whatsappPhone" value={form.whatsappPhone} onChange={update} />
          </label>
          <label className="text-xs text-white/80">Number of locations
            <input className={`${fieldClass} mt-2`} type="number" min="1" name="locationCount" value={form.locationCount} onChange={update} />
          </label>
          <label className="text-xs text-white/80">Locality
            <input className={`${fieldClass} mt-2`} name="locality" value={form.locality} onChange={update} placeholder="Whitefield, Indiranagar..." />
          </label>
          <label className="text-xs text-white/80">Pin code
            <input className={`${fieldClass} mt-2`} name="pinCode" value={form.pinCode} onChange={update} />
          </label>
          <label className="text-xs text-white/80">Website
            <input className={`${fieldClass} mt-2`} type="url" name="websiteUrl" value={form.websiteUrl} onChange={update} />
          </label>
          <label className="text-xs text-white/80">Instagram handle
            <input className={`${fieldClass} mt-2`} name="instagramHandle" value={form.instagramHandle} onChange={update} placeholder="@business" />
          </label>
          <label className="text-xs text-white/80 sm:col-span-2">What would make the partnership useful?
            <textarea className={`${fieldClass} mt-2 min-h-28 resize-y`} name="goals" value={form.goals} onChange={update} />
          </label>
          <div className="space-y-3 text-sm sm:col-span-2">
            {[
              ["premiumPositioning", "Our business has a premium positioning"],
              ["retailsProducts", "We currently retail products"],
              ["socialActive", "Our business is active on social media"],
              ["emailConsent", "Advaya may contact me by email about this application"],
              ["whatsappConsent", "Advaya may contact me one-to-one on WhatsApp about this application"],
            ].map(([name, label]) => (
              <label key={name} className="flex items-start gap-3">
                <input type="checkbox" name={name} checked={form[name]} onChange={update} className="mt-1 accent-[#D4AF37]" />
                <span className="text-white/75">{label}</span>
              </label>
            ))}
            <label className="flex items-start gap-3">
              <input type="checkbox" name="privacyAccepted" checked={form.privacyAccepted} onChange={update} required className="mt-1 accent-[#D4AF37]" />
              <span className="text-white/75">I have read the <Link className="underline text-[#D4AF37]" to="/privacy">Privacy Policy</Link> and consent to application processing.</span>
            </label>
          </div>
          {error ? <p className="text-sm text-red-300 sm:col-span-2">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300 sm:col-span-2">{success}</p> : null}
          <button disabled={submitting} className="rounded-full bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-black disabled:opacity-60 sm:col-span-2">
            {submitting ? "Submitting..." : "Submit trade application"}
          </button>
        </form>
      </section>

      <section className="space-y-5">
        <h2 className="text-3xl font-semibold">Trade FAQ</h2>
        {[
          ["Is approval automatic?", "No. Advaya reviews each application, product fit, location, and capacity before approving trade access."],
          ["Can I see wholesale pricing before approval?", "Exact pricing is private and appears only in an approved, expiring quote."],
          ["Can I sell online?", "Only where explicitly approved in your trade terms. Marketplace resale is not automatically permitted."],
          ["Are the products treatments?", "No. Trade materials describe cosmetic use and product experience, not medical treatment or guaranteed outcomes."],
        ].map(([question, answer]) => (
          <details key={question} className="rounded-2xl border border-white/15 bg-black/50 p-5">
            <summary className="cursor-pointer font-semibold text-[#D4AF37]">{question}</summary>
            <p className="mt-3 text-sm leading-relaxed text-white/70">{answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}

export default TradePage;
