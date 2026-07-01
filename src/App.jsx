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
import AdminBlogManagerPage from "./pages/AdminBlogManagerPage";
import BlogWriterPage from "./pages/BlogWriterPage";
import AdminProductsPage from "./pages/AdminProductsPage";
import AdminCommentsPage from "./pages/AdminCommentsPage";
import AdminCouponsPage from "./pages/AdminCouponsPage";
import AdminAffiliatesPage from "./pages/AdminAffiliatesPage";
import TradePage from "./pages/TradePage";
import TradeOrderPage from "./pages/TradeOrderPage";
import AdminB2BPage from "./pages/AdminB2BPage";
import AffiliateApplicationPage from "./pages/AffiliateApplicationPage";
import AffiliateDashboardPage from "./pages/AffiliateDashboardPage";
import { clearLegacyGuestAuthState } from "./lib/authSession";
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
                <Route path="/admin/comments" element={<AdminCommentsPage />} />
                <Route path="/admin/blog-manager" element={<AdminBlogManagerPage />} />
                <Route path="/admin/blogwriter" element={<BlogWriterPage />} />
                <Route path="/admin/products" element={<AdminProductsPage />} />
                <Route path="/admin/coupons" element={<AdminCouponsPage />} />
                <Route path="/admin/affiliates" element={<AdminAffiliatesPage />} />
                <Route path="/admin/b2b" element={<AdminB2BPage />} />
              </Routes>
            ) : (
              <div className={location.pathname.startsWith('/shop') ? "w-full" : "max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16"}>
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
                  <Route path="/affiliate" element={<AffiliateApplicationPage />} />
                  <Route path="/affiliate/dashboard" element={<AffiliateDashboardPage />} />
                  <Route path="/trade" element={<TradePage />} />
                  <Route path="/trade/order/:token" element={<TradeOrderPage />} />
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
