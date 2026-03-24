import React from "react";
import CommentCard from "./CommentCard";
import CommentForm from "./CommentForm";
import { createProductComment, listProductComments } from "../lib/commentsApi";

function ProductCommentsSection({ productId, productName }) {
  const [comments, setComments] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    setLoading(true);

    listProductComments(productId)
      .then((rows) => {
        if (!mounted) return;
        setComments(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!mounted) return;
        setComments([]);
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [productId]);

  return (
    <section className="space-y-6 pt-8">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-[#D4AF37]">Member Reviews</h2>
        <p className="text-sm text-white/80">
          Reviews are published only after moderation so this section stays useful and credible.
        </p>
      </div>

      {loading ? <p className="text-sm text-white/75">Loading member reviews...</p> : null}

      {!loading && comments.length > 0 ? (
        <div className="grid gap-4">
          {comments.map((comment) => (
            <CommentCard key={comment.id} comment={comment} variant="product" />
          ))}
        </div>
      ) : null}

      {!loading && comments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-700 bg-black/40 px-5 py-7 space-y-2">
          <p className="text-base font-medium text-white">Be the first member to review this ritual.</p>
          <p className="text-sm text-white/70">
            Your experience with {productName || "this product"} can help the next customer decide more confidently.
          </p>
        </div>
      ) : null}

      <CommentForm
        title="Review This Ritual"
        description="Share texture, scent, consistency, or results after use. Your review will go live once approved."
        submitLabel="Submit Review"
        successMessage="Submitted for approval. Your review will appear after moderation."
        onSubmit={(payload) => createProductComment(productId, payload)}
        variant="product"
      />
    </section>
  );
}

export default ProductCommentsSection;