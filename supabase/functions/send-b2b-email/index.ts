import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  getServiceClient,
  jsonResponse,
  normalizeEmail,
  requireAdmin,
  sha256,
} from "../_shared/b2b.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  const { user, error: authError } = await requireAdmin(req);
  if (authError || !user) return jsonResponse({ error: authError || "Unauthorized" }, 401);

  try {
    const { outreachId } = await req.json();
    const supabase = getServiceClient();
    const { data: outreach, error } = await supabase
      .from("b2b_outreach")
      .select("*, b2b_accounts(*), b2b_contacts(*)")
      .eq("id", outreachId)
      .single();
    if (error || !outreach) return jsonResponse({ error: "Outreach draft not found" }, 404);
    if (outreach.channel !== "email" || outreach.status !== "approved") {
      return jsonResponse({ error: "Only approved email drafts can be sent." }, 409);
    }

    const account = outreach.b2b_accounts;
    const contact = outreach.b2b_contacts;
    const email = normalizeEmail(contact?.email);
    if (!email || contact?.opted_out_at || [
      "replied", "discovery_booked", "sample_paid", "sample_sent",
      "proposal_sent", "won", "lost", "nurture", "suppressed",
    ].includes(account?.stage)) {
      return jsonResponse({ error: "This contact is not eligible for outreach." }, 409);
    }

    const { data: suppression } = await supabase
      .from("b2b_suppressions")
      .select("id")
      .eq("identifier_type", "email")
      .eq("identifier_hash", await sha256(email))
      .is("restored_at", null)
      .maybeSingle();
    if (suppression) return jsonResponse({ error: "This email address is suppressed." }, 409);

    const resendKey = Deno.env.get("RESEND_API_KEY") || "";
    if (!resendKey) return jsonResponse({ error: "RESEND_API_KEY is not configured." }, 500);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: Deno.env.get("B2B_FROM_EMAIL") || "Advaya Care Trade <trade@advayacare.com>",
        to: [email],
        subject: outreach.subject,
        text: outreach.body,
        reply_to: Deno.env.get("B2B_REPLY_TO_EMAIL") || "support@advayacare.com",
      }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      await supabase.from("b2b_outreach").update({
        status: "failed",
        error_message: result?.message || `Resend failed (${response.status})`,
      }).eq("id", outreach.id);
      return jsonResponse({ error: result?.message || "Email delivery failed." }, 502);
    }

    const sentAt = new Date().toISOString();
    await supabase.from("b2b_outreach").update({
      status: "sent",
      sent_at: sentAt,
      sent_by_email: user.email || "",
      provider_message_id: result?.id || "",
      error_message: "",
    }).eq("id", outreach.id);
    await supabase.from("b2b_accounts").update({
      stage: "contacted",
      last_contacted_at: sentAt,
      next_action_at: new Date(Date.now() + 3 * 86400000).toISOString(),
    }).eq("id", outreach.account_id);
    await supabase.from("b2b_activities").insert({
      account_id: outreach.account_id,
      contact_id: outreach.contact_id,
      activity_type: "email",
      title: `Email sent: ${outreach.subject}`,
      details: outreach.body,
      created_by_email: user.email || "",
      metadata: { outreach_id: outreach.id, provider_message_id: result?.id || "" },
    });
    return jsonResponse({ success: true, providerMessageId: result?.id || "" });
  } catch (error) {
    console.error("send-b2b-email failed", error);
    return jsonResponse({ error: "Could not send the approved email." }, 500);
  }
});
