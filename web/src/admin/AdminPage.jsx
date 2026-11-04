import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../shared/api";
import Toast from "../shared/common/Toast";
import TourApproval from "./tour-approval";
import AdminBentoOverview from "./AdminBentoOverview";
import "./AdminBem.css";
import "./Admin.css";

const MENU_GROUPS = [
  {
    tieuDe: "Quản lý chung",
    items: [
      { id: "overview", nhan: "Tổng quan", icon: "space_dashboard", desc: "Chỉ số tổng hợp và số liệu hệ thống", aliases: ["tong-quan"] },
    ],
  },
  {
    tieuDe: "Vận hành & Duyệt",
    items: [
      { id: "tour-approval", nhan: "Duyệt tour", icon: "verified", desc: "Phê duyệt các tour du lịch do nhà điều hành gửi lên", aliases: ["duyet-tour"] },
      { id: "operators", nhan: "Nhà điều hành", icon: "badge", desc: "Quản lý và cấp tài khoản cho các đối tác Nhà điều hành tour", aliases: ["nha-dieu-hanh"] },
      { id: "places", nhan: "Cơ sở lưu trú", icon: "domain", desc: "Quản lý danh mục khách sạn, homestay và điểm lưu trú", aliases: ["dia-diem"] },
    ],
  },
  {
    tieuDe: "Đơn hàng & Giao dịch",
    items: [
      { id: "bookings", nhan: "Đặt tour", icon: "confirmation_number", desc: "Danh sách đơn đặt tour du lịch trên toàn hệ thống", aliases: ["dat-tour"] },
      { id: "payments", nhan: "Thanh toán & Đối soát", icon: "payments", desc: "Đối soát chuyển khoản ngân hàng và xác nhận giao dịch", aliases: ["thanh-toan"] },
    ],
  },
];

const ALL_TABS = MENU_GROUPS.flatMap((g) => g.items);

const FORM_RONG = {
  place_type: "accommodation",
  name: "",
  amenity: "",
  tourism: "",
  description: "",
  price_range: "",
  stars: 0,
  address: "",
  lon: "",
  lat: "",
};

function so(n) {
  return n == null ? "—" : Number(n).toLocaleString("vi-VN");
}

export default function AdminPage({ user, onLogout, onNeedAuth }) {
  const [params, setParams] = useSearchParams();
  const rawTab = params.get("tab");
  const matchedTab = ALL_TABS.find(
    (t) => t.id === rawTab || (t.aliases && t.aliases.includes(rawTab))
  );
  const tabId = matchedTab ? matchedTab.id : "overview";
  const currentTab = matchedTab || ALL_TABS[0];

  const setTab = (id) => setParams({ tab: id }, { replace: true });
  const locTuUrl = params.get("loc") || "";

  if (!user) {
    return (
      <div className="admin-shell__gate">
        <div className="admin-shell__gate-card">
          <div className="admin-shell__div-1">
            Đ
          </div>
          <h1 className="admin-shell__gate-title">Khu vực Quản trị</h1>
          <p className="admin-shell__gate-text">
            Bạn cần đăng nhập bằng tài khoản Quản trị viên để truy cập bảng điều khiển.
          </p>
          {onNeedAuth && (
            <button
              type="button"
              onClick={onNeedAuth}
              className="admin-shell__button-2"
            >
              Đăng nhập ngay
            </button>
          )}
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="admin-shell__gate">
        <div className="admin-shell__gate-card">
          <div className="admin-shell__div-3">
            <span className="material-symbols-outlined admin-shell__span-4">block</span>
          </div>
          <h1 className="admin-shell__gate-title">Từ chối truy cập</h1>
          <p className="admin-shell__gate-text">
            Tài khoản ({user.email}) không có quyền hạn Quản trị viên của hệ thống.
          </p>
          <Link
            to="/"
            className="admin-shell__link-5"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {/* 1. SIDEBAR CHUẨN SHADCN */}
      <aside className="admin-shell__aside">
        <div>
          {/* Logo & Brand */}
          <div className="admin-shell__brand" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <svg
              style={{ width: "22px", height: "22px", color: "#0f172a", flexShrink: 0 }}
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-label="Aura Voyage"
            >
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 10.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span className="admin-shell__brand-title" style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", lineHeight: "1.2" }}>Aura Voyage</span>
              <span className="admin-shell__brand-sub" style={{ fontSize: "11px", color: "#64748b" }}>Quản trị hệ thống</span>
            </div>
          </div>

          {/* Menu Phân nhóm */}
          {MENU_GROUPS.map((group) => (
            <div className="admin-shell__group" key={group.tieuDe}>
              <div className="admin-shell__group-title">{group.tieuDe}</div>
              <nav className="admin-shell__nav">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`admin-shell__nav-item    ${
                      tabId === item.id ? "admin-shell__nav-item--active" : ""
                    }`}
                  >
                    <span className="material-symbols-outlined admin-shell__nav-icon">
                      {item.icon}
                    </span>
                    <span>{item.nhan}</span>
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer Account Card */}
        <div className="admin-shell__foot">
          <div className="admin-shell__account">
            <div className="admin-shell__account-row">
              <div className="admin-shell__avatar">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="admin-shell__account-info">
                <span className="admin-shell__account-name">
                  {user.full_name || "Quản trị viên"}
                </span>
                <span className="admin-shell__account-role">{user.email}</span>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="admin-shell__logout-btn"
                title="Đăng xuất"
              >
                <span className="material-symbols-outlined admin-shell__span-7">logout</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* 2. MAIN BODY */}
      <div className="admin-shell__body">
        {/* Top Header */}
        <header className="admin-shell__header">
          <div className="admin-shell__header-left">
            <span className="material-symbols-outlined admin-shell__header-icon">
              {currentTab.icon}
            </span>
            <div className="admin-shell__header-divider"></div>
            <div className="admin-shell__crumb">
              <span className="admin-shell__crumb-root">Quản trị</span>
              <span className="material-symbols-outlined admin-shell__span-8">
                chevron_right
              </span>
              <span className="admin-shell__crumb-active">{currentTab.nhan}</span>
            </div>
          </div>

          <div>
            <Link to="/" className="admin-shell__home-btn">
              <span className="material-symbols-outlined admin-shell__span-9">home</span>
              <span>Về trang chủ</span>
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="admin-shell__main">
          {/* Header mục hiện tại */}
          <div className="admin-page-heading">
            <h1 className="admin-page-heading__title">
              {currentTab.nhan}
            </h1>
            <p className="admin-page-heading__description">{currentTab.desc}</p>
          </div>

          {/* Màn hình tương ứng */}
          {tabId === "overview" && <TongQuan onNavigateTab={setTab} />}
          {tabId === "tour-approval" && <TourApproval />}
          {tabId === "operators" && <NhaDieuHanh />}
          {tabId === "places" && <DiaDiem />}
          {tabId === "bookings" && <DatTour />}
          {tabId === "payments" && <ThanhToan locBanDau={locTuUrl} />}
        </main>
      </div>
    </div>
  );
}

/* ── 1. Tổng quan theo khoảng thời gian ──────────────────────────────────── */

function dinhDangNgayInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function khoangMacDinh() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 29);
  return {
    from: dinhDangNgayInput(from),
    to: dinhDangNgayInput(today),
  };
}

function soSanh(hienTai, kyTruoc) {
  const current = Number(hienTai || 0);
  const previous = Number(kyTruoc || 0);
  if (previous === 0) {
    return current === 0
      ? { text: "Không đổi so với kỳ trước", tone: "neutral" }
      : { text: "Phát sinh mới trong kỳ", tone: "positive" };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return { text: "Không đổi so với kỳ trước", tone: "neutral" };
  return {
    text: `${percent > 0 ? "Tăng" : "Giảm"} ${Math.abs(percent)}% so với kỳ trước`,
    tone: percent > 0 ? "positive" : "negative",
  };
}

function nhanNgay(value) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function ngayTuChuoi(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function nhanNgayDayDu(value) {
  return ngayTuChuoi(value).toLocaleDateString("vi-VN");
}

function cacNgayTrongLich(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(year, month, 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });
}

function BoChonKhoangNgay({ tuNgay, denNgay, homNay, hienGiaTri, onChange }) {
  const [dangMo, setDangMo] = useState(false);
  const [thangHienThi, setThangHienThi] = useState(() => {
    const date = ngayTuChuoi(denNgay);
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [mocDau, setMocDau] = useState(tuNgay);
  const [mocCuoi, setMocCuoi] = useState(denNgay);
  const [dangChonMocCuoi, setDangChonMocCuoi] = useState(false);
  const pickerRef = useRef(null);

  useEffect(() => {
    if (!dangMo) return undefined;
    const dongKhiClickNgoai = (event) => {
      if (!pickerRef.current?.contains(event.target)) setDangMo(false);
    };
    const dongKhiNhanEscape = (event) => {
      if (event.key === "Escape") setDangMo(false);
    };
    document.addEventListener("mousedown", dongKhiClickNgoai);
    document.addEventListener("keydown", dongKhiNhanEscape);
    return () => {
      document.removeEventListener("mousedown", dongKhiClickNgoai);
      document.removeEventListener("keydown", dongKhiNhanEscape);
    };
  }, [dangMo]);

  const moLich = () => {
    const date = ngayTuChuoi(denNgay);
    setThangHienThi(new Date(date.getFullYear(), date.getMonth(), 1));
    setMocDau(tuNgay);
    setMocCuoi(denNgay);
    setDangChonMocCuoi(false);
    setDangMo((value) => !value);
  };

  const chonNgay = (value) => {
    if (!dangChonMocCuoi) {
      setMocDau(value);
      setMocCuoi("");
      setDangChonMocCuoi(true);
      return;
    }

    const start = value < mocDau ? value : mocDau;
    const end = value < mocDau ? mocDau : value;
    setMocDau(start);
    setMocCuoi(end);
    setDangChonMocCuoi(false);
    setDangMo(false);
    onChange(start, end);
  };

  const days = cacNgayTrongLich(thangHienThi);
  const todayMonth = ngayTuChuoi(homNay);
  const khongTheSangThangSau =
    thangHienThi.getFullYear() === todayMonth.getFullYear()
    && thangHienThi.getMonth() === todayMonth.getMonth();

  return (
    <div className="admin-overview__range-picker" ref={pickerRef}>
      <button
        type="button"
        className={`admin-overview__range-trigger ${dangMo ? "admin-overview__range-trigger--open" : ""}`}
        onClick={moLich}
        aria-expanded={dangMo}
        aria-haspopup="dialog"
        aria-label={hienGiaTri ? `${nhanNgayDayDu(tuNgay)} đến ${nhanNgayDayDu(denNgay)}` : "Chọn khoảng thời gian"}
      >
        <span className="material-symbols-outlined admin-overview__range-icon">calendar_month</span>
        {hienGiaTri && (
          <span className="admin-overview__range-value">
            {nhanNgay(tuNgay)} — {nhanNgay(denNgay)}
          </span>
        )}
      </button>

      {dangMo && (
        <div className="admin-overview__calendar" role="dialog" aria-label="Chọn khoảng thời gian">
          <div className="admin-overview__calendar-heading">
            <div>
              <strong>Chọn khoảng thời gian</strong>
              <span>
                {dangChonMocCuoi
                  ? `Chọn ngày kết thúc sau ${nhanNgayDayDu(mocDau)}`
                  : "Chọn ngày bắt đầu, sau đó chọn ngày kết thúc"}
              </span>
            </div>
            <button type="button" onClick={() => setDangMo(false)} aria-label="Đóng lịch">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="admin-overview__calendar-nav">
            <button
              type="button"
              onClick={() => setThangHienThi(new Date(thangHienThi.getFullYear(), thangHienThi.getMonth() - 1, 1))}
              aria-label="Tháng trước"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <strong>{thangHienThi.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</strong>
            <button
              type="button"
              disabled={khongTheSangThangSau}
              onClick={() => setThangHienThi(new Date(thangHienThi.getFullYear(), thangHienThi.getMonth() + 1, 1))}
              aria-label="Tháng sau"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>

          <div className="admin-overview__calendar-weekdays" aria-hidden="true">
            {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="admin-overview__calendar-days">
            {days.map((date) => {
              const value = dinhDangNgayInput(date);
              const ngoaiThang = date.getMonth() !== thangHienThi.getMonth();
              const laMocDau = value === mocDau;
              const laMocCuoi = value === mocCuoi;
              const trongKhoang = mocCuoi && value > mocDau && value < mocCuoi;
              const quaHomNay = value > homNay;
              const vuotQuaMotNam = dangChonMocCuoi
                && Math.abs(ngayTuChuoi(value) - ngayTuChuoi(mocDau)) > 365 * 24 * 60 * 60 * 1000;
              const disabled = quaHomNay || vuotQuaMotNam;
              const classNames = [
                "admin-overview__calendar-day",
                ngoaiThang ? "admin-overview__calendar-day--outside" : "",
                trongKhoang ? "admin-overview__calendar-day--in-range" : "",
                laMocDau ? "admin-overview__calendar-day--start" : "",
                laMocCuoi ? "admin-overview__calendar-day--end" : "",
              ].filter(Boolean).join(" ");
              return (
                <button
                  type="button"
                  className={classNames}
                  key={value}
                  disabled={disabled}
                  onClick={() => chonNgay(value)}
                  aria-pressed={laMocDau || laMocCuoi || Boolean(trongKhoang)}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ChiBaoXuHuong({ tone }) {
  const points = tone === "positive"
    ? "8,68 48,52 82,58 126,30 172,12"
    : tone === "negative"
      ? "8,12 48,28 82,22 126,50 172,68"
      : "8,40 172,40";
  return (
    <div className={`admin-overview__trend-mark admin-overview__trend-mark--${tone}`} aria-hidden="true">
      <svg viewBox="0 0 180 80">
        <line x1="8" x2="172" y1="72" y2="72" className="admin-overview__trend-baseline" />
        <polyline points={points} className="admin-overview__trend-line" />
        <circle cx="172" cy={tone === "positive" ? 12 : tone === "negative" ? 68 : 40} r="4" />
      </svg>
    </div>
  );
}

function BieuDoDoanhThu({ series }) {
  const data = series || [];
  const width = 760;
  const height = 220;
  const chartTop = 18;
  const chartBottom = 184;
  const chartHeight = chartBottom - chartTop;
  const maxRevenue = Math.max(...data.map((item) => Number(item.doanh_thu || 0)), 0);
  const slotWidth = data.length ? width / data.length : width;
  const barWidth = Math.max(3, Math.min(24, slotWidth * 0.56));
  const labelStep = Math.max(1, Math.ceil(data.length / 6));

  return (
    <div className="admin-overview__chart-wrap">
      <svg className="admin-overview__chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Biểu đồ doanh thu theo ngày">
        {[0, 0.5, 1].map((ratio) => {
          const y = chartTop + chartHeight * ratio;
          return <line key={ratio} x1="0" x2={width} y1={y} y2={y} className="admin-overview__chart-gridline" />;
        })}
        {data.map((item, index) => {
          const value = Number(item.doanh_thu || 0);
          const barHeight = maxRevenue ? Math.max(2, (value / maxRevenue) * chartHeight) : 2;
          const x = index * slotWidth + (slotWidth - barWidth) / 2;
          const y = chartBottom - barHeight;
          const showLabel = index % labelStep === 0 || index === data.length - 1;
          return (
            <g key={item.ngay}>
              <rect x={x} y={y} width={barWidth} height={barHeight} rx="2" className="admin-overview__chart-bar">
                <title>{nhanNgayDayDu(item.ngay)}: {so(value)} đ</title>
              </rect>
              {showLabel && (
                <text x={x + barWidth / 2} y="210" textAnchor="middle" className="admin-overview__chart-label">
                  {nhanNgay(item.ngay)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function tinhKhoangNgayTheoLoai(loai) {
  const today = new Date();
  if (loai === "this_month") {
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: dinhDangNgayInput(from), to: dinhDangNgayInput(today) };
  }
  if (loai === "last_month") {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const to = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: dinhDangNgayInput(from), to: dinhDangNgayInput(to) };
  }
  if (loai === "this_year") {
    const from = new Date(today.getFullYear(), 0, 1);
    return { from: dinhDangNgayInput(from), to: dinhDangNgayInput(today) };
  }
  // Mặc định 30 ngày gần đây
  const from = new Date(today);
  from.setDate(today.getDate() - 29);
  return { from: dinhDangNgayInput(from), to: dinhDangNgayInput(today) };
}

function TongQuan({ onNavigateTab }) {
  const [khoangChon, setKhoangChon] = useState("30_days");
  const [baoCao, setBaoCao] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [pendingTours, setPendingTours] = useState([]);
  const [loi, setLoi] = useState("");
  const [thongBao, setThongBao] = useState("");
  const [dangTai, setDangTai] = useState(true);

  const khoang = useMemo(() => tinhKhoangNgayTheoLoai(khoangChon), [khoangChon]);

  const taiDuLieu = useCallback(async () => {
    setDangTai(true);
    setLoi("");
    try {
      const [statsRes, bookingsRes, paymentsRes, toursRes] = await Promise.allSettled([
        api.adminStats({ from: khoang.from, to: khoang.to }),
        api.adminTourBookings(),
        api.adminPayments("PENDING"),
        api.adminToursChoDuyet(),
      ]);

      if (statsRes.status === "fulfilled") setBaoCao(statsRes.value);
      if (bookingsRes.status === "fulfilled") setBookings(bookingsRes.value?.bookings || []);
      if (paymentsRes.status === "fulfilled") setPendingPayments(paymentsRes.value?.payments || []);
      if (toursRes.status === "fulfilled") setPendingTours(toursRes.value?.tours || []);
    } catch (e) {
      setLoi(e.message || "Không thể tải dữ liệu quản trị.");
    } finally {
      setDangTai(false);
    }
  }, [khoang]);

  useEffect(() => {
    taiDuLieu();
  }, [taiDuLieu]);

  const handleDuyetTour = async (tourId) => {
    setLoi("");
    try {
      await api.adminDuyetTour(tourId);
      setThongBao("Đã duyệt tour thành công.");
      const res = await api.adminToursChoDuyet();
      setPendingTours(res.tours || []);
    } catch (e) {
      setLoi(e.message || "Không thể duyệt tour.");
    }
  };

  return (
    <section className="admin-overview" style={{ padding: "0 0 40px" }}>
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}
      {thongBao && <Toast message={thongBao} type="success" onClose={() => setThongBao("")} />}
      <AdminBentoOverview
        baoCao={baoCao}
        bookings={bookings}
        pendingPayments={pendingPayments}
        pendingTours={pendingTours}
        dangTai={dangTai}
        khoangChon={khoangChon}
        onChangeKhoang={setKhoangChon}
        onNavigateTab={onNavigateTab}
        onApproveTour={handleDuyetTour}
      />
    </section>
  );
}

/* ── 2. Địa điểm (Cơ sở lưu trú) ─────────────────────────────────────────── */

const TOI_THIEU_KY_TU = 2;

const LOAI_LUU_TRU = {
  hotel: "Khách sạn",
  accommodation: "Cơ sở lưu trú",
  campsite: "Khu cắm trại",
  bed_and_breakfast: "Nhà nghỉ B&B",
  motel: "Nhà nghỉ",
  guest_house: "Nhà nghỉ",
  hostel: "Hostel",
  resort: "Khu nghỉ dưỡng",
  apartment: "Căn hộ",
  homestay: "Homestay",
  villa: "Biệt thự",
  chalet: "Nhà gỗ",
  camp_site: "Khu cắm trại",
};

function nhanLoai(category) {
  if (!category) return "Cơ sở lưu trú";
  return LOAI_LUU_TRU[category] || category.replace(/_/g, " ");
}

function DiaDiem() {
  const [q, setQ] = useState("");
  const [ds, setDs] = useState(null);
  const [tong, setTong] = useState(0);
  const [trang, setTrang] = useState(1);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");
  const [form, setForm] = useState(null);
  const [lanTai, setLanTai] = useState(0);

  const PAGE = 20;
  const tuKhoa = q.trim();
  const duDieuKien = tuKhoa.length >= TOI_THIEU_KY_TU;

  function taiLai() {
    setLanTai((n) => n + 1);
  }

  function xoaKetQua() {
    setDs(null);
    setTong(0);
    setLoi("");
  }

  useEffect(() => {
    if (!duDieuKien) return;
    let bo = false;
    const t = setTimeout(() => {
      setDangTai(true);
      setLoi("");
      api
        .searchPlaces({
          q: tuKhoa,
          place_type: "accommodation",
          page: trang,
          page_size: PAGE,
        })
        .then((d) => {
          if (!bo) {
            setDs(d.items || []);
            setTong(d.total || 0);
          }
        })
        .catch((e) => {
          if (!bo) {
            setDs([]);
            setTong(0);
            setLoi(e.message);
          }
        })
        .finally(() => {
          if (!bo) setDangTai(false);
        });
    }, 400);
    return () => {
      bo = true;
      clearTimeout(t);
    };
  }, [tuKhoa, trang, duDieuKien, lanTai]);

  async function xoa(item) {
    if (!window.confirm(`Xoá "${item.name}"? Thao tác này không thể khôi phục.`)) return;
    try {
      await api.deletePlace(item.type, item.id);
      taiLai();
    } catch (e) {
      setLoi(e.message);
    }
  }

  const soTrang = Math.max(1, Math.ceil(tong / PAGE));

  return (
    <div className="admin-places">
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}

      {/* Toolbar */}
      <div className="admin-places__toolbar">
        <div className="admin-places__search">
          <span className="material-symbols-outlined admin-shell__span-28">
            search
          </span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTrang(1);
              if (e.target.value.trim().length < TOI_THIEU_KY_TU) xoaKetQua();
            }}
            placeholder="Tìm kiếm cơ sở lưu trú theo tên để quản lý..."
            className="admin-places__search-input"
          />
          {q && (
            <button
              type="button"
              className="admin-places__search-clear"
              onClick={() => {
                setQ("");
                xoaKetQua();
              }}
            >
              <span className="material-symbols-outlined admin-shell__span-31">close</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setForm({ ...FORM_RONG, place_type: "accommodation" })}
          className="btn-lime"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", fontSize: "13px" }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
          <span>Thêm cơ sở lưu trú</span>
        </button>
      </div>

      {/* Table */}
      <div className="admin-data-card admin-places__results">
        <div className="admin-data-card__scroll">
          <table className="bento-table">
            <thead>
              <tr>
                <th>Tên cơ sở</th>
                <th>Loại hình</th>
                <th>Toạ độ</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {dangTai &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td colSpan={4} style={{ padding: "20px" }}>
                      <div className="admin-shell__div-43 admin-shell__div-7" />
                    </td>
                  </tr>
                ))}

              {!dangTai && ds === null && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "36px", color: "#64748b" }}>
                    <span className="material-symbols-outlined" style={{ display: "block", fontSize: "32px", opacity: 0.6, marginBottom: "6px" }}>
                      manage_search
                    </span>
                    Nhập ít nhất {TOI_THIEU_KY_TU} ký tự vào ô tìm kiếm để tra cứu địa điểm cần chỉnh sửa.
                  </td>
                </tr>
              )}

              {!dangTai && ds?.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "36px", color: "#64748b" }}>
                    Không tìm thấy cơ sở lưu trú nào khớp với từ khóa “{tuKhoa}”.
                  </td>
                </tr>
              )}

              {!dangTai &&
                (ds || []).map((it) => (
                  <tr key={`${it.type}-${it.id}`}>
                    <td>
                      <Link
                        to={`/dia-diem/${it.type}/${it.id}`}
                        style={{ fontWeight: "700", color: "#0f172a", textDecoration: "none" }}
                      >
                        {it.name}
                      </Link>
                      {it.address && (
                        <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                          {it.address}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="pill pill-sky">
                        {nhanLoai(it.category)}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--bento-font-mono)", fontSize: "12.5px", color: "#475569" }}>
                      {it.lon?.toFixed(4)}, {it.lat?.toFixed(4)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...FORM_RONG,
                              id: it.id,
                              place_type: it.type,
                              name: it.name,
                              lon: it.lon,
                              lat: it.lat,
                              tourism: it.category || "",
                              address: it.address || "",
                              stars: it.stars || 0,
                              price_range: it.price_range || "",
                            })
                          }
                          className="btn-ghost"
                          style={{ padding: "4px 12px", fontSize: "12px" }}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => xoa(it)}
                          className="btn-ghost"
                          style={{ padding: "4px 12px", fontSize: "12px", color: "#b91c1c", borderColor: "#fecaca", background: "#fef2f2" }}
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {ds && ds.length > 0 && (
          <div className="admin-shell__div-58">
            <span>
              Tìm thấy <strong className="admin-shell__text-59">{so(tong)}</strong> kết quả · Trang {trang} / {so(soTrang)}
            </span>
            <div className="admin-shell__div-60">
              <button
                type="button"
                disabled={trang <= 1}
                onClick={() => setTrang((t) => t - 1)}
                className="admin-shell__button-61 admin-shell__button-9"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={trang >= soTrang}
                onClick={() => setTrang((t) => t + 1)}
                className="admin-shell__button-62 admin-shell__button-10"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>

      {form && (
        <FormDiaDiem
          form={form}
          setForm={setForm}
          onXong={() => {
            setForm(null);
            taiLai();
          }}
        />
      )}
    </div>
  );
}

const DANH_SACH_TINH_THANH = [
  { name: "Hà Nội", lon: 105.8542, lat: 21.0285 },
  { name: "Đà Nẵng", lon: 108.2022, lat: 16.0544 },
  { name: "TP. Hồ Chí Minh", lon: 106.6297, lat: 10.8231 },
  { name: "Quảng Ninh", lon: 107.0740, lat: 20.9500 },
  { name: "Khánh Hòa (Nha Trang)", lon: 109.1967, lat: 12.2388 },
  { name: "Lâm Đồng (Đà Lạt)", lon: 108.4583, lat: 11.9404 },
  { name: "Kiên Giang (Phú Quốc)", lon: 104.9833, lat: 10.0167 },
  { name: "Lào Cai (Sa Pa)", lon: 103.9750, lat: 22.4833 },
  { name: "Thừa Thiên Huế", lon: 107.5909, lat: 16.4637 },
  { name: "Ninh Bình", lon: 105.9745, lat: 20.2506 },
  { name: "Bình Định (Quy Nhơn)", lon: 109.2197, lat: 13.7830 },
  { name: "Bà Rịa - Vũng Tàu", lon: 107.0843, lat: 10.3460 },
  { name: "Quảng Nam (Hội An)", lon: 108.3380, lat: 15.8801 },
  { name: "Hải Phòng", lon: 106.6881, lat: 20.8449 },
  { name: "Cần Thơ", lon: 105.7838, lat: 10.0452 },
  { name: "An Giang", lon: 105.1259, lat: 10.3853 },
  { name: "Bắc Giang", lon: 106.1946, lat: 21.2731 },
  { name: "Bắc Kạn", lon: 105.8348, lat: 22.1471 },
  { name: "Bạc Liêu", lon: 105.7244, lat: 9.2941 },
  { name: "Bắc Ninh", lon: 106.0763, lat: 21.1861 },
  { name: "Bến Tre", lon: 106.3759, lat: 10.2433 },
  { name: "Bình Dương", lon: 106.6661, lat: 11.3254 },
  { name: "Bình Phước", lon: 106.7262, lat: 11.7511 },
  { name: "Bình Thuận", lon: 108.1021, lat: 10.9333 },
  { name: "Cà Mau", lon: 105.1524, lat: 9.1769 },
  { name: "Cao Bằng", lon: 106.2570, lat: 22.6667 },
  { name: "Đắk Lắk", lon: 108.0383, lat: 12.6667 },
  { name: "Đắk Nông", lon: 107.6908, lat: 12.0041 },
  { name: "Điện Biên", lon: 103.0167, lat: 21.3833 },
  { name: "Đồng Nai", lon: 106.8333, lat: 10.9500 },
  { name: "Đồng Tháp", lon: 105.6333, lat: 10.4500 },
  { name: "Gia Lai", lon: 108.0000, lat: 13.9833 },
  { name: "Hà Giang", lon: 104.9833, lat: 22.8167 },
  { name: "Hà Nam", lon: 105.9167, lat: 20.5333 },
  { name: "Hà Tĩnh", lon: 105.9000, lat: 18.3333 },
  { name: "Hải Dương", lon: 106.3167, lat: 20.9333 },
  { name: "Hậu Giang", lon: 105.4667, lat: 9.7833 },
  { name: "Hòa Bình", lon: 105.3333, lat: 20.8167 },
  { name: "Hưng Yên", lon: 106.0500, lat: 20.6500 },
  { name: "Kon Tum", lon: 108.0000, lat: 14.3500 },
  { name: "Lai Châu", lon: 103.4667, lat: 22.4000 },
  { name: "Lạng Sơn", lon: 106.7500, lat: 21.8500 },
  { name: "Long An", lon: 106.4167, lat: 10.5333 },
  { name: "Nam Định", lon: 106.1667, lat: 20.4333 },
  { name: "Nghệ An", lon: 105.6833, lat: 18.6667 },
  { name: "Ninh Thuận", lon: 108.9833, lat: 11.5667 },
  { name: "Phú Thọ", lon: 105.2167, lat: 21.3167 },
  { name: "Phú Yên", lon: 109.3000, lat: 13.0833 },
  { name: "Quảng Bình", lon: 106.6000, lat: 17.4833 },
  { name: "Quảng Ngãi", lon: 108.8000, lat: 15.1167 },
  { name: "Quảng Trị", lon: 107.1833, lat: 16.7500 },
  { name: "Sóc Trăng", lon: 105.9667, lat: 9.6000 },
  { name: "Sơn La", lon: 103.9000, lat: 21.3167 },
  { name: "Tây Ninh", lon: 106.1000, lat: 11.3000 },
  { name: "Thái Bình", lon: 106.3333, lat: 20.4500 },
  { name: "Thái Nguyên", lon: 105.8333, lat: 21.5833 },
  { name: "Thanh Hóa", lon: 105.7833, lat: 19.8000 },
  { name: "Tiền Giang", lon: 106.3500, lat: 10.3500 },
  { name: "Trà Vinh", lon: 106.3333, lat: 9.9333 },
  { name: "Tuyên Quang", lon: 105.2167, lat: 21.8167 },
  { name: "Vĩnh Long", lon: 105.9667, lat: 10.2500 },
  { name: "Vĩnh Phúc", lon: 105.6000, lat: 21.3000 },
  { name: "Yên Bái", lon: 104.8667, lat: 21.7000 },
];

function BanDoChonViTri({ lat, lon, onChonToaDo }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  const currentLat = Number(lat) || 21.0285;
  const currentLon = Number(lon) || 105.8542;

  useEffect(() => {
    if (!mapContainerRef.current || !window.L) return;

    if (!mapInstanceRef.current) {
      const map = window.L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false,
      }).setView([currentLat, currentLon], 14);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const marker = window.L.marker([currentLat, currentLon], {
        draggable: true,
      }).addTo(map);

      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        onChonToaDo(pos.lng, pos.lat);
      });

      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        onChonToaDo(e.latlng.lng, e.latlng.lat);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    } else {
      mapInstanceRef.current.setView([currentLat, currentLon]);
      if (markerRef.current) {
        markerRef.current.setLatLng([currentLat, currentLon]);
      }
    }
  }, [currentLat, currentLon, onChonToaDo]);

  return (
    <div style={{ position: "relative", width: "100%", height: "180px", borderRadius: "14px", overflow: "hidden", border: "1px solid #e2e8f0" }}>
      <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
      <div
        style={{
          position: "absolute",
          bottom: "8px",
          left: "8px",
          background: "rgba(255, 255, 255, 0.92)",
          padding: "4px 10px",
          borderRadius: "8px",
          fontSize: "11px",
          fontWeight: "700",
          color: "#0f172a",
          zIndex: 1000,
          pointerEvents: "none",
          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          backdropFilter: "blur(4px)",
        }}
      >
        📍 Click hoặc kéo ghim trên bản đồ để chọn vị trí
      </div>
    </div>
  );
}

function FormDiaDiem({ form, setForm, onXong }) {
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");
  const [dangTimViTri, setDangTimViTri] = useState(false);
  const [tinhChon, setTinhChon] = useState("Hà Nội");

  function dat(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  // Tự động gán vị trí mặc định nếu chưa có
  useEffect(() => {
    if (!form.lon || !form.lat) {
      setForm((f) => ({ ...f, lon: 105.8542, lat: 21.0285 }));
    }
  }, [form.lon, form.lat, setForm]);

  // Khi người dùng chọn Tỉnh / Thành phố
  const handleChonTinh = (e) => {
    const provinceName = e.target.value;
    setTinhChon(provinceName);
    const found = DANH_SACH_TINH_THANH.find((p) => p.name === provinceName);
    if (found) {
      dat("lon", found.lon);
      dat("lat", found.lat);
    }
  };

  // Định vị tự động từ địa chỉ
  const timViTriTheoDiaChi = async () => {
    const query = `${form.address || ""} ${form.name || ""} ${tinhChon || ""}`.trim();
    if (!query) return;
    setDangTimViTri(true);
    setLoi("");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn&limit=1`
      );
      const data = await res.json();
      if (data && data.length > 0) {
        dat("lon", Number(data[0].lon));
        dat("lat", Number(data[0].lat));
      } else {
        setLoi("Không tìm thấy tọa độ chính xác của địa chỉ này, bạn có thể click chọn trực tiếp trên bản đồ.");
      }
    } catch {
      setLoi("Không thể kết nối dịch vụ định vị. Hãy click vị trí trên bản đồ.");
    } finally {
      setDangTimViTri(false);
    }
  };

  async function luu(e) {
    e.preventDefault();
    setDangLuu(true);
    setLoi("");

    const lonVal = Number(form.lon) || 105.8542;
    const latVal = Number(form.lat) || 21.0285;

    const body = {
      name: form.name.trim(),
      lon: lonVal,
      lat: latVal,
      tourism: form.tourism || "hotel",
      amenity: form.amenity || null,
      price_range: form.price_range || null,
      stars: Number(form.stars) || 0,
      address: form.address || null,
    };

    try {
      if (form.id) await api.updatePlace(form.place_type, form.id, body);
      else await api.createPlace(form.place_type, body);
      onXong();
    } catch (e2) {
      setLoi(e2.message);
    } finally {
      setDangLuu(false);
    }
  }

  return (
    <div className="admin-modal" onClick={() => setForm(null)}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={luu}
        className="admin-modal__card"
        style={{ maxWidth: "580px", padding: "26px" }}
      >
        {/* TIÊU ĐỀ MODAL */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
              {form.id ? "Chỉnh sửa cơ sở lưu trú" : "Thêm mới cơ sở lưu trú"}
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#64748b" }}>
              Điền thông tin và chọn vị trí địa điểm lưu trú trên bản đồ
            </p>
          </div>
          <button
            type="button"
            className="admin-shell__button-66"
            onClick={() => setForm(null)}
          >
            <span className="material-symbols-outlined admin-shell__span-67">close</span>
          </button>
        </div>

        {/* 1. TÊN CƠ SỞ LƯU TRÚ */}
        <label style={{ display: "block", marginBottom: "14px" }}>
          <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
            Tên cơ sở lưu trú *
          </span>
          <input
            required
            value={form.name}
            onChange={(e) => dat("name", e.target.value)}
            placeholder="Ví dụ: Khách sạn Mường Thanh, Sapa Jade Hill..."
            className="admin-places__search-input"
            style={{ padding: "0 14px", height: "40px" }}
          />
        </label>

        {/* 2. TỈNH / THÀNH PHỐ & LOẠI HÌNH LƯU TRÚ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              Tỉnh / Thành phố *
            </span>
            <select
              value={tinhChon}
              onChange={handleChonTinh}
              className="admin-places__search-input"
              style={{ padding: "0 14px", height: "40px" }}
            >
              {DANH_SACH_TINH_THANH.map((p) => (
                <option key={p.name} value={p.name}>{p.name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              Loại hình lưu trú
            </span>
            <select
              value={form.tourism || "hotel"}
              onChange={(e) => dat("tourism", e.target.value)}
              className="admin-places__search-input"
              style={{ padding: "0 14px", height: "40px" }}
            >
              <option value="hotel">Khách sạn (Hotel)</option>
              <option value="resort">Khu nghỉ dưỡng (Resort)</option>
              <option value="homestay">Homestay</option>
              <option value="guest_house">Nhà nghỉ / B&B</option>
              <option value="hostel">Hostel</option>
              <option value="apartment">Căn hộ (Apartment)</option>
              <option value="villa">Biệt thự (Villa)</option>
              <option value="campsite">Khu cắm trại (Campsite)</option>
              <option value="accommodation">Cơ sở lưu trú khác</option>
            </select>
          </label>
        </div>

        {/* 3. ĐỊA CHỈ CỤ THỂ VÀ NÚT TÌM TỌA ĐỘ */}
        <div style={{ marginBottom: "14px" }}>
          <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
            Địa chỉ cụ thể
          </span>
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              value={form.address || ""}
              onChange={(e) => dat("address", e.target.value)}
              placeholder="Số nhà, tên đường, phường/xã..."
              className="admin-places__search-input"
              style={{ padding: "0 14px", height: "40px", flex: 1 }}
            />
            <button
              type="button"
              onClick={timViTriTheoDiaChi}
              disabled={dangTimViTri}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "0 14px",
                height: "40px",
                background: "#f1f5f9",
                color: "#0f172a",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#0284c7" }}>my_location</span>
              <span>{dangTimViTri ? "Đang tìm..." : "Định vị"}</span>
            </button>
          </div>
        </div>

        {/* 4. BẢN ĐỒ CHỌN VỊ TRÍ TRỰC QUAN (KHÔNG BẮT NHẬP KINH ĐỘ VĨ ĐỘ) */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#334155" }}>
              Vị trí trên bản đồ
            </span>
            <span style={{ fontSize: "11px", color: "#0284c7", fontWeight: "600", fontFamily: "var(--bento-font-mono)" }}>
              📍 {Number(form.lat || 21.0285).toFixed(4)}, {Number(form.lon || 105.8542).toFixed(4)}
            </span>
          </div>

          <BanDoChonViTri
            lat={form.lat}
            lon={form.lon}
            onChonToaDo={(lng, lat) => {
              dat("lon", lng);
              dat("lat", lat);
            }}
          />
        </div>

        {/* 5. HẠNG SAO VÀ MỨC GIÁ */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              Hạng sao (0 - 5)
            </span>
            <select
              value={form.stars || 0}
              onChange={(e) => dat("stars", Number(e.target.value))}
              className="admin-places__search-input"
              style={{ padding: "0 14px", height: "40px" }}
            >
              <option value={0}>Chưa xếp hạng</option>
              <option value={1}>⭐ 1 Sao</option>
              <option value={2}>⭐⭐ 2 Sao</option>
              <option value={3}>⭐⭐⭐ 3 Sao</option>
              <option value={4}>⭐⭐⭐⭐ 4 Sao</option>
              <option value={5}>⭐⭐⭐⭐⭐ 5 Sao</option>
            </select>
          </label>

          <label style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
              Mức giá
            </span>
            <select
              value={form.price_range || ""}
              onChange={(e) => dat("price_range", e.target.value)}
              className="admin-places__search-input"
              style={{ padding: "0 14px", height: "40px" }}
            >
              <option value="">Không rõ</option>
              <option value="Rẻ">Bình dân / Tiết kiệm</option>
              <option value="Trung bình">Trung bình</option>
              <option value="Sang trọng">Cao cấp / Sang trọng</option>
            </select>
          </label>
        </div>

        {loi && (
          <p style={{ margin: "0 0 14px", color: "#ef4444", fontSize: "12px", fontWeight: "600" }}>
            {loi}
          </p>
        )}

        {/* NÚT THAO TÁC */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "8px", borderTop: "1px solid #f1f5f9" }}>
          <button
            type="button"
            onClick={() => setForm(null)}
            style={{
              padding: "10px 18px",
              background: "#f1f5f9",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            Huỷ bỏ
          </button>
          <button
            type="submit"
            disabled={dangLuu}
            style={{
              padding: "10px 22px",
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontWeight: "700",
              fontSize: "13px",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
            }}
          >
            {dangLuu ? "Đang lưu..." : "Lưu thông tin"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── 3. Thanh toán & Đối soát ────────────────────────────────────────────── */

const LOC_THANH_TOAN = [
  ["", "Tất cả giao dịch"],
  ["PENDING", "Chờ xác nhận"],
  ["SUCCESS", "Đã nhận tiền"],
  ["MISMATCH", "Lệch tiền"],
  ["FAILED", "Thất bại"],
];

const NHAN_THANH_TOAN = {
  PENDING: "Chờ xác nhận",
  SUCCESS: "Đã nhận tiền",
  MISMATCH: "Lệch tiền",
  FAILED: "Thất bại",
};

const NHAN_CACH_TRA = { CHUYEN_KHOAN: "Chuyển khoản", STRIPE: "Stripe", CARD: "Thẻ" };

function ngay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN");
}

function ThanhToan({ locBanDau }) {
  const [loc, setLoc] = useState(locBanDau || "");
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState("");
  const [tin, setTin] = useState("");
  const [dangChay, setDangChay] = useState(0);

  function tai() {
    setDs(null);
    setLoi("");
    api
      .adminPayments(loc || undefined)
      .then((d) => setDs(d.payments || []))
      .catch((e) => {
        setDs([]);
        setLoi(e.message);
      });
  }
  useEffect(tai, [loc]);

  async function xacNhan(p) {
    const dongY = window.confirm(
      `Xác nhận đã nhận ${so(p.amount)} đ cho đơn hàng ${p.booking_code}?`
    );
    if (!dongY) return;
    setDangChay(p.id);
    setLoi("");
    setTin("");
    try {
      const kq = await api.adminConfirmPayment(p.id);
      if (kq && kq.success === false) {
        setLoi(kq.message || "Xác nhận thanh toán không thành công.");
      } else {
        setTin(kq.message || `Đã xác nhận thanh toán đơn ${p.booking_code}.`);
      }
      tai();
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangChay(0);
    }
  }

  const bamDuoc = (tt) => tt === "PENDING" || tt === "MISMATCH";

  return (
    <div className="admin-payments">
      {tin && <Toast message={tin} onClose={() => setTin("")} />}
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}

      {/* Filter Tabs Pills chuẩn Bento */}
      <div className="role-toggle-group" style={{ marginBottom: "16px" }} role="group" aria-label="Lọc trạng thái giao dịch">
        {LOC_THANH_TOAN.map(([v, nhan]) => (
          <button
            key={v}
            type="button"
            onClick={() => setLoc(v)}
            className={`role-tab ${loc === v ? "active" : ""}`}
            style={{ fontSize: "12px", padding: "6px 16px" }}
          >
            {nhan}
          </button>
        ))}
      </div>

      {ds === null && (
        <div className="admin-shell__div-100">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="admin-shell__div-101 admin-shell__div-20" />
          ))}
        </div>
      )}

      {ds?.length === 0 && (
        <div className="admin-shell__div-102 admin-shell__div-21">
          <div className="admin-shell__div-103">
            <span className="material-symbols-outlined admin-shell__span-104">payments</span>
          </div>
          <h3 className="admin-shell__text-105">Không có giao dịch nào</h3>
          <p className="admin-shell__text-106">Chưa ghi nhận khoản thanh toán nào ở danh mục này.</p>
        </div>
      )}

      {ds && ds.length > 0 && (
        <div className="admin-data-card admin-payments__results">
          <div className="admin-data-card__scroll">
            <table className="bento-table">
              <thead>
                <tr>
                  <th>Mã giao dịch</th>
                  <th>Mã đơn</th>
                  <th>Tour</th>
                  <th>Số tiền</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {ds.map((p) => {
                  return (
                    <tr key={p.id} title={p.note || undefined}>
                      <td>
                        <span style={{ fontFamily: "var(--bento-font-mono)", fontWeight: "800", color: "#0f172a" }}>
                          {p.txn_ref}
                        </span>
                        <div style={{ fontSize: "11px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                          {NHAN_CACH_TRA[p.method] || p.method}
                          {ngay(p.created_at) ? ` · ${ngay(p.created_at)}` : ""}
                        </div>
                      </td>
                      <td style={{ fontWeight: "600", color: "#334155" }}>
                        {p.booking_code}
                      </td>
                      <td style={{ fontWeight: "600" }}>
                        {p.tour_name}
                      </td>
                      <td style={{ fontFamily: "var(--bento-font-mono)", fontWeight: "800", color: "var(--bento-text-dark)", fontSize: "14px" }}>
                        {so(p.amount)} đ
                      </td>
                      <td>
                        <span
                          className={`pill ${
                            p.status === "SUCCESS"
                              ? "pill-lime"
                              : p.status === "PENDING"
                              ? "pill-sky"
                              : "pill-rose"
                          }`}
                        >
                          {NHAN_THANH_TOAN[p.status] || p.status}
                        </span>
                        {p.confirmed_by_name && (
                          <div style={{ fontSize: "11px", color: "#64748b", marginTop: "3px" }}>
                            Bởi {p.confirmed_by_name}
                          </div>
                        )}
                      </td>
                      <td>
                        {bamDuoc(p.status) ? (
                          <button
                            type="button"
                            onClick={() => xacNhan(p)}
                            disabled={dangChay === p.id}
                            title="Xác nhận đã nhận tiền"
                            aria-label="Xác nhận nhận tiền"
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "6px",
                              border: "none",
                              background: "#0f172a",
                              color: "#ffffff",
                              cursor: "pointer",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                              {dangChay === p.id ? "hourglass_empty" : "check"}
                            </span>
                          </button>
                        ) : (
                          <span style={{ fontSize: "12px", fontWeight: "600", color: "#94a3b8" }}>Đã chốt</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 5. Đặt tour ─────────────────────────────────────────────────────────── */

const NHAN_DAT_TOUR = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PARTIALLY_PAID: "Thanh toán một phần",
  CONFIRMED: "Đã xác nhận",
  EXPIRED: "Hết hạn",
  CANCELLED_BY_CUSTOMER: "Khách đã huỷ",
  CANCELLED_BY_OPERATOR: "Nhà điều hành đã huỷ",
  COMPLETED: "Hoàn thành",
  REFUNDED: "Đã hoàn tiền",
  NO_SHOW: "Không tham gia",
};

const LOC_DAT_TOUR = [
  { id: "ALL", nhan: "Tất cả" },
  { id: "PAID", nhan: "Đã thanh toán" },
  { id: "PENDING", nhan: "Chờ thanh toán" },
  { id: "CANCELLED", nhan: "Đã huỷ / Hoàn tiền" },
];

function toneDatTour(status) {
  if (["PAID", "CONFIRMED", "COMPLETED"].includes(status)) return "success";
  if (["PENDING_PAYMENT", "PARTIALLY_PAID"].includes(status)) return "info";
  if (["EXPIRED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_OPERATOR", "NO_SHOW"].includes(status)) return "danger";
  return "neutral";
}

function matchStatus(bookingStatus, tabId) {
  if (tabId === "ALL") return true;
  if (tabId === "PAID") return ["PAID", "CONFIRMED", "COMPLETED"].includes(bookingStatus);
  if (tabId === "PENDING") return ["PENDING_PAYMENT", "PARTIALLY_PAID"].includes(bookingStatus);
  if (tabId === "CANCELLED") {
    return ["EXPIRED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_OPERATOR", "NO_SHOW", "REFUNDED"].includes(bookingStatus);
  }
  return true;
}

function DatTour() {
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState("");
  const [q, setQ] = useState("");
  const [tabLoc, setTabLoc] = useState("ALL");
  const [sortField, setSortField] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");

  useEffect(() => {
    api
      .adminTourBookings()
      .then((d) => setDs(d.bookings || []))
      .catch((e) => {
        setLoi(e.message);
        setDs([]);
      });
  }, []);

  // Xử lý toggle sort khi click vào header cột
  const handleSortHeader = (field) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  // Lọc và sắp xếp danh sách đơn
  const filteredAndSorted = (ds || [])
    .filter((b) => {
      // 1. Lọc theo trạng thái
      if (!matchStatus(b.status, tabLoc)) return false;

      // 2. Tìm kiếm từ khóa
      if (!q.trim()) return true;
      const kw = q.trim().toLowerCase();
      const code = (b.code || "").toLowerCase();
      const name = (b.full_name || "").toLowerCase();
      const phone = (b.phone || "").toLowerCase();
      const tour = (b.tour_name || "").toLowerCase();
      const id = String(b.id);
      return code.includes(kw) || name.includes(kw) || phone.includes(kw) || tour.includes(kw) || id.includes(kw);
    })
    .sort((a, b) => {
      let va = a[sortField];
      let vb = b[sortField];

      if (sortField === "total_price" || sortField === "guests") {
        va = Number(va || 0);
        vb = Number(vb || 0);
      } else if (sortField === "created_at" || sortField === "depart_date") {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else {
        va = (va || "").toString().toLowerCase();
        vb = (vb || "").toString().toLowerCase();
      }

      if (va < vb) return sortOrder === "asc" ? -1 : 1;
      if (va > vb) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

  // Tính số lượng cho từng tab bộ lọc
  const counts = (ds || []).reduce(
    (acc, b) => {
      acc.ALL = (acc.ALL || 0) + 1;
      if (["PAID", "CONFIRMED", "COMPLETED"].includes(b.status)) acc.PAID = (acc.PAID || 0) + 1;
      if (["PENDING_PAYMENT", "PARTIALLY_PAID"].includes(b.status)) acc.PENDING = (acc.PENDING || 0) + 1;
      if (["EXPIRED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_OPERATOR", "NO_SHOW", "REFUNDED"].includes(b.status)) {
        acc.CANCELLED = (acc.CANCELLED || 0) + 1;
      }
      return acc;
    },
    { ALL: 0, PAID: 0, PENDING: 0, CANCELLED: 0 }
  );

  if (loi) return <Toast message={loi} type="error" onClose={() => setLoi("")} />;

  if (ds === null) {
    return (
      <div className="admin-shell__div-131">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="admin-shell__div-132 admin-shell__div-24" />
        ))}
      </div>
    );
  }

  return (
    <div className="admin-bookings">
      {/* TOOLBAR CHUẨN: TÌM KIẾM BÊN TRÁI & BỘ LỌC TRẠNG THÁI BÊN PHẢI */}
      <div className="admin-places__toolbar" style={{ marginBottom: "16px" }}>
        <div className="admin-places__search" style={{ maxWidth: "460px" }}>
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Tìm theo mã đơn, khách hàng, số điện thoại, tên tour..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="admin-places__search-input"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="admin-places__search-clear"
              title="Xóa tìm kiếm"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div className="role-toggle-group" role="group" aria-label="Lọc trạng thái đặt tour">
          {LOC_DAT_TOUR.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTabLoc(t.id)}
              className={`role-tab ${tabLoc === t.id ? "active" : ""}`}
            >
              {t.nhan} ({counts[t.id] || 0})
            </button>
          ))}
        </div>
      </div>

      {/* NỘI DUNG BẢNG HOẶC EMPTY STATE */}
      {filteredAndSorted.length === 0 ? (
        <div className="admin-data-card" style={{ padding: "48px 24px", textAlign: "center" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "#f1f5f9",
              color: "#94a3b8",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 14px",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "28px" }}>search_off</span>
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
            Không tìm thấy đơn đặt tour nào
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
            {q
              ? `Không có kết quả phù hợp với từ khóa "${q}" trong danh mục đã chọn.`
              : "Không có đơn đặt tour nào trong trạng thái này."}
          </p>
          {(q || tabLoc !== "ALL") && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setTabLoc("ALL");
              }}
              className="btn-lime"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                fontSize: "12.5px",
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>restart_alt</span>
              <span>Xóa bộ lọc</span>
            </button>
          )}
        </div>
      ) : (
        <div className="admin-data-card admin-bookings">
          <div className="admin-data-card__scroll">
            <table className="bento-table">
              <thead>
                <tr>
                  <th
                    className="admin-bookings__th-sortable"
                    onClick={() => handleSortHeader("code")}
                    title="Bấm để sắp xếp theo Mã đơn"
                  >
                    <span className="admin-bookings__th-sort-inner">
                      <span>Mã đơn</span>
                      <span className={`material-symbols-outlined admin-bookings__sort-icon ${sortField === "code" ? "admin-bookings__sort-icon--active" : ""}`}>
                        {sortField === "code" ? (sortOrder === "asc" ? "north" : "south") : "unfold_more"}
                      </span>
                    </span>
                  </th>

                  <th
                    className="admin-bookings__th-sortable"
                    onClick={() => handleSortHeader("full_name")}
                    title="Bấm để sắp xếp theo Khách hàng"
                  >
                    <span className="admin-bookings__th-sort-inner">
                      <span>Khách hàng</span>
                      <span className={`material-symbols-outlined admin-bookings__sort-icon ${sortField === "full_name" ? "admin-bookings__sort-icon--active" : ""}`}>
                        {sortField === "full_name" ? (sortOrder === "asc" ? "north" : "south") : "unfold_more"}
                      </span>
                    </span>
                  </th>

                  <th
                    className="admin-bookings__th-sortable"
                    onClick={() => handleSortHeader("tour_name")}
                    title="Bấm để sắp xếp theo Tour du lịch"
                  >
                    <span className="admin-bookings__th-sort-inner">
                      <span>Tour du lịch</span>
                      <span className={`material-symbols-outlined admin-bookings__sort-icon ${sortField === "tour_name" ? "admin-bookings__sort-icon--active" : ""}`}>
                        {sortField === "tour_name" ? (sortOrder === "asc" ? "north" : "south") : "unfold_more"}
                      </span>
                    </span>
                  </th>

                  <th
                    className="admin-bookings__th-sortable"
                    onClick={() => handleSortHeader("depart_date")}
                    title="Bấm để sắp xếp theo Ngày khởi hành"
                  >
                    <span className="admin-bookings__th-sort-inner">
                      <span>Khởi hành</span>
                      <span className={`material-symbols-outlined admin-bookings__sort-icon ${sortField === "depart_date" ? "admin-bookings__sort-icon--active" : ""}`}>
                        {sortField === "depart_date" ? (sortOrder === "asc" ? "north" : "south") : "unfold_more"}
                      </span>
                    </span>
                  </th>

                  <th
                    className="admin-bookings__th-sortable admin-bookings__money-heading"
                    onClick={() => handleSortHeader("total_price")}
                    title="Bấm để sắp xếp theo Tổng tiền"
                  >
                    <span className="admin-bookings__th-sort-inner" style={{ justifyContent: "flex-end", width: "100%" }}>
                      <span>Tổng tiền</span>
                      <span className={`material-symbols-outlined admin-bookings__sort-icon ${sortField === "total_price" ? "admin-bookings__sort-icon--active" : ""}`}>
                        {sortField === "total_price" ? (sortOrder === "asc" ? "north" : "south") : "unfold_more"}
                      </span>
                    </span>
                  </th>

                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <span style={{ fontFamily: "var(--bento-font-mono)", fontWeight: "800", color: "#0f172a" }}>{b.code || `#${b.id}`}</span>
                      <div style={{ fontSize: "11px", color: "var(--bento-text-muted)", marginTop: "2px" }}>{ngay(b.created_at)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: "700", color: "#0f172a" }}>{b.full_name}</div>
                      <div style={{ fontSize: "11px", color: "var(--bento-text-muted)", marginTop: "2px" }}>{b.phone} · {b.guests} khách</div>
                    </td>
                    <td style={{ fontWeight: "600", color: "#334155" }}>
                      {b.tour_name || `#${b.tour_id}`}
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "600", fontSize: "12px", color: "#475569" }}>
                        <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#64748b" }}>calendar_month</span>
                        <span>{b.depart_date || "—"}</span>
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--bento-font-mono)", fontWeight: "800", fontSize: "14px", color: "var(--bento-text-dark)", textAlign: "right" }}>
                      {so(b.total_price)} đ
                    </td>
                    <td>
                      <span className={`pill ${
                        ["PAID", "CONFIRMED", "COMPLETED"].includes(b.status)
                          ? "pill-lime"
                          : ["PENDING_PAYMENT", "PARTIALLY_PAID"].includes(b.status)
                          ? "pill-amber"
                          : ["EXPIRED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_OPERATOR", "NO_SHOW", "REFUNDED"].includes(b.status)
                          ? "pill-rose"
                          : "pill-sky"
                      }`}>
                        {NHAN_DAT_TOUR[b.status] || b.status || "Chưa xác định"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 6. Quản lý Nhà điều hành Tour (Operators) ───────────────────────────── */

const FORM_OPERATOR_RONG = {
  id: null,
  email: "",
  password: "",
  full_name: "",
  company_name: "",
  tax_code: "",
  commission_rate: 10,
  status: "ACTIVE",
};

function NhaDieuHanh() {
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState("");
  const [tin, setTin] = useState("");
  const [q, setQ] = useState("");
  const [locTrangThai, setLocTrangThai] = useState("ALL");
  const [form, setForm] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [loiForm, setLoiForm] = useState("");

  const taiDanhSach = useCallback(() => {
    setLoi("");
    api
      .adminOperators()
      .then((d) => setDs(d.operators || []))
      .catch((e) => {
        setLoi(e.message || "Không tải được danh sách nhà điều hành.");
        setDs([]);
      });
  }, []);

  useEffect(() => {
    taiDanhSach();
  }, [taiDanhSach]);

  const danhSachLoc = useMemo(() => {
    return (ds || []).filter((op) => {
      if (locTrangThai !== "ALL" && (op.status || "ACTIVE") !== locTrangThai) {
        return false;
      }
      if (!q.trim()) return true;
      const kw = q.trim().toLowerCase();
      return (
        (op.company_name || "").toLowerCase().includes(kw) ||
        (op.full_name || "").toLowerCase().includes(kw) ||
        (op.email || "").toLowerCase().includes(kw) ||
        (op.tax_code || "").toLowerCase().includes(kw)
      );
    });
  }, [ds, locTrangThai, q]);

  const moFormTaoMoi = () => {
    setLoiForm("");
    setForm({ ...FORM_OPERATOR_RONG });
  };

  const moFormSua = (op) => {
    setLoiForm("");
    setForm({
      id: op.id,
      email: op.email || "",
      password: "",
      full_name: op.full_name || "",
      company_name: op.company_name || "",
      tax_code: op.tax_code || "",
      commission_rate: Math.round(Number(op.commission_rate ?? 0.1) * 100),
      status: op.status || "ACTIVE",
    });
  };

  const doiTrangThaiNhanh = async (op) => {
    const trangThaiMoi = op.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      await api.adminUpdateOperator(op.id, { status: trangThaiMoi });
      setTin(
        trangThaiMoi === "ACTIVE"
          ? `Đã kích hoạt lại nhà điều hành "${op.company_name}".`
          : `Đã tạm ngưng nhà điều hành "${op.company_name}".`
      );
      taiDanhSach();
    } catch (e) {
      setLoi(e.message);
    }
  };

  const luuOperator = async (e) => {
    e.preventDefault();
    setLoiForm("");
    if (!form.company_name.trim() || !form.full_name.trim() || (!form.id && !form.email.trim())) {
      setLoiForm("Vui lòng điền đầy đủ Tên công ty, Người đại diện và Email.");
      return;
    }
    setDangLuu(true);
    try {
      const rateDecimal = Math.max(0, Math.min(100, Number(form.commission_rate || 10))) / 100;
      if (form.id) {
        await api.adminUpdateOperator(form.id, {
          full_name: form.full_name.trim(),
          company_name: form.company_name.trim(),
          tax_code: form.tax_code.trim() || null,
          commission_rate: rateDecimal,
          status: form.status,
          password: form.password.trim() || undefined,
        });
        setTin(`Đã cập nhật tài khoản nhà điều hành "${form.company_name}".`);
      } else {
        await api.adminCreateOperator({
          email: form.email.trim(),
          password: form.password.trim() || "123456",
          full_name: form.full_name.trim(),
          company_name: form.company_name.trim(),
          tax_code: form.tax_code.trim() || null,
          commission_rate: rateDecimal,
          status: form.status || "ACTIVE",
        });
        setTin(`Đã tạo tài khoản nhà điều hành "${form.company_name}" (${form.email}).`);
      }
      setForm(null);
      taiDanhSach();
    } catch (err) {
      setLoiForm(err.message || "Không thể lưu thông tin nhà điều hành.");
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <div className="admin-operators">
      {tin && <Toast message={tin} onClose={() => setTin("")} />}
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}

      {/* THANH CÔNG CỤ: TÌM KIẾM + LỌC + NÚT TẠO TÀI KHOẢN OPERATOR */}
      <div className="admin-places__toolbar" style={{ marginBottom: "16px", gap: "12px", flexWrap: "wrap" }}>
        <div className="admin-places__search" style={{ maxWidth: "420px", flex: "1 1 280px" }}>
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Tìm theo tên công ty, email, người đại diện, mã số thuế..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="admin-places__search-input"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="admin-places__search-clear"
              title="Xóa tìm kiếm"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div className="role-toggle-group" role="group" aria-label="Lọc trạng thái nhà điều hành">
            {[
              { id: "ALL", nhan: `Tất cả (${(ds || []).length})` },
              { id: "ACTIVE", nhan: "Đang hoạt động" },
              { id: "SUSPENDED", nhan: "Tạm ngưng" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setLocTrangThai(t.id)}
                className={`role-tab ${locTrangThai === t.id ? "active" : ""}`}
              >
                {t.nhan}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={moFormTaoMoi}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              background: "#0f172a",
              color: "#ffffff",
              border: "none",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(15, 23, 42, 0.14)",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>person_add</span>
            <span>Tạo tài khoản Nhà điều hành</span>
          </button>
        </div>
      </div>

      {/* BẢNG DANH SÁCH NHÀ ĐIỀU HÀNH */}
      <div className="admin-data-card">
        <div className="admin-data-card__scroll">
          <table className="bento-table">
            <thead>
              <tr>
                <th>Đơn vị lữ hành</th>
                <th>Tài khoản đăng nhập</th>
                <th>Mã số thuế</th>
                <th>Chiết khấu</th>
                <th>Số tour</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {ds === null && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "36px", color: "#64748b" }}>
                    Đang tải danh sách nhà điều hành...
                  </td>
                </tr>
              )}
              {ds !== null && danhSachLoc.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "42px 24px", color: "#64748b" }}>
                    <span className="material-symbols-outlined" style={{ display: "block", fontSize: "34px", opacity: 0.5, marginBottom: "8px" }}>
                      badge
                    </span>
                    Chưa có nhà điều hành nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              )}
              {danhSachLoc.map((op) => (
                <tr key={op.id}>
                  <td>
                    <div style={{ fontWeight: "800", color: "#0f172a", fontSize: "14px" }}>
                      {op.company_name}
                    </div>
                    <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                      ID #{op.id} · Tạo ngày {ngay(op.created_at) || "—"}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: "700", color: "#1e293b" }}>{op.full_name}</div>
                    <div style={{ fontFamily: "var(--bento-font-mono)", fontSize: "12px", color: "#0284c7", marginTop: "2px" }}>
                      {op.email}
                    </div>
                  </td>
                  <td style={{ fontFamily: "var(--bento-font-mono)", fontSize: "13px", color: "#334155", fontWeight: "600" }}>
                    {op.tax_code || "—"}
                  </td>
                  <td>
                    <span className="pill pill-sky">
                      {Math.round(Number(op.commission_rate ?? 0.1) * 100)}%
                    </span>
                  </td>
                  <td style={{ fontWeight: "700", color: "#0f172a" }}>
                    {so(op.tour_count || 0)} tour
                  </td>
                  <td>
                    <span className={`pill ${op.status === "ACTIVE" ? "pill-lime" : "pill-rose"}`}>
                      {op.status === "ACTIVE" ? "Đang hoạt động" : "Tạm ngưng"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => moFormSua(op)}
                        className="btn-ghost"
                        style={{ padding: "5px 12px", fontSize: "12px" }}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => doiTrangThaiNhanh(op)}
                        className="btn-ghost"
                        style={{
                          padding: "5px 12px",
                          fontSize: "12px",
                          color: op.status === "ACTIVE" ? "#b91c1c" : "#047857",
                          borderColor: op.status === "ACTIVE" ? "#fecaca" : "#a7f3d0",
                          background: op.status === "ACTIVE" ? "#fef2f2" : "#ecfdf5",
                        }}
                      >
                        {op.status === "ACTIVE" ? "Tạm ngưng" : "Kích hoạt"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL TẠO / CẬP NHẬT TÀI KHOẢN NHÀ ĐIỀU HÀNH */}
      {form && (
        <div className="admin-modal" onClick={() => setForm(null)}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={luuOperator}
            className="admin-modal__card"
            style={{ maxWidth: "540px", padding: "26px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#0f172a" }}>
                  {form.id ? "Cập nhật Nhà điều hành" : "Tạo tài khoản Nhà điều hành mới"}
                </h2>
                <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#64748b" }}>
                  {form.id
                    ? "Chỉnh sửa thông tin đơn vị lữ hành, mật khẩu hoặc chiết khấu"
                    : "Tài khoản tạo xong có thể đăng nhập ngay vào cổng /operator để tạo và quản lý tour"}
                </p>
              </div>
              <button
                type="button"
                className="admin-shell__button-66"
                onClick={() => setForm(null)}
              >
                <span className="material-symbols-outlined admin-shell__span-67">close</span>
              </button>
            </div>

            <label style={{ display: "block", marginBottom: "14px" }}>
              <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                Tên công ty / Đơn vị lữ hành *
              </span>
              <input
                required
                value={form.company_name}
                onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                placeholder="VD: Công ty Lữ hành Vietravel Đà Nẵng"
                className="admin-places__search-input"
                style={{ padding: "0 14px", height: "40px" }}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Người đại diện / Quản lý *
                </span>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  placeholder="VD: Nguyễn Văn A"
                  className="admin-places__search-input"
                  style={{ padding: "0 14px", height: "40px" }}
                />
              </label>

              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Mã số thuế doanh nghiệp
                </span>
                <input
                  value={form.tax_code}
                  onChange={(e) => setForm((f) => ({ ...f, tax_code: e.target.value }))}
                  placeholder="VD: 0101234567"
                  className="admin-places__search-input"
                  style={{ padding: "0 14px", height: "40px" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Email đăng nhập *
                </span>
                <input
                  type="email"
                  required={!form.id}
                  disabled={Boolean(form.id)}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="operator2@gmail.com"
                  className="admin-places__search-input"
                  style={{
                    padding: "0 14px",
                    height: "40px",
                    background: form.id ? "#f8fafc" : "#ffffff",
                  }}
                />
              </label>

              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  {form.id ? "Đặt lại mật khẩu (bỏ trống nếu giữ nguyên)" : "Mật khẩu khởi tạo (mặc định 123456)"}
                </span>
                <input
                  type="text"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={form.id ? "Nhập mật khẩu mới..." : "123456"}
                  className="admin-places__search-input"
                  style={{ padding: "0 14px", height: "40px" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "18px" }}>
              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Tỷ lệ hoa hồng nền tảng (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={form.commission_rate}
                  onChange={(e) => setForm((f) => ({ ...f, commission_rate: e.target.value }))}
                  className="admin-places__search-input"
                  style={{ padding: "0 14px", height: "40px" }}
                />
              </label>

              <label style={{ display: "block" }}>
                <span style={{ display: "block", fontSize: "12.5px", fontWeight: "700", color: "#334155", marginBottom: "6px" }}>
                  Trạng thái hoạt động
                </span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="admin-places__search-input"
                  style={{ padding: "0 14px", height: "40px" }}
                >
                  <option value="ACTIVE">Đang hoạt động (ACTIVE)</option>
                  <option value="SUSPENDED">Tạm ngưng (SUSPENDED)</option>
                </select>
              </label>
            </div>

            {loiForm && (
              <p style={{ margin: "0 0 14px", color: "#ef4444", fontSize: "12.5px", fontWeight: "600" }}>
                {loiForm}
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                onClick={() => setForm(null)}
                style={{
                  padding: "10px 18px",
                  background: "#f1f5f9",
                  color: "#475569",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Huỷ bỏ
              </button>
              <button
                type="submit"
                disabled={dangLuu}
                style={{
                  padding: "10px 22px",
                  background: "#0f172a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "10px",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {dangLuu ? "Đang lưu..." : form.id ? "Lưu thay đổi" : "Tạo tài khoản"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
