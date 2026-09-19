import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import VoyageDrawer from "../../../shared/layout/VoyageDrawer";
import "./Home.css";

const SLIDES = [
  {
    id: 1,
    url: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=2000&q=90",
    location: "Positano, Amalfi Coast",
    country: "Italy",
    weather: "22°C · Golden Hour",
  },
  {
    id: 2,
    url: "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=2000&q=90",
    location: "Ha Long Bay, Quang Ninh",
    country: "Vietnam",
    weather: "26°C · Emerald Waters",
  },
  {
    id: 3,
    url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=2000&q=88",
    location: "Mu Cang Chai, Yen Bai",
    country: "Vietnam",
    weather: "20°C · Misty Terraces",
  },
];

const TRENDING_DESTINATIONS = [
  "Ha Long Bay",
  "Ninh Binh",
  "Sapa",
  "Da Nang",
  "Phu Quoc",
  "Kyoto",
];

const POPULAR_DESTINATIONS = [
  "Ha Long Bay",
  "Ninh Binh",
  "Sapa",
  "Da Nang & Hoi An",
  "Phu Quoc",
  "Kyoto, Japan",
  "Bali, Indonesia",
];

export default function HomePage({ user, onNeedAuth, onLogout }) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isNavSearchOpen, setIsNavSearchOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const navSearchRef = useRef(null);
  const navSearchInputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isFromLogin = !!location.state?.fromLoginTransition;

  // Slide transition timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Close nav search bar on outside click
  useEffect(() => {
    function handleNavSearchClickOutside(event) {
      if (
        navSearchRef.current &&
        !navSearchRef.current.contains(event.target)
      ) {
        setIsNavSearchOpen(false);
      }
    }
    if (isNavSearchOpen) {
      document.addEventListener("mousedown", handleNavSearchClickOutside);
    }
    return () =>
      document.removeEventListener("mousedown", handleNavSearchClickOutside);
  }, [isNavSearchOpen]);

  const handleNavSearchSubmit = (e) => {
    e?.preventDefault();
    if (navSearchQuery.trim()) {
      setIsNavSearchOpen(false);
      navigate(`/tour?q=${encodeURIComponent(navSearchQuery.trim())}`);
    } else {
      navSearchInputRef.current?.focus();
    }
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    setIsSearchOpen(false);
    if (searchQuery.trim()) {
      navigate(`/tour?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/tour");
    }
  };

  const handlePillClick = (dest) => {
    setIsSearchOpen(false);
    navigate(`/tour?q=${encodeURIComponent(dest)}`);
  };

  const activeSlideData = SLIDES[currentSlide] || SLIDES[0];

  return (
    <div className={`voyage-home ${isFromLogin ? "voyage-home--from-login" : ""}`}>
      {/* Background Slides Frame */}
      <div className="voyage-bg">
        {SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            className={`voyage-bg-img ${
              currentSlide === idx ? "voyage-bg-img--active" : ""
            }`}
            style={{ backgroundImage: `url(${slide.image || slide.url})` }}
            aria-hidden={currentSlide !== idx}
          />
        ))}
      </div>

      {/* Foreground Container */}
      <div className="voyage-shell voyage-inner">
        {/* Navigation Bar */}
        <header className="voyage-nav">
          <Link to="/" className="voyage-brand">
            Voyage
          </Link>

          <nav className="voyage-navlinks">
            <Link to="/" className="voyage-navlink">
              Destinations
            </Link>
            <Link to="/tour" className="voyage-navlink">
              Tours
            </Link>
            <Link to="/chuyen-di" className="voyage-navlink">
              Experiences
            </Link>
          </nav>

          <div className="voyage-actions">
            {/* Expandable Search Bar extending left */}
            <div
              className={`voyage-nav-search ${
                isNavSearchOpen ? "voyage-nav-search--open" : ""
              }`}
              ref={navSearchRef}
            >
              <button
                type="button"
                className="voyage-nav-search-trigger"
                onClick={() => {
                  if (!isNavSearchOpen) {
                    setIsNavSearchOpen(true);
                    setTimeout(() => navSearchInputRef.current?.focus(), 100);
                  } else if (navSearchQuery.trim()) {
                    handleNavSearchSubmit();
                  } else {
                    navSearchInputRef.current?.focus();
                  }
                }}
                title="Search destinations & tours"
                aria-label="Search"
              >
                <span className="material-symbols-outlined text-[19px]">
                  search
                </span>
              </button>

              <form
                className="voyage-nav-search-form"
                onSubmit={handleNavSearchSubmit}
              >
                <input
                  ref={navSearchInputRef}
                  type="text"
                  className="voyage-nav-search-input"
                  placeholder="Search destinations, tours..."
                  value={navSearchQuery}
                  onChange={(e) => setNavSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setIsNavSearchOpen(false);
                    }
                  }}
                  tabIndex={isNavSearchOpen ? 0 : -1}
                />
                {isNavSearchOpen && (
                  <button
                    type="button"
                    className="voyage-nav-search-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsNavSearchOpen(false);
                      setNavSearchQuery("");
                    }}
                    aria-label="Close search"
                  >
                    ✕
                  </button>
                )}
              </form>
            </div>

            {/* Menu Hamburger Button */}
            <button
              type="button"
              className="voyage-iconbtn"
              onClick={() => setIsDrawerOpen(true)}
              title="Open menu"
              aria-label="Menu"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          </div>
        </header>

        {/* Hero Copy with Trending Chips */}
        <div className="voyage-hero-copy">
          <h1 className="voyage-hero-title">
            Two ways<br />to see the world
          </h1>
          <p className="voyage-hero-desc">
            Same curiosity. Different journeys.
          </p>

          {/* Trending Destinations Row */}
          <div className="voyage-trending-row">
            <span className="voyage-trending-label">Trending:</span>
            {TRENDING_DESTINATIONS.map((dest) => (
              <button
                key={dest}
                type="button"
                className="voyage-trending-chip"
                onClick={() => handlePillClick(dest)}
              >
                {dest}
              </button>
            ))}
          </div>
        </div>

        {/* The Two Choice Cards */}
        <div className="voyage-choices">
          {/* Choice 1: Explore tours */}
          <Link to="/tour" className="voyage-choice-card">
            <h2 className="voyage-choice-title">Explore tours</h2>
            <p className="voyage-choice-desc">
              Handpicked trips, ready for you.
            </p>
            <div className="voyage-choice-action">
              <span>Explore tours</span>
              <span className="voyage-choice-arrow">→</span>
            </div>
            <img
              src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1400&q=85"
              alt="Majestic mountain landscape"
              className="voyage-choice-img"
            />
          </Link>

          {/* Choice 2: Plan your own trip */}
          <Link to="/chuyen-di" className="voyage-choice-card">
            <h2 className="voyage-choice-title">Plan your own trip</h2>
            <p className="voyage-choice-desc">
              Get personalised recommendations with AI.
            </p>
            <div className="voyage-choice-action">
              <span>Start planning</span>
              <span className="voyage-choice-arrow">→</span>
            </div>
            <img
              src="https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1400&q=85"
              alt="Picturesque coastal village at dusk"
              className="voyage-choice-img"
            />
          </Link>
        </div>

        {/* Footer Row */}
        <footer className="voyage-footer">
          <div className="voyage-footer-quote">Travel differently</div>

          <div className="voyage-slides-nav">
            {SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`voyage-slide-dash ${
                  currentSlide === idx ? "voyage-slide-dash--active" : ""
                }`}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        </footer>
      </div>

      {/* Search Modal */}
      {isSearchOpen && (
        <div
          className="voyage-modal-overlay"
          onClick={() => setIsSearchOpen(false)}
        >
          <div
            className="voyage-search-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="voyage-search-header">
              <h3 className="voyage-search-title">Where do you want to go?</h3>
              <button
                type="button"
                className="voyage-search-close"
                onClick={() => setIsSearchOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form className="voyage-search-body" onSubmit={handleSearchSubmit}>
              <div className="voyage-search-input-wrap">
                <span className="material-symbols-outlined text-[#7a858d]">
                  search
                </span>
                <input
                  type="text"
                  className="voyage-search-input"
                  placeholder="e.g. Ha Long Bay, Sapa, Da Nang, Japan..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="voyage-search-pills">
                {POPULAR_DESTINATIONS.map((dest) => (
                  <button
                    key={dest}
                    type="button"
                    className="voyage-search-pill"
                    onClick={() => handlePillClick(dest)}
                  >
                    {dest}
                  </button>
                ))}
              </div>

              <button type="submit" className="voyage-search-submit">
                <span>Explore destinations & tours</span>
                <span>→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Slide-out Menu Drawer dùng chung */}
      <VoyageDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={user}
        onNeedAuth={onNeedAuth}
        onLogout={onLogout}
      />
    </div>
  );
}
