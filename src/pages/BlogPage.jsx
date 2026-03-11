import React from "react";
import { Link } from "react-router-dom";
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

function getPreviewText(post) {
  const shortDescription = String(post?.short_description || "").trim();
  if (shortDescription) {
    return shortDescription;
  }

  const normalizedContent = String(post?.content || "").replace(/\s+/g, " ").trim();
  if (!normalizedContent) {
    return "Read the full article for practical skincare guidance and routines.";
  }

  if (normalizedContent.length <= 190) {
    return normalizedContent;
  }

  return `${normalizedContent.slice(0, 187)}...`;
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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8 animate-fade-in">
      <header className="max-w-3xl space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-white/70">Advaya Journal</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#D4AF37]">Skincare Stories And Ritual Wisdom</h1>
        <p className="text-sm sm:text-base leading-relaxed text-white/80">
          Explore ingredient insights, practical routines, and mindful care rituals made for Indian skin and climate.
        </p>
      </header>

      {loading ? <p className="text-sm text-white/80">Loading posts...</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      {!loading && !error && posts.length === 0 ? (
        <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-3">
          <h2 className="text-xl font-semibold text-[#D4AF37]">No published posts yet</h2>
          <p className="text-sm sm:text-base text-white/80">Fresh articles are on the way. Check back soon for new skincare stories.</p>
        </section>
      ) : null}

      {!loading && !error && posts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
          {posts.map((post) => {
            const slug = String(post?.slug || "").trim();
            const cardContent = (
              <>
                {post.image_url ? (
                  <div className="overflow-hidden rounded-xl border border-neutral-700">
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="h-52 w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">{formatDate(post.published_at)}</p>
                  <h2 className="text-xl sm:text-2xl font-semibold leading-tight text-[#D4AF37] group-hover:text-[#e3c458] transition">
                    {post.title}
                  </h2>
                  <p className="text-sm sm:text-base leading-relaxed text-white/80">{getPreviewText(post)}</p>
                </div>

                <span className="inline-flex items-center rounded-full border border-[#D4AF37]/70 px-4 py-2 text-xs sm:text-sm font-medium tracking-wide text-[#D4AF37] transition group-hover:bg-[#D4AF37] group-hover:text-black">
                  Read Full Article
                </span>
              </>
            );

            if (slug) {
              return (
                <Link
                  key={post.id}
                  to={`/blog/${encodeURIComponent(slug)}`}
                  aria-label={`Read article: ${post.title}`}
                  className="group block cursor-pointer rounded-2xl border border-neutral-700 bg-black/50 p-4 sm:p-5 space-y-4 transform-gpu transition duration-300 hover:-translate-y-1 hover:border-[#D4AF37] hover:bg-black/70 hover:shadow-[0_14px_35px_rgba(212,175,55,0.22)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  {cardContent}
                </Link>
              );
            }

            return (
              <article
                key={post.id}
                className="rounded-2xl border border-neutral-700 bg-black/50 p-4 sm:p-5 space-y-4"
              >
                {post.image_url ? (
                  <div className="overflow-hidden rounded-xl border border-neutral-700">
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="h-52 w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">{formatDate(post.published_at)}</p>
                  <h2 className="text-xl sm:text-2xl font-semibold leading-tight text-[#D4AF37]">{post.title}</h2>
                  <p className="text-sm sm:text-base leading-relaxed text-white/80">{getPreviewText(post)}</p>
                </div>

                <p className="text-xs uppercase tracking-[0.2em] text-white/50">Article link unavailable</p>
              </article>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default BlogPage;
