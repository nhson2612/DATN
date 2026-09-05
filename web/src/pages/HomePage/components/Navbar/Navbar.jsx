import React, { useState, useEffect } from "react";
import Logo from "../../../../components/common/Logo";
import "./Navbar.css";

export default function Navbar() {
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY <= 50) {
        // At top of page -> Full Navbar
        setIsExpanded(true);
      } else if (currentScrollY < lastScrollY - 5) {
        // Scrolling UP -> Expand Navbar
        setIsExpanded(true);
      } else if (currentScrollY > lastScrollY + 5) {
        // Scrolling DOWN -> Collapse to Logo Circle
        setIsExpanded(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`wl-nav ${isExpanded ? "wl-nav--expanded" : "wl-nav--collapsed"}`}>
      <div className="wl-nav__container">
        {/* Left Wing Nav Items */}
        <div className="wl-nav__wing wl-nav__wing--left">
          <a className="wl-nav__item" href="#tour-packages">
            <span className="material-symbols-outlined text-base text-orange-500">travel_explore</span>
            <span>Explore Tours</span>
          </a>
          <a className="wl-nav__item" href="#custom-itinerary">
            <span className="material-symbols-outlined text-base text-orange-500">route</span>
            <span>Plan Itinerary</span>
          </a>
        </div>

        {/* Center Circular Logo Badge */}
        <a className="wl-nav__center-logo" href="/" aria-label="Wanderlust Home">
          <div className="wl-nav__logo-circle">
            <Logo className="w-20 h-20" />
          </div>
        </a>

        {/* Right Wing Nav Items & Actions */}
        <div className="wl-nav__wing wl-nav__wing--right">
          <a className="wl-nav__item" href="#guide">
            <span className="material-symbols-outlined text-base text-orange-500">menu_book</span>
            <span>Guide</span>
          </a>
          <button className="wl-nav__btn wl-nav__btn--primary">
            <span className="material-symbols-outlined text-sm">account_circle</span>
            <span>Sign In</span>
          </button>
        </div>
      </div>
    </header>
  );
}
