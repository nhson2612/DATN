import { Link, NavLink, useLocation, useSearchParams } from "react-router-dom";

import BookingsScreen from "./bookings";
import CancellationsScreen from "./cancellations";
import DeparturesScreen from "./departures";
import RevenueScreen from "./revenue";
import ToursScreen from "./tours";
import "./Operator.css";
import "./OperatorShell.css";

/** Năm màn của khu nhà điều hành, nhóm theo việc. Đường dẫn con, biểu tượng và tên
 *  trên menu lấy từ đây; thêm màn mới thì thêm một dòng. */
const NHOM_MENU = [
  {
    tieuDe: "Vận hành tour",
    muc: [
      { path: "tours", icon: "map", label: "Tour của tôi", Screen: ToursScreen },
      { path: "departures", icon: "calendar_month", label: "Đợt khởi hành", Screen: DeparturesScreen },
    ],
  },
  {
    tieuDe: "Đơn hàng",
    muc: [
      { path: "bookings", icon: "confirmation_number", label: "Đơn đặt tour", Screen: BookingsScreen },
      { path: "cancellations", icon: "event_busy", label: "Huỷ đợt", Screen: CancellationsScreen },
    ],
  },
  {
    tieuDe: "Tài chính",
    muc: [{ path: "revenue", icon: "monitoring", label: "Doanh thu", Screen: RevenueScreen }],
  },
];

const TAT_CA_MAN = NHOM_MENU.flatMap((nhom) => nhom.muc);

/** Cửa vào khi chưa đăng nhập hoặc sai vai trò. */
function Gate({ title, description, actionLabel, onAction }) {
  return (
    <div className="op-shell__gate">
      <h1 className="op-shell__gate-title">{title}</h1>
      {description && <p className="op-shell__gate-text">{description}</p>}
      {onAction && (
        <button type="button" className="op-shell__gate-button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/** Khung khu nhà điều hành: menu dọc, thanh trên, và màn theo đường dẫn đang mở. */
export default function OperatorPage({ user, onLogout, onNeedAuth }) {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  if (!user) {
    return (
      <Gate
        title="Khu nhà điều hành"
        description="Đăng nhập bằng tài khoản nhà điều hành để tiếp tục."
        actionLabel="Đăng nhập"
        onAction={onNeedAuth}
      />
    );
  }

  if (user.role !== "operator" && user.role !== "admin") {
    return (
      <Gate
        title="Bạn không có quyền truy cập"
        description="Khu này chỉ dành cho tài khoản nhà điều hành."
      />
    );
  }

  const currentPath = pathname.split("/")[2] || TAT_CA_MAN[0].path;
  const dangMo = TAT_CA_MAN.find((item) => item.path === currentPath) || TAT_CA_MAN[0];
  const Screen = dangMo.Screen;

  const action = searchParams.get("action");
  let subCrumb = null;
  if (currentPath === "tours") {
    if (action === "create") subCrumb = "Tạo tour mới";
    else if (action === "edit") subCrumb = "Chỉnh sửa tour";
  }

  return (
    <div className="op-shell">
      <aside className="op-shell__aside">
        <div>
          <div className="op-shell__brand">
            <div className="op-shell__brand-mark">Đ</div>
            <div>
              <span className="op-shell__brand-name">Đi Đâu</span>
              <span className="op-shell__brand-role">Nhà điều hành</span>
            </div>
          </div>

          <Link to="/nha-dieu-hanh/tours?action=create" className="op-shell__quick-create">
            <span className="material-symbols-outlined text-base">add</span>
            <span>Tạo tour mới</span>
          </Link>

          {NHOM_MENU.map((nhom) => (
            <div className="op-shell__group" key={nhom.tieuDe}>
              <div className="op-shell__group-title">{nhom.tieuDe}</div>
              <nav className="op-shell__nav">
                {nhom.muc.map(({ path, icon, label }) => (
                  <NavLink
                    key={path}
                    to={`/nha-dieu-hanh/${path}`}
                    className={({ isActive }) =>
                      `op-shell__link ${isActive ? "op-shell__link--active" : ""}`
                    }
                  >
                    <span className="material-symbols-outlined op-shell__icon">{icon}</span>
                    <span>{label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          ))}
        </div>

        <div className="op-shell__foot">
          <div className="op-shell__account">
            <div className="op-shell__account-row">
              <div className="op-shell__avatar">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
              </div>
              <div className="op-shell__account-info">
                <span className="op-shell__account-name">{user.full_name}</span>
                <span className="op-shell__account-role">{user.email || "Nhà điều hành"}</span>
              </div>
            </div>
            <button
              type="button"
              className="op-shell__logout"
              onClick={onLogout}
              title="Đăng xuất"
            >
              <span className="material-symbols-outlined text-lg">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="op-shell__body">
        <header className="op-shell__header">
          <div className="op-shell__header-left">
            <div className="op-shell__header-sidebar-btn" title="Khu nhà điều hành">
              <span className="material-symbols-outlined text-lg">space_dashboard</span>
            </div>
            <div className="op-shell__header-divider"></div>
            <div className="op-shell__crumb">
              <Link to="/nha-dieu-hanh/tours" className="op-shell__crumb-link">
                Nhà điều hành
              </Link>
              <span className="material-symbols-outlined op-shell__icon--xs">chevron_right</span>
              {subCrumb ? (
                <>
                  <Link to={`/nha-dieu-hanh/${dangMo.path}`} className="op-shell__crumb-link">
                    {dangMo.label}
                  </Link>
                  <span className="material-symbols-outlined op-shell__icon--xs">chevron_right</span>
                  <span className="op-shell__crumb-now">{subCrumb}</span>
                </>
              ) : (
                <span className="op-shell__crumb-now">{dangMo.label}</span>
              )}
            </div>
          </div>

          <div className="op-shell__who">
            <div className="op-shell__avatar">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="op-shell__who-text">
              <span className="op-shell__account-name">{user.full_name}</span>
              <span className="op-shell__account-role">Nhà điều hành</span>
            </div>
          </div>
        </header>

        <main className="op-shell__main">
          <div className="op-screen">
            <Screen />
          </div>
        </main>
      </div>
    </div>
  );
}
