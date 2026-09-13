import React from "react";
import "./TourAccordionCarousel.css";

const TOURS_DATA = [
  {
    id: 0,
    title: "Discover Ha Long Bay",
    tag: "20% OFF",
    duration: "3 Days 2 Nights",
    schedule: "Departures: Every Tue, Thu, Sat",
    rating: "4.8",
    reviews: "210",
    price: "$105 USD",
    oldPrice: "$130 USD",
    img: "/assets/images/tour-halong.jpg",
  },
  {
    id: 1,
    title: "Magical Sapa Mist",
    tag: "18% OFF",
    duration: "3 Days 2 Nights",
    schedule: "Departures: Every Thu, Sun",
    rating: "4.9",
    reviews: "340",
    price: "$135 USD",
    oldPrice: "$165 USD",
    img: "/assets/images/tour-sapa.jpg",
  },
  {
    id: 2,
    title: "Da Nang – Hoi An Ancient Town",
    tag: "15% OFF",
    duration: "4 Days 3 Nights",
    schedule: "Departures: Daily",
    rating: "4.9",
    reviews: "480",
    price: "$160 USD",
    oldPrice: "$190 USD",
    img: "/assets/images/tour-danang.jpg",
  },
  {
    id: 3,
    title: "Phu Quoc Island Luxury Resort",
    tag: "Hot Sale",
    duration: "4 Days 3 Nights",
    schedule: "Departures: Every Friday",
    rating: "4.9",
    reviews: "520",
    price: "$185 USD",
    oldPrice: "$220 USD",
    img: "/assets/images/tour-phuquoc.jpg",
  },
];

export default function TourAccordionCarousel({ activeIndex, onSelectCard }) {
  return (
    <div className="wl-accordion">
      {TOURS_DATA.map((tour, idx) => {
        const isActive = activeIndex === idx;
        return (
          <div
            key={tour.id}
            onClick={() => onSelectCard(idx)}
            onMouseEnter={() => onSelectCard(idx)}
            className={`wl-accordion__card ${
              isActive ? "wl-accordion__card--active" : "wl-accordion__card--collapsed"
            }`}
          >
            {/* Card Details (Visible when active) */}
            <div
              className={`wl-accordion__details ${
                isActive ? "wl-accordion__details--show" : "wl-accordion__details--hide"
              }`}
            >
              <div className="wl-accordion__content">
                <div className="wl-accordion__tag-wrapper">
                  <span className="wl-accordion__tag">
                    {tour.tag}
                  </span>
                </div>
                <h3 className="wl-accordion__title">{tour.title}</h3>
                <div className="wl-accordion__meta">
                  <div className="wl-accordion__meta-item">
                    <span className="material-symbols-outlined text-orange-500 text-xs">schedule</span>
                    <span>{tour.duration}</span>
                  </div>
                  <div className="wl-accordion__meta-item">
                    <span className="material-symbols-outlined text-orange-500 text-xs">calendar_month</span>
                    <span>{tour.schedule}</span>
                  </div>
                </div>
                <div className="wl-accordion__rating">
                  <span className="wl-accordion__star">★ {tour.rating}</span>
                  <span className="wl-accordion__reviews">({tour.reviews} reviews)</span>
                </div>
              </div>

              <div className="wl-accordion__footer">
                <div className="wl-accordion__price-box">
                  <span className="wl-accordion__price-label">From</span>
                  <div className="wl-accordion__price-group">
                    <span className="wl-accordion__price">{tour.price}</span>
                    <span className="wl-accordion__old-price">{tour.oldPrice}</span>
                  </div>
                </div>
                <button className="wl-accordion__btn">
                  <span>Book Now</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Card Image */}
            <div
              className={`wl-accordion__image-box ${
                isActive ? "wl-accordion__image-box--active" : "wl-accordion__image-box--collapsed"
              }`}
            >
              <img
                alt={tour.title}
                className="wl-accordion__img"
                src={tour.img}
              />
              <button
                aria-label="Favorite"
                className="wl-accordion__fav-btn"
              >
                <span className="material-symbols-outlined text-base font-light">favorite</span>
              </button>
            </div>

            {/* Collapsed Preview (Visible when not active) */}
            <div
              className={`wl-accordion__preview ${
                isActive ? "wl-accordion__preview--hide" : "wl-accordion__preview--show"
              }`}
            >
              <div className="wl-accordion__preview-header">
                <span className="wl-accordion__tag wl-accordion__tag--small">
                  {tour.tag}
                </span>
                <div className="wl-accordion__fav-icon">
                  <span className="material-symbols-outlined text-xs font-light">favorite</span>
                </div>
              </div>
              <div className="wl-accordion__preview-card">
                <p className="wl-accordion__preview-title">{tour.title}</p>
                <div className="wl-accordion__preview-meta">
                  <span className="wl-accordion__preview-price">{tour.price}</span>
                  <span className="wl-accordion__preview-star">★ {tour.rating}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
