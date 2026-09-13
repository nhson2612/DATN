import React, { useState, useEffect, useRef } from "react";
import useInView from "../../hooks/useInView";
import "./HeroSection.css";

const HERO_SLIDES = [
  {
    id: 0,
    title: "Ninh Binh & Ba Be",
    src: "/assets/images/hero-slide-1.jpg",
  },
  {
    id: 1,
    title: "Halong Bay",
    src: "/assets/images/hero-slide-2.jpg",
  },
  {
    id: 2,
    title: "Mu Cang Chai / Sapa",
    src: "/assets/images/hero-slide-3.jpg",
  },
];

export default function HeroSection() {
  const [currentSlide, setCurrentSlide] = useState(2);
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("2025-06-18");
  const [endDate, setEndDate] = useState("2025-06-20");

  const startDateInputRef = useRef(null);
  const endDateInputRef = useRef(null);

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  const [sectionRef, isInView] = useInView();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section ref={sectionRef} className={`wl-hero ${isInView ? "in-view" : ""}`}>
      {/* Background Carousel */}
      <div className="wl-hero__carousel" id="hero-carousel">
        {HERO_SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            className={`wl-hero__slide ${
              currentSlide === idx ? "wl-hero__slide--active" : "wl-hero__slide--inactive"
            }`}
          >
            <img alt={slide.title} className="wl-hero__slide-img" src={slide.src} />
            <div className="wl-hero__slide-overlay"></div>
          </div>
        ))}
      </div>

      {/* Hero Content */}
      <div className="wl-hero__content">
        <h1 className="wl-hero__title wl-slide-left">
          WANDERLUST <span className="wl-hero__title-highlight">VIETNAM</span>
        </h1>
        <p className="wl-hero__subtitle wl-slide-right">
          Craft your unique journey across Vietnam — curated boutique tours or tailor-made itineraries.
        </p>
        <div className="wl-hero__actions wl-slide-left">
          <a className="wl-hero__link" href="#tour-packages">
            <span>Explore Tours</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
          <a className="wl-hero__link" href="#custom-itinerary">
            <span>Plan Itinerary</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
        </div>
      </div>

      {/* Carousel Dots */}
      <div className="wl-hero__dots">
        {HERO_SLIDES.map((_, idx) => (
          <button
            key={idx}
            aria-label={`Slide ${idx + 1}`}
            onClick={() => setCurrentSlide(idx)}
            className={`wl-hero__dot ${currentSlide === idx ? "wl-hero__dot--active" : "wl-hero__dot--inactive"}`}
          ></button>
        ))}
      </div>

      {/* Search Engine Bar */}
      <div className="wl-search wl-slide-right">
        <div className="wl-search__card">
          <div className="wl-search__row">
            {/* Destination Field */}
            <div className="wl-search__field wl-search__field--main">
              <div className="wl-search__label">
                <span className="material-symbols-outlined text-base">location_on</span>
                <span>Destination</span>
              </div>
              <div className="wl-search__value">
                <input
                  type="text"
                  className="wl-search__input"
                  placeholder="Ninh Binh (Trang An, Tam Coc)"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                />
              </div>
            </div>

            <div className="wl-search__divider"></div>

            {/* Start Date Field */}
            <div
              className="wl-search__field"
              onClick={() => startDateInputRef.current?.showPicker()}
            >
              <div className="wl-search__label">
                <span className="material-symbols-outlined text-sm text-slate-400">calendar_today</span>
                <span className="text-slate-500">Start</span>
              </div>
              <div className="wl-search__value text-sm">
                {formatDateDisplay(startDate)}
                <input
                  ref={startDateInputRef}
                  type="date"
                  className="wl-search__date-hidden"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="wl-search__divider"></div>

            {/* End Date Field */}
            <div
              className="wl-search__field"
              onClick={() => endDateInputRef.current?.showPicker()}
            >
              <div className="wl-search__label">
                <span className="material-symbols-outlined text-sm text-slate-400">event</span>
                <span className="text-slate-500">End</span>
              </div>
              <div className="wl-search__value text-sm">
                {formatDateDisplay(endDate)}
                <input
                  ref={endDateInputRef}
                  type="date"
                  className="wl-search__date-hidden"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="wl-search__divider"></div>

            {/* Guests Field */}
            <div className="wl-search__field">
              <div className="wl-search__label">
                <span className="material-symbols-outlined text-sm text-slate-400">group</span>
                <span className="text-slate-500">Guests</span>
              </div>
              <div className="wl-search__value text-sm">2 Adults, 1 Room</div>
            </div>

            {/* Search Button Container for absolute full height */}
            <div className="wl-search__btn-wrapper">
              <button className="wl-search__btn group" title="Search">
                <span className="hidden md:inline text-xs font-black uppercase tracking-wider">Search</span>
                <span className="material-symbols-outlined text-xl group-hover:translate-x-1 transition-transform">
                  arrow_forward
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
