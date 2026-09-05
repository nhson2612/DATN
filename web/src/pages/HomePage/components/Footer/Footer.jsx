import React from "react";
import useInView from "../../hooks/useInView";
import Logo from "../../../../components/common/Logo";
import "./Footer.css";

export default function Footer() {
  const [sectionRef, isInView] = useInView();

  return (
    <footer ref={sectionRef} className={`wl-footer ${isInView ? "in-view" : ""}`}>
      {/* Background Travel Image */}
      <div
        className="wl-footer__bg"
        style={{
          backgroundImage: "url('/assets/images/footer-bg.jpg')",
        }}
      >
        <div className="wl-footer__overlay"></div>
      </div>

      {/* Footer Content */}
      <div className="wl-footer__container">
        {/* Brand column */}
        <div className="wl-slide-left">
          <div className="wl-footer__brand-logo">
            <Logo className="w-14 h-14" />
            <span className="wl-footer__brand-text">
              WANDERLUST <span className="wl-footer__brand-text--highlight">VN</span>
            </span>
          </div>
          <p className="wl-footer__brand-desc">
            Next-generation smart travel platform connecting travelers with exquisite journeys across Vietnam.
          </p>
          <div className="wl-footer__copyright">© 2025 Wanderlust Vietnam. All rights reserved.</div>
        </div>

        {/* Tour Links */}
        <div className="wl-slide-right">
          <h5 className="wl-footer__title">Featured Tours</h5>
          <ul className="wl-footer__list">
            <li>
              <a className="wl-footer__link" href="#tour-packages">
                <span className="wl-footer__link-bullet">›</span> Northern Vietnam - Trang An &amp; Ha Long
              </a>
            </li>
            <li>
              <a className="wl-footer__link" href="#tour-packages">
                <span className="wl-footer__link-bullet">›</span> Northwest &amp; Northeast Loop Tour
              </a>
            </li>
            <li>
              <a className="wl-footer__link" href="#tour-packages">
                <span className="wl-footer__link-bullet">›</span> Central Heritage Hue - Da Nang
              </a>
            </li>
            <li>
              <a className="wl-footer__link" href="#tour-packages">
                <span className="wl-footer__link-bullet">›</span> Phu Quoc Tropical Island Paradise
              </a>
            </li>
            <li>
              <a className="wl-footer__link" href="#tour-packages">
                <span className="wl-footer__link-bullet">›</span> Mekong Delta Cultural Discovery
              </a>
            </li>
          </ul>
        </div>

        {/* Quick Services */}
        <div className="wl-slide-left">
          <h5 className="wl-footer__title">Services &amp; Itineraries</h5>
          <ul className="wl-footer__list">
            <li>
              <a className="wl-footer__link" href="#custom-itinerary">
                <span className="wl-footer__link-bullet">›</span> Personalized Itinerary Planner
              </a>
            </li>
            <li>
              <a className="wl-footer__link" href="#">
                <span className="wl-footer__link-bullet">›</span> Private Limousine &amp; Driver Rental
              </a>
            </li>
            <li>
              <a className="wl-footer__link" href="#">
                <span className="wl-footer__link-bullet">›</span> Authentic Local Homestay Booking
              </a>
            </li>
            <li>
              <a className="wl-footer__link" href="#">
                <span className="wl-footer__link-bullet">›</span> Freelance Local Tour Guides
              </a>
            </li>
            <li>
              <a className="wl-footer__link" href="#">
                <span className="wl-footer__link-bullet">›</span> International Travel Insurance
              </a>
            </li>
          </ul>
        </div>

        {/* Contact Info */}
        <div className="wl-slide-right">
          <h5 className="wl-footer__title">Support &amp; Contact</h5>
          <div className="wl-footer__contact">
            <p className="wl-footer__contact-item">
              <span className="material-symbols-outlined text-orange-400 text-sm">location_on</span>
              <span>12th Floor, Heritage Tower, Hoan Kiem Dist., Hanoi</span>
            </p>
            <p className="wl-footer__contact-item">
              <span className="material-symbols-outlined text-emerald-400 text-sm">phone_in_talk</span>
              <span className="wl-footer__hotline">Hotline 24/7: 1900 888 999</span>
            </p>
            <p className="wl-footer__contact-item">
              <span className="material-symbols-outlined text-sky-400 text-sm">mail</span>
              <span>contact@wanderlustvietnam.vn</span>
            </p>
            <div className="pt-2 flex items-center gap-3 text-slate-400">
              <span className="text-[11px] font-semibold text-slate-300">Follow us:</span>
              <a className="hover:text-orange-400 transition-colors font-medium text-white" href="#">
                Facebook
              </a>{" "}
              •
              <a className="hover:text-orange-400 transition-colors font-medium text-white" href="#">
                Instagram
              </a>{" "}
              •
              <a className="hover:text-orange-400 transition-colors font-medium text-white" href="#">
                TikTok
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
