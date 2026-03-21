import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

import { CartProvider } from "./context/CartContext";
import Header from "./components/Header";
import Footer from "./components/Footer";
import GlobalBackgroundOrbs from "./components/GlobalBackgroundOrbs";

import HomePage from "./pages/HomePage";
import ShopPage from "./pages/ShopPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import CartPage from "./pages/CartPage";
import BlogPage from "./pages/BlogPage";
import BlogArticlePage from "./pages/BlogArticlePage";
import ContactPage from "./pages/ContactPage";
import TermsPage from "./pages/TermsPage";
import GiftCardPage from "./pages/GiftCardPage";
import MembershipPage from "./pages/MembershipPage";
import PrivacyPage from "./pages/PrivacyPage";
import AccountPage from "./pages/AccountPage";
import AdminLoginPage from "./pages/AdminLoginPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import BlogWriterPage from "./pages/BlogWriterPage";
import AdminProductsPage from "./pages/AdminProductsPage";
import { clearLegacyGuestAuthState, ensureSupabaseGuestSession } from "./lib/authSession";
import { useMemberSession } from "./context/MemberSessionContext";

function App() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith("/admin");
  const { authReady, isAuthenticated } = useMemberSession();

  React.useEffect(() => {
    if (isAdminRoute) {
      clearLegacyGuestAuthState().catch(() => undefined);
      return;
    }

    if (!authReady || isAuthenticated) {
      return;
    }

    ensureSupabaseGuestSession().catch((error) => {
      // eslint-disable-next-line no-console
      console.warn("Guest session bootstrap failed", error);
    });
  }, [authReady, isAdminRoute, isAuthenticated]);

  return (
    <CartProvider>
      <div className="min-h-screen flex flex-col text-black relative">
        <GlobalBackgroundOrbs />
        <div className="relative z-10 flex flex-col flex-1">
          {!isAdminRoute ? <Header /> : null}
          <main id="main" className="flex-1">
            {isAdminRoute ? (
              <Routes>
                <Route path="/admin" element={<AdminLoginPage />} />
                <Route path="/admin/orders" element={<AdminOrdersPage />} />
                <Route path="/admin/blogwriter" element={<BlogWriterPage />} />
                <Route path="/admin/products" element={<AdminProductsPage />} />
              </Routes>
            ) : (
              <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/product/:id" element={<ProductDetailPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/blog" element={<BlogPage />} />
                  <Route path="/blog/:slug" element={<BlogArticlePage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/gift-card" element={<GiftCardPage />} />
                  <Route path="/membership" element={<MembershipPage />} />
                  <Route path="/account" element={<AccountPage />} />
                </Routes>
              </div>
            )}
          </main>
          {!isAdminRoute ? <Footer /> : null}
        </div>
      </div>
    </CartProvider>
  );
}

export default App;
