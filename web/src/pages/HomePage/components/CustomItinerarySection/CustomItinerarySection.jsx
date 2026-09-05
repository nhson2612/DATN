import React, { useState, useEffect, useRef } from "react";
import useInView from "../../hooks/useInView";
import HanoiRouteMap from "../HanoiRouteMap/HanoiRouteMap";
import ItineraryTimeline from "../ItineraryTimeline/ItineraryTimeline";

export default function CustomItinerarySection() {
  const [sectionRef, isInView] = useInView();

  return (
    <section ref={sectionRef} className={`wl-section ${isInView ? "in-view" : ""}`} id="custom-itinerary">
      <div className="wl-section__container">
        {/* BEM Section Header */}
        <div className="wl-section__header">
          <div className="wl-slide-left">
            <h2 className="wl-section__title">Bespoke Tailor-Made Itineraries</h2>
            <p className="wl-section__subtitle">
              Flexibly customize every stop, duration, and budget to fit your dream travel style.
            </p>
          </div>
        </div>

        {/* 3:7 Layout Grid */}
        <div className="wl-section__grid">
          <div className="wl-section__grid-sidebar wl-slide-left">
            <HanoiRouteMap />
          </div>
          <div className="wl-section__grid-main wl-slide-right">
            <ItineraryTimeline />
          </div>
        </div>
      </div>
    </section>
  );
}
