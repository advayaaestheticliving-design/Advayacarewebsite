import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
const ALLOWED_STATUSES = new Set(["pending", "approved", "rejected", "spam"]);
const COMMENT_SELECT = [
  "id",
  "target_type",
  "product_id",
  "display_name",
  "city",
  "headline",
  "body",
  "rating",
  "status",
  "moderation_notes",
  "moderated_by_email",
  "moderated_at",
  "created_at",
  "products(name)",
].join(", ");

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseBearerToken(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return "";
  }
  return authHeader.slice("Bearer ".length).trim();
}

async function getRequestUser(
  req: Request,
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string
) {
  const token = parseBearerToken(req);
  if (!token || token === "undefined" || token === "null") {
    return { user: null, error: "Missing authorization token" };
  }

  const serviceClient = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: serviceData,
    error: serviceError,
  } = await serviceClient.auth.getUser(token);

  if (!serviceError && serviceData?.user) {
    return { user: serviceData.user, error: null };
  }

  if (anonKey) {
    const anonClient = createClient(supabaseUrl, anonKey);
    const {
      data: anonData,
      error: anonError,
    } = await anonClient.auth.getUser(token);

    if (!anonError && anonData?.user) {
      return { user: anonData.user, error: null };
    }

    return {
      user: null,
      error: anonError?.message || serviceError?.message || "Invalid or expired authorization token",
    };
  }

  return {
    user: null,
    error: serviceError?.message || "Invalid or expired authorization token",
  };
}

function escapeSearchTerm(value: string) {
  return String(value || "").replace(/[,%]/g, " ").trim();
}

function mapCommentRow(row: Record<string, unknown>) {
  const productRelation = row?.products as { name?: string } | null;

  return {
    id: row.id,
    target_type: row.target_type,
    product_id: row.product_id,
    display_name: row.display_name,
    city: row.city,
    headline: row.headline,
    body: row.body,
    rating: row.rating,
    status: row.status,
    moderation_notes: row.moderation_notes,
    moderated_by_email: row.moderated_by_email,
    moderated_at: row.moderated_at,
    created_at: row.created_at,
    product_name: productRelation?.name || "",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    return jsonResponse({ error: "Server configuration error: Supabase credentials missing" }, 500);
  }

  const { user, error: authError } = await getRequestUser(
    req,
    supabaseUrl,
    supabaseServiceKey,
    supabaseAnonKey
  );
  if (authError || !user) {
    return jsonResponse({ error: authError || "Unauthorized" }, 401);
  }

  const requesterEmail = String(user.email || "").trim().toLowerCase();
  if (!requesterEmail || requesterEmail !== ADMIN_EMAIL) {
    return jsonResponse({ error: "Forbidden: admin access required" }, 403);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (req.method === "GET") {
    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "all").trim().toLowerCase();
    const targetType = String(url.searchParams.get("targetType") || "all").trim().toLowerCase();
    const search = escapeSearchTerm(url.searchParams.get("search") || "");
    const parsedLimit = Number(url.searchParams.get("limit") || 120);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 300) : 120;

    let query = supabase
      .from("member_comments")
      .select(COMMENT_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (targetType !== "all") {
      query = query.eq("target_type", targetType);
    }

    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,headline.ilike.%${search}%,body.ilike.%${search}%,city.ilike.%${search}%,product_id.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      return jsonResponse({ error: "Failed to fetch comments", details: error.message }, 500);
    }

    return jsonResponse({ comments: Array.isArray(data) ? data.map((row) => mapCommentRow(row as Record<string, unknown>)) : [] });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => ({}));
    const commentId = String(body?.commentId || "").trim();
    const status = String(body?.status || "").trim().toLowerCase();
    const moderationNotes = String(body?.moderationNotes || "").trim();

    if (!commentId || !status) {
      return jsonResponse({ error: "commentId and status are required" }, 400);
    }

    if (!ALLOWED_STATUSES.has(status)) {
      return jsonResponse({ error: "Invalid status value" }, 400);
    }

    const nowIso = new Date().toISOString();
    const payload = {
      status,
      moderation_notes: moderationNotes,
      moderated_by_email: status === "pending" ? null : requesterEmail,
      moderated_at: status === "pending" ? null : nowIso,
      updated_at: nowIso,
    };

    const { data, error } = await supabase
      .from("member_comments")
      .update(payload)
      .eq("id", commentId)
      .select(COMMENT_SELECT)
      .single();

    if (error || !data) {
      return jsonResponse({ error: "Failed to update comment", details: error?.message }, 500);
    }

    return jsonResponse({
      success: true,
      comment: mapCommentRow(data as Record<string, unknown>),
    });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});