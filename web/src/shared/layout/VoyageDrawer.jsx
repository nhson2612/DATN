import { Link } from "react-router-dom";
import "./VoyageDrawer.css";

/**
 * Slide-out Menu Drawer dùng chung cho toàn bộ ứng dụng Voyage
 * Thiết kế phong cách editorial dark (#0E1116) tuân thủ kiến trúc BEM.
 */
export default function VoyageDrawer({
  isOpen,
  onClose,
  user,
  onLogout,
}) {
  if (!isOpen) return null;

  return (
    <div className="aura-drawer__overlay" onClick={onClose}>
      <div className="aura-drawer__panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="aura-drawer__header">
          <div className="aura-drawer__brand">
            <svg
              className="aura-drawer__brand-icon"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
            </svg>
            <span className="aura-drawer__brand-text">Aura Journal</span>
          </div>
          <button
            type="button"
            className="aura-drawer__close"
            onClick={onClose}
            aria-label="Đóng menu"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>

        {/* Danh sách điều hướng BEM */}
        <nav className="aura-drawer__nav">
          <Link to="/" className="aura-drawer__link" onClick={onClose}>
            <span>Trang chủ</span>
            <span className="aura-drawer__link-num">01</span>
          </Link>
          <Link to="/tour" className="aura-drawer__link" onClick={onClose}>
            <span>Khám phá Tour</span>
            <span className="aura-drawer__link-num">02</span>
          </Link>
          <Link to="/chuyen-di" className="aura-drawer__link" onClick={onClose}>
            <span>Lịch trình AI</span>
            <span className="aura-drawer__link-num">03</span>
          </Link>
          <Link to="/tai-khoan" className="aura-drawer__link" onClick={onClose}>
            <span>Tài khoản cá nhân</span>
            <span className="aura-drawer__link-num">04</span>
          </Link>

          <div className="aura-drawer__auth-action">
            {user ? (
              <button
                type="button"
                className="aura-drawer__auth-btn aura-drawer__auth-btn--logout"
                onClick={() => {
                  onClose();
                  onLogout?.();
                }}
              >
                Đăng xuất ({user.full_name || user.email})
              </button>
            ) : (
              <Link
                to="/login"
                className="aura-drawer__auth-btn aura-drawer__auth-btn--login"
                onClick={onClose}
              >
                Đăng nhập tài khoản →
              </Link>
            )}
          </div>
        </nav>

        {/* Footer & Curated Feature */}
        <div className="aura-drawer__footer">
          <div className="aura-drawer__feature">
            <div className="aura-drawer__feature-thumb">
              <img
                src="https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=300&q=80"
                alt="Việt Nam Di Sản"
                className="aura-drawer__feature-img"
              />
            </div>
            <div className="aura-drawer__feature-content">
              <span className="aura-drawer__feature-tag">Đặc quyền tháng này</span>
              <h4 className="aura-drawer__feature-title">Bộ sưu tập Đông Bắc 2026</h4>
              <Link
                to="/tour?region=bac"
                className="aura-drawer__feature-link"
                onClick={onClose}
              >
                Xem chi tiết các tour →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
