import { Link } from "react-router-dom";
import "./VoyageDrawer.css";

/**
 * Slide-out Menu Drawer dùng chung cho toàn bộ ứng dụng Voyage
 * Đồng bộ chính xác trên mọi trang: /, /tour, /tour/:slug, /chuyen-di...
 */
export default function VoyageDrawer({
  isOpen,
  onClose,
  user,
  onNeedAuth,
  onLogout,
}) {
  if (!isOpen) return null;

  return (
    <div className="voyage-drawer-overlay" onClick={onClose}>
      <div className="voyage-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Nút đóng */}
        <div className="voyage-drawer-head">
          <button
            type="button"
            className="voyage-drawer-close"
            onClick={onClose}
            aria-label="Close menu"
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
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Danh sách điều hướng lớn phong cách Medusa */}
        <ul className="voyage-drawer-nav">
          <li>
            <Link
              to="/tour"
              className="voyage-drawer-link"
              onClick={onClose}
            >
              Explore Tours
            </Link>
          </li>
          <li>
            <Link
              to="/chuyen-di"
              className="voyage-drawer-link"
              onClick={onClose}
            >
              Plan with AI
            </Link>
          </li>
          <li>
            <Link
              to="/tai-khoan"
              className="voyage-drawer-link"
              onClick={onClose}
            >
              My Account
            </Link>
          </li>
          <li>
            {user ? (
              <button
                type="button"
                className="voyage-drawer-link voyage-drawer-link--button voyage-drawer-link--logout"
                onClick={() => {
                  onClose();
                  onLogout?.();
                }}
              >
                Log out
              </button>
            ) : (
              <Link
                to="/login"
                className="voyage-drawer-link voyage-drawer-link--button voyage-drawer-link--login"
                onClick={onClose}
              >
                Log in
              </Link>
            )}
          </li>
        </ul>

        {/* Footer khu vực và bản quyền */}
        <div className="voyage-drawer-footer">
          <div
            className="voyage-drawer-region"
            onClick={onClose}
            role="button"
            tabIndex={0}
          >
            <span className="voyage-drawer-region-text">
              Shipping to: <span className="voyage-drawer-flag">🇻🇳</span> Vietnam
            </span>
            <span className="voyage-drawer-arrow">→</span>
          </div>
          <p className="voyage-drawer-copy">
            © {new Date().getFullYear()} Voyage Store. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
