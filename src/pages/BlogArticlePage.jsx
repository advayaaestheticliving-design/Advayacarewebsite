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

const ALLOWED_HTML_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
]);

const TAG_ATTRIBUTE_ALLOWLIST = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "title"]),
};

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ""));
}

function isSafeUrl(value) {
  return /^(https?:|mailto:|tel:|\/|#)/i.test(String(value || "").trim());
}

function sanitizeArticleHtml(value) {
  const rawHtml = String(value || "").trim();
  if (!rawHtml || typeof DOMParser === "undefined") {
    return "";
  }

  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  const elements = Array.from(doc.body.querySelectorAll("*"));

  elements.forEach((element) => {
    const tag = element.tagName.toLowerCase();
    if (!ALLOWED_HTML_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes));
      return;
    }

    const allowedAttributes = TAG_ATTRIBUTE_ALLOWLIST[tag] || new Set();
    Array.from(element.attributes).forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      if (!allowedAttributes.has(attributeName)) {
        element.removeAttribute(attribute.name);
      }
    });

    if (tag === "a") {
      const href = element.getAttribute("href");
      if (!href || !isSafeUrl(href)) {
        element.removeAttribute("href");
      }

      const target = element.getAttribute("target");
      if (target && target !== "_blank") {
        element.removeAttribute("target");
      }
      if (target === "_blank") {
        element.setAttribute("rel", "noopener noreferrer");
      }
    }

    if (tag === "img") {
      const src = element.getAttribute("src");
      if (!src || !isSafeUrl(src)) {
        element.remove();
      }
    }
  });

  return doc.body.innerHTML;
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

  const rawContent = String(post?.content || "");
  const shouldRenderHtml = looksLikeHtml(rawContent);
  const safeHtmlContent = React.useMemo(
    () => (shouldRenderHtml ? sanitizeArticleHtml(rawContent) : ""),
    [rawContent, shouldRenderHtml]
  );

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
            {shouldRenderHtml ? (
              <div
                className="text-sm sm:text-base leading-relaxed text-white/95 space-y-3 [&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:text-[#D4AF37] [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-[#D4AF37] [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-[#D4AF37] [&_p]:mt-3 [&_a]:text-[#D4AF37] [&_a]:underline [&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#D4AF37]/70 [&_blockquote]:pl-4 [&_blockquote]:text-white/80 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1 [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-neutral-700 [&_pre]:bg-black/70 [&_pre]:p-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_img]:mt-4 [&_img]:max-h-[28rem] [&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-neutral-700 [&_img]:object-cover [&_hr]:mt-6 [&_hr]:border-neutral-700"
                dangerouslySetInnerHTML={{ __html: safeHtmlContent }}
              />
            ) : (
              <p className="text-sm sm:text-base leading-relaxed text-white whitespace-pre-line">{rawContent}</p>
            )}
          </div>
        </article>
      ) : null}
    </div>
  );
}

export default BlogArticlePage;
