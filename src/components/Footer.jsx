import React from "react";
import { Link } from "react-router-dom";

const navItems = [
  { label: "Home", to: "/" },
  { label: "Shop", to: "/shop" },
  { label: "Blog", to: "/blog" },
  { label: "Contact Us", to: "/contact" },
  { label: "Terms and Conditions", to: "/terms" },
  { label: "Privacy Policy", to: "/privacy" },
  { label: "Gift Card", to: "/gift-card" },
  { label: "Membership", to: "/membership" },
  { label: "Cart", to: "/cart" },
];

function Footer() {
  return (
    <footer className="mt-12 border-t border-neutral-200 bg-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid gap-10 md:gap-16 md:grid-cols-3 items-start">
          {/* Left: Customer Service */}
          <div className="order-2 md:order-1">
            <h2 className="text-sm font-semibold tracking-wide text-white uppercase mb-3">
              Customer Service
            </h2>
            <p className="text-sm leading-relaxed text-white">
              Whatsapp: +91 8050403745
              <br />
              Email: support@advayacare.com
              <br />
              Whitefield,Bangalore
              <br />
              INDIA- 560066
            </p>
          </div>
          {/* Center: Logo + Tagline */}
          <div className="order-1 md:order-2 flex flex-col items-center text-center select-none">
            <Link to="/" className="flex flex-col items-center gap-4">
              <img
                src={`${import.meta.env.BASE_URL}images/logo.png`}
                alt="Advayacare logo"
                width="157"
                height="157"
                className="logo-img shrink-0 w-[157px] h-[157px] md:w-[157px] md:h-[157px]"
                draggable="false"
              />
            </Link>
          </div>
          {/* Right: Navigation */}
          <div className="order-3 md:order-3">
            <h3 className="text-sm font-semibold tracking-wide text-white uppercase mb-3">
              Navigate
            </h3>
            <nav className="grid grid-cols-2 gap-x-6 gap-y-2">
              {navItems.map((item) => (
                <div key={item.to}>
                  <Link
                    to={item.to}
                    className="text-sm text-white hover:text-amber-400 transition-colors"
                  >
                    {item.label}
                  </Link>
                </div>
              ))}
            </nav>
          </div>
        </div>
        <p className="mt-8 text-xs text-white text-center">© Advayacare.</p>
      </div>
    </footer>
  );
}

export default Footer;
