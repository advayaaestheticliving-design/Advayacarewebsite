import React, { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [authLabel, setAuthLabel] = useState("Log In/Sign up");
  const [authTarget, setAuthTarget] = useState("/membership");
  const [isAdmin, setIsAdmin] = useState(false);
  const adminEmail = "advaya.aestheticliving@gmail.com";

  React.useEffect(() => {
    let mounted = true;

    const applyUser = (user) => {
      if (!mounted) return;

      if (!user) {
        setAuthLabel("Log In/Sign up");
        setAuthTarget("/membership");
        setIsAdmin(false);
        return;
      }

      const fullName = String(user.user_metadata?.full_name || "").trim();
      const preferredName = String(user.user_metadata?.name || "").trim();
      const email = String(user.email || "").trim();
      const emailPrefix = email.includes("@") ? email.split("@")[0] : email;
      const username = fullName || preferredName || emailPrefix || "Account";

      setAuthLabel(username);
      setAuthTarget("/account");
      setIsAdmin(Boolean(adminEmail && email.toLowerCase() === adminEmail));
    };

    supabase.auth.getUser().then(({ data }) => {
      applyUser(data?.user || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user || null);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const isMoreActive = ["/contact", "/terms", "/gift-card", "/privacy"].includes(
    location.pathname
  );

  // Update nav link base styles for dark header
  const navLinkBase = "block px-1 text-white hover:text-[#b58b2f] transition";
  const navLinkDesktop = "text-white hover:text-[#b58b2f] transition";

  const getNavLinkClass = ({ isActive }) =>
    `${navLinkDesktop} ${isActive ? "border-b border-amber-700 pb-1" : ""}`;

  const getMobileNavLinkClass = ({ isActive }) =>
    `${navLinkBase} ${isActive ? "border-l-2 border-amber-700 pl-2" : ""}`;

  return (
    <header className="sticky top-0 z-20 bg-black border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center gap-6">
          {/* Nav (desktop only) */}
          <nav className="hidden md:flex items-center gap-6 text-[11px] font-medium tracking-wide uppercase">
            <NavLink to="/" className={getNavLinkClass} end>
              Home
            </NavLink>
            <NavLink to="/shop" className={getNavLinkClass}>
              Shop
            </NavLink>
            <NavLink to="/blog" className={getNavLinkClass}>
              Blog
            </NavLink>
            <div className="relative group">
              <button
                type="button"
                className={`${navLinkDesktop} inline-flex items-center gap-1 ${
                  isMoreActive ? "border-b border-amber-700 pb-1" : ""
                }`}
                aria-haspopup="menu"
              >
                More
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <div className="invisible absolute left-0 top-full mt-2 min-w-[13rem] rounded border border-neutral-700 bg-black/95 py-2 opacity-0 transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
                <NavLink to="/contact" className="block px-3 py-1 text-white hover:text-[#b58b2f] transition">
                  Contact Us
                </NavLink>
                <NavLink to="/terms" className="block px-3 py-1 text-white hover:text-[#b58b2f] transition">
                  Terms and Conditions
                </NavLink>
                <NavLink to="/gift-card" className="block px-3 py-1 text-white hover:text-[#b58b2f] transition">
                  Gift Card
                </NavLink>
                <NavLink to="/privacy" className="block px-3 py-1 text-white hover:text-[#b58b2f] transition">
                  Privacy Policy
                </NavLink>
              </div>
            </div>
            <NavLink to={authTarget} className={getNavLinkClass}>
              {authLabel}
            </NavLink>
            {isAdmin ? (
              <NavLink to="/admin/orders" className={getNavLinkClass}>
                Admin
              </NavLink>
            ) : null}
            <NavLink to="/cart" className={getNavLinkClass}>
              Cart
            </NavLink>
          </nav>

          {/* Logo + tagline (single instance) */}
          <Link to="/" className="flex items-center gap-3 ml-auto select-none">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Advayacare logo"
              width="48"
              height="48"
              className="logo-img shrink-0"
              draggable="false"
            />
            <span className="text-[10px] tracking-[0.28em] uppercase font-medium text-[#b58b2f] whitespace-nowrap">
              Glow with intention
            </span>
          </Link>

          {/* Hamburger (mobile only) */}
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center rounded-full border border-neutral-600 bg-black/60 p-2 text-white shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-[#b58b2f] focus:ring-offset-2 focus:ring-offset-black"
            aria-label="Open navigation"
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <span className="sr-only">Toggle navigation</span>
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              {isOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {isOpen && (
          <div className="md:hidden mt-2 space-y-1 pb-3 border-t border-neutral-700">
            <NavLink to="/" className={getMobileNavLinkClass} end>
              Home
            </NavLink>
            <NavLink to="/shop" className={getMobileNavLinkClass}>
              Shop
            </NavLink>
            <NavLink to="/blog" className={getMobileNavLinkClass}>
              Blog
            </NavLink>
            <details className="group">
              <summary
                className={`cursor-pointer list-none ${navLinkBase} inline-flex items-center gap-1 ${
                  isMoreActive ? "border-l-2 border-amber-700 pl-2" : ""
                }`}
              >
                More
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd"
                  />
                </svg>
              </summary>
              <div className="mt-1 space-y-1 border-l border-neutral-700 pl-3">
                <NavLink to="/contact" className={getMobileNavLinkClass}>
                  Contact Us
                </NavLink>
                <NavLink to="/terms" className={getMobileNavLinkClass}>
                  Terms and Conditions
                </NavLink>
                <NavLink to="/gift-card" className={getMobileNavLinkClass}>
                  Gift Card
                </NavLink>
                <NavLink to="/privacy" className={getMobileNavLinkClass}>
                  Privacy Policy
                </NavLink>
              </div>
            </details>
            <NavLink to={authTarget} className={getMobileNavLinkClass}>
              {authLabel}
            </NavLink>
            {isAdmin ? (
              <NavLink to="/admin/orders" className={getMobileNavLinkClass}>
                Admin
              </NavLink>
            ) : null}
            <NavLink to="/cart" className={getMobileNavLinkClass}>
              Cart
            </NavLink>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
