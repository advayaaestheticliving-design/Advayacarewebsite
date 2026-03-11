import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
const PRODUCT_IMAGE_BUCKET = "product-images";

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

  return base || "product-image";
}

function extensionForMimeType(mimeType: string) {
  const normalized = String(mimeType || "").toLowerCase();
  if (normalized.includes("png")) return "png";
  if (normalized.includes("webp")) return "webp";
  if (normalized.includes("avif")) return "avif";
  if (normalized.includes("gif")) return "gif";
  return "jpg";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return jsonResponse({ error: "Server configuration error: Supabase credentials missing" }, 500);
  }

  try {
    const { user, error: authError } = await getRequestUser(req, supabaseUrl, supabaseAnonKey);
    if (authError || !user) {
      return jsonResponse({ error: authError || "Unauthorized" }, 401);
    }

    const requesterEmail = String(user.email || "").trim().toLowerCase();
    if (!requesterEmail || requesterEmail !== ADMIN_EMAIL) {
      return jsonResponse({ error: "Forbidden: admin access required" }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(body.title || "").trim();
    const mimeType = String(body.mimeType || "image/jpeg").trim();
    const base64Data = String(body.base64Data || "").trim();

    if (!base64Data) {
      return jsonResponse({ error: "base64Data is required" }, 400);
    }

    const normalizedData = base64Data.includes(",")
      ? base64Data.slice(base64Data.indexOf(",") + 1)
      : base64Data;

    const binaryString = atob(normalizedData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    if (bytes.byteLength === 0) {
      return jsonResponse({ error: "Image file is empty" }, 400);
    }

    if (bytes.byteLength > 12 * 1024 * 1024) {
      return jsonResponse({ error: "Image is too large. Max size is 12MB." }, 400);
    }

    const extension = extensionForMimeType(mimeType);
    const safeTitle = slugify(title);
    const fileName = `${Date.now()}-${safeTitle}.${extension}`;
    const storagePath = `products/${new Date().toISOString().slice(0, 10)}/${fileName}`;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    await supabase.storage.createBucket(PRODUCT_IMAGE_BUCKET, {
      public: true,
      fileSizeLimit: "12MB",
    });

    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadError) {
      return jsonResponse({ error: "Image upload failed", details: uploadError.message }, 500);
    }

    const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(storagePath);

    return jsonResponse({
      success: true,
      storagePath,
      publicUrl: data?.publicUrl || "",
    });
  } catch (error) {
    console.error("admin-product-upload-image error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
