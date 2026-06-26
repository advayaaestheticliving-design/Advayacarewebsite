import React from "react";
import { Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import {
  archivePublishedBlog,
  deleteBlogDraft,
  deletePublishedBlog,
  listBlogDrafts,
  listBlogPosts,
  publishBlog,
  restorePublishedBlog,
  saveBlogDraft,
  updatePublishedBlog,
  uploadBlogImageFromUrl,
} from "../lib/blogAdminApi";
import { useAdminAccess } from "../lib/useAdminAccess";

const EMPTY_FORM = {
  id: "",
  entityType: "draft",
  title: "",
  slug: "",
  content: "",
  shortDescription: "",
  imageSearchTerms: "",
  imageUrl: "",
  imageStoragePath: "",
  tags: "",
  seoTitle: "",
  seoDescription: "",
  isArchived: false,
  createdAt: "",
  updatedAt: "",
  publishedAt: "",
};

const STATUS_OPTIONS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
];

const TAG_ATTRIBUTE_ALLOWLIST = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "title"]),
};

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

function normalizeCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toCommaList(value) {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item || "").trim()).filter(Boolean).join(", ");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFormSnapshot(form) {
  return JSON.stringify({
    id: String(form?.id || ""),
    entityType: String(form?.entityType || "draft"),
    title: String(form?.title || ""),
    slug: String(form?.slug || ""),
    content: String(form?.content || ""),
    shortDescription: String(form?.shortDescription || ""),
    imageSearchTerms: String(form?.imageSearchTerms || ""),
    imageUrl: String(form?.imageUrl || ""),
    imageStoragePath: String(form?.imageStoragePath || ""),
    tags: String(form?.tags || ""),
    seoTitle: String(form?.seoTitle || ""),
    seoDescription: String(form?.seoDescription || ""),
  });
}

function formatBlogForForm(item, entityType) {
  return {
    id: String(item?.id || ""),
    entityType,
    title: String(item?.title || ""),
    slug: String(item?.slug || ""),
    content: String(item?.content || ""),
    shortDescription: String(item?.short_description || ""),
    imageSearchTerms: toCommaList(item?.image_search_terms),
    imageUrl: String(item?.image_url || ""),
    imageStoragePath: String(item?.image_storage_path || ""),
    tags: toCommaList(item?.tags),
    seoTitle: String(item?.seo_title || ""),
    seoDescription: String(item?.seo_description || ""),
    isArchived: item?.is_archived === true,
    createdAt: String(item?.created_at || ""),
    updatedAt: String(item?.updated_at || ""),
    publishedAt: String(item?.published_at || ""),
  };
}

function buildDraftPayload(form) {
  return {
    draftId: form.id,
    title: form.title,
    slug: form.slug,
    content: form.content,
    shortDescription: form.shortDescription,
    imageUrl: form.imageUrl,
    imageStoragePath: form.imageStoragePath,
    imageSearchTerms: normalizeCsv(form.imageSearchTerms),
    tags: normalizeCsv(form.tags),
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
  };
}

function buildPostPayload(form) {
  return {
    postId: form.id,
    title: form.title,
    slug: form.slug,
    content: form.content,
    shortDescription: form.shortDescription,
    imageUrl: form.imageUrl,
    imageStoragePath: form.imageStoragePath,
    imageSearchTerms: normalizeCsv(form.imageSearchTerms),
    tags: normalizeCsv(form.tags),
    seoTitle: form.seoTitle,
    seoDescription: form.seoDescription,
  };
}

function getStatusLabel(item) {
  if (item.entityType === "draft") return "Draft";
  return item.is_archived ? "Archived" : "Published";
}

function getNormalizedStatus(item) {
  if (item.entityType === "draft") {
    return "draft";
  }

  return item.is_archived ? "archived" : "published";
}

function getStatusTone(status) {
  if (status === "draft") {
    return "border-sky-500/60 bg-sky-500/10 text-sky-200";
  }

  if (status === "archived") {
    return "border-amber-500/60 bg-amber-500/10 text-amber-200";
  }

  return "border-emerald-500/60 bg-emerald-500/10 text-emerald-200";
}

function getItemTimestamp(item) {
  if (item.entityType === "draft") {
    return item.updated_at;
  }

  return item.is_archived ? item.archived_at : item.published_at;
}

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

function isAdminSessionError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("admin session expired") || message.includes("authorization failed (401)");
}

function AdminBlogManagerPage() {
  const admin = useAdminAccess();
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [drafts, setDrafts] = React.useState([]);
  const [posts, setPosts] = React.useState([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState(8);
  const [selectedKey, setSelectedKey] = React.useState("");
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [savedSnapshot, setSavedSnapshot] = React.useState(() => getFormSnapshot(EMPTY_FORM));
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const items = React.useMemo(() => {
    const draftItems = drafts.map((item) => ({ ...item, entityType: "draft" }));
    const postItems = posts.map((item) => ({ ...item, entityType: "post" }));

    return [...draftItems, ...postItems].sort((left, right) => {
      const leftTime = new Date(getItemTimestamp(left) || 0).getTime();
      const rightTime = new Date(getItemTimestamp(right) || 0).getTime();
      return rightTime - leftTime;
    });
  }, [drafts, posts]);

  const filteredItems = React.useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return items.filter((item) => {
      const normalizedStatus = getNormalizedStatus(item);
      if (statusFilter !== "all" && normalizedStatus !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [item.title, item.slug, item.short_description]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(query);
    });
  }, [items, searchTerm, statusFilter]);

  const selectedItem = React.useMemo(
    () => items.find((item) => `${item.entityType}:${item.id}` === selectedKey) || null,
    [items, selectedKey]
  );

  const counts = React.useMemo(
    () => ({
      draft: drafts.length,
      published: posts.filter((item) => item.is_archived !== true).length,
      archived: posts.filter((item) => item.is_archived === true).length,
    }),
    [drafts, posts]
  );

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));

  const paginatedItems = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [currentPage, filteredItems, itemsPerPage]);

  const currentSnapshot = React.useMemo(() => getFormSnapshot(form), [form]);
  const isDirty = currentSnapshot !== savedSnapshot;

  const previewHtml = React.useMemo(() => {
    if (!looksLikeHtml(form.content)) {
      return "";
    }

    return sanitizeArticleHtml(form.content);
  }, [form.content]);

  const loadContent = React.useCallback(async () => {
    if (!admin.authorized) {
      setDrafts([]);
      setPosts([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const draftRows = await listBlogDrafts(100);
      const postRows = await listBlogPosts({ limit: 200, includeArchived: true });

      setDrafts(Array.isArray(draftRows) ? draftRows : []);
      setPosts(Array.isArray(postRows) ? postRows : []);
    } catch (loadError) {
      setError(loadError?.message || "Could not load blog manager content.");
    } finally {
      setLoading(false);
    }
  }, [admin.authorized]);

  React.useEffect(() => {
    if (!admin.checkingAccess && admin.authorized) {
      loadContent().catch(() => undefined);
      return;
    }

    if (!admin.authorized) {
      setDrafts([]);
      setPosts([]);
    }
  }, [admin.authorized, admin.checkingAccess, loadContent]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, searchTerm, statusFilter]);

  React.useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  React.useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [isDirty]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function confirmDiscardChanges(message = "You have unsaved changes. Discard them and continue?") {
    if (!isDirty) {
      return true;
    }

    return window.confirm(message);
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function selectItem(item) {
    if (!confirmDiscardChanges()) {
      return;
    }

    const key = `${item.entityType}:${item.id}`;
    const nextForm = formatBlogForForm(item, item.entityType);
    setSelectedKey(key);
    setForm(nextForm);
    setSavedSnapshot(getFormSnapshot(nextForm));
    clearMessages();
  }

  function handleCreateDraft() {
    if (!confirmDiscardChanges()) {
      return;
    }

    setSelectedKey("draft:new");
    setForm(EMPTY_FORM);
    setSavedSnapshot(getFormSnapshot(EMPTY_FORM));
    clearMessages();
  }

  async function handleRefresh() {
    if (!confirmDiscardChanges("You have unsaved changes. Refreshing will discard them. Continue?")) {
      return;
    }

    setSelectedKey("");
    setForm(EMPTY_FORM);
    setSavedSnapshot(getFormSnapshot(EMPTY_FORM));
    await loadContent();
  }

  async function runAction(actionName, action) {
    setActionLoading(actionName);
    clearMessages();

    try {
      await action();
    } catch (actionError) {
      setError(actionError?.message || "Blog manager action failed.");
    } finally {
      setActionLoading("");
    }
  }

  async function handleSave() {
    console.log("handleSave triggered!");
    setSaving(true);
    clearMessages();

    try {
      let formToSave = { ...form };
      console.log("Current formToSave:", formToSave);

      if (formToSave.imageUrl && !formToSave.imageUrl.includes("/storage/v1/object/public/")) {
        console.log("External image detected, uploading:", formToSave.imageUrl);
        const { publicUrl, storagePath } = await uploadBlogImageFromUrl(formToSave.imageUrl, formToSave.title);
        console.log("Upload result:", { publicUrl, storagePath });
        formToSave.imageUrl = publicUrl;
        formToSave.imageStoragePath = storagePath;
        setForm((prev) => ({ ...prev, imageUrl: publicUrl, imageStoragePath: storagePath }));
      } else {
        console.log("No external image detected, skipping upload. URL:", formToSave.imageUrl);
      }

      if (formToSave.entityType === "post") {
        const updated = await updatePublishedBlog(buildPostPayload(formToSave));
        if (!updated) {
          throw new Error("Post update returned no data.");
        }

        const nextForm = formatBlogForForm(updated, "post");
        setSuccess("Published post updated.");
        setSelectedKey(`post:${updated.id}`);
        setForm(nextForm);
        setSavedSnapshot(getFormSnapshot(nextForm));
      } else {
        const draft = await saveBlogDraft(buildDraftPayload(formToSave));
        if (!draft) {
          throw new Error("Draft save returned no data.");
        }

        const nextForm = formatBlogForForm(draft, "draft");
        setSuccess(formToSave.id ? "Draft updated." : "Draft created.");
        setSelectedKey(`draft:${draft.id}`);
        setForm(nextForm);
        setSavedSnapshot(getFormSnapshot(nextForm));
      }

      await loadContent();
    } catch (saveError) {
      setError(saveError?.message || "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    await runAction("publish", async () => {
      let formToPublish = { ...form };

      if (formToPublish.imageUrl && !formToPublish.imageUrl.includes("/storage/v1/object/public/")) {
        const { publicUrl, storagePath } = await uploadBlogImageFromUrl(formToPublish.imageUrl, formToPublish.title);
        formToPublish.imageUrl = publicUrl;
        formToPublish.imageStoragePath = storagePath;
        setForm((prev) => ({ ...prev, imageUrl: publicUrl, imageStoragePath: storagePath }));
      }

      const published = await publishBlog(buildDraftPayload(formToPublish));
      if (!published) {
        throw new Error("Publish returned no data.");
      }

      const nextForm = formatBlogForForm(published, "post");
      setSelectedKey(`post:${published.id}`);
      setForm(nextForm);
      setSavedSnapshot(getFormSnapshot(nextForm));
      setSuccess(`Published: ${published.title || "Blog post"}`);
      await loadContent();
    });
  }

  async function handleDeleteDraft(draftId) {
    if (`draft:${draftId}` === selectedKey && !confirmDiscardChanges("Delete this draft and discard unsaved changes?")) {
      return;
    }

    if (!window.confirm("Delete this draft permanently?")) {
      return;
    }

    await runAction("delete-draft", async () => {
      await deleteBlogDraft(draftId);
      if (`draft:${draftId}` === selectedKey) {
        setSelectedKey("");
        setForm(EMPTY_FORM);
        setSavedSnapshot(getFormSnapshot(EMPTY_FORM));
      }
      setSuccess("Draft deleted.");
      await loadContent();
    });
  }

  async function handleArchivePost(postId) {
    if (`post:${postId}` === selectedKey && !confirmDiscardChanges("Archive this post and discard unsaved changes?")) {
      return;
    }

    if (!window.confirm("Archive this post? It will be hidden from the public blog until restored.")) {
      return;
    }

    await runAction("archive-post", async () => {
      const archived = await archivePublishedBlog(postId);
      if (!archived) {
        throw new Error("Archive returned no data.");
      }

      const nextForm = formatBlogForForm(archived, "post");
      setSelectedKey(`post:${archived.id}`);
      setForm(nextForm);
      setSavedSnapshot(getFormSnapshot(nextForm));
      setSuccess("Post archived.");
      await loadContent();
    });
  }

  async function handleRestorePost(postId) {
    if (`post:${postId}` === selectedKey && !confirmDiscardChanges("Restore this post and discard unsaved changes?")) {
      return;
    }

    await runAction("restore-post", async () => {
      const restored = await restorePublishedBlog(postId);
      if (!restored) {
        throw new Error("Restore returned no data.");
      }

      const nextForm = formatBlogForForm(restored, "post");
      setSelectedKey(`post:${restored.id}`);
      setForm(nextForm);
      setSavedSnapshot(getFormSnapshot(nextForm));
      setSuccess("Post restored to published state.");
      await loadContent();
    });
  }

  async function handleDeletePost(postId) {
    if (`post:${postId}` === selectedKey && !confirmDiscardChanges("Delete this post and discard unsaved changes?")) {
      return;
    }

    if (!window.confirm("Delete this post permanently? This cannot be undone.")) {
      return;
    }

    await runAction("delete-post", async () => {
      await deletePublishedBlog(postId);
      if (`post:${postId}` === selectedKey) {
        setSelectedKey("");
        setForm(EMPTY_FORM);
        setSavedSnapshot(getFormSnapshot(EMPTY_FORM));
      }
      setSuccess("Post deleted permanently.");
      await loadContent();
    });
  }

  function handleOpenPublicPost() {
    if (!form.slug || form.isArchived) {
      return;
    }

    window.open(`/blog/${encodeURIComponent(form.slug)}`, "_blank", "noopener,noreferrer");
  }

  function handleTogglePreview() {
    setPreviewOpen((prev) => !prev);
  }

  function handleStatusFilterChange(nextFilter) {
    setStatusFilter(nextFilter);
  }

  function getStatusCount(status) {
    if (status === "draft") return counts.draft;
    if (status === "published") return counts.published;
    if (status === "archived") return counts.archived;
    return items.length;
  }

  if (admin.checkingAccess) {
    return (
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <p className="text-sm text-white/80">Checking admin access...</p>
      </div>
    );
  }

  if (!admin.authorized) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">Blog Manager</h1>
        <p className="mt-1 text-sm text-white/80">
          Review drafts, edit live posts, archive articles, and permanently delete content when needed.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <AdminSidebar
          onSignOut={admin.logout}
          authLoading={admin.authLoading}
          onBeforeNavigate={() => confirmDiscardChanges("You have unsaved changes. Leave the Blog Manager anyway?")}
        />

        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/70">
              <span className="rounded-full border border-neutral-700 bg-black/30 px-3 py-1.5">
                Total items: {items.length}
              </span>
              {isDirty ? (
                <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-3 py-1.5 text-amber-200">
                  Unsaved changes
                </span>
              ) : (
                <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-emerald-200">
                  All changes saved
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleCreateDraft}
                className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
              >
                New Draft
              </button>
              <button
                type="button"
                onClick={handleRefresh}
                className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
              >
                Refresh
              </button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}

          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <div className="rounded-2xl border border-neutral-700 bg-black/40 p-4 space-y-3 max-h-[72vh] overflow-auto">
              <div className="sticky top-0 z-10 space-y-3 rounded-2xl bg-black/75 pb-1 backdrop-blur">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search title, slug, or description"
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />

                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((option) => {
                    const isActive = statusFilter === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => handleStatusFilterChange(option.key)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition ${
                          isActive
                            ? "border-[#D4AF37] bg-[#D4AF37] text-black font-semibold"
                            : "border-neutral-700 bg-black/30 text-white/80 hover:border-[#D4AF37]"
                        }`}
                      >
                        {option.label} ({getStatusCount(option.key)})
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2 rounded-2xl border border-neutral-700 bg-black/30 px-3 py-2 text-[11px] text-white/70">
                  <span>
                    Showing {filteredItems.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length}
                  </span>
                  <label className="flex items-center gap-2">
                    <span>Per page</span>
                    <select
                      value={itemsPerPage}
                      onChange={(event) => setItemsPerPage(Number(event.target.value) || 8)}
                      className="rounded-full border border-neutral-600 bg-black/60 px-2 py-1 text-[11px] text-white"
                    >
                      <option value={8}>8</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                    </select>
                  </label>
                </div>
              </div>

              {loading ? <p className="text-xs text-white/70">Loading posts and drafts...</p> : null}
              {!loading && filteredItems.length === 0 ? (
                <p className="text-xs text-white/70">No blog items match the current filters.</p>
              ) : null}

              {paginatedItems.map((item) => {
                const key = `${item.entityType}:${item.id}`;
                const isSelected = selectedKey === key;
                const statusLabel = getStatusLabel(item);
                const statusClass = getStatusTone(getNormalizedStatus(item));

                return (
                  <div
                    key={key}
                    className={`rounded-xl border p-3 space-y-3 ${
                      isSelected ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-neutral-700 bg-black/40"
                    }`}
                  >
                    <button type="button" onClick={() => selectItem(item)} className="w-full text-left space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-white line-clamp-2">{item.title || "Untitled post"}</p>
                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-wide ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-white/60">{item.slug || "Slug will be generated from title"}</p>
                      <p className="text-[11px] text-white/60">
                        {item.entityType === "draft" ? "Updated" : item.is_archived ? "Archived" : "Published"}: {formatDateTime(getItemTimestamp(item)) || "Not available"}
                      </p>
                    </button>

                    <div className="flex flex-wrap items-center gap-2">
                      {item.entityType === "draft" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => selectItem(item)}
                            className="rounded-full border border-neutral-500 px-3 py-1.5 text-[11px] font-medium text-white"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(item.id)}
                            disabled={actionLoading === "delete-draft"}
                            className="rounded-full border border-red-500/60 px-3 py-1.5 text-[11px] font-medium text-red-200 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => selectItem(item)}
                            className="rounded-full border border-neutral-500 px-3 py-1.5 text-[11px] font-medium text-white"
                          >
                            Edit
                          </button>
                          {item.is_archived ? (
                            <button
                              type="button"
                              onClick={() => handleRestorePost(item.id)}
                              disabled={actionLoading === "restore-post"}
                              className="rounded-full border border-emerald-500/60 px-3 py-1.5 text-[11px] font-medium text-emerald-200 disabled:opacity-60"
                            >
                              Restore
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleArchivePost(item.id)}
                              disabled={actionLoading === "archive-post"}
                              className="rounded-full border border-amber-500/60 px-3 py-1.5 text-[11px] font-medium text-amber-200 disabled:opacity-60"
                            >
                              Archive
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeletePost(item.id)}
                            disabled={actionLoading === "delete-post"}
                            className="rounded-full border border-red-500/60 px-3 py-1.5 text-[11px] font-medium text-red-200 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {filteredItems.length > 0 ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-700 bg-black/30 px-3 py-2 text-xs text-white/75">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="rounded-full border border-neutral-600 px-3 py-1.5 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>
                    Page {currentPage} of {pageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pageCount))}
                    disabled={currentPage === pageCount}
                    className="rounded-full border border-neutral-600 px-3 py-1.5 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-neutral-700 bg-black/40 p-4 sm:p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-white">
                    {form.id ? (form.entityType === "post" ? "Edit Post" : "Edit Draft") : "Create Draft"}
                  </h2>
                  <p className="mt-1 text-xs text-white/60">
                    Direct edits on published posts go live immediately. Drafts can be saved or published from here.
                  </p>
                  {selectedItem ? (
                    <p className="mt-2 text-[11px] text-white/50">
                      Selected item: {selectedItem.title || "Untitled post"}
                    </p>
                  ) : null}
                </div>

                {form.id ? (
                  <span
                    className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-wide ${getStatusTone(
                      form.entityType === "draft" ? "draft" : form.isArchived ? "archived" : "published"
                    )}`}
                  >
                    {form.entityType === "draft" ? "Draft" : form.isArchived ? "Archived post" : "Published post"}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-700 bg-black/30 px-4 py-3 text-xs text-white/70">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-neutral-700 px-2.5 py-1">
                    {form.slug || "Slug will be generated from title"}
                  </span>
                  {isDirty ? (
                    <span className="rounded-full border border-amber-500/60 bg-amber-500/10 px-2.5 py-1 text-amber-200">
                      Unsaved edits
                    </span>
                  ) : (
                    <span className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-2.5 py-1 text-emerald-200">
                      Synced
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleTogglePreview}
                  className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
                >
                  {previewOpen ? "Hide Preview" : "Safe Preview"}
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-white/80">
                  <span>Title</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(event) => updateField("title", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Slug</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(event) => updateField("slug", event.target.value)}
                    placeholder="leave blank to derive from title"
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>Short Description</span>
                <textarea
                  value={form.shortDescription}
                  onChange={(event) => updateField("shortDescription", event.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <label className="space-y-1 text-xs text-white/80 block">
                <span>Content</span>
                <textarea
                  value={form.content}
                  onChange={(event) => updateField("content", event.target.value)}
                  rows={16}
                  className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-white/80">
                  <span>Image URL</span>
                  <input
                    type="text"
                    value={form.imageUrl}
                    onChange={(event) => updateField("imageUrl", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Image Storage Path</span>
                  <input
                    type="text"
                    value={form.imageStoragePath}
                    onChange={(event) => updateField("imageStoragePath", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Tags</span>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(event) => updateField("tags", event.target.value)}
                    placeholder="tag one, tag two"
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>Image Search Terms</span>
                  <input
                    type="text"
                    value={form.imageSearchTerms}
                    onChange={(event) => updateField("imageSearchTerms", event.target.value)}
                    placeholder="aloe vera, skincare flatlay"
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>SEO Title</span>
                  <input
                    type="text"
                    value={form.seoTitle}
                    onChange={(event) => updateField("seoTitle", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
                <label className="space-y-1 text-xs text-white/80">
                  <span>SEO Description</span>
                  <input
                    type="text"
                    value={form.seoDescription}
                    onChange={(event) => updateField("seoDescription", event.target.value)}
                    className="w-full rounded-xl border border-neutral-600 bg-black/60 px-3 py-2 text-sm text-white"
                  />
                </label>
              </div>

              {form.id ? (
                <div className="grid gap-2 rounded-2xl border border-neutral-700 bg-black/30 p-4 text-xs text-white/70 sm:grid-cols-3">
                  <p>Created: {formatDateTime(form.createdAt) || "Not available"}</p>
                  <p>Updated: {formatDateTime(form.updatedAt) || "Not available"}</p>
                  <p>Published: {formatDateTime(form.publishedAt) || "Not available"}</p>
                </div>
              ) : null}

              {previewOpen ? (
                <section className="rounded-2xl border border-neutral-700 bg-black/30 p-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-white/60">Preview</p>
                      <h3 className="text-xl font-semibold text-[#D4AF37]">
                        {form.title || "Untitled preview"}
                      </h3>
                    </div>
                    <span className="text-xs text-white/50">Sanitized to match the public article renderer</span>
                  </div>

                  {form.shortDescription ? (
                    <p className="text-sm leading-relaxed text-white/80">{form.shortDescription}</p>
                  ) : null}

                  {form.imageUrl ? (
                    <img
                      src={form.imageUrl}
                      alt={form.title || "Preview image"}
                      className="max-h-[24rem] w-full rounded-2xl border border-neutral-700 object-cover"
                    />
                  ) : null}

                  {form.tags ? (
                    <div className="flex flex-wrap gap-2">
                      {normalizeCsv(form.tags).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-neutral-600 bg-black/30 px-3 py-1 text-[11px] text-white/75"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  {previewHtml ? (
                    <div
                      className="text-sm sm:text-base leading-relaxed text-white/95 space-y-3 [&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:text-[#D4AF37] [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:text-[#D4AF37] [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-[#D4AF37] [&_p]:mt-3 [&_a]:text-[#D4AF37] [&_a]:underline [&_blockquote]:mt-4 [&_blockquote]:border-l-2 [&_blockquote]:border-[#D4AF37]/70 [&_blockquote]:pl-4 [&_blockquote]:text-white/80 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mt-1 [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-neutral-700 [&_pre]:bg-black/70 [&_pre]:p-3 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_img]:mt-4 [&_img]:max-h-[28rem] [&_img]:w-full [&_img]:rounded-xl [&_img]:border [&_img]:border-neutral-700 [&_img]:object-cover [&_hr]:mt-6 [&_hr]:border-neutral-700"
                      dangerouslySetInnerHTML={{ __html: previewHtml }}
                    />
                  ) : (
                    <p className="whitespace-pre-line text-sm sm:text-base leading-relaxed text-white/85">
                      {form.content || "Preview content will appear here as you type."}
                    </p>
                  )}
                </section>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-full bg-[#D4AF37] px-5 py-2 text-sm font-semibold text-black disabled:opacity-60"
                >
                  {saving ? "Saving..." : form.entityType === "post" ? "Save Live Post" : "Save Draft"}
                </button>

                {form.entityType === "draft" ? (
                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={actionLoading === "publish"}
                    className="rounded-full border border-emerald-500/60 px-4 py-2 text-sm font-medium text-emerald-200 disabled:opacity-60"
                  >
                    {actionLoading === "publish" ? "Publishing..." : "Publish Draft"}
                  </button>
                ) : null}

                {form.entityType === "post" && !form.isArchived && form.slug ? (
                  <button
                    type="button"
                    onClick={handleOpenPublicPost}
                    className="rounded-full border border-neutral-500 px-4 py-2 text-sm font-medium text-white"
                  >
                    Open Public Post
                  </button>
                ) : null}

                {form.entityType === "post" && !form.isArchived ? (
                  <button
                    type="button"
                    onClick={() => handleArchivePost(form.id)}
                    disabled={actionLoading === "archive-post"}
                    className="rounded-full border border-amber-500/60 px-4 py-2 text-sm font-medium text-amber-200 disabled:opacity-60"
                  >
                    {actionLoading === "archive-post" ? "Archiving..." : "Archive Post"}
                  </button>
                ) : null}

                {form.entityType === "post" && form.isArchived ? (
                  <button
                    type="button"
                    onClick={() => handleRestorePost(form.id)}
                    disabled={actionLoading === "restore-post"}
                    className="rounded-full border border-emerald-500/60 px-4 py-2 text-sm font-medium text-emerald-200 disabled:opacity-60"
                  >
                    {actionLoading === "restore-post" ? "Restoring..." : "Restore Post"}
                  </button>
                ) : null}

                {form.entityType === "draft" && form.id ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteDraft(form.id)}
                    disabled={actionLoading === "delete-draft"}
                    className="rounded-full border border-red-500/60 px-4 py-2 text-sm font-medium text-red-200 disabled:opacity-60"
                  >
                    {actionLoading === "delete-draft" ? "Deleting..." : "Delete Draft"}
                  </button>
                ) : null}

                {form.entityType === "post" && form.id ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePost(form.id)}
                    disabled={actionLoading === "delete-post"}
                    className="rounded-full border border-red-500/60 px-4 py-2 text-sm font-medium text-red-200 disabled:opacity-60"
                  >
                    {actionLoading === "delete-post" ? "Deleting..." : "Delete Permanently"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminBlogManagerPage;