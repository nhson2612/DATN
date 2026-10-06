import { Link } from "react-router-dom";
import "./AuraHeader.css";

/**
 * Component Header chuẩn Aura Voyage tái sử dụng cho các trang (Tours, TourDetail, etc.)
 * Tuân thủ đúng BEM class: aura-tours__header aura-tours__stagger aura-tours__stagger--header
 */
export default function AuraHeader({
  backTo = "/",
  backLabel = "Trang chủ",
  breadcrumbs = null,
  onOpenSearch = null,
  searchQuery = "",
  searchLabel = "Tìm kiếm",
  actions = null,
  onOpenDrawer = null,
  onClose = null,
  closeTo = null,
  className = "",
}) {
  return (
    <header className={`aura-tours__header ${className}`}>
      {/* Cụm trái: Logo Brand + Divider + Back / Breadcrumbs */}
      <div className="aura-tours__header-left">
        <Link to="/" className="aura-tours__brand" aria-label="Aura Voyage">
          <svg
            className="aura-tours__brand-icon"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 10.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
          </svg>
          <span className="aura-tours__brand-text">Aura Voyage</span>
        </Link>

        <span className="aura-tours__divider" />

        {Array.isArray(breadcrumbs) && breadcrumbs.length > 0 ? (
          <nav className="aura-tours__breadcrumbs" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, idx) => {
              const isLast = idx === breadcrumbs.length - 1;
              return (
                <span key={idx} className="aura-tours__breadcrumb-item">
                  {crumb.to && !isLast ? (
                    <Link to={crumb.to} className="aura-tours__breadcrumb-link">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="aura-tours__breadcrumb-curr">
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <span className="aura-tours__breadcrumb-sep">/</span>}
                </span>
              );
            })}
          </nav>
        ) : backTo ? (
          <Link to={backTo} className="aura-tours__back-btn">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 19l-7-7 7-7" />
            </svg>
            <span>{backLabel}</span>
          </Link>
        ) : null}
      </div>

      {/* Cụm phải: Search / Actions / Menu Drawer / Close */}
      <div className="aura-tours__header-right">
        {onOpenSearch && (
          <button
            type="button"
            className="aura-tours__search-btn"
            onClick={onOpenSearch}
            aria-label="Tìm kiếm tour"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>{searchQuery ? `Tìm: "${searchQuery}"` : searchLabel}</span>
          </button>
        )}

        {actions}

        {onOpenDrawer && (
          <button
            type="button"
            className="aura-tours__menu-btn"
            onClick={onOpenDrawer}
            aria-label="Mở menu"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
          </button>
        )}

        {closeTo ? (
          <Link to={closeTo} className="aura-tours__close-btn" aria-label="Đóng">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </Link>
        ) : onClose ? (
          <button
            type="button"
            className="aura-tours__close-btn"
            onClick={onClose}
            aria-label="Đóng"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ) : null}
      </div>
    </header>
  );
}
