import React, { useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMemberSession } from "../context/MemberSessionContext";
import { signOutMembership } from "../lib/membershipApi";
import { useCart } from "../context/CartContext";

const Header = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const profileMenuRef = React.useRef(null);
  const [authLabel, setAuthLabel] = useState("Log In/Sign up");
  const [authTarget, setAuthTarget] = useState("/membership");
  const [isAdmin, setIsAdmin] = useState(false);
  const adminEmail = "advaya.aestheticliving@gmail.com";
  const { user } = useMemberSession();
  const { items } = useCart();
  const isMemberAuthenticated = Boolean(user?.id);

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  React.useEffect(() => {
    const applyUser = (user) => {
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

    applyUser(user || null);
  }, [adminEmail, user]);

  React.useEffect(() => {
    setIsProfileMenuOpen(false);
    setIsOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!isProfileMenuOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!profileMenuRef.current?.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isProfileMenuOpen]);

  const handleProfileMenuToggle = () => {
    setIsProfileMenuOpen((prev) => !prev);
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);

    try {
      await signOutMembership();
      setIsProfileMenuOpen(false);
      setIsOpen(false);
      navigate("/membership");
    } catch {
      // Keep the menu usable even if sign-out fails.
    } finally {
      setIsSigningOut(false);
    }
  };

  const isMoreActive = ["/contact", "/terms", "/gift-card", "/privacy", "/trade", "/affiliate"].some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );

  // Update nav link base styles for dark header
  const navLinkBase = "block px-1 text-white hover:text-[#b58b2f] transition";
  const navLinkDesktop = "text-white hover:text-[#b58b2f] transition";

  const getNavLinkClass = ({ isActive }) =>
    `${navLinkDesktop} ${isActive ? "border-b border-amber-700 pb-1" : ""}`;

  const getMobileNavLinkClass = ({ isActive }) =>
    `${navLinkBase} ${isActive ? "border-l-2 border-amber-700 pl-2" : ""}`;

  const cartIcon = (
    <div className="relative inline-flex items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l1.2 10.2a2 2 0 001.98 1.8h8.64a2 2 0 001.97-1.66L20 8H7" />
        <circle cx="10" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
      {cartItemCount > 0 && (
        <span className="absolute -top-2 -right-2.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#b58b2f] px-1 text-[9px] font-bold text-black">
          {cartItemCount > 99 ? '99+' : cartItemCount}
        </span>
      )}
    </div>
  );

  const mobileCartIcon = (
    <div className="relative inline-flex items-center justify-center">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l1.2 10.2a2 2 0 001.98 1.8h8.64a2 2 0 001.97-1.66L20 8H7" />
        <circle cx="10" cy="19" r="1.5" />
        <circle cx="17" cy="19" r="1.5" />
      </svg>
      {cartItemCount > 0 && (
        <span className="absolute -top-1.5 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#b58b2f] px-1 text-[9px] font-bold text-black">
          {cartItemCount > 99 ? '99+' : cartItemCount}
        </span>
      )}
    </div>
  );

  return (
    <header className="sticky top-0 z-20 bg-black border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-3 md:flex h-20 items-center md:gap-6">
          <Link to="/" className="flex items-center select-none shrink-0 justify-self-start">
            <img
              src={`${import.meta.env.BASE_URL}images/logo.png`}
              alt="Advayacare logo"
              width="72"
              height="72"
              className="logo-img shrink-0 w-[72px] h-[72px]"
              draggable="false"
            />
          </Link>

          {/* Hamburger (mobile only) */}
          <div className="md:hidden flex justify-center">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-full border border-neutral-600 bg-black/60 p-2 text-white shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-[#b58b2f] focus:ring-offset-2 focus:ring-offset-black"
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

          {/* Cart (mobile only) */}
          <div className="md:hidden flex justify-end">
            <Link
              to="/cart"
              className="inline-flex items-center justify-center rounded-full border border-neutral-600 bg-black/60 p-2 text-white shadow-sm hover:bg-black focus:outline-none focus:ring-2 focus:ring-[#b58b2f] focus:ring-offset-2 focus:ring-offset-black"
              aria-label="Cart"
            >
              {mobileCartIcon}
            </Link>
          </div>

          {/* Nav (desktop only) */}
          <nav className="hidden md:flex flex-1 items-center gap-6 ml-2 text-[11px] font-medium tracking-wide uppercase">
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
                <NavLink to="/trade" className="block px-3 py-1 text-white hover:text-[#b58b2f] transition">
                  Salon &amp; Spa Trade
                </NavLink>
                <NavLink to="/affiliate" className="block px-3 py-1 text-white hover:text-[#b58b2f] transition">
                  Become an Affiliate
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
          </nav>

          <div className="hidden md:flex items-center gap-4 ml-auto pl-4 border-l border-neutral-700/80 text-[11px] font-medium tracking-wide uppercase">
            {isMemberAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={handleProfileMenuToggle}
                  className={`${navLinkDesktop} inline-flex items-center gap-1 ${isProfileMenuOpen ? "border-b border-amber-700 pb-1" : ""}`}
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                >
                  {authLabel}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-3 w-3"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                {isProfileMenuOpen ? (
                  <div className="absolute right-0 top-full mt-2 min-w-[12rem] rounded border border-neutral-700 bg-black/95 py-2 shadow-xl">
                    <Link
                      to="/account"
                      className="block px-3 py-2 text-left text-white transition hover:text-[#b58b2f]"
                    >
                      My Profile
                    </Link>
                    <Link
                      to="/affiliate/dashboard"
                      className="block px-3 py-2 text-left text-white transition hover:text-[#b58b2f]"
                    >
                      Affiliate Dashboard
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={isSigningOut}
                      className="block w-full px-3 py-2 text-left text-white transition hover:text-[#b58b2f] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSigningOut ? "Logging Out..." : "Log Out"}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <NavLink to={authTarget} className={getNavLinkClass}>
                {authLabel}
              </NavLink>
            )}
            {isAdmin ? (
              <NavLink to="/admin" className={getNavLinkClass}>
                Admin
              </NavLink>
            ) : null}
            <NavLink to="/cart" className={`${navLinkDesktop} inline-flex items-center gap-1`}>
              {cartIcon}
              Cart
            </NavLink>
          </div>

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
                <NavLink to="/trade" className={getMobileNavLinkClass}>
                  Salon &amp; Spa Trade
                </NavLink>
                <NavLink to="/affiliate" className={getMobileNavLinkClass}>
                  Become an Affiliate
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
            {isMemberAuthenticated ? (
              <details className="group">
                <summary className={`${navLinkBase} cursor-pointer list-none`}>
                  {authLabel}
                </summary>
                <div className="mt-1 space-y-1 border-l border-neutral-700 pl-3">
                  <NavLink to="/account" className={getMobileNavLinkClass}>
                    My Profile
                  </NavLink>
                  <NavLink to="/affiliate/dashboard" className={getMobileNavLinkClass}>
                    Affiliate Dashboard
                  </NavLink>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="block w-full px-1 text-left text-white transition hover:text-[#b58b2f] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSigningOut ? "Logging Out..." : "Log Out"}
                  </button>
                </div>
              </details>
            ) : (
              <NavLink to={authTarget} className={getMobileNavLinkClass}>
                {authLabel}
              </NavLink>
            )}
            {isAdmin ? (
              <NavLink to="/admin" className={getMobileNavLinkClass}>
                Admin
              </NavLink>
            ) : null}
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
