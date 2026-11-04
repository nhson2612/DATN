import { Link, useLocation, useNavigate } from "react-router-dom";
import "./AppNavbar.css";

export function BrandLogo({ className = "", textClassName = "", iconClassName = "" }) {
  return (
    <Link to="/" className={`app-brand ${className}`} aria-label="Aura Voyage">
      <svg
        className={`app-brand__icon ${iconClassName}`}
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 10.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
      </svg>
      <span className={`app-brand__name ${textClassName}`}>Aura Voyage</span>
    </Link>
  );
}

export default function AppNavbar({ user, onNeedAuth }) {
  const location = useLocation();
  const navigate = useNavigate();

  const isCurrent = (path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <header className="app-navbar">
      <BrandLogo />

      <nav className="app-navbar__nav" aria-label="Điều hướng chính">
        <Link
          to="/"
          className={`app-navbar__link ${isCurrent("/") ? "app-navbar__link--active" : ""}`}
        >
          GIỚI THIỆU
        </Link>
        <Link
          to="/tour"
          className={`app-navbar__link ${isCurrent("/tour") ? "app-navbar__link--active" : ""}`}
        >
          TOUR TRỌN GÓI
        </Link>
        <Link
          to="/trips"
          className={`app-navbar__link ${isCurrent("/trips") || isCurrent("/chuyen-di") ? "app-navbar__link--active" : ""}`}
        >
          LẬP LỊCH TRÌNH
        </Link>
        {user?.role === "admin" && (
          <Link
            to="/admin"
            className={`app-navbar__link ${isCurrent("/admin") ? "app-navbar__link--active" : ""}`}
            style={{ color: "#0f172a", fontWeight: "800" }}
          >
            QUẢN TRỊ VIÊN
          </Link>
        )}
        {user?.role === "operator" && (
          <Link
            to="/operator"
            className={`app-navbar__link ${isCurrent("/operator") ? "app-navbar__link--active" : ""}`}
            style={{ color: "#0f172a", fontWeight: "800" }}
          >
            ĐIỀU HÀNH
          </Link>
        )}
        {user && (
          <Link
            to="/tai-khoan"
            className={`app-navbar__link ${isCurrent("/tai-khoan") || isCurrent("/account") ? "app-navbar__link--active" : ""}`}
          >
            TÀI KHOẢN
          </Link>
        )}
      </nav>

      <div className="app-navbar__actions">
        {user ? (
          <>
            {user.role === "admin" && (
              <Link to="/admin" className="app-navbar__admin-btn" title="Vào trang quản trị hệ thống">
                <span>Trang Quản Trị</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>dashboard</span>
              </Link>
            )}
            {user.role === "operator" && (
              <Link to="/operator" className="app-navbar__admin-btn" title="Vào bàn điều hành tour">
                <span>Bàn Điều Hành</span>
                <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>flight_takeoff</span>
              </Link>
            )}
            <Link
              to={user.role === "admin" ? "/admin" : user.role === "operator" ? "/operator" : "/tai-khoan"}
              className="app-navbar__user-pill"
              title={user.role === "admin" ? "Tài khoản Quản trị viên" : "Tài khoản của bạn"}
            >
              <span className="app-navbar__user-name">{user.full_name || user.email}</span>
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={() => (onNeedAuth ? onNeedAuth() : navigate("/login"))}
            className="app-navbar__cta-btn"
          >
            Lên Lịch Ngay
          </button>
        )}
      </div>
    </header>
  );
}
