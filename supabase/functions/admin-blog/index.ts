import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "advaya.aestheticliving@gmail.com";
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL_BLOG") || Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";

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

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authClients = [serviceKey, anonKey]
    .map((key) => String(key || "").trim())
    .filter(Boolean)
    .map((key) => createClient(supabaseUrl, key));

  for (const authClient of authClients) {
    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(token);

    if (!error && user) {
      return { user, error: null };
    }
  }

  return { user: null, error: "Invalid or expired authorization token" };
}

function normalizeCsvArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function slugify(value: unknown) {
  const base = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return base || `post-${Date.now()}`;
}

function normalizeBlogPayload(body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  const shortDescription = String(body.shortDescription || "").trim();
  const content = String(body.content || "").trim();
  const imageUrl = String(body.imageUrl || "").trim();
  const imageStoragePath = String(body.imageStoragePath || "").trim();
  const seoTitle = String(body.seoTitle || "").trim();
  const seoDescription = String(body.seoDescription || "").trim();
  const slug = slugify(body.slug || title);

  return {
    title,
    slug,
    short_description: shortDescription,
    content,
    image_url: imageUrl,
    image_storage_path: imageStoragePath,
    image_search_terms: normalizeCsvArray(body.imageSearchTerms),
    tags: normalizeCsvArray(body.tags),
    seo_title: seoTitle,
    seo_description: seoDescription,
  };
}

function normalizeBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }

  return normalized === "true" || normalized === "1" || normalized === "yes";
}

async function callGeminiJson(prompt: string) {
  const apiKey = Deno.env.get("GEMINI_API_KEY") || "";
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.35,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`AI generation request failed (${response.status})`);
  }

  const payload = await response.json().catch(() => null);
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || typeof text !== "string") {
    throw new Error("AI did not return valid output");
  }

  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error("AI output parsing failed");
    }
    return JSON.parse(match[0]);
  }
}

async function ensureUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  slug: string,
  currentPostId?: string
) {
  const candidate = String(slug || "").trim();
  if (!candidate) {
    return slugify("post");
  }

  const { data: existing } = await supabase
    .from("blog_posts")
    .select("id")
    .eq("slug", candidate)
    .maybeSingle();

  if (!existing || String(existing.id || "") === String(currentPostId || "")) {
    return candidate;
  }

  return `${candidate}-${Date.now().toString().slice(-6)}`;
}

async function listPosts(
  supabase: ReturnType<typeof createClient>,
  {
    includeArchived,
    limit,
  }: {
    includeArchived: boolean;
    limit: number;
  }
) {
  let query = supabase
    .from("blog_posts")
    .select("*")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (!includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;

  if (error) {
    return { posts: null, error };
  }

  return { posts: Array.isArray(data) ? data : [], error: null };
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
    const action = String(body.action || "").trim().toLowerCase();

    if (!action) {
      return jsonResponse({ error: "Action is required" }, 400);
    }

    if (action === "generate_title") {
      const contentPlan = String(body.contentPlan || "").trim();
      const generated = await callGeminiJson(
        [
          "Generate one strong skincare blog title and a concise content plan for Indian audiences.",
          "Return JSON only: {\"title\":\"...\",\"contentPlan\":\"...\"}",
          "The contentPlan should be a practical outline with key points, written as plain text.",
          `Existing content plan (if any): ${contentPlan || "None"}`,
        ].join("\n")
      );

      const generatedTitle = String(generated?.title || "").trim();
      const generatedPlan = String(generated?.contentPlan || generated?.content_plan || "").trim();
      return jsonResponse({ title: generatedTitle, contentPlan: generatedPlan });
    }

    if (action === "generate_metadata") {
      const title = String(body.title || "").trim();
      const content = String(body.content || "").trim();
      const shortDescription = String(body.shortDescription || "").trim();

      if (!title && !content && !shortDescription) {
        return jsonResponse({ error: "Provide title, content, or short description to generate metadata" }, 400);
      }

      const generated = await callGeminiJson(
        [
          "Generate SEO metadata for a skincare blog post.",
          "Return JSON only: {\"tags\":[\"tag1\",\"tag2\"],\"seoTitle\":\"...\",\"seoDescription\":\"...\"}",
          "Rules:",
          "- tags: 5 to 8 concise tags, lowercase, no hashtags",
          "- seoTitle: under 60 characters",
          "- seoDescription: under 160 characters",
          `Title: ${title}`,
          `Short description: ${shortDescription}`,
          `Content: ${content}`,
        ].join("\n")
      );

      const tags = Array.isArray(generated?.tags)
        ? generated.tags.map((item: unknown) => String(item || "").trim()).filter(Boolean)
        : [];

      return jsonResponse({
        tags,
        seoTitle: String(generated?.seoTitle || generated?.seo_title || "").trim(),
        seoDescription: String(generated?.seoDescription || generated?.seo_description || "").trim(),
      });
    }

    if (action === "generate_content") {
      const title = String(body.title || "").trim();
      const contentPlan = String(body.contentPlan || "").trim();

      if (!title) {
        return jsonResponse({ error: "Title is required to generate content" }, 400);
      }

      const generated = await callGeminiJson(
        [
          "Write a detailed skincare blog post.",
          "Audience: Indian skincare consumers.",
          "Use practical structure with headings and concise paragraphs.",
          "Return JSON only: {\"content\":\"...\"}",
          `Title: ${title}`,
          `Plan: ${contentPlan || "No explicit plan provided. Create a helpful educational flow."}`,
        ].join("\n")
      );

      return jsonResponse({ content: String(generated?.content || "").trim() });
    }

    if (action === "generate_description") {
      const title = String(body.title || "").trim();
      const content = String(body.content || "").trim();

      if (!content) {
        return jsonResponse({ error: "Content is required to generate short description" }, 400);
      }

      const generated = await callGeminiJson(
        [
          "Generate a concise short description for a skincare blog.",
          "Return JSON only: {\"shortDescription\":\"...\"}",
          `Title: ${title}`,
          `Content: ${content}`,
        ].join("\n")
      );

      return jsonResponse({ shortDescription: String(generated?.shortDescription || "").trim() });
    }

    if (action === "generate_image_terms") {
      const title = String(body.title || "").trim();
      const content = String(body.content || "").trim();

      if (!content) {
        return jsonResponse({ error: "Content is required to generate image search terms" }, 400);
      }

      const generated = await callGeminiJson(
        [
          "Generate image library search terms for a skincare blog post.",
          "Return JSON only: {\"terms\":[\"term 1\",\"term 2\"]}",
          "Provide 6 to 10 short, searchable phrase terms.",
          `Title: ${title}`,
          `Content: ${content}`,
        ].join("\n")
      );

      const terms = Array.isArray(generated?.terms)
        ? generated.terms.map((item: unknown) => String(item || "").trim()).filter(Boolean)
        : [];

      return jsonResponse({ terms });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (action === "save_draft") {
      const draftId = String(body.draftId || "").trim();
      const draftPayload = normalizeBlogPayload(body);

      if (draftId) {
        const { data, error } = await supabase
          .from("blog_drafts")
          .update(draftPayload)
          .eq("id", draftId)
          .select("*")
          .single();

        if (error || !data) {
          return jsonResponse({ error: "Could not update draft", details: error?.message }, 500);
        }

        return jsonResponse({ success: true, draft: data });
      }

      const { data, error } = await supabase.from("blog_drafts").insert(draftPayload).select("*").single();

      if (error || !data) {
        return jsonResponse({ error: "Could not save draft", details: error?.message }, 500);
      }

      return jsonResponse({ success: true, draft: data });
    }

    if (action === "list_drafts") {
      const parsedLimit = Number(body.limit || 20);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 100) : 20;

      const { data, error } = await supabase
        .from("blog_drafts")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(limit);

      if (error) {
        return jsonResponse({ error: "Could not load drafts", details: error.message }, 500);
      }

      return jsonResponse({ drafts: Array.isArray(data) ? data : [] });
    }

    if (action === "list_posts") {
      const parsedLimit = Number(body.limit || 40);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 200) : 40;
      const includeArchived = normalizeBoolean(body.includeArchived, true);

      const { posts, error } = await listPosts(supabase, { includeArchived, limit });
      if (error) {
        return jsonResponse({ error: "Could not load posts", details: error.message }, 500);
      }

      return jsonResponse({ posts });
    }

    if (action === "delete_draft") {
      const draftId = String(body.draftId || "").trim();
      if (!draftId) {
        return jsonResponse({ error: "draftId is required" }, 400);
      }

      const { error } = await supabase.from("blog_drafts").delete().eq("id", draftId);
      if (error) {
        return jsonResponse({ error: "Could not delete draft", details: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    if (action === "publish") {
      const draftId = String(body.draftId || "").trim();
      const postPayload = normalizeBlogPayload(body);

      if (!postPayload.title) {
        return jsonResponse({ error: "Title is required to publish" }, 400);
      }

      if (!postPayload.content) {
        return jsonResponse({ error: "Content is required to publish" }, 400);
      }

      const uniqueSlug = await ensureUniqueSlug(supabase, postPayload.slug);

      const { data: post, error: publishError } = await supabase
        .from("blog_posts")
        .insert({
          ...postPayload,
          slug: uniqueSlug,
          published_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (publishError || !post) {
        return jsonResponse({ error: "Could not publish post", details: publishError?.message }, 500);
      }

      if (draftId) {
        await supabase.from("blog_drafts").delete().eq("id", draftId);
      }

      return jsonResponse({ success: true, post });
    }

    if (action === "update_post") {
      const postId = String(body.postId || "").trim();
      if (!postId) {
        return jsonResponse({ error: "postId is required" }, 400);
      }

      const postPayload = normalizeBlogPayload(body);
      if (!postPayload.title) {
        return jsonResponse({ error: "Title is required to update a post" }, 400);
      }

      if (!postPayload.content) {
        return jsonResponse({ error: "Content is required to update a post" }, 400);
      }

      const uniqueSlug = await ensureUniqueSlug(supabase, postPayload.slug, postId);
      const { data, error } = await supabase
        .from("blog_posts")
        .update({
          ...postPayload,
          slug: uniqueSlug,
        })
        .eq("id", postId)
        .select("*")
        .single();

      if (error || !data) {
        return jsonResponse({ error: "Could not update post", details: error?.message }, 500);
      }

      return jsonResponse({ success: true, post: data });
    }

    if (action === "archive_post") {
      const postId = String(body.postId || "").trim();
      if (!postId) {
        return jsonResponse({ error: "postId is required" }, 400);
      }

      const { data, error } = await supabase
        .from("blog_posts")
        .update({
          is_archived: true,
          archived_at: new Date().toISOString(),
        })
        .eq("id", postId)
        .select("*")
        .single();

      if (error || !data) {
        return jsonResponse({ error: "Could not archive post", details: error?.message }, 500);
      }

      return jsonResponse({ success: true, post: data });
    }

    if (action === "restore_post") {
      const postId = String(body.postId || "").trim();
      if (!postId) {
        return jsonResponse({ error: "postId is required" }, 400);
      }

      const { data, error } = await supabase
        .from("blog_posts")
        .update({
          is_archived: false,
          archived_at: null,
        })
        .eq("id", postId)
        .select("*")
        .single();

      if (error || !data) {
        return jsonResponse({ error: "Could not restore post", details: error?.message }, 500);
      }

      return jsonResponse({ success: true, post: data });
    }

    if (action === "delete_post") {
      const postId = String(body.postId || "").trim();
      if (!postId) {
        return jsonResponse({ error: "postId is required" }, 400);
      }

      const { error } = await supabase.from("blog_posts").delete().eq("id", postId);
      if (error) {
        return jsonResponse({ error: "Could not delete post", details: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("admin-blog error", error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Internal server error" }, 500);
  }
});
