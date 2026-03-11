import React from "react";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../lib/productsApi";

function ShopPage() {
  const [selectedFilter, setSelectedFilter] = React.useState("All");
  const [isOpen, setIsOpen] = React.useState(false);
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  const categories = ["All", "Face", "Body", "Hair"];

  React.useEffect(() => {
    let mounted = true;

    try {
      setLoading(true);
      setError(null);

      fetchProducts()
        .then((rows) => {
          if (!mounted) return;
          setProducts(Array.isArray(rows) ? rows : []);
        })
        .catch(() => {
          if (!mounted) return;
          setError("Something went wrong loading products.");
          setProducts([]);
        })
        .finally(() => {
          if (!mounted) return;
          setLoading(false);
        });
    } catch {
      setError("Something went wrong loading products.");
      setProducts([]);
    }

    return () => {
      mounted = false;
    };
  }, []);

  const filteredProducts =
    selectedFilter === "All"
      ? products
      : products.filter((product) => {
          const tags = product.filter_tags || product.filterTags || [];
          return tags.includes(selectedFilter);
        });

  const toggleDropdown = () => setIsOpen((prev) => !prev);

  const handleSelect = (category) => {
    setSelectedFilter(category);
    setIsOpen(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="max-w-2xl">
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">
          Rituals for intentional glow
        </h1>
        <p className="mt-3 text-sm sm:text-base text-white">
          Browse our edit of everyday essentials crafted to slow you down,
          soften your routine, and let your glow feel intentional.
        </p>
      </div>
      <div className="mt-6 flex justify-end">
        <div className="relative inline-block text-left">
          <button
            type="button"
            onClick={toggleDropdown}
            className="inline-flex w-full justify-center rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-[#e3c458] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#D4AF37]"
          >
            {`Filter: ${selectedFilter}`}
            <svg
              className="ml-2 h-4 w-4 text-black"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute right-0 z-10 mt-2 w-40 origin-top-right rounded-xl bg-black/90 ring-1 ring-white/10 shadow-lg focus:outline-none">
              <div className="py-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleSelect(category)}
                    className={`block w-full px-4 py-2 text-left text-sm ${
                      selectedFilter === category
                        ? "bg-[#D4AF37] text-black"
                        : "text-white hover:bg-white/10"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {loading && (
        <p className="mt-8 text-sm text-white/80">Loading products...</p>
      )}
      {!loading && error && (
        <p className="mt-8 text-sm text-red-400">{error}</p>
      )}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-8">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ShopPage;
