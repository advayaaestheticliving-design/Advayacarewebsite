import React from "react";
import { NavLink } from "react-router-dom";

function AdminSidebar({ onSignOut, authLoading, onBeforeNavigate }) {
  const getNavClass = ({ isActive }) =>
    `block rounded-xl px-3 py-2 text-sm transition ${
      isActive
        ? "bg-[#D4AF37] text-white font-semibold"
        : "border border-neutral-700 text-white hover:border-[#D4AF37]"
    }`;

  function handleBeforeNavigate(event) {
    if (typeof onBeforeNavigate !== "function") {
      return;
    }

    const canContinue = onBeforeNavigate();
    if (canContinue === false) {
      event.preventDefault();
    }
  }

  function handleSignOut() {
    if (typeof onBeforeNavigate === "function") {
      const canContinue = onBeforeNavigate();
      if (canContinue === false) {
        return;
      }
    }

    onSignOut();
  }

  return (
    <aside className="rounded-2xl border border-neutral-700 bg-black/50 p-4 h-fit space-y-4">
      <p className="text-xs uppercase tracking-wide text-white/60">Admin Panel</p>

      <nav className="space-y-2" aria-label="Admin sections">
        <NavLink to="/admin/orders" className={getNavClass} onClick={handleBeforeNavigate}>
          Orders
        </NavLink>
        <NavLink to="/admin/comments" className={getNavClass} onClick={handleBeforeNavigate}>
          Comments
        </NavLink>
        <NavLink to="/admin/products" className={getNavClass} onClick={handleBeforeNavigate}>
          Products
        </NavLink>
        <NavLink to="/admin/coupons" className={getNavClass} onClick={handleBeforeNavigate}>
          Generate Coupon Code
        </NavLink>
        <NavLink to="/admin/blog-manager" className={getNavClass} onClick={handleBeforeNavigate}>
          Blog Manager
        </NavLink>
        <NavLink to="/admin/blogwriter" className={getNavClass} onClick={handleBeforeNavigate}>
          Blog Writer
        </NavLink>
      </nav>

      <button
        type="button"
        onClick={handleSignOut}
        disabled={authLoading}
        className="w-full rounded-full border border-neutral-500 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37] disabled:opacity-60"
      >
        {authLoading ? "Signing out..." : "Sign Out Admin"}
      </button>
    </aside>
  );
}

export default AdminSidebar;
