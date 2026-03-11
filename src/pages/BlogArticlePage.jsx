import React from "react";
import { Link, useParams } from "react-router-dom";
import { getPublishedBlogBySlug } from "../lib/blogApi";

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

function BlogArticlePage() {
  const { slug } = useParams();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [post, setPost] = React.useState(null);

  React.useEffect(() => {
    let active = true;

    async function loadPost() {
      setLoading(true);
      setError("");

      try {
        const row = await getPublishedBlogBySlug(slug);
        if (!active) return;
        setPost(row || null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError?.message || "Could not load this blog article.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadPost().catch(() => undefined);

    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs sm:text-sm uppercase tracking-[0.2em] text-white/70">Journal</p>
        <Link
          to="/blog"
          className="inline-flex items-center rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37] hover:text-[#D4AF37] transition"
        >
          Back to Blog
        </Link>
      </div>

      {loading ? <p className="text-sm text-white/80">Loading article...</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {!loading && !error && !post ? (
        <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-3">
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#D4AF37]">Article not found</h1>
          <p className="text-sm sm:text-base text-white/80 leading-relaxed">
            The article you are looking for is unavailable or has been moved.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-medium text-black hover:bg-[#e3c458] transition"
          >
            Explore all articles
          </Link>
        </section>
      ) : null}

      {!loading && !error && post ? (
        <article className="rounded-2xl border border-neutral-700 bg-black/55 p-5 sm:p-7 space-y-5">
          <header className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">{formatDate(post.published_at)}</p>
            <h1 className="text-2xl sm:text-4xl font-semibold leading-tight text-[#D4AF37]">{post.title}</h1>
            {post.short_description ? (
              <p className="text-sm sm:text-base leading-relaxed text-white/80">{post.short_description}</p>
            ) : null}
          </header>

          {post.image_url ? (
            <img
              src={post.image_url}
              alt={post.title}
              className="w-full max-h-[30rem] rounded-2xl border border-neutral-700 object-cover"
              loading="lazy"
            />
          ) : null}

          <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">Full Article</h2>
            <p className="text-sm sm:text-base leading-relaxed text-white whitespace-pre-line">{post.content}</p>
          </div>
        </article>
      ) : null}
    </div>
  );
}

export default BlogArticlePage;
