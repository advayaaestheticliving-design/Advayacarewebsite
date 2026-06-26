import React from "react";
import { Navigate } from "react-router-dom";
import AdminSidebar from "../components/AdminSidebar";
import AdminAddCommentModal from "../components/AdminAddCommentModal";
import { getAdminComments, updateAdminCommentStatus, createAdminComment } from "../lib/adminCommentsApi";
import { useAdminAccess } from "../lib/useAdminAccess";

const STATUS_OPTIONS = ["pending", "approved", "rejected", "spam"];
const TARGET_OPTIONS = ["all", "home", "product"];

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function AdminCommentsPage() {
  const admin = useAdminAccess();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [comments, setComments] = React.useState([]);
  const [statusFilter, setStatusFilter] = React.useState("pending");
  const [targetFilter, setTargetFilter] = React.useState("all");
  const [searchInput, setSearchInput] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [pendingStatusByComment, setPendingStatusByComment] = React.useState({});
  const [pendingNotesByComment, setPendingNotesByComment] = React.useState({});
  const [updatingCommentId, setUpdatingCommentId] = React.useState("");
  const [isAddModalOpen, setIsAddModalOpen] = React.useState(false);

  const loadComments = React.useCallback(async () => {
    if (!admin.authorized) {
      setComments([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const rows = await getAdminComments({
        status: statusFilter,
        targetType: targetFilter,
        search: searchQuery,
        limit: 200,
      });
      setComments(rows);
      setPendingStatusByComment({});
      setPendingNotesByComment({});
    } catch (loadError) {
      setError(loadError?.message || "Could not load comments.");
    } finally {
      setLoading(false);
    }
  }, [admin.authorized, searchQuery, statusFilter, targetFilter]);

  React.useEffect(() => {
    if (!admin.checkingAccess && admin.authorized) {
      loadComments().catch(() => undefined);
      return;
    }

    if (!admin.authorized) {
      setComments([]);
      setPendingStatusByComment({});
      setPendingNotesByComment({});
    }
  }, [admin.authorized, admin.checkingAccess, loadComments]);

  async function handleUpdate(comment) {
    const nextStatus = String(pendingStatusByComment[comment.id] || comment.status || "pending").toLowerCase();
    const nextNotes = String(pendingNotesByComment[comment.id] || "").trim();

    setUpdatingCommentId(comment.id);
    setError("");

    try {
      const updated = await updateAdminCommentStatus(comment.id, nextStatus, nextNotes);
      setPendingStatusByComment((prev) => ({ ...prev, [comment.id]: updated.status }));
      setPendingNotesByComment((prev) => ({ ...prev, [comment.id]: updated.moderation_notes || "" }));
      await loadComments();
    } catch (updateError) {
      setError(updateError?.message || "Could not update comment.");
    } finally {
      setUpdatingCommentId("");
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
  }

  async function handleAddComment(payload) {
    setError("");
    try {
      await createAdminComment(payload);
      setIsAddModalOpen(false);
      await loadComments();
    } catch (createError) {
      setError(createError?.message || "Could not create comment.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">Admin Comments</h1>
        <p className="text-sm text-white/80 mt-1">
          Review testimonials and product comments before they appear publicly.
        </p>
      </div>

      {admin.checkingAccess ? (
        <p className="text-sm text-white/80">Checking admin access...</p>
      ) : !admin.authorized ? (
        <Navigate to="/admin" replace />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <AdminSidebar onSignOut={admin.logout} authLoading={admin.authLoading} />

          <section className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-neutral-700 bg-black/50 p-4 sm:grid-cols-[160px_160px_1fr_auto_auto] sm:items-center">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white"
              >
                <option value="all">All Statuses</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {toLabel(status)}
                  </option>
                ))}
              </select>

              <select
                value={targetFilter}
                onChange={(event) => setTargetFilter(event.target.value)}
                className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white"
              >
                {TARGET_OPTIONS.map((target) => (
                  <option key={target} value={target}>
                    {target === "all" ? "All Targets" : toLabel(target)}
                  </option>
                ))}
              </select>

              <form onSubmit={handleSearchSubmit} className="contents">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name, headline, body, city, or product id"
                  className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white placeholder:text-white/40"
                />
                <button
                  type="submit"
                  className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
                >
                  Search
                </button>
              </form>

              <button
                type="button"
                onClick={() => loadComments()}
                className="rounded-full border border-neutral-600 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37]"
              >
                Refresh
              </button>
              
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-black hover:bg-[#e3c458]"
              >
                Add Comment
              </button>
            </div>

            {error || admin.error ? <p className="text-sm text-red-400">{error || admin.error}</p> : null}

            {loading ? (
              <p className="text-sm text-white/80">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-white/70">No comments found for the current filters.</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const selectedStatus = pendingStatusByComment[comment.id] || comment.status || "pending";
                  const noteValue = Object.prototype.hasOwnProperty.call(pendingNotesByComment, comment.id)
                    ? pendingNotesByComment[comment.id]
                    : comment.moderation_notes || "";

                  return (
                    <article
                      key={comment.id}
                      className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4"
                    >
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4 text-sm text-white">
                        <p>
                          <span className="text-white/70">Target:</span> {toLabel(comment.target_type)}
                        </p>
                        <p>
                          <span className="text-white/70">Status:</span> {toLabel(comment.status)}
                        </p>
                        <p>
                          <span className="text-white/70">Member:</span> {comment.display_name || "—"}
                        </p>
                        <p>
                          <span className="text-white/70">Created:</span> {formatDateTime(comment.created_at)}
                        </p>
                        <p>
                          <span className="text-white/70">City:</span> {comment.city || "—"}
                        </p>
                        <p>
                          <span className="text-white/70">Rating:</span> {comment.rating || "—"}
                        </p>
                        <p className="sm:col-span-2">
                          <span className="text-white/70">Product:</span>{" "}
                          {comment.product_name || comment.product_id || "Homepage testimonial"}
                        </p>
                        <p className="sm:col-span-2 xl:col-span-4">
                          <span className="text-white/70">Last moderated:</span>{" "}
                          {comment.moderated_at ? `${formatDateTime(comment.moderated_at)} by ${comment.moderated_by_email || "admin"}` : "Not moderated yet"}
                        </p>
                      </div>

                      {comment.headline ? <h2 className="text-lg font-semibold text-[#D4AF37]">{comment.headline}</h2> : null}
                      <p className="text-sm leading-relaxed text-white whitespace-pre-line">{comment.body}</p>

                      <div className="grid gap-3 lg:grid-cols-[220px_1fr_auto]">
                        <select
                          value={selectedStatus}
                          onChange={(event) =>
                            setPendingStatusByComment((prev) => ({
                              ...prev,
                              [comment.id]: event.target.value,
                            }))
                          }
                          className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {toLabel(status)}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={noteValue}
                          onChange={(event) =>
                            setPendingNotesByComment((prev) => ({
                              ...prev,
                              [comment.id]: event.target.value,
                            }))
                          }
                          placeholder="Internal moderation note"
                          className="rounded-full border border-neutral-600 bg-black/60 px-4 py-2 text-sm text-white placeholder:text-white/40"
                        />

                        <button
                          type="button"
                          onClick={() => handleUpdate(comment)}
                          disabled={updatingCommentId === comment.id}
                          className="rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-white hover:bg-[#e3c458] disabled:opacity-60"
                        >
                          {updatingCommentId === comment.id ? "Updating..." : "Update"}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      <AdminAddCommentModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleAddComment}
      />
    </div>
  );
}

export default AdminCommentsPage;