import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
const BLOG_IMAGE_BUCKET = "blog-images";

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

  const anonClient = createClient(supabaseUrl, anonKey);
  const {
    data: anonData,
    error: anonError,
  } = await anonClient.auth.getUser(token);

  if (anonError || !anonData?.user) {
    return {
      user: null,
      error: anonError?.message || serviceError?.message || "Invalid or expired authorization token",
    };
  }

  return { user: anonData.user, error: null };
}

function slugify(value: string) {
  const base = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return base || "blog-image";
}

function extensionForContentType(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("avif")) return "avif";
  if (contentType.includes("gif")) return "gif";
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const imageUrl = String(body.imageUrl || "").trim();
    const title = String(body.title || "").trim();

    if (!imageUrl) {
      return jsonResponse({ error: "imageUrl is required" }, 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(imageUrl);
    } catch {
      return jsonResponse({ error: "Invalid image URL" }, 400);
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return jsonResponse({ error: "Only http and https image URLs are supported" }, 400);
    }

    const sourceResponse = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/webp,image/apng,image/avif,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9"
      },
    });

    if (!sourceResponse.ok) {
      const errorText = await sourceResponse.text().catch(() => "");
      return jsonResponse({ error: `Could not fetch image URL (${sourceResponse.status}): ${errorText.substring(0, 100)}` }, 400);
    }

    const contentType = String(sourceResponse.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      return jsonResponse({ error: "Provided URL is not an image" }, 400);
    }

    const bytes = await sourceResponse.arrayBuffer();
    if (bytes.byteLength === 0) {
      return jsonResponse({ error: "Downloaded image is empty" }, 400);
    }

    if (bytes.byteLength > 12 * 1024 * 1024) {
      return jsonResponse({ error: "Image is too large. Max size is 12MB." }, 400);
    }

    const extension = extensionForContentType(contentType);
    const safeTitle = slugify(title);
    const fileName = `${Date.now()}-${safeTitle}.${extension}`;
    const storagePath = `blog/${new Date().toISOString().slice(0, 10)}/${fileName}`;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error: uploadError } = await supabase.storage
      .from(BLOG_IMAGE_BUCKET)
      .upload(storagePath, bytes, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      return jsonResponse({ error: "Image upload failed", details: uploadError.message }, 500);
    }

    const { data } = supabase.storage.from(BLOG_IMAGE_BUCKET).getPublicUrl(storagePath);

    return jsonResponse({
      success: true,
      storagePath,
      publicUrl: data?.publicUrl || "",
    });
  } catch (error) {
    console.error("admin-blog-upload-image error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
