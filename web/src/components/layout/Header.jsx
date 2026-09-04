import { Link, useLocation } from "react-router-dom";
import "./Header.css";

export default function Header({ user, onLogin, onLogout }) {
  const location = useLocation();

  const isCurrent = (path) => location.pathname === path;

  return (
    <header className="header-island-wrapper">
      <div className="header-island">
        {/* Logo */}
        <Link to="/" className="header-logo">
          <div className="header-logo__icon">
            <i className="fa-solid fa-mountain-sun" />
          </div>
          <div className="header-logo__text">
            <span className="header-logo__title">Đi Đâu</span>
            <span className="header-logo__tagline">
              Khám phá · Mơ ước · Trải nghiệm
            </span>
          </div>
        </Link>

        {/* Floating Navigation Links */}
        <nav className="header-nav">
          <Link
            to="/"
            className={`header-nav__link ${
              isCurrent("/") ? "header-nav__link--active" : ""
            }`}
          >
            Trang chủ
          </Link>
          <Link
            to="/dia-diem"
            className={`header-nav__link ${
              isCurrent("/dia-diem") ? "header-nav__link--active" : ""
            }`}
          >
            Điểm đến
          </Link>
          <Link
            to="/tour"
            className={`header-nav__link ${
              isCurrent("/tour") ? "header-nav__link--active" : ""
            }`}
          >
            Tour trọn gói
          </Link>
          <Link
            to="/chuyen-di"
            className={`header-nav__link ${
              isCurrent("/chuyen-di") ? "header-nav__link--active" : ""
            }`}
          >
            Tự lên lịch
          </Link>
        </nav>

        {/* User Actions Group */}
        <div className="header-actions">
          {user ? (
            <div className="header-user-group">
              <Link
                to="/yeu-thich"
                className="header-icon-btn"
                title="Địa điểm đã lưu"
              >
                <i className="fa-regular fa-heart" />
              </Link>
              <div className="header-user-badge">
                <span className="header-user-name">
                  {user.full_name || user.email}
                </span>
                <button
                  onClick={onLogout}
                  className="header-logout-btn"
                  title="Đăng xuất"
                >
                  <i className="fa-solid fa-arrow-right-from-bracket" />
                </button>
              </div>
            </div>
          ) : (
            <button onClick={onLogin} className="header-login-btn">
              <i className="fa-regular fa-user" /> Đăng nhập
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
