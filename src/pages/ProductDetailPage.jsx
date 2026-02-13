import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useCart } from "../context/CartContext";
import productsData from "../data/products.json";

function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [product, setProduct] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    try {
      setLoading(true);
      setError(null);
      const found = Array.isArray(productsData)
        ? productsData.find((p) => p.id === id)
        : null;
      setProduct(found || null);
    } catch {
      setError("Something went wrong loading product.");
      setProduct(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-sm text-white/80">Loading product...</p>
      </div>
    );
  }

  if (!product || error) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-10">
        <p className="text-sm text-slate-200">Product not found</p>
      </div>
    );
  }

  const {
    name,
    price_inr,
    benefits_brief,
    benefits_detail,
    use_cases,
    ingredients,
    images: dbImages,
  } = product;

  const images = Array.isArray(dbImages) ? dbImages : [];

  const resolveImage = (filename) => {
    if (!filename) return undefined;
    const hasExt = filename.includes(".");
    const finalName = hasExt ? filename : `${filename}.avif`;
    return `${import.meta.env.BASE_URL}images/${finalName}`;
  };

  // Automatic gallery state + hover pause
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isHovered, setIsHovered] = React.useState(false);
  const touchStartXRef = React.useRef(null);
  const touchStartYRef = React.useRef(null);
  const isSwipingRef = React.useRef(false);

  React.useEffect(() => {
    if ((images || []).length > 1 && !isHovered) {
      const interval = setInterval(() => {
        setActiveIndex((idx) => (idx + 1) % images.length);
      }, 4000); // advance every 4s
      return () => clearInterval(interval);
    }
  }, [images, isHovered]);

  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
    setIsHovered(true); // pause auto-advance during touch
  };

  const handleTouchMove = (e) => {
    if (!touchStartXRef.current || !e.touches || e.touches.length === 0) return;
    const deltaX = e.touches[0].clientX - touchStartXRef.current;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    // If horizontal movement significantly exceeds vertical, mark swiping
    if (Math.abs(deltaX) > 20 && Math.abs(deltaY) < Math.abs(deltaX) / 2) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (touchStartXRef.current == null) {
      setIsHovered(false);
      return;
    }
    const endX = e.changedTouches && e.changedTouches.length ? e.changedTouches[0].clientX : touchStartXRef.current;
    const deltaX = endX - touchStartXRef.current;
    const threshold = 40; // minimum px to register swipe
    if (isSwipingRef.current && Math.abs(deltaX) > threshold) {
      setActiveIndex((prev) => {
        if (deltaX < 0) { // swipe left -> next image
          return (prev + 1) % images.length;
        } else { // swipe right -> previous image
          return (prev - 1 + images.length) % images.length;
        }
      });
    }
    // reset
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isSwipingRef.current = false;
    setIsHovered(false); // resume auto-advance
  };
  const formattedPrice = Number(price_inr || 0).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });

  const handleAddToCart = () => {
    addToCart(product, 1);
  };

  const handleBuyNow = () => {
    addToCart(product, 1);
    navigate("/cart");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-3">
          {images.length > 0 && (
            <div
              className="relative overflow-hidden rounded-3xl bg-slate-100 shadow-sm h-[400px] touch-pan-y select-none"
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {images.map((src, i) => (
                <img
                  key={src}
                  src={resolveImage(src)}
                  alt={`${name} image ${i + 1}`}
                  className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${i === activeIndex ? 'opacity-100' : 'opacity-0'}`}
                />
              ))}
            </div>
          )}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {images.map((src, i) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`relative h-16 w-16 overflow-hidden rounded-xl ring-1 ring-white/10 focus:outline-none focus:ring-2 focus:ring-[#FFD700] transition-all ${i === activeIndex ? 'border-2 border-[#FFD700]' : 'border border-transparent'} group`}
                  aria-current={i === activeIndex ? 'true' : 'false'}
                >
                  <img
                    src={resolveImage(src)}
                    alt={`${name} thumbnail ${i + 1}`}
                    className="h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-90"
                  />
                  {i === activeIndex && (
                    <span className="absolute inset-0 rounded-xl shadow-inner shadow-[#FFD700]/40 pointer-events-none" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#FFD700]">
              {name}
            </h1>
            <p className="text-sm text-white max-w-prose">{benefits_brief}</p>
          </div>

          <div className="text-lg font-semibold text-[#FFD700]">
            {formattedPrice}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={handleAddToCart}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-[#b58b2f] px-5 py-2.5 text-sm font-medium tracking-wide text-black shadow-sm hover:bg-[#d4af37] transition-colors"
            >
              Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-full bg-[#b58b2f] px-5 py-2.5 text-sm font-medium tracking-wide text-black shadow-sm hover:bg-[#d4af37] transition-colors"
            >
              Buy Now
            </button>
          </div>

          {benefits_detail && (
            <section className="pt-4 space-y-2">
              <h2 className="text-sm font-semibold tracking-wide text-[#FFD700] uppercase">
                Benefits
              </h2>
              <p className="text-sm leading-relaxed text-white whitespace-pre-line">
                {benefits_detail}
              </p>
            </section>
          )}

          {/* Use Cases section removed as per request */}

          {ingredients && (
            <section className="pt-2 space-y-2">
              <h2 className="text-sm font-semibold tracking-wide text-[#FFD700] uppercase">
                Ingredients
              </h2>
              <p className="text-sm leading-relaxed text-white whitespace-pre-line">
                {ingredients}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductDetailPage;
