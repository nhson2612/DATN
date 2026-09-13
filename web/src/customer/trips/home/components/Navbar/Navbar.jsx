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

  return (
    <>
      {/* Sidebar cố định cho trang con; ở homepage chỉ dùng làm drawer mobile */}
      <aside
        className={`wl-sidebar ${
          isHome ? "wl-sidebar--mobile-only" : ""
        } ${isMobileOpen ? "wl-sidebar--open" : ""}`}
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

      {isHome ? (
        <header className="wl-navbar">
          <div className="wl-navbar__inner">
            <Link to="/" className="wl-navbar__brand">
              <span className="wl-sidebar__logo">
                <Logo className="w-9 h-9" />
              </span>
              <span className="wl-navbar__brand-name">Wanderlust</span>
            </Link>

            <nav className="wl-navbar__links">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`wl-navbar__link ${
                    isActive(item.to) ? "wl-navbar__link--active" : ""
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {user && (
                <Link
                  to="/tour/don-cua-toi"
                  className={`wl-navbar__link ${
                    isActive("/tour/don-cua-toi") ? "wl-navbar__link--active" : ""
                  }`}
                  style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "1.15rem" }}>
                    receipt_long
                  </span>
                  <span>Đơn tour của tôi</span>
                </Link>
              )}
            </nav>

            <div className="wl-navbar__actions">
              {user ? (
                <>
                  <Link
                    to="/tour/don-cua-toi"
                    className="wl-navbar__action"
                    title="Đơn tour của tôi"
                  >
                    <span className="material-symbols-outlined">receipt_long</span>
                  </Link>
                  <button
                    type="button"
                    className="wl-navbar__action"
                    onClick={onLogout}
                    title="Đăng xuất"
                  >
                    <span className="material-symbols-outlined">logout</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="wl-navbar__signin"
                  onClick={onNeedAuth}
                >
                  Sign In
                </button>
              )}
              <button
                type="button"
                className="wl-navbar__burger"
                onClick={() => setIsMobileOpen(true)}
                aria-label="Mở menu"
              >
                <span className="material-symbols-outlined">menu</span>
              </button>
            </div>
          </div>
        </header>
      ) : (
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
      )}

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
