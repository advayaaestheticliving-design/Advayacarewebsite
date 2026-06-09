import React from "react";

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-10 sm:py-14 space-y-8 text-white">
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">PRIVACY POLICY</h1>

      <section className="space-y-3 text-sm sm:text-base leading-relaxed">
        <h2 className="text-xl font-semibold">What We Collect</h2>
        <p>
          For membership personalization, we collect skin profile data such as skin type, concerns,
          allergies, ingredient preferences, lifestyle factors, and routine details.
        </p>
        <p>
          For business enquiries and the Advaya trade programme, we may collect business identity,
          location, website and social links, contact names and roles, business email or phone
          details, application answers, consent records, sales activity, quotes, orders, and
          communication preferences.
        </p>
      </section>

      <section className="space-y-3 text-sm sm:text-base leading-relaxed">
        <h2 className="text-xl font-semibold">How We Use Data</h2>
        <p>
          We use your profile data to generate skincare recommendations and improve your shopping
          experience. AI-assisted recommendations are informational and are not medical advice.
        </p>
        <p>
          We use business prospect data to assess trade fit, respond to applications, prepare
          fact-constrained outreach, manage samples and quotes, fulfil orders, prevent duplicate
          contact, and schedule relevant follow-ups or reorder reminders. First-touch outreach is
          reviewed by a person before it is sent.
        </p>
      </section>

      <section className="space-y-3 text-sm sm:text-base leading-relaxed">
        <h2 className="text-xl font-semibold">Business Prospect Sources and Outreach</h2>
        <p>
          Trade prospects may come from direct applications, referrals, CSV lists supplied by our
          team, or manually verified public business sources. We do not use this programme to
          permanently store restricted Google Places content. WhatsApp contact is limited to
          reviewed one-to-one messages using a business number that was supplied to us, consented
          to, or publicly advertised for business contact.
        </p>
        <p>
          You can opt out in any reply. We stop scheduled follow-ups after a reply, opt-out, bounce,
          conversion, or manual suppression. We may keep a one-way hash of an email address or
          phone number after deletion solely to prevent accidental future outreach, unless consent
          is restored.
        </p>
      </section>

      <section className="space-y-3 text-sm sm:text-base leading-relaxed">
        <h2 className="text-xl font-semibold">Storage and Access</h2>
        <p>
          Your membership data is stored in Supabase. If you sign in, your profile is linked to your
          account; otherwise it can be stored against a guest session on your device.
        </p>
        <p>
          Trade and prospect records are limited to authorised Advaya administrators. Service
          providers such as Supabase, Resend, Razorpay, and delivery providers process only the
          information needed for hosting, communications, payment, and fulfilment.
        </p>
      </section>

      <section className="space-y-3 text-sm sm:text-base leading-relaxed">
        <h2 className="text-xl font-semibold">Your Choices</h2>
        <p>
          You can request access, correction, deletion, or withdrawal of outreach consent by
          emailing support@advayacare.com. You may also
          withdraw consent for AI-assisted recommendations at any time by updating your profile.
        </p>
      </section>
    </div>
  );
}

export default PrivacyPage;
