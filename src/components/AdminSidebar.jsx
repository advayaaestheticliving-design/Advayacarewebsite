import React from "react";
import { NavLink } from "react-router-dom";

function AdminSidebar({ onSignOut, authLoading }) {
  const getNavClass = ({ isActive }) =>
    `block rounded-xl px-3 py-2 text-sm transition ${
      isActive
        ? "bg-[#D4AF37] text-black font-semibold"
        : "border border-neutral-700 text-white hover:border-[#D4AF37]"
    }`;

  return (
    <aside className="rounded-2xl border border-neutral-700 bg-black/50 p-4 h-fit space-y-4">
      <p className="text-xs uppercase tracking-wide text-white/60">Admin Panel</p>

      <nav className="space-y-2" aria-label="Admin sections">
        <NavLink to="/admin/orders" className={getNavClass}>
          Orders
        </NavLink>
        <NavLink to="/admin/products" className={getNavClass}>
          Products
        </NavLink>
        <NavLink to="/admin/blogwriter" className={getNavClass}>
          Blog Writer
        </NavLink>
      </nav>

      <button
        type="button"
        onClick={onSignOut}
        disabled={authLoading}
        className="w-full rounded-full border border-neutral-500 px-4 py-2 text-xs font-medium text-white hover:border-[#D4AF37] disabled:opacity-60"
      >
        {authLoading ? "Signing out..." : "Sign Out Admin"}
      </button>
    </aside>
  );
}

export default AdminSidebar;
