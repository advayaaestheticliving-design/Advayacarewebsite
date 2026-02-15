import React, { useState } from "react";
import { Link, NavLink } from "react-router-dom";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);

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
            <NavLink to="/contact" className={getNavLinkClass}>
              Contact Us
            </NavLink>
            <NavLink to="/terms" className={getNavLinkClass}>
              Terms and Conditions
            </NavLink>
            <NavLink to="/gift-card" className={getNavLinkClass}>
              Gift Card
            </NavLink>
            <NavLink to="/membership" className={getNavLinkClass}>
              Membership
            </NavLink>
            <NavLink to="/privacy" className={getNavLinkClass}>
              Privacy Policy
            </NavLink>
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
            <NavLink to="/contact" className={getMobileNavLinkClass}>
              Contact Us
            </NavLink>
            <NavLink to="/terms" className={getMobileNavLinkClass}>
              Terms and Conditions
            </NavLink>
            <NavLink to="/gift-card" className={getMobileNavLinkClass}>
              Gift Card
            </NavLink>
            <NavLink to="/membership" className={getMobileNavLinkClass}>
              Membership
            </NavLink>
            <NavLink to="/privacy" className={getMobileNavLinkClass}>
              Privacy Policy
            </NavLink>
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
