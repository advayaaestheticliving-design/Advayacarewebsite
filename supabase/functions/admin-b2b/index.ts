import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  buildFallbackOutreach,
  callGeminiOutreach,
  corsHeaders,
  createPublicToken,
  getServiceClient,
  jsonResponse,
  normalizeEmail,
  normalizePhone,
  normalizeText,
  quoteNumber,
  requireAdmin,
  sha256,
  toNumber,
} from "../_shared/b2b.ts";

const STAGES = new Set([
  "new", "researched", "qualified", "approved_for_outreach", "contacted",
  "replied", "discovery_booked", "sample_paid", "sample_sent",
  "proposal_sent", "won", "lost", "nurture", "suppressed",
]);

async function dashboard(supabase: ReturnType<typeof getServiceClient>) {
  const results = await Promise.all([
    supabase.from("b2b_accounts").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("b2b_contacts").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("b2b_opportunities").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("b2b_activities").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("b2b_outreach").select("*").order("created_at", { ascending: false }).limit(2000),
    supabase.from("b2b_trade_terms").select("*, products(id, name, price_inr, stock_quantity, reserved_quantity, is_active)").order("created_at"),
    supabase.from("b2b_quotes").select("*").order("created_at", { ascending: false }).limit(1000),
    supabase.from("b2b_credits").select("*").order("created_at", { ascending: false }).limit(1000),
  ]);
  const error = results.map((result) => result.error).find(Boolean);
  if (error) throw error;

  const [accountRows, contacts, opportunities, activities, outreach, tradeTerms, quotes, credits] =
    results.map((result) => result.data || []);
  const accounts = accountRows.map((account: any) => ({
    ...account,
    contacts: contacts.filter((item: any) => item.account_id === account.id),
    opportunities: opportunities.filter((item: any) => item.account_id === account.id),
    activities: activities.filter((item: any) => item.account_id === account.id).slice(0, 50),
    outreach: outreach.filter((item: any) => item.account_id === account.id).slice(0, 50),
    quotes: quotes.filter((item: any) => item.account_id === account.id),
  }));
  const sent = outreach.filter((item: any) => item.sent_at || item.provider_message_id);
  const approvedOrSent = outreach.filter((item: any) =>
    ["approved", "sent", "opened", "replied", "bounced", "failed", "suppressed"].includes(item.status)
  );
  const delivered = outreach.filter((item: any) =>
    item.metadata?.last_provider_event === "email.delivered" ||
    ["opened", "replied"].includes(item.status)
  );
  const bounced = outreach.filter((item: any) => ["bounced", "failed", "suppressed"].includes(item.status));
  const replied = accounts.filter((account: any) =>
    ["replied", "discovery_booked", "sample_paid", "sample_sent", "proposal_sent", "won"].includes(account.stage)
  );
  const paidQuotes = quotes.filter((quote: any) => quote.status === "paid");

  return {
    accounts,
    tasks: activities.filter((item: any) => item.status === "open")
      .sort((a: any, b: any) => String(a.due_at || "").localeCompare(String(b.due_at || ""))),
    outreach,
    tradeTerms,
    quotes,
    credits,
    metrics: {
      totalAccounts: accounts.length,
      qualifiedAccounts: accounts.filter((account: any) => account.score >= 60).length,
      pendingApprovals: outreach.filter((item: any) => item.status === "draft").length,
      openTasks: activities.filter((item: any) => item.status === "open").length,
      sentOutreach: sent.length,
      approvalRate: outreach.length ? Math.round((approvedOrSent.length / outreach.length) * 1000) / 10 : 0,
      deliveredOutreach: delivered.length,
      bounceRate: approvedOrSent.length ? Math.round((bounced.length / approvedOrSent.length) * 1000) / 10 : 0,
      positiveReplies: replied.length,
      replyRate: sent.length ? Math.round((replied.length / sent.length) * 1000) / 10 : 0,
      discoveryMeetings: accounts.filter((account: any) => account.stage === "discovery_booked").length,
      paidSamples: paidQuotes.filter((quote: any) => quote.quote_type === "sample_kit").length,
      quotesCreated: quotes.length,
      openingOrders: paidQuotes.filter((quote: any) => quote.quote_type === "opening_order").length,
      reorders: paidQuotes.filter((quote: any) => quote.quote_type === "reorder").length,
      activeAccounts: accounts.filter((account: any) => account.stage === "won").length,
      wonRevenueInr: paidQuotes.reduce((sum: number, quote: any) => sum + toNumber(quote.total_inr), 0),
      averageOrderValueInr: paidQuotes.length
        ? Math.round(paidQuotes.reduce((sum: number, quote: any) => sum + toNumber(quote.total_inr), 0) / paidQuotes.length)
        : 0,
    },
  };
}

async function accountAndContact(
  supabase: ReturnType<typeof getServiceClient>,
  accountId: string,
  contactId = ""
) {
  const { data: account, error } = await supabase.from("b2b_accounts").select("*").eq("id", accountId).single();
  if (error || !account) throw new Error("Account not found");
  const query = supabase.from("b2b_contacts").select("*").eq("account_id", accountId);
  const contactResult = contactId
    ? await query.eq("id", contactId).single()
    : await query.order("is_primary", { ascending: false }).limit(1).maybeSingle();
  return { account, contact: contactResult.data };
}

async function createQuote(supabase: ReturnType<typeof getServiceClient>, body: any, adminEmail: string) {
  const accountId = normalizeText(body?.accountId, 80);
  const contactId = normalizeText(body?.contactId, 80) || null;
  const quoteType = ["sample_kit", "opening_order", "reorder"].includes(body?.quoteType)
    ? body.quoteType
    : "opening_order";
  const lines = Array.isArray(body?.lines) ? body.lines.slice(0, 100) : [];
  if (!lines.length) throw new Error("Add at least one product.");

  const productIds = [...new Set(lines.map((line: any) => normalizeText(line?.productId, 160)).filter(Boolean))];
  const { data: terms, error } = await supabase
    .from("b2b_trade_terms")
    .select("*, products(id, name, stock_quantity, reserved_quantity, is_active)")
    .in("product_id", productIds);
  if (error) throw error;
  const termMap = new Map((terms || []).map((term: any) => [term.product_id, term]));
  const items: any[] = [];

  for (const line of lines) {
    const productId = normalizeText(line?.productId, 160);
    const quantity = Math.max(1, Math.floor(toNumber(line?.quantity, 1)));
    const term: any = termMap.get(productId);
    if (!term?.products?.is_active) throw new Error(`Product ${productId} is unavailable.`);
    if (quoteType !== "sample_kit" && !term.is_eligible) {
      throw new Error(`${term.products.name} has not passed the margin floor.`);
    }
    if (quoteType === "sample_kit" && (!term.sample_selected || !term.is_eligible)) {
      throw new Error(`${term.products.name} is not selected for the sample kit.`);
    }
    const available = toNumber(term.products.stock_quantity) - toNumber(term.products.reserved_quantity);
    if (available < quantity) throw new Error(`Insufficient stock for ${term.products.name}.`);
    const samplePrice = Math.max(toNumber(term.retail_price_inr) * 0.70, toNumber(term.unit_cost_inr) / 0.55);
    const unitPrice = quoteType === "sample_kit"
      ? Math.round(samplePrice * 100) / 100
      : toNumber(term.wholesale_price_inr);
    items.push({
      product_id: productId,
      name: term.products.name,
      quantity,
      unit_price_inr: unitPrice,
      retail_price_inr: toNumber(term.retail_price_inr),
      line_total_inr: Math.round(unitPrice * quantity * 100) / 100,
    });
  }

  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = items.reduce((sum, item) => sum + item.line_total_inr, 0);
  if (quoteType === "sample_kit" && (items.length !== 3 || items.some((item) => item.quantity !== 1))) {
    throw new Error("The sample kit must contain exactly three products with one unit each.");
  }
  if (quoteType === "opening_order" && (subtotal < 12000 || units < 12 || items.some((item) => item.quantity < 2))) {
    throw new Error("Opening orders require ₹12,000, 12 units, and at least two units per selected SKU.");
  }
  if (quoteType === "reorder" && (subtotal < 7500 || units < 6)) {
    throw new Error("Reorders require ₹7,500 and at least six units.");
  }

  const deliveryCity = normalizeText(body?.deliveryCity, 120);
  const isBangalore = ["bangalore", "bengaluru"].includes(deliveryCity.toLowerCase());
  const shipping = quoteType === "opening_order" && isBangalore
    ? 0
    : Math.max(0, toNumber(body?.shippingInr));
  let credit = 0;
  let creditId = "";
  if (quoteType === "opening_order") {
    const { data: availableCredit } = await supabase
      .from("b2b_credits")
      .select("*")
      .eq("account_id", accountId)
      .eq("status", "active")
      .gt("remaining_inr", 0)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at")
      .limit(1)
      .maybeSingle();
    if (availableCredit) {
      credit = Math.min(toNumber(availableCredit.remaining_inr), subtotal);
      creditId = availableCredit.id;
    }
  }

  const token = createPublicToken();
  const { data: quote, error: quoteError } = await supabase.from("b2b_quotes").insert({
    account_id: accountId,
    contact_id: contactId,
    quote_number: quoteNumber(),
    quote_type: quoteType,
    token_hash: await sha256(token),
    token_hint: token.slice(-6),
    items,
    subtotal_inr: subtotal,
    shipping_inr: shipping,
    credit_inr: credit,
    total_inr: Math.max(0, Math.round((subtotal + shipping - credit) * 100) / 100),
    delivery_address: normalizeText(body?.deliveryAddress, 800),
    delivery_city: deliveryCity,
    delivery_state: normalizeText(body?.deliveryState, 120),
    delivery_pin_code: normalizeText(body?.deliveryPinCode, 12),
    notes: normalizeText(body?.notes, 2000),
    metadata: { credit_id: creditId || null },
  }).select("*").single();
  if (quoteError) throw quoteError;
  await supabase.from("b2b_activities").insert({
    account_id: accountId,
    contact_id: contactId,
    activity_type: "quote",
    title: `${quoteType.replace(/_/g, " ")} quote created`,
    details: quote.quote_number,
    created_by_email: adminEmail,
    metadata: { quote_id: quote.id },
  });
  return { quote, publicToken: token };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const { user, error: authError } = await requireAdmin(req);
  if (authError || !user) return jsonResponse({ error: authError || "Unauthorized" }, 401);
  const supabase = getServiceClient();

  try {
    if (req.method === "GET") return jsonResponse(await dashboard(supabase));
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
    const body = await req.json().catch(() => ({}));
    const action = normalizeText(body?.action, 80);

    if (action === "update_account") {
      const allowed = [
        "business_name", "business_type", "website_url", "instagram_handle", "address",
        "locality", "city", "state", "pin_code", "premium_positioning",
        "retails_products", "social_active", "location_count", "notes",
        "assigned_to_email", "next_action_at",
      ];
      const updates = Object.fromEntries(allowed
        .filter((key) => Object.prototype.hasOwnProperty.call(body?.updates || {}, key))
        .map((key) => [key, body.updates[key]]));
      const { data, error } = await supabase.from("b2b_accounts").update(updates)
        .eq("id", body?.accountId).select("*").single();
      if (error) throw error;
      return jsonResponse({ account: data });
    }

    if (action === "change_stage") {
      const stage = normalizeText(body?.stage, 80);
      if (!STAGES.has(stage)) return jsonResponse({ error: "Invalid stage" }, 400);
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { stage };
      if (stage === "won") updates.won_at = now;
      if (stage === "lost") updates.lost_at = now;
      if (stage === "replied") updates.last_replied_at = now;
      if (stage === "suppressed") updates.opt_out_at = now;
      const { data, error } = await supabase.from("b2b_accounts").update(updates)
        .eq("id", body?.accountId).select("*").single();
      if (error) throw error;
      await supabase.from("b2b_activities").insert({
        account_id: body?.accountId,
        activity_type: "stage_change",
        title: `Stage changed to ${stage.replace(/_/g, " ")}`,
        details: normalizeText(body?.notes, 1000),
        created_by_email: user.email || "",
      });
      if ([
        "replied", "discovery_booked", "sample_paid", "sample_sent",
        "proposal_sent", "won", "lost", "nurture", "suppressed",
      ].includes(stage)) {
        await supabase.from("b2b_outreach")
          .update({ status: stage === "replied" ? "cancelled" : "suppressed" })
          .eq("account_id", body?.accountId).in("status", ["draft", "approved"]);
      }
      return jsonResponse({ account: data });
    }

    if (action === "create_activity") {
      const { data, error } = await supabase.from("b2b_activities").insert({
        account_id: body?.accountId,
        contact_id: body?.contactId || null,
        opportunity_id: body?.opportunityId || null,
        activity_type: normalizeText(body?.activityType || "note", 80),
        title: normalizeText(body?.title, 220),
        details: normalizeText(body?.details, 3000),
        status: normalizeText(body?.status || "completed", 30),
        due_at: body?.dueAt || null,
        completed_at: body?.status === "completed" ? new Date().toISOString() : null,
        created_by_email: user.email || "",
      }).select("*").single();
      if (error) throw error;
      return jsonResponse({ activity: data });
    }

    if (action === "complete_activity") {
      const { data, error } = await supabase.from("b2b_activities")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", body?.activityId).select("*").single();
      if (error) throw error;
      return jsonResponse({ activity: data });
    }

    if (action === "save_trade_term") {
      const { data: product, error: productError } = await supabase.from("products")
        .select("id, price_inr").eq("id", body?.productId).single();
      if (productError || !product) return jsonResponse({ error: "Product not found" }, 404);
      const unitCost = Math.max(0, toNumber(body?.unitCostInr));
      const retail = toNumber(product.price_inr);
      const wholesale = retail > 0 && unitCost > 0 ? Math.max(retail * 0.65, unitCost / 0.55) : 0;
      const eligible = wholesale > 0 &&
        (retail - wholesale) / retail >= 0.30 &&
        (wholesale - unitCost) / wholesale >= 0.45;
      if (body?.sampleSelected && !eligible) {
        return jsonResponse({ error: "Only products that pass both margin floors can be selected for samples." }, 409);
      }
      if (body?.sampleSelected) {
        const { count } = await supabase.from("b2b_trade_terms")
          .select("id", { count: "exact", head: true })
          .eq("sample_selected", true)
          .neq("product_id", product.id);
        if ((count || 0) >= 3) {
          return jsonResponse({ error: "The sample kit can contain exactly three selected products." }, 409);
        }
      }
      const { data, error } = await supabase.from("b2b_trade_terms").upsert({
        product_id: product.id,
        retail_price_inr: product.price_inr,
        unit_cost_inr: unitCost,
        sample_selected: Boolean(body?.sampleSelected),
        notes: normalizeText(body?.notes, 1000),
      }, { onConflict: "product_id" })
        .select("*, products(id, name, price_inr, stock_quantity, reserved_quantity, is_active)").single();
      if (error) throw error;
      return jsonResponse({ tradeTerm: data });
    }

    if (action === "generate_outreach") {
      const channel = body?.channel === "whatsapp" ? "whatsapp" : "email";
      const step = Math.min(3, Math.max(0, Math.floor(toNumber(body?.step, 0))));
      const { account, contact } = await accountAndContact(supabase, body?.accountId, body?.contactId);
      if (["won", "lost", "suppressed"].includes(account.stage) || contact?.opted_out_at) {
        return jsonResponse({ error: "Outreach is suppressed for this account." }, 409);
      }
      if (channel === "email" && !contact?.email) return jsonResponse({ error: "Contact email is missing." }, 400);
      if (channel === "whatsapp" && !contact?.whatsapp_phone && !contact?.phone) {
        return jsonResponse({ error: "Contact WhatsApp number is missing." }, 400);
      }
      if (channel === "whatsapp" && !contact?.whatsapp_consent && !contact?.is_public_business_contact) {
        return jsonResponse({ error: "WhatsApp requires consent or a verified public business number." }, 409);
      }
      const fallback = buildFallbackOutreach({
        businessName: account.business_name,
        contactName: contact?.full_name || "",
        channel,
        step,
      });
      const generated = await callGeminiOutreach(`Return JSON with subject and body. Draft a concise ${channel}
B2B message for Advaya Care to ${account.business_name}, a ${account.business_type} in ${account.locality || account.city}.
Only use these facts: Advaya Care is a Bangalore vegan skincare brand for Indian skin and climate; selected partners
may receive up to 35% resale margin; opening order is ₹12,000; the paid three-product trial kit can be credited against
a qualifying first order within 30 days; delivery is available across India. This is sequence step ${step}.
Do not invent prospect facts or make medical, therapeutic, antibacterial, or guaranteed-result claims.
End with a low-pressure question and clear opt-out.`);
      const message = generated?.body ? generated : fallback;
      const { data, error } = await supabase.from("b2b_outreach").upsert({
        account_id: account.id,
        contact_id: contact?.id || null,
        channel,
        direction: "outbound",
        sequence_step: step,
        subject: channel === "email" ? message.subject : "",
        body: message.body,
        status: "draft",
        scheduled_for: new Date().toISOString(),
        approved_at: null,
        approved_by_email: "",
        metadata: { generated_with_ai: Boolean(generated?.body) },
      }, { onConflict: "account_id,channel,sequence_step,direction" }).select("*").single();
      if (error) throw error;
      return jsonResponse({ outreach: data });
    }

    if (action === "approve_outreach") {
      const { data, error } = await supabase.from("b2b_outreach").update({
        subject: normalizeText(body?.subject, 180),
        body: normalizeText(body?.body, 3000),
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_email: user.email || "",
      }).eq("id", body?.outreachId).eq("status", "draft").select("*").single();
      if (error) throw error;
      return jsonResponse({ outreach: data });
    }

    if (action === "confirm_whatsapp_sent") {
      const { data, error } = await supabase.from("b2b_outreach").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        sent_by_email: user.email || "",
      }).eq("id", body?.outreachId).eq("channel", "whatsapp").eq("status", "approved").select("*").single();
      if (error || !data) throw error || new Error("Approved WhatsApp message not found");
      await supabase.from("b2b_accounts").update({
        stage: "contacted",
        last_contacted_at: new Date().toISOString(),
        next_action_at: new Date(Date.now() + 3 * 86400000).toISOString(),
      }).eq("id", data.account_id);
      await supabase.from("b2b_activities").insert({
        account_id: data.account_id,
        contact_id: data.contact_id,
        activity_type: "whatsapp",
        title: `WhatsApp sequence step ${data.sequence_step} sent`,
        details: data.body,
        created_by_email: user.email || "",
        metadata: { outreach_id: data.id },
      });
      return jsonResponse({ outreach: data });
    }

    if (action === "mark_reply") {
      await supabase.from("b2b_accounts").update({
        stage: "replied", last_replied_at: new Date().toISOString(), next_action_at: null,
      }).eq("id", body?.accountId);
      await supabase.from("b2b_outreach").update({ status: "cancelled" })
        .eq("account_id", body?.accountId).in("status", ["draft", "approved"]);
      await supabase.from("b2b_activities").insert({
        account_id: body?.accountId,
        contact_id: body?.contactId || null,
        activity_type: body?.channel === "whatsapp" ? "whatsapp" : "email",
        title: "Prospect replied",
        details: normalizeText(body?.details, 3000),
        created_by_email: user.email || "",
      });
      return jsonResponse({ success: true });
    }

    if (action === "suppress_contact") {
      const { contact } = await accountAndContact(supabase, body?.accountId, body?.contactId);
      const entries: any[] = [];
      if (contact?.email) entries.push({ identifier_type: "email", identifier_hash: await sha256(normalizeEmail(contact.email)) });
      const phone = normalizePhone(contact?.whatsapp_phone || contact?.phone);
      if (phone) entries.push({ identifier_type: "phone", identifier_hash: await sha256(phone) });
      for (const entry of entries) {
        await supabase.from("b2b_suppressions").upsert({
          ...entry,
          reason: normalizeText(body?.reason || "opt_out", 200),
          source: "admin",
          restored_at: null,
        }, { onConflict: "identifier_type,identifier_hash" });
      }
      await supabase.from("b2b_contacts").update({ opted_out_at: new Date().toISOString() }).eq("id", contact.id);
      await supabase.from("b2b_accounts").update({
        stage: "suppressed", opt_out_at: new Date().toISOString(), next_action_at: null,
      }).eq("id", body?.accountId);
      await supabase.from("b2b_outreach").update({ status: "suppressed" })
        .eq("account_id", body?.accountId).in("status", ["draft", "approved"]);
      return jsonResponse({ success: true });
    }

    if (action === "create_quote") return jsonResponse(await createQuote(supabase, body, user.email || ""));

    if (action === "approve_quote") {
      const { data, error } = await supabase.from("b2b_quotes").update({
        status: "approved",
        approved_at: new Date().toISOString(),
        approved_by_email: user.email || "",
      }).eq("id", body?.quoteId).eq("status", "draft").select("*").single();
      if (error) throw error;
      await supabase.from("b2b_accounts").update({ stage: "proposal_sent" }).eq("id", data.account_id);
      return jsonResponse({ quote: data });
    }

    if (action === "regenerate_quote_link") {
      const token = createPublicToken();
      const { data, error } = await supabase.from("b2b_quotes").update({
        token_hash: await sha256(token),
        token_hint: token.slice(-6),
      }).eq("id", body?.quoteId).in("status", ["draft", "approved", "sent", "viewed"])
        .select("*").single();
      if (error) throw error;
      return jsonResponse({ quote: data, publicToken: token });
    }

    if (action === "import_accounts") {
      const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 100) : [];
      let imported = 0;
      const errors: string[] = [];
      for (const row of rows) {
        const businessName = normalizeText(row?.businessName || row?.business_name, 180);
        if (!businessName) continue;
        const city = normalizeText(row?.city || "Bangalore", 100);
        const { data: existing } = await supabase.from("b2b_accounts")
          .select("id").ilike("business_name", businessName).ilike("city", city).maybeSingle();
        let accountId = existing?.id || "";
        if (!accountId) {
          const { data: account, error } = await supabase.from("b2b_accounts").insert({
            business_name: businessName,
            business_type: normalizeText(row?.businessType || "salon_spa", 80),
            source: "csv_import",
            source_reference: normalizeText(row?.sourceReference, 500),
            website_url: normalizeText(row?.websiteUrl, 500),
            instagram_handle: normalizeText(row?.instagramHandle, 200),
            locality: normalizeText(row?.locality, 120),
            city,
            state: normalizeText(row?.state || "Karnataka", 100),
            premium_positioning: Boolean(row?.premiumPositioning),
            retails_products: Boolean(row?.retailsProducts),
            social_active: Boolean(row?.socialActive),
            location_count: Math.max(1, Math.floor(toNumber(row?.locationCount, 1))),
          }).select("id").single();
          if (error || !account) {
            errors.push(`${businessName}: ${error?.message || "insert failed"}`);
            continue;
          }
          accountId = account.id;
        }
        if (accountId && (row?.email || row?.phone)) {
          await supabase.from("b2b_contacts").insert({
            account_id: accountId,
            full_name: normalizeText(row?.contactName, 140),
            job_title: normalizeText(row?.jobTitle, 120),
            email: normalizeEmail(row?.email) || null,
            phone: normalizePhone(row?.phone) || null,
            whatsapp_phone: normalizePhone(row?.whatsappPhone || row?.phone) || null,
            is_public_business_contact: Boolean(row?.isPublicBusinessContact),
          });
        }
        imported += 1;
      }
      return jsonResponse({ imported, errors });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("admin-b2b failed", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "B2B admin action failed" }, 500);
  }
});
