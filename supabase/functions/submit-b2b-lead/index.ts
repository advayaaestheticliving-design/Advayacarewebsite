import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  getServiceClient,
  jsonResponse,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  sha256,
  toNumber,
} from "../_shared/b2b.ts";

const BUSINESS_TYPES = new Set(["salon", "spa", "salon_spa", "aesthetic_studio", "wellness", "other"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const kind = normalizeText(body?.kind || "trade", 20);
    const startedAt = toNumber(body?.startedAt, 0);
    if (normalizeText(body?.website_confirmation, 200) || (startedAt > 0 && Date.now() - startedAt < 2500)) {
      return jsonResponse({ success: true, message: "Thanks. We received your message." });
    }

    const ip = normalizeText(req.headers.get("x-forwarded-for")?.split(",")[0], 100);
    const fingerprintHash = await sha256(`${ip}|${normalizeText(req.headers.get("user-agent"), 300)}`);
    const supabase = getServiceClient();
    const { count } = await supabase
      .from("b2b_submission_attempts")
      .select("id", { count: "exact", head: true })
      .eq("fingerprint_hash", fingerprintHash)
      .gte("submitted_at", new Date(Date.now() - 3600000).toISOString());

    if ((count || 0) >= 5) return jsonResponse({ error: "Too many submissions. Please try again later." }, 429);
    await supabase.from("b2b_submission_attempts").insert({ fingerprint_hash: fingerprintHash });

    if (kind === "general") {
      const name = normalizeText(body?.name, 120);
      const email = normalizeEmail(body?.email);
      const message = normalizeText(body?.message, 4000);
      if (!name || !email.includes("@") || !message) {
        return jsonResponse({ error: "Name, valid email, and message are required." }, 400);
      }
      const { error } = await supabase.from("general_inquiries").insert({
        name,
        email,
        message,
        consent_to_contact: body?.consentToContact !== false,
        metadata: { fingerprint_hash: fingerprintHash },
      });
      if (error) return jsonResponse({ error: "Could not save the inquiry." }, 500);
      return jsonResponse({ success: true, message: "Thanks. We’ll get back to you shortly." }, 201);
    }

    const businessName = normalizeText(body?.businessName, 180);
    const contactName = normalizeText(body?.contactName, 140);
    const email = normalizeEmail(body?.email);
    const phone = normalizePhone(body?.phone);
    const whatsappPhone = normalizePhone(body?.whatsappPhone || body?.phone);
    const city = normalizeText(body?.city || "Bangalore", 100);
    const state = normalizeText(body?.state || "Karnataka", 100);
    const businessType = BUSINESS_TYPES.has(body?.businessType) ? body.businessType : "salon_spa";
    const emailConsent = Boolean(body?.emailConsent);
    const whatsappConsent = Boolean(body?.whatsappConsent);

    if (!businessName || !contactName || !email.includes("@") || !phone) {
      return jsonResponse({ error: "Business name, contact name, valid email, and phone are required." }, 400);
    }
    if (!body?.privacyAccepted || (!emailConsent && !whatsappConsent)) {
      return jsonResponse({ error: "Accept the privacy notice and choose at least one contact method." }, 400);
    }

    const identifierHashes = await Promise.all([sha256(email), sha256(phone), sha256(whatsappPhone)]);
    const { data: suppressed } = await supabase
      .from("b2b_suppressions")
      .select("id")
      .is("restored_at", null)
      .in("identifier_hash", identifierHashes);
    if ((suppressed || []).length) {
      return jsonResponse({ success: true, message: "Your communication preference has been recorded." });
    }

    const { data: existingContact } = await supabase
      .from("b2b_contacts")
      .select("id, account_id")
      .eq("email", email)
      .maybeSingle();
    if (existingContact?.account_id) {
      await supabase.from("b2b_activities").insert({
        account_id: existingContact.account_id,
        contact_id: existingContact.id,
        activity_type: "note",
        title: "Repeat trade application",
        details: normalizeText(body?.goals || "The prospect submitted the trade application again.", 2000),
        metadata: { source: "trade_application" },
      });
      return jsonResponse({ success: true, duplicate: true, message: "Your trade interest is already with our team." });
    }

    const { data: matchedAccount } = await supabase
      .from("b2b_accounts")
      .select("id, business_name")
      .ilike("business_name", businessName)
      .ilike("city", city)
      .maybeSingle();

    let account = matchedAccount;
    if (!account) {
      const { data, error } = await supabase.from("b2b_accounts").insert({
        business_name: businessName,
        business_type: businessType,
        source: "trade_application",
        website_url: normalizeText(body?.websiteUrl, 500),
        instagram_handle: normalizeText(body?.instagramHandle, 200),
        address: normalizeText(body?.address, 800),
        locality: normalizeText(body?.locality, 120),
        city,
        state,
        pin_code: normalizeText(body?.pinCode, 12),
        premium_positioning: Boolean(body?.premiumPositioning),
        retails_products: Boolean(body?.retailsProducts),
        social_active: Boolean(body?.socialActive),
        location_count: Math.min(100, Math.max(1, Math.floor(toNumber(body?.locationCount, 1)))),
        notes: normalizeText(body?.goals, 3000),
        next_action_at: new Date().toISOString(),
        metadata: { referral_source: normalizeText(body?.referralSource, 200) },
      }).select("id, business_name").single();
      if (error || !data) return jsonResponse({ error: "Could not save the trade application." }, 500);
      account = data;
    }

    const { data: contact, error: contactError } = await supabase.from("b2b_contacts").insert({
      account_id: account.id,
      full_name: contactName,
      job_title: normalizeText(body?.jobTitle, 120),
      email,
      phone,
      whatsapp_phone: whatsappPhone,
      is_primary: true,
      email_consent: emailConsent,
      whatsapp_consent: whatsappConsent,
      consent_source: "trade_application",
      consent_recorded_at: new Date().toISOString(),
      metadata: { privacy_accepted: true },
    }).select("id").single();
    if (contactError || !contact) return jsonResponse({ error: "Could not save contact details." }, 500);

    await supabase.from("b2b_activities").insert([
      {
        account_id: account.id,
        contact_id: contact.id,
        activity_type: "note",
        title: "Trade application received",
        details: normalizeText(body?.goals || "New inbound trade application.", 2000),
        metadata: { source: "trade_application" },
      },
      {
        account_id: account.id,
        contact_id: contact.id,
        activity_type: "task",
        title: "Review and qualify trade application",
        details: "Review fit, product retail activity, and preferred contact channel.",
        status: "open",
        due_at: new Date().toISOString(),
        metadata: { source: "trade_application" },
      },
    ]);

    return jsonResponse({
      success: true,
      message: "Application received. We’ll review it and respond within two business days.",
    }, 201);
  } catch (error) {
    console.error("submit-b2b-lead failed", error);
    return jsonResponse({ error: "Could not process the submission." }, 500);
  }
});
