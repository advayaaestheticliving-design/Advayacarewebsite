import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { getAvailableStock, isProductPurchasable, normalizeProduct } from "../lib/productsApi";

function ProductCard({ product, className = "" }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();

  if (!product) return null;

  const normalizedProduct = normalizeProduct(product);
  const {
    id,
    name,
    price_inr,
    benefits_brief,
    one_line_summary,
    images = [],
    filterTags = [],
    low_stock_threshold,
  } = normalizedProduct;

  const availableStock = getAvailableStock(normalizedProduct);
  const canPurchase = isProductPurchasable(normalizedProduct);
  const lowStockThreshold = Number(low_stock_threshold || 5);
  const isLowStock = Number.isFinite(availableStock)
    && availableStock > 0
    && availableStock <= lowStockThreshold;

  let stockText = "Out of stock";
  let stockClasses = "bg-red-100 text-red-700 border-red-200";
  if (canPurchase && isLowStock) {
    stockText = `Low stock (${availableStock} left)`;
    stockClasses = "bg-amber-100 text-amber-700 border-amber-200";
  } else if (canPurchase) {
    stockText = `In stock (${availableStock})`;
    stockClasses = "bg-emerald-100 text-emerald-700 border-emerald-200";
  }

  const resolveImage = (filename) => {
    if (!filename) return undefined;
    if (String(filename).startsWith("http://") || String(filename).startsWith("https://")) {
      return filename;
    }
    const hasExt = filename.includes(".");
    const finalName = hasExt ? filename : `${filename}.avif`;
    return `${import.meta.env.BASE_URL}images/${finalName}`;
  };

  const imageSrc = images.length ? resolveImage(images[0]) : undefined;
  const formattedPrice = Number(price_inr || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const handleAddToCart = (e) => {
    e.preventDefault();
    if (!canPurchase) return;
    addToCart(normalizedProduct, 1);
  };

  const handleBuyNow = (e) => {
    e.preventDefault();
    if (!canPurchase) return;
    addToCart(normalizedProduct, 1);
    navigate("/cart");
  };

  return (
    <Link
      to={`/product/${id}`}
      className={`group flex flex-col rounded-2xl border border-black bg-[#D4AF37] shadow-sm/40 hover:shadow-md transition-shadow overflow-hidden ${className}`.trim()}
    >
      {imageSrc && (
        <div className="aspect-[4/3] overflow-hidden bg-slate-100">
          <img
            src={imageSrc}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4 sm:p-5 gap-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1 line-clamp-2">
            {name}
          </h3>
          {(one_line_summary || benefits_brief) && (
            <p className="text-sm text-[#333333] line-clamp-2">
              {one_line_summary || benefits_brief}
            </p>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-sm sm:text-base font-semibold text-slate-900">
            {formattedPrice}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${stockClasses}`}>
            {stockText}
          </span>
        </div>
        {filterTags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {filterTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center rounded-full border border-black/20 bg-black/5 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-900"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={!canPurchase}
            className="w-full rounded-full bg-black px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            Add to Cart
          </button>
          <button
            type="button"
            onClick={handleBuyNow}
            disabled={!canPurchase}
            className="w-full rounded-full bg-black px-3 py-2 text-xs sm:text-sm font-medium text-white hover:bg-neutral-800 transition-colors disabled:cursor-not-allowed disabled:bg-neutral-500"
          >
            Buy Now
          </button>
        </div>
      </div>
    </Link>
  );
}

export default ProductCard;
