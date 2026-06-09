import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  buildFallbackOutreach,
  corsHeaders,
  getServiceClient,
  jsonResponse,
  requireAdmin,
} from "../_shared/b2b.ts";

const DAY_MS = 86_400_000;
const STOP_STAGES = new Set(["replied", "discovery_booked", "sample_paid", "sample_sent", "proposal_sent", "won", "lost", "nurture", "suppressed"]);
const FOLLOWUP_DAYS = [0, 3, 7, 14];

function isCronAuthorized(req: Request) {
  const expected = Deno.env.get("B2B_CRON_SECRET") || "";
  const supplied = req.headers.get("x-cron-secret") || "";
  return Boolean(expected && supplied && expected === supplied);
}

async function createReviewTask(
  supabase: ReturnType<typeof getServiceClient>,
  accountId: string,
  contactId: string | null,
  title: string,
  details: string,
  dueAt: string,
  queueKey: string,
) {
  const { data: existing } = await supabase
    .from("b2b_activities")
    .select("id")
    .eq("account_id", accountId)
    .eq("status", "open")
    .contains("metadata", { queue_key: queueKey })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return false;

  const { error } = await supabase.from("b2b_activities").insert({
    account_id: accountId,
    contact_id: contactId,
    activity_type: "task",
    title,
    details,
    status: "open",
    due_at: dueAt,
    metadata: { queue_key: queueKey, source: "run-b2b-followups" },
  });
  if (error) throw error;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!isCronAuthorized(req)) {
    const { user, error } = await requireAdmin(req);
    if (error || !user) return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabase = getServiceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  let draftsCreated = 0;
  let tasksCreated = 0;
  let expiredCredits = 0;
  let reorderTasks = 0;

  try {
    const body = await req.json().catch(() => ({}));
    const mode = body?.mode === "stale_only" ? "stale_only" : "full";
    if (mode === "full") {
      const { data: accounts, error: accountError } = await supabase
        .from("b2b_accounts")
        .select("*, b2b_contacts(*)")
        .not("stage", "in", '("lost","won","suppressed")')
        .limit(1000);
      if (accountError) throw accountError;

      for (const account of accounts || []) {
        const contacts = Array.isArray(account.b2b_contacts) ? account.b2b_contacts : [];
        const contact = contacts.find((item: any) => item.is_primary) || contacts[0] || null;
        if (!contact || contact.opted_out_at || STOP_STAGES.has(account.stage)) continue;

        if (account.stage === "approved_for_outreach") {
          for (const channel of ["email", "whatsapp"] as const) {
            if (channel === "email" && !contact.email) continue;
            if (channel === "whatsapp" && (!contact.whatsapp_phone && !contact.phone)) continue;
            if (channel === "whatsapp" && !contact.whatsapp_consent && !contact.is_public_business_contact) continue;
            const message = buildFallbackOutreach({
              businessName: account.business_name,
              contactName: contact.full_name || "",
              channel,
              step: 0,
            });
            const { data: existing } = await supabase.from("b2b_outreach")
              .select("id").eq("account_id", account.id).eq("channel", channel)
              .eq("sequence_step", 0).eq("direction", "outbound").maybeSingle();
            if (!existing?.id) {
              const { error } = await supabase.from("b2b_outreach").insert({
                account_id: account.id,
                contact_id: contact.id,
                channel,
                direction: "outbound",
                sequence_step: 0,
                subject: message.subject,
                body: message.body,
                status: "draft",
                scheduled_for: nowIso,
                metadata: { generated_by_queue: true },
              });
              if (error) throw error;
              draftsCreated += 1;
            }
          }
          if (await createReviewTask(
            supabase,
            account.id,
            contact.id,
            "Review first-touch outreach",
            "Review the email and WhatsApp drafts. Each channel remains unsent until approved and manually actioned.",
            nowIso,
            `first-touch:${account.id}`,
          )) tasksCreated += 1;
          continue;
        }

        const { data: sentEmails } = await supabase.from("b2b_outreach")
          .select("*").eq("account_id", account.id).eq("channel", "email")
          .eq("direction", "outbound").eq("status", "sent")
          .order("sequence_step", { ascending: false });
        const lastSent = sentEmails?.[0];
        if (!lastSent?.sent_at) continue;
        if (Number(lastSent.sequence_step || 0) >= 3) {
          await supabase.from("b2b_accounts").update({
            stage: "nurture",
            next_action_at: null,
          }).eq("id", account.id).eq("stage", "contacted");
          continue;
        }

        const nextStep = Math.min(3, Number(lastSent.sequence_step || 0) + 1);
        const dueAt = new Date(new Date(lastSent.sent_at).getTime() +
          (FOLLOWUP_DAYS[nextStep] - FOLLOWUP_DAYS[Number(lastSent.sequence_step || 0)]) * DAY_MS);
        if (dueAt.getTime() > now.getTime()) continue;

        const { data: existingNext } = await supabase.from("b2b_outreach")
          .select("id").eq("account_id", account.id).eq("channel", "email")
          .eq("sequence_step", nextStep).eq("direction", "outbound").maybeSingle();
        if (!existingNext?.id) {
          const message = buildFallbackOutreach({
            businessName: account.business_name,
            contactName: contact.full_name || "",
            channel: "email",
            step: nextStep,
          });
          const { error } = await supabase.from("b2b_outreach").insert({
            account_id: account.id,
            contact_id: contact.id,
            channel: "email",
            direction: "outbound",
            sequence_step: nextStep,
            subject: message.subject,
            body: message.body,
            status: "draft",
            scheduled_for: dueAt.toISOString(),
            metadata: { generated_by_queue: true },
          });
          if (error) throw error;
          draftsCreated += 1;
        }
        if (await createReviewTask(
          supabase,
          account.id,
          contact.id,
          `Review email follow-up ${nextStep}`,
          `Sequence day ${FOLLOWUP_DAYS[nextStep]}. Confirm there has been no reply or opt-out before approval.`,
          dueAt.toISOString(),
          `followup:${account.id}:${nextStep}`,
        )) tasksCreated += 1;
      }
    }

    const staleBefore = new Date(now.getTime() - 7 * DAY_MS).toISOString();
    const { data: staleAccounts } = await supabase.from("b2b_accounts")
      .select("id, business_name, next_action_at")
      .not("stage", "in", '("won","lost","nurture","suppressed")')
      .or(`next_action_at.lt.${nowIso},and(next_action_at.is.null,updated_at.lt.${staleBefore})`)
      .limit(500);
    for (const account of staleAccounts || []) {
      const key = `stale:${account.id}:${nowIso.slice(0, 10)}`;
      if (await createReviewTask(
        supabase,
        account.id,
        null,
        "Review stale B2B account",
        `${account.business_name} has no current next action.`,
        nowIso,
        key,
      )) tasksCreated += 1;
    }

    const { data: expired } = await supabase.from("b2b_credits")
      .update({ status: "expired" })
      .eq("status", "active").lte("expires_at", nowIso).select("id");
    expiredCredits = expired?.length || 0;

    const deliveredBefore = new Date(now.getTime() - 30 * DAY_MS).toISOString();
    const { data: deliveredOrders, error: deliveredError } = await supabase.from("orders")
      .select("id, b2b_account_id, customer_name, fulfillment_updated_at")
      .in("order_type", ["b2b_opening", "b2b_reorder"])
      .eq("fulfillment_status", "delivered")
      .not("b2b_account_id", "is", null)
      .lte("fulfillment_updated_at", deliveredBefore)
      .limit(500);
    if (deliveredError) throw deliveredError;
    for (const order of deliveredOrders || []) {
      if (await createReviewTask(
        supabase,
        order.b2b_account_id,
        null,
        "Reorder reminder due",
        `Order ${order.id} was delivered at least 30 days ago. Review stock needs before contacting the account.`,
        nowIso,
        `reorder:${order.id}`,
      )) reorderTasks += 1;
    }

    return jsonResponse({ success: true, draftsCreated, tasksCreated, expiredCredits, reorderTasks });
  } catch (error) {
    console.error("run-b2b-followups failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Queue run failed" }, 500);
  }
});
