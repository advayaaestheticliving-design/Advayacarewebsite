import React from "react";
import { Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import {
  deleteBlogDraft,
  generateBlogContent,
  generateBlogImageSearchTerms,
  generateBlogSeoMetadata,
  generateBlogShortDescription,
  generateBlogTitle,
  listBlogDrafts,
  publishBlog,
  saveBlogDraft,
  uploadBlogImageFromUrl,
} from "../lib/blogAdminApi";
import { useAdminAccess } from "../lib/useAdminAccess";

const FREE_IMAGE_LIBRARIES = [
  { label: "Unsplash", url: "https://unsplash.com" },
  { label: "Pexels", url: "https://www.pexels.com" },
  { label: "Pixabay", url: "https://pixabay.com" },
];

function normalizeCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function BlogWriterPage() {
  const admin = useAdminAccess();
  const [draftId, setDraftId] = React.useState("");
  const [form, setForm] = React.useState({
    title: "",
    contentPlan: "",
    content: "",
    shortDescription: "",
    imageSearchTerms: "",
    imageUrl: "",
    imageStoragePath: "",
    tags: "",
    seoTitle: "",
    seoDescription: "",
  });
  const [loadingAction, setLoadingAction] = React.useState("");
  const [loadingDrafts, setLoadingDrafts] = React.useState(false);
  const [drafts, setDrafts] = React.useState([]);
  const [error, setError] = React.useState("");
  const [status, setStatus] = React.useState("");

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function clearMessages() {
    setError("");
    setStatus("");
  }

  const loadDrafts = React.useCallback(async () => {
    if (!admin.authorized) {
      setDrafts([]);
      return;
    }

    setLoadingDrafts(true);
    try {
      const rows = await listBlogDrafts(40);
      setDrafts(rows);
    } catch (loadError) {
      setError(loadError?.message || "Could not load drafts.");
    } finally {
      setLoadingDrafts(false);
    }
  }, [admin.authorized]);

  React.useEffect(() => {
    if (!admin.checkingAccess && admin.authorized) {
      loadDrafts().catch(() => undefined);
      return;
    }

    if (!admin.authorized) {
      setDrafts([]);
    }
  }, [admin.authorized, admin.checkingAccess, loadDrafts]);

  async function runAction(actionName, action) {
    setLoadingAction(actionName);
    clearMessages();

    try {
      await action();
    } catch (actionError) {
      setError(actionError?.message || "Blog action failed.");
    } finally {
      setLoadingAction("");
    }
  }

  async function handleGenerateTitle() {
    await runAction("generate-title", async () => {
      const generated = await generateBlogTitle(form.contentPlan);
      setField("title", generated.title);
      if (generated.contentPlan) {
        setField("contentPlan", generated.contentPlan);
      }
      setStatus("Generated blog title and content plan.");
    });
  }

  async function handleGenerateSeoAndTags() {
    if (!form.title.trim() && !form.content.trim() && !form.shortDescription.trim()) {
      setError("Add title, content, or short description first.");
      return;
    }

    await runAction("generate-seo-metadata", async () => {
      const generated = await generateBlogSeoMetadata(
        form.title,
        form.content,
        form.shortDescription
      );

      setField("tags", generated.tags);
      setField("seoTitle", generated.seoTitle);
      setField("seoDescription", generated.seoDescription);
      setStatus("Generated tags, SEO title, and SEO description.");
    });
  }

  async function handleGenerateContent() {
    if (!form.title.trim()) {
      setError("Generate or enter a blog title first.");
      return;
    }

    await runAction("generate-content", async () => {
      const content = await generateBlogContent(form.title, form.contentPlan);
      setField("content", content);
      setStatus("Generated blog content from current title and plan.");
    });
  }

  async function handleGenerateDescription() {
    if (!form.content.trim()) {
      setError("Generate or enter blog content first.");
      return;
    }

    await runAction("generate-description", async () => {
      const shortDescription = await generateBlogShortDescription(form.title, form.content);
      setField("shortDescription", shortDescription);
      setStatus("Generated short description.");
    });
  }

  async function handleGenerateImageTerms() {
    if (!form.content.trim()) {
      setError("Generate or enter blog content first.");
      return;
    }

    await runAction("generate-image-terms", async () => {
      const terms = await generateBlogImageSearchTerms(form.title, form.content);
      setField("imageSearchTerms", terms);
      setStatus("Generated image search terms.");
    });
  }

  async function handleUploadImage() {
    if (!form.imageUrl.trim()) {
      setError("Paste a blog image URL before uploading.");
      return;
    }

    await runAction("upload-image", async () => {
      const uploaded = await uploadBlogImageFromUrl(form.imageUrl, form.title);
      setField("imageUrl", uploaded.publicUrl || form.imageUrl);
      setField("imageStoragePath", uploaded.storagePath || "");
      setStatus("Image downloaded to Supabase storage and attached to this blog.");
    });
  }

  async function handleSaveDraft() {
    await runAction("save-draft", async () => {
      const draft = await saveBlogDraft({
        draftId,
        title: form.title,
        contentPlan: form.contentPlan,
        content: form.content,
        shortDescription: form.shortDescription,
        imageUrl: form.imageUrl,
        imageStoragePath: form.imageStoragePath,
        imageSearchTerms: normalizeCsv(form.imageSearchTerms),
        tags: normalizeCsv(form.tags),
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
      });

      setDraftId(String(draft?.id || draftId));
      setStatus("Draft saved.");
      await loadDrafts();
    });
  }

  async function handlePublish() {
    await runAction("publish", async () => {
      const post = await publishBlog({
        draftId,
        title: form.title,
        contentPlan: form.contentPlan,
        content: form.content,
        shortDescription: form.shortDescription,
        imageUrl: form.imageUrl,
        imageStoragePath: form.imageStoragePath,
        imageSearchTerms: normalizeCsv(form.imageSearchTerms),
        tags: normalizeCsv(form.tags),
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
      });

      setDraftId("");
      setForm((prev) => ({ ...prev, title: "", content: "", shortDescription: "" }));
      setStatus(`Published: ${post?.title || "Blog post"}`);
      await loadDrafts();
    });
  }

  function handleSelectDraft(draft) {
    setDraftId(String(draft?.id || ""));
    setForm({
      title: String(draft?.title || ""),
      contentPlan: "",
      content: String(draft?.content || ""),
      shortDescription: String(draft?.short_description || ""),
      imageSearchTerms: Array.isArray(draft?.image_search_terms)
        ? draft.image_search_terms.join(", ")
        : "",
      imageUrl: String(draft?.image_url || ""),
      imageStoragePath: String(draft?.image_storage_path || ""),
      tags: Array.isArray(draft?.tags) ? draft.tags.join(", ") : "",
      seoTitle: String(draft?.seo_title || ""),
      seoDescription: String(draft?.seo_description || ""),
    });
    setStatus("Draft loaded into editor.");
    setError("");
  }

  async function handleDeleteDraft(selectedDraftId) {
    await runAction("delete-draft", async () => {
      await deleteBlogDraft(selectedDraftId);

      if (String(selectedDraftId) === String(draftId)) {
        setDraftId("");
      }

      setStatus("Draft deleted.");
      await loadDrafts();
    });
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">Blog Writer</h1>
        <p className="text-sm text-white/80 mt-1">
          Generate, refine, and publish Supabase-backed blog posts.
        </p>
      </div>

      {admin.checkingAccess ? (
        <p className="text-sm text-white/80">Checking admin access...</p>
      ) : !admin.authorized ? (
        <Navigate to="/admin" replace />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <AdminSidebar onSignOut={admin.logout} authLoading={admin.authLoading} />

          <div className="space-y-5">
            <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleGenerateTitle}
                disabled={loadingAction === "generate-title"}
                className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e3c458] disabled:opacity-60"
              >
                {loadingAction === "generate-title" ? "Generating..." : "Generate Blog Title"}
              </button>

              <button
                type="button"
                onClick={handleGenerateContent}
                disabled={loadingAction === "generate-content"}
                className="rounded-full border border-neutral-500 px-4 py-2 text-sm font-semibold text-white hover:border-[#D4AF37] disabled:opacity-60"
              >
                {loadingAction === "generate-content" ? "Generating..." : "Generate Blog Content"}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Generate Blog Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(event) => setField("title", event.target.value)}
                className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Blog title"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Content Plan</label>
              <textarea
                rows={4}
                value={form.contentPlan}
                onChange={(event) => setField("contentPlan", event.target.value)}
                className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Outline, points, tone, and audience for this blog"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Generate Blog Content</label>
              <textarea
                rows={12}
                value={form.content}
                onChange={(event) => setField("content", event.target.value)}
                className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Generated or edited full blog content"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleGenerateDescription}
                disabled={loadingAction === "generate-description"}
                className="rounded-full border border-neutral-500 px-4 py-2 text-sm font-semibold text-white hover:border-[#D4AF37] disabled:opacity-60"
              >
                {loadingAction === "generate-description" ? "Generating..." : "Generate Short Description"}
              </button>

              <button
                type="button"
                onClick={handleGenerateImageTerms}
                disabled={loadingAction === "generate-image-terms"}
                className="rounded-full border border-neutral-500 px-4 py-2 text-sm font-semibold text-white hover:border-[#D4AF37] disabled:opacity-60"
              >
                {loadingAction === "generate-image-terms" ? "Generating..." : "Generate Image Search Terms"}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Generate Short Description</label>
              <textarea
                rows={3}
                value={form.shortDescription}
                onChange={(event) => setField("shortDescription", event.target.value)}
                className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="One short description for listings and previews"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Generate Image Search Terms</label>
              <input
                type="text"
                value={form.imageSearchTerms}
                onChange={(event) => setField("imageSearchTerms", event.target.value)}
                className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="e.g. herbal skincare, glowing skin, natural oils"
              />
              <div className="flex flex-wrap gap-2">
                {FREE_IMAGE_LIBRARIES.map((library) => (
                  <a
                    key={library.label}
                    href={library.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-neutral-600 px-3 py-1 text-xs text-white hover:border-[#D4AF37]"
                  >
                    {library.label}
                  </a>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">Blog Image URL</label>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(event) => setField("imageUrl", event.target.value)}
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="Paste image URL from a free library"
                />
                <button
                  type="button"
                  onClick={handleUploadImage}
                  disabled={loadingAction === "upload-image"}
                  className="rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-black hover:bg-[#e3c458] disabled:opacity-60"
                >
                  {loadingAction === "upload-image" ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/70">Tags</label>
                <input
                  type="text"
                  value={form.tags}
                  onChange={(event) => setField("tags", event.target.value)}
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="Comma separated tags"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-white/70">SEO Title</label>
                <input
                  type="text"
                  value={form.seoTitle}
                  onChange={(event) => setField("seoTitle", event.target.value)}
                  className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                  placeholder="Optional SEO title"
                />
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={handleGenerateSeoAndTags}
                disabled={loadingAction === "generate-seo-metadata"}
                className="rounded-full border border-neutral-500 px-4 py-2 text-sm font-semibold text-white hover:border-[#D4AF37] disabled:opacity-60"
              >
                {loadingAction === "generate-seo-metadata"
                  ? "Generating..."
                  : "Generate Tags + SEO Fields"}
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-white/70">SEO Description</label>
              <textarea
                rows={3}
                value={form.seoDescription}
                onChange={(event) => setField("seoDescription", event.target.value)}
                className="w-full rounded-xl border border-neutral-600 bg-black px-4 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Optional SEO description"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={loadingAction === "save-draft"}
                className="rounded-full border border-neutral-500 px-5 py-2 text-sm font-semibold text-white hover:border-[#D4AF37] disabled:opacity-60"
              >
                {loadingAction === "save-draft" ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="button"
                onClick={handlePublish}
                disabled={loadingAction === "publish"}
                className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black hover:bg-[#e3c458] disabled:opacity-60"
              >
                {loadingAction === "publish" ? "Publishing..." : "Publish"}
              </button>
            </div>

            {draftId ? <p className="text-xs text-white/60">Current Draft ID: {draftId}</p> : null}
            {status ? <p className="text-sm text-emerald-300">{status}</p> : null}
            {error || admin.error ? <p className="text-sm text-red-400">{error || admin.error}</p> : null}
            </section>

            <section className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">Saved Drafts</h2>
                <button
                  type="button"
                  onClick={() => loadDrafts()}
                  className="rounded-full border border-neutral-600 px-3 py-1 text-xs text-white hover:border-[#D4AF37]"
                >
                  Refresh
                </button>
              </div>

              {loadingDrafts ? <p className="text-sm text-white/70">Loading drafts...</p> : null}

              {!loadingDrafts && drafts.length === 0 ? (
                <p className="text-sm text-white/70">No drafts yet.</p>
              ) : null}

              {!loadingDrafts && drafts.length > 0 ? (
                <div className="space-y-3">
                  {drafts.map((draft) => {
                    const isSelected = String(draft.id) === String(draftId);

                    return (
                      <div
                        key={draft.id}
                        className={`rounded-xl border px-4 py-3 ${
                          isSelected ? "border-[#D4AF37] bg-black/80" : "border-neutral-700 bg-black/60"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-white">{draft.title || "Untitled draft"}</p>
                            <p className="text-xs text-white/60">
                              Updated {new Date(draft.updated_at || draft.created_at || Date.now()).toLocaleString("en-IN")}
                            </p>
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectDraft(draft)}
                              className="rounded-full border border-neutral-500 px-3 py-1 text-xs text-white hover:border-[#D4AF37]"
                            >
                              Load
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDraft(draft.id)}
                              disabled={loadingAction === "delete-draft"}
                              className="rounded-full border border-red-500 px-3 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

export default BlogWriterPage;
