import React from "react";

function formatCommentDate(value) {
  if (!value) return "Recently shared";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Recently shared";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function renderStars(rating) {
  const safeRating = Math.max(0, Math.min(5, Number(rating) || 0));
  return Array.from({ length: 5 }, (_, index) => (
    <span key={`star-${index}`} className={index < safeRating ? "text-[#FFD700]" : "text-white/20"}>
      ★
    </span>
  ));
}

function CommentCard({ comment, variant = "product" }) {
  const location = [comment?.city].filter(Boolean).join(", ");

  return (
    <article className="rounded-2xl border border-neutral-700 bg-black/50 p-5 sm:p-6 space-y-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-white">{comment?.displayName || "Member"}</p>
          <p className="text-xs uppercase tracking-[0.16em] text-white/55">
            {location || "Advaya Care Member"}
          </p>
        </div>
        <p className="text-xs text-white/60">{formatCommentDate(comment?.createdAt)}</p>
      </div>

      {variant === "product" && Number.isFinite(Number(comment?.rating)) ? (
        <div className="flex items-center gap-2 text-sm">
          <div aria-label={`${comment.rating} out of 5 stars`}>{renderStars(comment.rating)}</div>
          <span className="text-white/70">{comment.rating}/5</span>
        </div>
      ) : null}

      {comment?.headline ? (
        <h3 className="text-lg font-semibold text-[#D4AF37]">{comment.headline}</h3>
      ) : null}

      <p className="text-sm leading-relaxed text-white/88 whitespace-pre-line">{comment?.body}</p>
    </article>
  );
}

export default CommentCard;