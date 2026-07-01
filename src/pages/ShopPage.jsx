import React from "react";
import ProductCard from "../components/ProductCard";
import MembershipPromoPopup from "../components/MembershipPromoPopup";
import { fetchProducts, getAvailableStock } from "../lib/productsApi";
import { getMembershipProfile } from "../lib/membershipApi";
import { supabase } from "../lib/supabaseClient";

const SHOP_MEMBER_PROMO_SESSION_KEY = "shop-member-promo-seen-v1";
const SHOP_MEMBER_PROMO_VARIANT_KEY = "shop-member-promo-variant-v1";
const SHOP_MEMBER_PROMO_DELAY_SECONDS = 120;
const SHOP_MEMBER_PROMO_DURATION_SECONDS = 120;

function pickPromoVariant() {
  return Math.random() < 0.5 ? "A" : "B";
}

function ShopPage() {
  const [selectedFilter, setSelectedFilter] = React.useState("All");
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = React.useState(false);
  const [sortBy, setSortBy] = React.useState("Featured");
  const [isSortOpen, setIsSortOpen] = React.useState(false);
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [showMemberPromo, setShowMemberPromo] = React.useState(false);
  const [promoSecondsLeft, setPromoSecondsLeft] = React.useState(SHOP_MEMBER_PROMO_DURATION_SECONDS);
  const [promoVariant, setPromoVariant] = React.useState("A");

  const categories = ["All", "Face", "Body", "Hair", "Pet Care"];
  const sortOptions = ["Featured", "Highest Price", "Lowest Price", "Discount"];

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

  const dismissMemberPromo = React.useCallback(() => {
    setShowMemberPromo(false);
    try {
      window.sessionStorage.setItem(SHOP_MEMBER_PROMO_SESSION_KEY, "1");
    } catch {
      // no-op: session storage might be unavailable in private browsing modes
    }
  }, []);

  React.useEffect(() => {
    let mounted = true;
    let showDelayTimeout;
    let countdownInterval;

    const runPromoEligibilityCheck = async () => {
      let alreadyShownInSession = false;

      try {
        alreadyShownInSession =
          window.sessionStorage.getItem(SHOP_MEMBER_PROMO_SESSION_KEY) === "1";
      } catch {
        alreadyShownInSession = false;
      }

      if (alreadyShownInSession || !mounted) {
        return;
      }

      let isLoggedIn = false;
      let hasMembershipProfile = false;

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        isLoggedIn = Boolean(session?.user?.id);
      } catch {
        isLoggedIn = false;
      }

      try {
        const membershipProfile = await getMembershipProfile();
        hasMembershipProfile = Boolean(membershipProfile?.id);
      } catch {
        hasMembershipProfile = false;
      }

      const shouldShowPromo = !isLoggedIn || !hasMembershipProfile;
      if (!mounted || !shouldShowPromo) {
        return;
      }

      let assignedVariant = "A";
      try {
        const storedVariant = window.sessionStorage.getItem(SHOP_MEMBER_PROMO_VARIANT_KEY);
        assignedVariant = storedVariant === "A" || storedVariant === "B"
          ? storedVariant
          : pickPromoVariant();
        window.sessionStorage.setItem(SHOP_MEMBER_PROMO_VARIANT_KEY, assignedVariant);
      } catch {
        assignedVariant = pickPromoVariant();
      }

      showDelayTimeout = window.setTimeout(() => {
        if (!mounted) return;

        const expiresAt = Date.now() + SHOP_MEMBER_PROMO_DURATION_SECONDS * 1000;
        setPromoVariant(assignedVariant);
        setPromoSecondsLeft(SHOP_MEMBER_PROMO_DURATION_SECONDS);
        setShowMemberPromo(true);

        countdownInterval = window.setInterval(() => {
          if (!mounted) return;

          const remainingSeconds = Math.max(
            0,
            Math.ceil((expiresAt - Date.now()) / 1000),
          );

          setPromoSecondsLeft(remainingSeconds);

          if (remainingSeconds <= 0) {
            window.clearInterval(countdownInterval);
            dismissMemberPromo();
          }
        }, 1000);
      }, SHOP_MEMBER_PROMO_DELAY_SECONDS * 1000);
    };

    runPromoEligibilityCheck();

    return () => {
      mounted = false;
      if (showDelayTimeout) {
        window.clearTimeout(showDelayTimeout);
      }
      if (countdownInterval) {
        window.clearInterval(countdownInterval);
      }
    };
  }, [dismissMemberPromo]);

  const filteredProducts =
    selectedFilter === "All"
      ? products
      : products.filter((product) => {
          const tags = product.filter_tags || product.filterTags || [];
          return tags.includes(selectedFilter);
        });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    // 1. Out of stock always goes to the bottom
    const aStock = getAvailableStock(a);
    const bStock = getAvailableStock(b);
    const aInStock = aStock > 0;
    const bInStock = bStock > 0;
    
    if (aInStock && !bInStock) return -1;
    if (!aInStock && bInStock) return 1;

    // 2. Sort by selected option
    if (sortBy === "Highest Price") {
      return (b.price_inr || 0) - (a.price_inr || 0);
    } else if (sortBy === "Lowest Price") {
      return (a.price_inr || 0) - (b.price_inr || 0);
    } else if (sortBy === "Discount") {
      const aDiscount = (a.compare_at_price && a.compare_at_price > a.price_inr) ? ((a.compare_at_price - a.price_inr) / a.compare_at_price) : 0;
      const bDiscount = (b.compare_at_price && b.compare_at_price > b.price_inr) ? ((b.compare_at_price - b.price_inr) / b.compare_at_price) : 0;
      return bDiscount - aDiscount;
    }
    return 0;
  });

  const handleSelectFilter = (category) => {
    setSelectedFilter(category);
    setIsMobileFiltersOpen(false);
  };

  return (
    <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Header */}
      <div className="max-w-2xl mb-8">
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-[#D4AF37]">
          Rituals for intentional glow
        </h1>
        <p className="mt-3 text-sm sm:text-base text-white">
          Browse our edit of everyday essentials crafted to slow you down,
          soften your routine, and let your glow feel intentional.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Desktop Sidebar */}
        <div className="hidden md:block w-64 shrink-0">
          <h2 className="text-lg font-semibold text-white mb-4">Categories</h2>
          <ul className="space-y-2">
            {categories.map((category) => (
              <li key={category}>
                <button
                  type="button"
                  onClick={() => handleSelectFilter(category)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedFilter === category
                      ? "bg-[#D4AF37] text-black"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {category}
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Main Content Area */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-6 md:justify-end">
            {/* Mobile Filter Button */}
            <button
              type="button"
              onClick={() => setIsMobileFiltersOpen(true)}
              className="md:hidden inline-flex items-center justify-center rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-white/20"
            >
              Filters
              <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
            </button>

            {/* Sort Dropdown */}
            <div className="relative inline-block text-left">
              <button
                type="button"
                onClick={() => setIsSortOpen((prev) => !prev)}
                className="inline-flex w-full justify-center rounded-full bg-[#D4AF37] px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-[#e3c458]"
              >
                {`Sort: ${sortBy}`}
                <svg className="ml-2 -mr-1 h-5 w-5 text-black" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.27a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {isSortOpen && (
                <div className="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-xl bg-black/90 ring-1 ring-white/10 shadow-lg focus:outline-none">
                  <div className="py-1">
                    {sortOptions.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => { setSortBy(option); setIsSortOpen(false); }}
                        className={`block w-full px-4 py-2 text-left text-sm ${sortBy === option ? "bg-[#D4AF37] text-black" : "text-white hover:bg-white/10"}`}
                      >
                        {option}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {sortedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filters Drawer */}
      {isMobileFiltersOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileFiltersOpen(false)}></div>
          <div className="relative flex w-full max-w-xs flex-col overflow-y-auto bg-neutral-900 pb-12 shadow-xl z-50">
            <div className="flex px-4 pb-2 pt-5">
              <button
                type="button"
                onClick={() => setIsMobileFiltersOpen(false)}
                className="-m-2 inline-flex items-center justify-center rounded-md p-2 text-white/70"
              >
                <span className="sr-only">Close menu</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mt-4 px-4">
              <h2 className="text-lg font-semibold text-white mb-4">Categories</h2>
              <ul className="space-y-2">
                {categories.map((category) => (
                  <li key={category}>
                    <button
                      type="button"
                      onClick={() => handleSelectFilter(category)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedFilter === category
                          ? "bg-[#D4AF37] text-black"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      {category}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <MembershipPromoPopup
        isOpen={showMemberPromo}
        variant={promoVariant}
        secondsLeft={promoSecondsLeft}
        onClose={dismissMemberPromo}
        onRegister={dismissMemberPromo}
      />
    </div>
  );
}

export default ShopPage;
