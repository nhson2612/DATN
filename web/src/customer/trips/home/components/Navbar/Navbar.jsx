import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "../../../../../shared/common/Logo";
import "./Navbar.css";

const NAV_ITEMS = [
  { to: "/tour", icon: "travel_explore", label: "Explore Tours" },
  { to: "/chuyen-di", icon: "route", label: "Plan Itinerary" },
];

export default function Navbar({
  user,
  onNeedAuth,
  onLogout,
  variant = "sidebar",
}) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const isHome = variant === "home";

  const closeMobile = () => setIsMobileOpen(false);
  const isActive = (to) =>
    location.pathname === to ||
    (to !== "/" && location.pathname.startsWith(to));

  if (isHome) {
    return null;
  }

  return (
    <>
      <aside
        className={`wl-sidebar ${isMobileOpen ? "wl-sidebar--open" : ""}`}
        aria-label="Điều hướng chính"
      >
        <div className="wl-sidebar__brand">
          <Link
            to="/"
            className="wl-sidebar__brand-link"
            onClick={closeMobile}
          >
            <span className="wl-sidebar__logo">
              <Logo className="w-9 h-9" />
            </span>
            <span className="wl-sidebar__brand-text">
              <span className="wl-sidebar__brand-name">Wanderlust</span>
              <span className="wl-sidebar__brand-tag">Vietnam Tours</span>
            </span>
          </Link>

          <button
            type="button"
            className="wl-sidebar__close"
            onClick={closeMobile}
            aria-label="Đóng menu"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <nav className="wl-sidebar__nav">
          <span className="wl-sidebar__label">Khám phá</span>
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`wl-sidebar__item ${
                isActive(item.to) ? "wl-sidebar__item--active" : ""
              }`}
              onClick={closeMobile}
            >
              <span className="material-symbols-outlined wl-sidebar__icon">
                {item.icon}
              </span>
              <span className="wl-sidebar__item-label">{item.label}</span>
            </Link>
          ))}

          {user && (
            <>
              <span className="wl-sidebar__label" style={{ marginTop: "0.75rem" }}>
                Cá nhân
              </span>
              <Link
                to="/tour/don-cua-toi"
                className={`wl-sidebar__item ${
                  isActive("/tour/don-cua-toi") ? "wl-sidebar__item--active" : ""
                }`}
                onClick={closeMobile}
              >
                <span className="material-symbols-outlined wl-sidebar__icon">
                  receipt_long
                </span>
                <span className="wl-sidebar__item-label">Đơn tour của tôi</span>
              </Link>
            </>
          )}
        </nav>

        <div className="wl-sidebar__footer">
          {user ? (
            <div className="wl-sidebar__user">
              <span className="wl-sidebar__user-avatar">
                {(user.full_name || user.email || "?").slice(0, 1).toUpperCase()}
              </span>
              <div className="wl-sidebar__user-info">
                <span className="wl-sidebar__user-name">
                  {user.full_name || "Người dùng"}
                </span>
                <span className="wl-sidebar__user-email">
                  {user.email || ""}
                </span>
              </div>
              <button
                type="button"
                className="wl-sidebar__logout"
                onClick={onLogout}
                title="Đăng xuất"
              >
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="wl-sidebar__signin"
              onClick={onNeedAuth}
            >
              <span className="material-symbols-outlined wl-sidebar__icon">
                account_circle
              </span>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </aside>

      <header className="wl-sidebar__mobile-bar">
        <Link to="/" className="wl-sidebar__mobile-brand">
          <span className="wl-sidebar__logo">
            <Logo className="w-8 h-8" />
          </span>
          <span className="wl-sidebar__brand-name">Wanderlust</span>
        </Link>
        <button
          type="button"
          className="wl-sidebar__mobile-toggle"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Mở menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      </header>

      {isMobileOpen && (
        <button
          type="button"
          className="wl-sidebar__backdrop"
          onClick={closeMobile}
          aria-label="Đóng menu"
        />
      )}
    </>
  );
}
