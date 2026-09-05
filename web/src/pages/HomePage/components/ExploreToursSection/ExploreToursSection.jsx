import React, { useState, useEffect, useRef } from "react";
import useInView from "../../hooks/useInView";
import VietnamMapFilter from "../VietnamMapFilter/VietnamMapFilter";
import TourAccordionCarousel from "../TourAccordionCarousel/TourAccordionCarousel";

export default function ExploreToursSection() {
  const [activeTourIndex, setActiveTourIndex] = useState(0);
  const [sectionRef, isInView] = useInView();
  const totalTours = 4;

  const handlePrev = () => {
    setActiveTourIndex((prev) => (prev - 1 + totalTours) % totalTours);
  };

  const handleNext = () => {
    setActiveTourIndex((prev) => (prev + 1) % totalTours);
  };

  return (
    <section ref={sectionRef} className={`wl-section ${isInView ? "in-view" : ""}`} id="tour-packages">
      <div className="wl-section__container">
        {/* BEM Section Header */}
        <div className="wl-section__header">
          <div className="wl-slide-left">
            <h2 className="wl-section__title">Explore Featured Destinations &amp; Curated Tours</h2>
            <p className="wl-section__subtitle">
              Immerse in unforgettable journeys with premium curated tours, expert local guides, and authentic cultural experiences.
            </p>
          </div>

          {/* Carousel navigation controls */}
          <div className="wl-section__controls wl-slide-right">
            <button
              onClick={handlePrev}
              aria-label="Previous tour"
              className="wl-section__control-btn"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
            </button>
            <button
              onClick={handleNext}
              aria-label="Next tour"
              className="wl-section__control-btn"
            >
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* Main Layout Grid */}
        <div className="wl-section__grid">
          <div className="wl-section__grid-sidebar wl-slide-left">
            <VietnamMapFilter />
          </div>
          <div className="wl-section__grid-main wl-slide-right overflow-hidden">
            <TourAccordionCarousel activeIndex={activeTourIndex} onSelectCard={setActiveTourIndex} />
          </div>
        </div>
      </div>
    </section>
  );
}
