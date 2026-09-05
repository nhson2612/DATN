import React from "react";
import "./ItineraryTimeline.css";

export default function ItineraryTimeline() {
  return (
    <div className="wl-timeline">
      {/* Summary Header: Budget & Estimate Time */}
      <div className="wl-timeline__header">
        <div className="wl-timeline__stat wl-timeline__stat--budget">
          <span className="wl-timeline__value wl-timeline__value--emerald">
            $145
          </span>
        </div>
        <div className="wl-timeline__stat wl-timeline__stat--duration">
          <span className="wl-timeline__value wl-timeline__value--dark">
            3 Days 2 Nights
          </span>
        </div>
      </div>

      {/* Timeline / Stepper by Day */}
      <div className="wl-timeline__stepper">
        {/* DAY 1 */}
        <div className="wl-timeline__step">
          <div className="wl-timeline__badge wl-timeline__badge--orange">
            <svg viewBox="0 0 384 512" className="wl-timeline__pin-icon" role="img" aria-hidden="true">
              <path fill="currentColor" d="M192 0C86 0 0 84.4 0 188.6 0 307.9 120.2 450.9 170.4 505.4 182.2 518.2 201.8 518.2 213.6 505.4 263.8 450.9 384 307.9 384 188.6 384 84.4 298 0 192 0z" />
            </svg>
            <span className="wl-timeline__badge-num">01</span>
          </div>
          <div className="wl-timeline__card">
            <h4 className="wl-timeline__title">
              Day 1: Thang Long Heritage &amp; Old Quarter Pulse
            </h4>
            <p className="wl-timeline__desc">
              Depart from <strong className="wl-timeline__bold">Hoan Kiem Lake</strong>, savor authentic{" "}
              <strong className="wl-timeline__highlight-orange">Giang Egg Coffee</strong>. Visit Ngoc Son Temple &amp; stroll around Ta Hien Night Street.
            </p>
            <div className="wl-timeline__tags">
              <span className="wl-timeline__tag">☕ Giang Egg Coffee</span>
              <span className="wl-timeline__tag">🏛️ Ngoc Son Temple</span>
              <span className="wl-timeline__tag">🍜 Hang Manh Bun Cha</span>
            </div>
          </div>
        </div>

        {/* DAY 2 */}
        <div className="wl-timeline__step">
          <div className="wl-timeline__badge wl-timeline__badge--amber">
            <svg viewBox="0 0 384 512" className="wl-timeline__pin-icon" role="img" aria-hidden="true">
              <path fill="currentColor" d="M192 0C86 0 0 84.4 0 188.6 0 307.9 120.2 450.9 170.4 505.4 182.2 518.2 201.8 518.2 213.6 505.4 263.8 450.9 384 307.9 384 188.6 384 84.4 298 0 192 0z" />
            </svg>
            <span className="wl-timeline__badge-num">02</span>
          </div>
          <div className="wl-timeline__card">
            <h4 className="wl-timeline__title">
              Day 2: Imperial Cultural Heritage &amp; Royal History
            </h4>
            <p className="wl-timeline__desc">
              Explore <strong className="wl-timeline__bold">Temple of Literature</strong> (82 Stelae of Doctors). Discover the UNESCO World Heritage{" "}
              <strong className="wl-timeline__highlight-emerald">Imperial Citadel of Thang Long</strong>.
            </p>
            <div className="wl-timeline__tags">
              <span className="wl-timeline__tag">📜 Doctor Stelae</span>
              <span className="wl-timeline__tag">🏰 Hanoi Flag Tower</span>
              <span className="wl-timeline__tag">🥖 Old Quarter Banh Mi</span>
            </div>
          </div>
        </div>

        {/* DAY 3 */}
        <div className="wl-timeline__step">
          <div className="wl-timeline__badge wl-timeline__badge--teal">
            <svg viewBox="0 0 384 512" className="wl-timeline__pin-icon" role="img" aria-hidden="true">
              <path fill="currentColor" d="M192 0C86 0 0 84.4 0 188.6 0 307.9 120.2 450.9 170.4 505.4 182.2 518.2 201.8 518.2 213.6 505.4 263.8 450.9 384 307.9 384 188.6 384 84.4 298 0 192 0z" />
            </svg>
            <span className="wl-timeline__badge-num">03</span>
          </div>
          <div className="wl-timeline__card">
            <h4 className="wl-timeline__title">
              Day 3: Scenic West Lake &amp; Artisan Souvenir Shopping
            </h4>
            <p className="wl-timeline__desc">
              Cycle around <strong className="wl-timeline__bold">West Lake</strong>, visit ancient Tran Quoc Pagoda, and buy premium Lotus Tea at Dong Xuan Market.
            </p>
            <div className="wl-timeline__tags">
              <span className="wl-timeline__tag">🌸 Quang An Lotus Tea</span>
              <span className="wl-timeline__tag">🏮 Tran Quoc Pagoda</span>
              <span className="wl-timeline__tag">🛍️ Dong Xuan Market</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Buttons */}
      <div className="wl-timeline__footer">
        <button className="wl-timeline__btn">
          <span className="material-symbols-outlined text-base">edit_note</span>
          <span>Customize This Itinerary</span>
        </button>
      </div>
    </div>
  );
}
