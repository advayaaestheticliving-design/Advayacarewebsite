import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsHeaders,
  getServiceClient,
  jsonResponse,
  normalizeEmail,
  sha256,
} from "../_shared/b2b.ts";

function base64Bytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

async function verifyWebhook(req: Request, payload: string) {
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";
  const id = req.headers.get("svix-id") || "";
  const timestamp = req.headers.get("svix-timestamp") || "";
  const signatures = req.headers.get("svix-signature") || "";
  if (!secret || !id || !timestamp || !signatures) return false;

  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds) || Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;
  const encodedSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    base64Bytes(encodedSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${payload}`),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return signatures.split(" ").some((part) => {
    const [, supplied = ""] = part.split(",");
    return constantTimeEqual(expected, supplied);
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const rawBody = await req.text();
  if (!(await verifyWebhook(req, rawBody))) return jsonResponse({ error: "Invalid webhook signature" }, 400);

  try {
    const event = JSON.parse(rawBody);
    const type = String(event?.type || "");
    const emailId = String(event?.data?.email_id || "");
    if (!emailId || !type.startsWith("email.")) return jsonResponse({ received: true });

    const supabase = getServiceClient();
    const { data: outreach } = await supabase.from("b2b_outreach")
      .select("*, b2b_contacts(email)")
      .eq("provider_message_id", emailId)
      .maybeSingle();
    if (!outreach) return jsonResponse({ received: true });

    const statusMap: Record<string, string> = {
      "email.opened": "opened",
      "email.bounced": "bounced",
      "email.failed": "failed",
      "email.suppressed": "suppressed",
      "email.complained": "suppressed",
    };
    const status = statusMap[type] || outreach.status;
    await supabase.from("b2b_outreach").update({
      status,
      error_message: event?.data?.bounce?.message || (status === "failed" ? "Provider reported delivery failure" : ""),
      metadata: {
        ...(outreach.metadata || {}),
        last_provider_event: type,
        last_provider_event_at: event?.created_at || new Date().toISOString(),
      },
    }).eq("id", outreach.id);

    if (["email.bounced", "email.failed", "email.suppressed", "email.complained"].includes(type)) {
      await supabase.from("b2b_outreach").update({ status: "cancelled" })
        .eq("account_id", outreach.account_id).in("status", ["draft", "approved"]);
      await supabase.from("b2b_accounts").update({
        stage: type === "email.failed" ? "nurture" : "suppressed",
        next_action_at: null,
        opt_out_at: ["email.suppressed", "email.complained"].includes(type) ? new Date().toISOString() : null,
      }).eq("id", outreach.account_id);

      const email = normalizeEmail(outreach.b2b_contacts?.email || event?.data?.to?.[0]);
      if (email) {
        await supabase.from("b2b_suppressions").upsert({
          identifier_type: "email",
          identifier_hash: await sha256(email),
          reason: type.replace("email.", ""),
          source: "resend_webhook",
          restored_at: null,
        }, { onConflict: "identifier_type,identifier_hash" });
      }
    }

    return jsonResponse({ received: true });
  } catch (error) {
    console.error("b2b-email-events failed", error);
    return jsonResponse({ error: "Webhook processing failed" }, 500);
  }
});
