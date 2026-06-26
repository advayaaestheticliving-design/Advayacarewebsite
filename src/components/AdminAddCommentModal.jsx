import React from "react";
import { listAdminProducts } from "../lib/adminProductsApi";

function AdminAddCommentModal({ isOpen, onClose, onSubmit }) {
  const [targetType, setTargetType] = React.useState("home");
  const [displayName, setDisplayName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [body, setBody] = React.useState("");
  const [rating, setRating] = React.useState("5");
  const [productId, setProductId] = React.useState("");
  const [products, setProducts] = React.useState([]);
  const [loadingProducts, setLoadingProducts] = React.useState(false);

  React.useEffect(() => {
    if (isOpen && targetType === "product" && products.length === 0) {
      setLoadingProducts(true);
      listAdminProducts({ includeInactive: true })
        .then((fetched) => setProducts(fetched || []))
        .catch((err) => console.error("Failed to fetch products for modal", err))
        .finally(() => setLoadingProducts(false));
    }
  }, [isOpen, targetType, products.length]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      targetType,
      displayName,
      city,
      headline,
      body,
      rating: targetType === "product" ? parseInt(rating, 10) : null,
      productId: targetType === "product" ? productId : null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-neutral-700 bg-[#111] p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-white/50 hover:text-white"
          aria-label="Close modal"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-xl font-semibold text-[#D4AF37] mb-6">Add Comment Manually</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Target Type</label>
            <select
              value={targetType}
              onChange={(e) => {
                setTargetType(e.target.value);
                if (e.target.value !== "product") setProductId("");
              }}
              className="w-full rounded-xl border border-neutral-700 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
            >
              <option value="home">Home Testimonial</option>
              <option value="product">Product Review</option>
            </select>
          </div>

          {targetType === "product" && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Select Product</label>
              <select
                required
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="" disabled>Select a product...</option>
                {loadingProducts && <option disabled>Loading products...</option>}
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.is_active ? "" : "(Inactive)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Display Name *</label>
            <input
              required
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-[#D4AF37] focus:outline-none placeholder:text-white/30"
              placeholder="e.g. Jane Doe"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-[#D4AF37] focus:outline-none placeholder:text-white/30"
              placeholder="e.g. Mumbai"
            />
          </div>

          {targetType === "product" && (
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Rating</label>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full rounded-xl border border-neutral-700 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-[#D4AF37] focus:outline-none"
              >
                <option value="5">5 Stars</option>
                <option value="4">4 Stars</option>
                <option value="3">3 Stars</option>
                <option value="2">2 Stars</option>
                <option value="1">1 Star</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-[#D4AF37] focus:outline-none placeholder:text-white/30"
              placeholder="Brief summary..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Body *</label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-xl border border-neutral-700 bg-black/50 px-4 py-2.5 text-sm text-white focus:border-[#D4AF37] focus:outline-none placeholder:text-white/30"
              placeholder="Write the full comment here..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-neutral-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-600 px-6 py-2 text-sm font-medium text-white hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-[#D4AF37] px-6 py-2 text-sm font-semibold text-black hover:bg-[#e3c458]"
            >
              Save Comment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AdminAddCommentModal;
