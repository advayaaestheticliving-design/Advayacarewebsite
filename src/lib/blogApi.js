import { supabase, isSupabaseConfigured } from "./supabaseClient";

const POST_SELECT =
  "id, title, slug, short_description, content, image_url, tags, seo_title, seo_description, published_at, created_at";

export async function getPublishedBlogs(limit = 30) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("is_archived", false)
    .order("published_at", { ascending: false })
    .limit(Math.min(Math.max(Number(limit) || 30, 1), 100));

  if (error) {
    throw error;
  }

  return Array.isArray(data) ? data : [];
}

export async function getPublishedBlogBySlug(slug) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }

  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) {
    return null;
  }

  const { data, error } = await supabase
    .from("blog_posts")
    .select(POST_SELECT)
    .eq("is_archived", false)
    .eq("slug", normalizedSlug)
    .single();

  if (error) {
    throw error;
  }

  return data || null;
}
