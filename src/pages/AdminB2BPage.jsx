import React from "react";
import { Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import { useAdminAccess } from "../lib/useAdminAccess";
import {
  getB2BDashboard,
  runB2BAdminAction,
  runB2BFollowupQueue,
  sendApprovedB2BEmail,
} from "../lib/b2bApi";
import B2BHelpModal from "../components/B2BHelpModal";

const STAGES = [
  "new", "researched", "qualified", "approved_for_outreach", "contacted", "replied",
  "discovery_booked", "sample_paid", "sample_sent", "proposal_sent", "won", "lost",
  "nurture", "suppressed",
];
const TABS = ["pipeline", "tasks", "outreach", "pricing", "quotes", "samples", "import"];
const inputClass = "w-full rounded-xl border border-neutral-700 bg-black px-3 py-2 text-sm text-white outline-none focus:border-[#D4AF37]";

function label(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function currency(value) {
  return Number(value || 0).toLocaleString("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const input = String(text || "").replace(/\r\n/g, "\n");
  for (let index = 0; index <= input.length; index += 1) {
    const char = input[index] ?? "\n";
    const next = input[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if (char === "\n" && !quoted) {
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function AdminB2BPage() {
  const admin = useAdminAccess();
  const [data, setData] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [tab, setTab] = React.useState("pipeline");
  const [selectedAccountId, setSelectedAccountId] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [workingId, setWorkingId] = React.useState("");
  const [draftEdits, setDraftEdits] = React.useState({});
  const [quoteForm, setQuoteForm] = React.useState({
    quoteType: "opening_order", shippingInr: 0, deliveryAddress: "", deliveryCity: "Bangalore",
    deliveryState: "Karnataka", deliveryPinCode: "", notes: "", quantities: {},
  });
  const [latestQuoteLink, setLatestQuoteLink] = React.useState("");
  const [csvText, setCsvText] = React.useState("");
  const [helpOpen, setHelpOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!admin.authorized) return;
    setLoading(true);
    setError("");
    try {
      const result = await getB2BDashboard();
      setData(result);
      setSelectedAccountId((current) => current || result.accounts?.[0]?.id || "");
    } catch (loadError) {
      setError(loadError?.message || "Could not load B2B sales.");
    } finally {
      setLoading(false);
    }
  }, [admin.authorized]);

  React.useEffect(() => {
    if (!admin.checkingAccess && admin.authorized) load().catch(() => undefined);
  }, [admin.authorized, admin.checkingAccess, load]);

  async function act(action, payload = {}, message = "Updated.") {
    setWorkingId(payload.accountId || payload.outreachId || payload.quoteId || action);
    setError("");
    setStatus("");
    try {
      const result = await runB2BAdminAction(action, payload);
      setStatus(message);
      await load();
      return result;
    } catch (actionError) {
      setError(actionError?.message || "Action failed.");
      return null;
    } finally {
      setWorkingId("");
    }
  }

  const accounts = data?.accounts || [];
  const selected = accounts.find((account) => account.id === selectedAccountId) || null;
  const filteredAccounts = accounts.filter((account) =>
    `${account.business_name} ${account.locality} ${account.city} ${account.stage}`.toLowerCase().includes(search.toLowerCase())
  );
  const eligibleTerms = (data?.tradeTerms || []).filter((term) => term.is_eligible);

  async function createQuote() {
    if (!selected) return;
    const lines = Object.entries(quoteForm.quantities)
      .map(([productId, quantity]) => ({ productId, quantity: Number(quantity) }))
      .filter((line) => line.quantity > 0);
    const result = await act("create_quote", {
      accountId: selected.id,
      contactId: selected.contacts?.[0]?.id || null,
      ...quoteForm,
      lines,
    }, "Quote created. Save the secure link now or regenerate it later.");
    if (result?.publicToken) {
      setLatestQuoteLink(`${window.location.origin}/trade/order/${result.publicToken}`);
      setQuoteForm((current) => ({ ...current, quantities: {} }));
    }
  }

  async function sendEmail(outreach) {
    setWorkingId(outreach.id);
    setError("");
    try {
      await sendApprovedB2BEmail(outreach.id);
      setStatus("Approved email sent.");
      await load();
    } catch (sendError) {
      setError(sendError?.message || "Could not send email.");
    } finally {
      setWorkingId("");
    }
  }

  if (admin.checkingAccess) return <p className="p-10 text-white">Checking admin access...</p>;
  if (!admin.authorized) return <Navigate to="/admin" replace />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-white/50">Human-approved sales system</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#D4AF37]">B2B Sales</h1>
        </div>
        <button
          onClick={() => setHelpOpen(true)}
          className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Guide & Help
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <AdminSidebar onSignOut={admin.logout} authLoading={admin.authLoading} />
        <main className="min-w-0 space-y-6">
          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => (
              <button key={item} onClick={() => setTab(item)} className={`rounded-full px-4 py-2 text-xs font-semibold ${tab === item ? "bg-[#D4AF37] text-black" : "border border-neutral-700 bg-black/50"}`}>
                {label(item)}
              </button>
            ))}
            <button
              onClick={async () => {
                setWorkingId("queue");
                try {
                  const result = await runB2BFollowupQueue();
                  setStatus(`Queue refreshed: ${result.draftsCreated} drafts and ${result.tasksCreated + result.reorderTasks} tasks created.`);
                  await load();
                } catch (queueError) {
                  setError(queueError?.message || "Queue failed.");
                } finally {
                  setWorkingId("");
                }
              }}
              disabled={workingId === "queue"}
              className="ml-auto rounded-full border border-[#D4AF37] px-4 py-2 text-xs font-semibold text-[#D4AF37]"
            >
              {workingId === "queue" ? "Running..." : "Run queue now"}
            </button>
          </div>

          {error ? <p className="rounded-xl border border-red-400/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p> : null}
          {status ? <p className="rounded-xl border border-emerald-400/30 bg-emerald-950/30 p-3 text-sm text-emerald-200">{status}</p> : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["Accounts", data?.metrics?.totalAccounts],
              ["Qualified", data?.metrics?.qualifiedAccounts],
              ["Reply rate", `${data?.metrics?.replyRate || 0}%`],
              ["Won revenue", currency(data?.metrics?.wonRevenueInr)],
              ["Draft approvals", data?.metrics?.pendingApprovals],
              ["Open tasks", data?.metrics?.openTasks],
              ["Paid samples", data?.metrics?.paidSamples],
              ["Opening orders", data?.metrics?.openingOrders],
              ["Delivery count", data?.metrics?.deliveredOutreach],
              ["Bounce rate", `${data?.metrics?.bounceRate || 0}%`],
              ["Meetings", data?.metrics?.discoveryMeetings],
              ["Reorders", data?.metrics?.reorders],
            ].map(([name, value]) => (
              <article key={name} className="rounded-2xl border border-neutral-700 bg-black/55 p-4">
                <p className="text-xs text-white/50">{name}</p><p className="mt-1 text-2xl font-semibold text-[#D4AF37]">{value ?? 0}</p>
              </article>
            ))}
          </section>

          {loading && !data ? <p className="text-sm text-white/60">Loading pipeline...</p> : null}

          {tab === "pipeline" ? (
            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <section className="rounded-2xl border border-neutral-700 bg-black/55 p-4">
                <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search accounts" />
                <div className="mt-4 max-h-[680px] space-y-2 overflow-y-auto">
                  {filteredAccounts.map((account) => (
                    <button key={account.id} onClick={() => setSelectedAccountId(account.id)} className={`w-full rounded-xl border p-3 text-left ${selectedAccountId === account.id ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-neutral-800"}`}>
                      <div className="flex justify-between gap-3"><span className="font-medium">{account.business_name}</span><span className="text-[#D4AF37]">{account.score}</span></div>
                      <p className="mt-1 text-xs text-white/50">{label(account.stage)} · {account.locality || account.city}</p>
                    </button>
                  ))}
                </div>
              </section>
              <section className="rounded-2xl border border-neutral-700 bg-black/55 p-5">
                {selected ? (
                  <div className="space-y-6">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                      <div><h2 className="text-2xl font-semibold">{selected.business_name}</h2><p className="text-sm text-white/50">{label(selected.business_type)} · {selected.locality || selected.city}</p></div>
                      <select className={`${inputClass} sm:w-56`} value={selected.stage} onChange={(event) => act("change_stage", { accountId: selected.id, stage: event.target.value }, "Stage updated.")}>
                        {STAGES.map((stage) => <option key={stage} value={stage}>{label(stage)}</option>)}
                      </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/50">Score</p><p className="text-xl text-[#D4AF37]">{selected.score}/100</p></div>
                      <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/50">Locations</p><p className="text-xl">{selected.location_count}</p></div>
                      <div className="rounded-xl bg-white/5 p-3"><p className="text-xs text-white/50">Source</p><p className="text-sm">{label(selected.source)}</p></div>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#D4AF37]">Primary contact</h3>
                      {selected.contacts?.length ? selected.contacts.map((contact) => (
                        <div key={contact.id} className="mt-2 rounded-xl border border-neutral-800 p-3 text-sm">
                          <p>{contact.full_name || "Unnamed contact"} {contact.job_title ? `· ${contact.job_title}` : ""}</p>
                          <p className="text-white/55">{contact.email || "No email"} · {contact.whatsapp_phone || contact.phone || "No phone"}</p>
                        </div>
                      )) : <p className="mt-2 text-sm text-white/50">No contact recorded.</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => act("generate_outreach", { accountId: selected.id, channel: "email", step: 0 }, "Email draft generated.")} className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black">Draft email</button>
                      <button onClick={() => act("generate_outreach", { accountId: selected.id, channel: "whatsapp", step: 0 }, "WhatsApp draft generated.")} className="rounded-full border border-[#D4AF37] px-4 py-2 text-xs text-[#D4AF37]">Draft WhatsApp</button>
                      <button onClick={() => act("mark_reply", { accountId: selected.id, contactId: selected.contacts?.[0]?.id, details: "Reply recorded by admin." }, "Reply recorded; follow-ups stopped.")} className="rounded-full border border-neutral-600 px-4 py-2 text-xs">Mark replied</button>
                      <button onClick={() => act("suppress_contact", { accountId: selected.id, contactId: selected.contacts?.[0]?.id, reason: "manual_opt_out" }, "Contact suppressed.")} className="rounded-full border border-red-500/60 px-4 py-2 text-xs text-red-300">Suppress</button>
                    </div>
                    <div>
                      <h3 className="font-semibold text-[#D4AF37]">Recent activity</h3>
                      <div className="mt-2 space-y-2">
                        {(selected.activities || []).slice(0, 8).map((activity) => (
                          <div key={activity.id} className="rounded-xl bg-white/5 p-3 text-sm"><p>{activity.title}</p><p className="text-xs text-white/45">{new Date(activity.created_at).toLocaleString("en-IN")}</p></div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : <p className="text-white/50">Select an account.</p>}
              </section>
            </div>
          ) : null}

          {tab === "tasks" ? (
            <section className="space-y-3">
              {(data?.tasks || []).map((task) => (
                <article key={task.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-neutral-700 bg-black/55 p-4 sm:flex-row sm:items-center">
                  <div><p className="font-medium">{task.title}</p><p className="mt-1 text-sm text-white/55">{task.details}</p><p className="mt-1 text-xs text-[#D4AF37]">Due {task.due_at ? new Date(task.due_at).toLocaleString("en-IN") : "now"}</p></div>
                  <button onClick={() => act("complete_activity", { activityId: task.id }, "Task completed.")} className="rounded-full border border-[#D4AF37] px-4 py-2 text-xs text-[#D4AF37]">Complete</button>
                </article>
              ))}
              {!data?.tasks?.length ? <p className="text-sm text-white/55">No open tasks.</p> : null}
            </section>
          ) : null}

          {tab === "outreach" ? (
            <section className="space-y-4">
              {(data?.outreach || []).map((outreach) => {
                const account = accounts.find((item) => item.id === outreach.account_id);
                const edits = draftEdits[outreach.id] || { subject: outreach.subject, body: outreach.body };
                return (
                  <article key={outreach.id} className="rounded-2xl border border-neutral-700 bg-black/55 p-5">
                    <div className="flex flex-wrap justify-between gap-3"><div><p className="font-semibold">{account?.business_name || "Account"}</p><p className="text-xs text-white/50">{label(outreach.channel)} · step {outreach.sequence_step} · {label(outreach.status)}</p></div></div>
                    {outreach.channel === "email" ? <input className={`${inputClass} mt-4`} value={edits.subject} disabled={outreach.status !== "draft"} onChange={(event) => setDraftEdits((current) => ({ ...current, [outreach.id]: { ...edits, subject: event.target.value } }))} /> : null}
                    <textarea className={`${inputClass} mt-3 min-h-36 resize-y`} value={edits.body} disabled={outreach.status !== "draft"} onChange={(event) => setDraftEdits((current) => ({ ...current, [outreach.id]: { ...edits, body: event.target.value } }))} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {outreach.status === "draft" ? <button onClick={() => act("approve_outreach", { outreachId: outreach.id, ...edits }, "Outreach approved.")} className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black">Approve</button> : null}
                      {outreach.status === "approved" && outreach.channel === "email" ? <button onClick={() => sendEmail(outreach)} className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black">Send email</button> : null}
                      {outreach.status === "approved" && outreach.channel === "whatsapp" ? (
                        <>
                          <a href={`https://wa.me/${account?.contacts?.[0]?.whatsapp_phone || account?.contacts?.[0]?.phone || ""}?text=${encodeURIComponent(outreach.body)}`} target="_blank" rel="noreferrer" className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black">Open WhatsApp</a>
                          <button onClick={() => act("confirm_whatsapp_sent", { outreachId: outreach.id }, "WhatsApp marked sent.")} className="rounded-full border border-[#D4AF37] px-4 py-2 text-xs text-[#D4AF37]">Confirm sent</button>
                        </>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}

          {tab === "pricing" ? (
            <section className="grid gap-4 lg:grid-cols-2">
              {(data?.tradeTerms || []).map((term) => (
                <article key={term.id} className="rounded-2xl border border-neutral-700 bg-black/55 p-5">
                  <div className="flex justify-between gap-3"><div><p className="font-semibold">{term.products?.name || term.product_id}</p><p className="text-xs text-white/50">Retail {currency(term.retail_price_inr)}</p></div><span className={`text-xs ${term.is_eligible ? "text-emerald-300" : "text-amber-300"}`}>{term.is_eligible ? "Eligible" : "Blocked"}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <label>Unit cost<input id={`cost-${term.id}`} className={`${inputClass} mt-1`} type="number" min="0" defaultValue={term.unit_cost_inr} /></label>
                    <label className="flex items-end gap-2 pb-2"><input id={`sample-${term.id}`} type="checkbox" defaultChecked={term.sample_selected} className="accent-[#D4AF37]" /> Sample selected</label>
                  </div>
                  <p className="mt-3 text-xs text-white/50">Wholesale {term.wholesale_price_inr ? currency(term.wholesale_price_inr) : "requires cost"} · Partner {term.partner_margin_percent != null ? `${Math.round(Number(term.partner_margin_percent) * 100)}%` : "—"} · Advaya {term.brand_margin_percent != null ? `${Math.round(Number(term.brand_margin_percent) * 100)}%` : "—"}</p>
                  <button onClick={() => act("save_trade_term", {
                    productId: term.product_id,
                    unitCostInr: document.getElementById(`cost-${term.id}`)?.value,
                    sampleSelected: document.getElementById(`sample-${term.id}`)?.checked,
                  }, "Trade pricing recalculated.")} className="mt-4 rounded-full border border-[#D4AF37] px-4 py-2 text-xs text-[#D4AF37]">Save and recalculate</button>
                </article>
              ))}
            </section>
          ) : null}

          {tab === "quotes" ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <section className="rounded-2xl border border-neutral-700 bg-black/55 p-5">
                <h2 className="text-xl font-semibold">Quote builder</h2>
                <select className={`${inputClass} mt-4`} value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)}>
                  <option value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.business_name}</option>)}
                </select>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <select className={inputClass} value={quoteForm.quoteType} onChange={(event) => setQuoteForm((current) => ({ ...current, quoteType: event.target.value }))}>
                    <option value="sample_kit">Sample kit</option><option value="opening_order">Opening order</option><option value="reorder">Reorder</option>
                  </select>
                  <input className={inputClass} type="number" min="0" value={quoteForm.shippingInr} onChange={(event) => setQuoteForm((current) => ({ ...current, shippingInr: event.target.value }))} placeholder="Shipping" />
                </div>
                <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
                  {(quoteForm.quoteType === "sample_kit" ? (data?.tradeTerms || []).filter((term) => term.sample_selected && term.is_eligible) : eligibleTerms).map((term) => (
                    <label key={term.product_id} className="grid grid-cols-[1fr_80px] items-center gap-3 rounded-xl border border-neutral-800 p-3 text-sm">
                      <span>{term.products?.name || term.product_id}<small className="block text-white/45">{currency(quoteForm.quoteType === "sample_kit" ? Math.max(Number(term.retail_price_inr) * 0.7, Number(term.unit_cost_inr) / 0.55) : term.wholesale_price_inr)}</small></span>
                      <input className={inputClass} type="number" min="0" value={quoteForm.quantities[term.product_id] || ""} onChange={(event) => setQuoteForm((current) => ({ ...current, quantities: { ...current.quantities, [term.product_id]: event.target.value } }))} />
                    </label>
                  ))}
                </div>
                <textarea className={`${inputClass} mt-3 min-h-20`} value={quoteForm.deliveryAddress} onChange={(event) => setQuoteForm((current) => ({ ...current, deliveryAddress: event.target.value }))} placeholder="Delivery address" />
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {["deliveryCity", "deliveryState", "deliveryPinCode"].map((name) => <input key={name} className={inputClass} value={quoteForm[name]} onChange={(event) => setQuoteForm((current) => ({ ...current, [name]: event.target.value }))} placeholder={label(name.replace("delivery", ""))} />)}
                </div>
                <button onClick={createQuote} disabled={!selected} className="mt-4 w-full rounded-full bg-[#D4AF37] px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">Create validated quote</button>
                {latestQuoteLink ? <div className="mt-4 rounded-xl border border-emerald-400/30 p-3 text-sm"><p className="text-emerald-200">Secure link</p><a className="break-all text-[#D4AF37] underline" href={latestQuoteLink} target="_blank" rel="noreferrer">{latestQuoteLink}</a></div> : null}
              </section>
              <section className="space-y-3">
                {(data?.quotes || []).map((quote) => (
                  <article key={quote.id} className="rounded-2xl border border-neutral-700 bg-black/55 p-4">
                    <div className="flex justify-between gap-3"><div><p className="font-semibold">{quote.quote_number}</p><p className="text-xs text-white/50">{label(quote.quote_type)} · {label(quote.status)}</p></div><p className="text-[#D4AF37]">{currency(quote.total_inr)}</p></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {quote.status === "draft" ? <button onClick={() => act("approve_quote", { quoteId: quote.id }, "Quote approved.")} className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black">Approve</button> : null}
                      {["draft", "approved", "sent", "viewed"].includes(quote.status) ? <button onClick={async () => {
                        const result = await act("regenerate_quote_link", { quoteId: quote.id }, "New secure link generated.");
                        if (result?.publicToken) setLatestQuoteLink(`${window.location.origin}/trade/order/${result.publicToken}`);
                      }} className="rounded-full border border-[#D4AF37] px-4 py-2 text-xs text-[#D4AF37]">Generate link</button> : null}
                    </div>
                  </article>
                ))}
              </section>
            </div>
          ) : null}

          {tab === "samples" ? (
            <section className="grid gap-4 lg:grid-cols-2">
              {(data?.quotes || []).filter((quote) => quote.quote_type === "sample_kit").map((quote) => {
                const account = accounts.find((item) => item.id === quote.account_id);
                const credit = (data?.credits || []).find((item) => item.source_quote_id === quote.id);
                return (
                  <article key={quote.id} className="rounded-2xl border border-neutral-700 bg-black/55 p-5">
                    <div className="flex justify-between gap-3">
                      <div><p className="font-semibold">{account?.business_name || quote.quote_number}</p><p className="text-xs text-white/50">{quote.quote_number} · {label(quote.status)}</p></div>
                      <p className="text-[#D4AF37]">{currency(quote.total_inr)}</p>
                    </div>
                    <p className="mt-3 text-sm text-white/60">
                      {credit
                        ? `Credit ${currency(credit.remaining_inr)} · ${label(credit.status)} · expires ${new Date(credit.expires_at).toLocaleDateString("en-IN")}`
                        : quote.status === "paid" ? "Credit will be created from the payment event." : "Awaiting payment."}
                    </p>
                    {quote.status === "paid" && account?.stage === "sample_paid" ? (
                      <button onClick={() => act("change_stage", { accountId: account.id, stage: "sample_sent", notes: `Sample quote ${quote.quote_number} dispatched.` }, "Sample marked sent.")} className="mt-4 rounded-full border border-[#D4AF37] px-4 py-2 text-xs text-[#D4AF37]">
                        Mark sample sent
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </section>
          ) : null}

          {tab === "import" ? (
            <section className="rounded-2xl border border-neutral-700 bg-black/55 p-5">
              <h2 className="text-xl font-semibold">CSV import</h2>
              <p className="mt-2 text-sm text-white/55">Use manually verified sources only. Do not upload restricted Google Places content.</p>
              <p className="mt-2 text-xs text-[#D4AF37]">Headers: businessName,businessType,contactName,email,phone,whatsappPhone,locality,city,state,websiteUrl,instagramHandle,sourceReference</p>
              <textarea className={`${inputClass} mt-4 min-h-72 font-mono text-xs`} value={csvText} onChange={(event) => setCsvText(event.target.value)} placeholder="Paste CSV including a header row" />
              <button onClick={() => act("import_accounts", { rows: parseCsv(csvText) }, "CSV import completed.")} className="mt-4 rounded-full bg-[#D4AF37] px-5 py-3 text-sm font-semibold text-black">Import verified accounts</button>
            </section>
          ) : null}
        </main>
      </div>
      {helpOpen ? <B2BHelpModal onClose={() => setHelpOpen(false)} /> : null}
    </div>
  );
}

export default AdminB2BPage;
