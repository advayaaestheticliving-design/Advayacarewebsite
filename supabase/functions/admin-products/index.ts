import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
const PRODUCT_COLUMNS = [
  "id",
  "name",
  "price_inr",
  "filter_tags",
  "images",
  "one_line_summary",
  "ingredients",
  "benefits_brief",
  "benefits_detail",
  "use_cases",
  "stock_quantity",
  "reserved_quantity",
  "low_stock_threshold",
  "is_active",
  "created_at",
  "updated_at",
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

async function getRequestUser(req: Request, supabaseUrl: string, anonKey: string) {
  const token = parseBearerToken(req);
  if (!token) {
    return { user: null, error: "Missing authorization token" };
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    return { user: null, error: "Invalid or expired authorization token" };
  }

  return { user, error: null };
}

function slugify(value: string) {
  const base = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return base || `product-${Date.now()}`;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInteger(value: unknown, fallback = 0) {
  const parsed = Math.floor(toNumber(value, fallback));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: "Server configuration error: Supabase credentials missing" }, 500);
  }

  const { user, error: authError } = await getRequestUser(req, supabaseUrl, supabaseAnonKey);
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
    const parsedLimit = Number(url.searchParams.get("limit") || 200);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 500) : 200;
    const includeInactive = url.searchParams.get("includeInactive") !== "false";

    const query = supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .order("name", { ascending: true })
      .limit(limit);

    if (!includeInactive) {
      query.eq("is_active", true);
    }

    const { data, error } = await query;

    if (error) {
      return jsonResponse({ error: "Failed to fetch products", details: error.message }, 500);
    }

    return jsonResponse({ products: Array.isArray(data) ? data : [] });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const action = String(body.action || "").trim().toLowerCase();

  if (action === "upsert") {
    const rawName = String(body.name || "").trim();
    if (!rawName) {
      return jsonResponse({ error: "Product name is required" }, 400);
    }

    const productId = slugify(String(body.id || rawName));
    const priceInr = Math.max(0, toNumber(body.price_inr, 0));
    const stockQuantity = Math.max(0, toInteger(body.stock_quantity, 0));
    const lowStockThreshold = Math.max(0, toInteger(body.low_stock_threshold, 5));
    const nextActiveState = body.is_active !== false;

    const { data: existingProduct } = await supabase
      .from("products")
      .select("id, stock_quantity, reserved_quantity")
      .eq("id", productId)
      .maybeSingle();

    const reservedQuantity = Math.max(0, toInteger(existingProduct?.reserved_quantity, 0));
    const nextStockQuantity = Math.max(stockQuantity, reservedQuantity);

    const payload = {
      id: productId,
      name: rawName,
      price_inr: priceInr,
      filter_tags: parseStringArray(body.filter_tags),
      images: parseStringArray(body.images),
      one_line_summary: String(body.one_line_summary || ""),
      ingredients: String(body.ingredients || ""),
      benefits_brief: String(body.benefits_brief || ""),
      benefits_detail: String(body.benefits_detail || ""),
      use_cases: String(body.use_cases || ""),
      stock_quantity: nextStockQuantity,
      low_stock_threshold: lowStockThreshold,
      is_active: nextActiveState,
      updated_at: new Date().toISOString(),
    };

    const { data: savedProduct, error: saveError } = await supabase
      .from("products")
      .upsert(payload, { onConflict: "id" })
      .select(PRODUCT_COLUMNS)
      .single();

    if (saveError || !savedProduct) {
      return jsonResponse({ error: "Failed to save product", details: saveError?.message }, 500);
    }

    const previousStock = Math.max(0, toInteger(existingProduct?.stock_quantity, nextStockQuantity));
    if (previousStock !== nextStockQuantity) {
      await supabase.from("product_stock_events").insert({
        product_id: productId,
        event_type: nextStockQuantity > previousStock ? "restock" : "adjustment",
        quantity_change: nextStockQuantity - previousStock,
        quantity_before: previousStock,
        quantity_after: nextStockQuantity,
        notes: "Admin upsert",
        actor_email: requesterEmail,
        metadata: { source: "admin-products", action: "upsert" },
      });
    }

    return jsonResponse({ success: true, product: savedProduct });
  }

  if (action === "adjust_stock") {
    const productId = String(body.productId || body.id || "").trim();
    const nextStockQuantity = Math.max(0, toInteger(body.stock_quantity, -1));
    const notes = String(body.notes || "").trim() || "Manual stock adjustment";

    if (!productId || nextStockQuantity < 0) {
      return jsonResponse({ error: "productId and stock_quantity are required" }, 400);
    }

    const { data: currentProduct, error: currentError } = await supabase
      .from("products")
      .select("id, stock_quantity, reserved_quantity")
      .eq("id", productId)
      .single();

    if (currentError || !currentProduct) {
      return jsonResponse({ error: "Product not found", details: currentError?.message }, 404);
    }

    const reservedQuantity = Math.max(0, toInteger(currentProduct.reserved_quantity, 0));
    if (nextStockQuantity < reservedQuantity) {
      return jsonResponse({
        error: `Stock cannot be below reserved quantity (${reservedQuantity})`,
      }, 400);
    }

    const previousStock = Math.max(0, toInteger(currentProduct.stock_quantity, 0));

    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({
        stock_quantity: nextStockQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .select(PRODUCT_COLUMNS)
      .single();

    if (updateError || !updatedProduct) {
      return jsonResponse({ error: "Failed to update stock", details: updateError?.message }, 500);
    }

    await supabase.from("product_stock_events").insert({
      product_id: productId,
      event_type: nextStockQuantity > previousStock ? "restock" : "adjustment",
      quantity_change: nextStockQuantity - previousStock,
      quantity_before: previousStock,
      quantity_after: nextStockQuantity,
      notes,
      actor_email: requesterEmail,
      metadata: { source: "admin-products", action: "adjust_stock" },
    });

    return jsonResponse({ success: true, product: updatedProduct });
  }

  if (action === "set_active") {
    const productId = String(body.productId || body.id || "").trim();
    if (!productId) {
      return jsonResponse({ error: "productId is required" }, 400);
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from("products")
      .update({
        is_active: body.is_active !== false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", productId)
      .select(PRODUCT_COLUMNS)
      .single();

    if (updateError || !updatedProduct) {
      return jsonResponse({ error: "Failed to update product active state", details: updateError?.message }, 500);
    }

    return jsonResponse({ success: true, product: updatedProduct });
  }

  return jsonResponse({ error: "Unsupported action" }, 400);
});
