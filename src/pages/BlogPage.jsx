import React from "react";
import { getPublishedBlogs } from "../lib/blogApi";

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function BlogPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [posts, setPosts] = React.useState([]);

  React.useEffect(() => {
    let active = true;

    async function loadPosts() {
      setLoading(true);
      setError("");

      try {
        const rows = await getPublishedBlogs();
        if (!active) return;
        setPosts(rows);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Could not load blog posts.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPosts().catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-slate-900">Blog</h1>
        <p className="text-sm sm:text-base leading-relaxed text-slate-700 mt-1">
          Insights on ingredients, rituals, and routines crafted for Indian skin and climate.
        </p>
      </div>

      {loading ? <p className="text-sm text-slate-700">Loading posts...</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && !error && posts.length === 0 ? (
        <p className="text-sm text-slate-700">No published posts yet. Check back soon.</p>
      ) : null}

      {!loading && !error && posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-3">
              <div className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-900">{post.title}</h2>
                <p className="text-xs uppercase tracking-wide text-slate-500">{formatDate(post.published_at)}</p>
              </div>

              {post.image_url ? (
                <img
                  src={post.image_url}
                  alt={post.title}
                  className="w-full max-h-96 object-cover rounded-xl border border-slate-200"
                  loading="lazy"
                />
              ) : null}

              {post.short_description ? (
                <p className="text-sm sm:text-base leading-relaxed text-slate-700">{post.short_description}</p>
              ) : null}

              <p className="text-sm sm:text-base leading-relaxed text-slate-800 whitespace-pre-line">{post.content}</p>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default BlogPage;
