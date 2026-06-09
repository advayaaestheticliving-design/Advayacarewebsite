import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

export const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getServiceClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server credentials are missing");
  return createClient(supabaseUrl, serviceRoleKey);
}

export async function requireAdmin(req: Request) {
  const token = String(req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return { user: null, error: "Missing authorization token" };
  const supabase = getServiceClient();
  const { data, error } = await supabase.auth.getUser(token);
  const email = String(data?.user?.email || "").trim().toLowerCase();
  if (error || !data?.user) return { user: null, error: error?.message || "Invalid authorization token" };
  if (email !== ADMIN_EMAIL) return { user: null, error: "Admin access required" };
  return { user: data.user, error: null };
}

export function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function normalizePhone(value: unknown) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function normalizeText(value: unknown, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}

export function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createPublicToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function quoteNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `AC-B2B-${datePart}-${suffix}`;
}

export function buildFallbackOutreach({
  businessName,
  contactName,
  channel,
  step,
}: {
  businessName: string;
  contactName: string;
  channel: "email" | "whatsapp";
  step: number;
}) {
  const greeting = contactName ? `Hi ${contactName}` : "Hello";
  if (step === 0) {
    return {
      subject: channel === "email" ? `A skincare retail partnership for ${businessName}` : "",
      body: `${greeting},

I’m reaching out from Advaya Care, a Bangalore-based vegan skincare brand formulated for Indian skin and climate.

We are opening a small trade partnership programme for selected salons and spas. It combines professional-use products, retail resale margins of up to 35%, a paid trial kit that can be credited toward the first qualifying order, and delivery support from Bangalore.

Would it be useful to share the short trade catalogue for ${businessName}?

If this is not relevant, reply “no” and I will not follow up.`,
    };
  }

  const followups = [
    "",
    `${greeting}, just following up on the Advaya Care salon and spa trade programme. I can send the concise catalogue and paid trial-kit details if product retail is relevant for ${businessName}.`,
    `${greeting}, one useful detail: the trial kit cost can be credited against a qualifying first wholesale order placed within 30 days. Would you like me to share the current selection?`,
    `${greeting}, I’ll close the loop after this note. If a vegan skincare retail partnership becomes useful for ${businessName}, I’d be happy to send the trade catalogue. Reply “no” and I will remove the contact from follow-ups.`,
  ];
  return {
    subject: channel === "email" ? "Re: Advaya Care trade partnership" : "",
    body: followups[Math.min(Math.max(step, 1), 3)],
  };
}

export async function callGeminiOutreach(prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  const model = Deno.env.get("GEMINI_MODEL_B2B") || Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  if (!apiKey) return null;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0.25, responseMimeType: "application/json" },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return { subject: normalizeText(parsed?.subject, 180), body: normalizeText(parsed?.body, 3000) };
  } catch {
    return null;
  }
}
