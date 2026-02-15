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
      </section>

      <section className="space-y-3 text-sm sm:text-base leading-relaxed">
        <h2 className="text-xl font-semibold">How We Use Data</h2>
        <p>
          We use your profile data to generate skincare recommendations and improve your shopping
          experience. AI-assisted recommendations are informational and are not medical advice.
        </p>
      </section>

      <section className="space-y-3 text-sm sm:text-base leading-relaxed">
        <h2 className="text-xl font-semibold">Storage and Access</h2>
        <p>
          Your membership data is stored in Supabase. If you sign in, your profile is linked to your
          account; otherwise it can be stored against a guest session on your device.
        </p>
      </section>

      <section className="space-y-3 text-sm sm:text-base leading-relaxed">
        <h2 className="text-xl font-semibold">Your Choices</h2>
        <p>
          You can request data updates or deletion by emailing support@advayacare.com. You may also
          withdraw consent for AI-assisted recommendations at any time by updating your profile.
        </p>
      </section>
    </div>
  );
}

export default PrivacyPage;
