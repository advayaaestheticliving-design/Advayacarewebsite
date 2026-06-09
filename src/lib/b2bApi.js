import { authorizedAdminFetch, getAdminFunctionUrl } from "./adminOrdersApi";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function publicFunction(functionName, payload) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`);
  return body;
}

export function submitTradeApplication(payload) {
  return publicFunction("submit-b2b-lead", {
    ...payload,
    kind: "trade",
    website_confirmation: payload.companyWebsite || "",
  });
}

export function submitGeneralInquiry(payload) {
  return publicFunction("submit-b2b-lead", {
    ...payload,
    kind: "general",
    website_confirmation: payload.companyWebsite || "",
  });
}

export function previewTradeQuote(token) {
  return publicFunction("create-b2b-order", { action: "preview", token });
}

export function createTradeOrder(token, customer) {
  return publicFunction("create-b2b-order", { action: "create_order", token, customer });
}

async function adminRequest(payload, method = "POST") {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("admin-b2b"), {
    method,
    headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: method === "POST" ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `B2B admin request failed (${response.status})`);
  return body;
}

export function getB2BDashboard() {
  return adminRequest(null, "GET");
}

export function runB2BAdminAction(action, payload = {}) {
  return adminRequest({ action, ...payload });
}

export async function sendApprovedB2BEmail(outreachId) {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("send-b2b-email"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ outreachId }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Email send failed (${response.status})`);
  return body;
}

export async function runB2BFollowupQueue() {
  const response = await authorizedAdminFetch(getAdminFunctionUrl("run-b2b-followups"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "admin" }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || `Queue run failed (${response.status})`);
  return body;
}
