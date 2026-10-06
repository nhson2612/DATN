import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../shared/api";
import Toast from "../shared/common/Toast";
import TourApproval from "./tour-approval";
import "./AdminBem.css";
import "./Admin.css";

const MENU_GROUPS = [
  {
    tieuDe: "Quản lý chung",
    items: [
      { id: "tong-quan", nhan: "Tổng quan", icon: "space_dashboard", desc: "Chỉ số tổng hợp và số liệu hệ thống" },
    ],
  },
  {
    tieuDe: "Vận hành & Duyệt",
    items: [
      { id: "duyet-tour", nhan: "Duyệt tour", icon: "verified", desc: "Phê duyệt các tour du lịch do nhà điều hành gửi lên" },
      { id: "dia-diem", nhan: "Cơ sở lưu trú", icon: "domain", desc: "Quản lý danh mục khách sạn, homestay và điểm lưu trú" },
    ],
  },
  {
    tieuDe: "Đơn hàng & Giao dịch",
    items: [
      { id: "dat-tour", nhan: "Đặt tour", icon: "confirmation_number", desc: "Danh sách đơn đặt tour du lịch trên toàn hệ thống" },
      { id: "thanh-toan", nhan: "Thanh toán & Đối soát", icon: "payments", desc: "Đối soát chuyển khoản ngân hàng và xác nhận giao dịch" },
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
  const tabId = ALL_TABS.some((t) => t.id === params.get("tab"))
    ? params.get("tab")
    : "tong-quan";
  const currentTab = ALL_TABS.find((t) => t.id === tabId) || ALL_TABS[0];

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
          <div className="admin-shell__brand">
            <div className="admin-shell__brand-mark">Đ</div>
            <div className="admin-shell__div-6">
              <span className="admin-shell__brand-title">Đi Đâu</span>
              <span className="admin-shell__brand-sub">Quản trị hệ thống</span>
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
          {tabId === "tong-quan" && <TongQuan />}
          {tabId === "duyet-tour" && <TourApproval />}
          {tabId === "dia-diem" && <DiaDiem />}
          {tabId === "dat-tour" && <DatTour />}
          {tabId === "thanh-toan" && <ThanhToan locBanDau={locTuUrl} />}
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

function TongQuan() {
  const macDinh = khoangMacDinh();
  const [baoCao, setBaoCao] = useState(null);
  const [loi, setLoi] = useState("");
  const [dangTai, setDangTai] = useState(true);
  const [tuNgay, setTuNgay] = useState(macDinh.from);
  const [denNgay, setDenNgay] = useState(macDinh.to);
  const [daTuyChinh, setDaTuyChinh] = useState(false);

  useEffect(() => {
    let conHieuLuc = true;
    setDangTai(true);
    setLoi("");
    api
      .adminStats({ from: tuNgay, to: denNgay })
      .then((d) => {
        if (conHieuLuc) setBaoCao(d);
      })
      .catch((e) => {
        if (conHieuLuc) setLoi(e.message);
      })
      .finally(() => {
        if (conHieuLuc) setDangTai(false);
      });
    return () => {
      conHieuLuc = false;
    };
  }, [tuNgay, denNgay]);

  const datKhoang = (soNgay) => {
    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - soNgay + 1);
    setTuNgay(dinhDangNgayInput(from));
    setDenNgay(dinhDangNgayInput(today));
    setDaTuyChinh(false);
  };

  const homNay = dinhDangNgayInput(new Date());
  const bayNgayTruoc = new Date();
  bayNgayTruoc.setDate(bayNgayTruoc.getDate() - 6);
  const dauBayNgay = dinhDangNgayInput(bayNgayTruoc);
  const baMuoiNgayTruoc = new Date();
  baMuoiNgayTruoc.setDate(baMuoiNgayTruoc.getDate() - 29);
  const dauBaMuoiNgay = dinhDangNgayInput(baMuoiNgayTruoc);

  const tk = baoCao?.stats;
  const kyTruoc = baoCao?.comparison;
  const chiSoPhu = tk ? [
    { nhan: "Lượt đặt tour", value: tk.dat_tour, key: "dat_tour" },
    { nhan: "Số khách đã đặt", value: tk.so_khach, key: "so_khach" },
    { nhan: "Giá trị đơn trung bình", value: tk.gia_tri_don_tb, key: "gia_tri_don_tb", money: true },
  ] : [];
  const doanhThuSanh = tk ? soSanh(tk.doanh_thu, kyTruoc?.doanh_thu) : null;
  const soNgayBaoCao = Math.max(baoCao?.series?.length || 0, 1);
  const doanhThuBinhQuanNgay = tk
    ? Math.round(Number(tk.doanh_thu || 0) / soNgayBaoCao)
    : 0;
  const series = baoCao?.series || [];
  const ngayDoanhThuCao = series.reduce(
    (best, item) => Number(item.doanh_thu || 0) > Number(best?.doanh_thu || 0) ? item : best,
    null,
  );
  const ngayDatNhieu = series.reduce(
    (best, item) => Number(item.dat_tour || 0) > Number(best?.dat_tour || 0) ? item : best,
    null,
  );
  const khachMoiDon = Number(tk?.dat_tour || 0)
    ? Number(tk.so_khach || 0) / Number(tk.dat_tour)
    : 0;

  return (
    <section className="admin-overview">
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}

      {dangTai && !tk ? (
        <div className="admin-overview__skeleton" aria-label="Đang tải báo cáo" />
      ) : tk ? (
        <>
          <div className="admin-overview__kpi-grid" aria-busy={dangTai}>
            <article className="admin-overview__kpi-card admin-overview__kpi-card--lead">
              <div className="admin-overview__lead-header">
                <p className="admin-overview__eyebrow">Doanh thu đã xác nhận</p>
                <div className="admin-overview__toolbar">
                  <div className="admin-overview__presets" aria-label="Khoảng thống kê nhanh">
                    <button
                      type="button"
                      className={`admin-overview__preset ${!daTuyChinh && tuNgay === homNay && denNgay === homNay ? "admin-overview__preset--active" : ""}`}
                      onClick={() => datKhoang(1)}
                    >
                      1d
                    </button>
                    <button
                      type="button"
                      className={`admin-overview__preset ${!daTuyChinh && tuNgay === dauBayNgay && denNgay === homNay ? "admin-overview__preset--active" : ""}`}
                      onClick={() => datKhoang(7)}
                    >
                      7d
                    </button>
                    <button
                      type="button"
                      className={`admin-overview__preset ${!daTuyChinh && tuNgay === dauBaMuoiNgay && denNgay === homNay ? "admin-overview__preset--active" : ""}`}
                      onClick={() => datKhoang(30)}
                    >
                      30d
                    </button>
                  </div>
                  <BoChonKhoangNgay
                    tuNgay={tuNgay}
                    denNgay={denNgay}
                    homNay={homNay}
                    hienGiaTri={daTuyChinh}
                    onChange={(from, to) => {
                      setTuNgay(from);
                      setDenNgay(to);
                      setDaTuyChinh(true);
                    }}
                  />
                </div>
              </div>
              <div className="admin-overview__lead-content">
                <div>
                  <p className="admin-overview__lead-value">
                    {so(tk.doanh_thu)}<span>đ</span>
                  </p>
                  <p className={`admin-overview__comparison admin-overview__comparison--${doanhThuSanh.tone}`}>
                    {doanhThuSanh.text}
                  </p>
                </div>
                <ChiBaoXuHuong tone={doanhThuSanh.tone} />
              </div>
              <div className="admin-overview__lead-breakdown">
                <div>
                  <span>Kỳ trước</span>
                  <strong>{so(kyTruoc?.doanh_thu)} đ</strong>
                </div>
                <div>
                  <span>Bình quân / ngày</span>
                  <strong>{so(doanhThuBinhQuanNgay)} đ</strong>
                </div>
              </div>
            </article>

            <div className="admin-overview__secondary-kpis">
              {chiSoPhu.map((item) => {
                const comparison = soSanh(item.value, kyTruoc?.[item.key]);
                return (
                  <article className="admin-overview__kpi-card admin-overview__kpi-card--secondary" key={item.key}>
                    <div>
                      <p className="admin-overview__kpi-label">{item.nhan}</p>
                      <p className="admin-overview__kpi-value">
                        {so(item.value)}{item.money ? <span>đ</span> : null}
                      </p>
                    </div>
                    <p className={`admin-overview__comparison admin-overview__comparison--${comparison.tone}`}>
                      {comparison.text}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="admin-overview__details-grid">
            <article className="admin-overview__detail-card admin-overview__detail-card--chart">
              <div className="admin-overview__detail-heading">
                <div>
                  <p className="admin-overview__detail-eyebrow">Diễn biến theo kỳ</p>
                  <h2>Doanh thu theo ngày</h2>
                </div>
                <span>{nhanNgay(baoCao.range.from)} — {nhanNgay(baoCao.range.to)}</span>
              </div>
              <BieuDoDoanhThu series={series} />
            </article>

            <article className="admin-overview__detail-card admin-overview__detail-card--summary">
              <div className="admin-overview__detail-heading">
                <div>
                  <p className="admin-overview__detail-eyebrow">Thông tin bổ sung</p>
                  <h2>Điểm đáng chú ý</h2>
                </div>
              </div>
              <dl className="admin-overview__summary-list">
                <div>
                  <dt>Ngày doanh thu cao nhất</dt>
                  <dd>
                    <strong>{Number(ngayDoanhThuCao?.doanh_thu || 0) ? `${so(ngayDoanhThuCao.doanh_thu)} đ` : "—"}</strong>
                    <span>{Number(ngayDoanhThuCao?.doanh_thu || 0) ? nhanNgayDayDu(ngayDoanhThuCao.ngay) : "Chưa phát sinh doanh thu"}</span>
                  </dd>
                </div>
                <div>
                  <dt>Ngày có nhiều lượt đặt nhất</dt>
                  <dd>
                    <strong>{Number(ngayDatNhieu?.dat_tour || 0) ? `${so(ngayDatNhieu.dat_tour)} lượt` : "—"}</strong>
                    <span>{Number(ngayDatNhieu?.dat_tour || 0) ? nhanNgayDayDu(ngayDatNhieu.ngay) : "Chưa phát sinh lượt đặt"}</span>
                  </dd>
                </div>
                <div>
                  <dt>Số khách trung bình / đơn</dt>
                  <dd>
                    <strong>{khachMoiDon ? khachMoiDon.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) : "—"}</strong>
                    <span>Tính trên các đơn trong kỳ</span>
                  </dd>
                </div>
              </dl>
            </article>
          </div>

        </>
      ) : null}
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
          className="admin-places__create"
        >
          <span className="material-symbols-outlined admin-shell__span-33">add</span>
          <span>Thêm cơ sở lưu trú</span>
        </button>
      </div>

      {/* Table */}
      <div className="admin-data-card admin-places__results">
        <div className="admin-data-card__scroll">
          <table className="admin-data-table admin-shell__table-36">
            <thead>
              <tr className="admin-shell__tr-37">
                <th className="admin-shell__th-38">Tên cơ sở</th>
                <th className="admin-shell__th-39">Loại hình</th>
                <th className="admin-shell__th-40">Toạ độ</th>
                <th className="admin-shell__th-41">Thao tác</th>
              </tr>
            </thead>
            <tbody className="admin-shell__table-body">
              {dangTai &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td className="admin-shell__td-42" colSpan={4}>
                      <div className="admin-shell__div-43 admin-shell__div-7" />
                    </td>
                  </tr>
                ))}

              {!dangTai && ds === null && (
                <tr>
                  <td colSpan={4} className="admin-shell__td-44">
                    <span className="material-symbols-outlined admin-shell__span-45">
                      manage_search
                    </span>
                    Nhập ít nhất {TOI_THIEU_KY_TU} ký tự vào ô tìm kiếm để tra cứu địa điểm cần chỉnh sửa.
                  </td>
                </tr>
              )}

              {!dangTai && ds?.length === 0 && (
                <tr>
                  <td colSpan={4} className="admin-shell__td-46">
                    Không tìm thấy cơ sở lưu trú nào khớp với từ khóa “{tuKhoa}”.
                  </td>
                </tr>
              )}

              {!dangTai &&
                (ds || []).map((it) => (
                  <tr key={`${it.type}-${it.id}`} className="admin-shell__tr-47">
                    <td className="admin-shell__td-48">
                      <Link
                        to={`/dia-diem/${it.type}/${it.id}`}
                        className="admin-shell__link-49"
                      >
                        {it.name}
                      </Link>
                      {it.address && (
                        <p className="admin-shell__text-50">
                          {it.address}
                        </p>
                      )}
                    </td>
                    <td className="admin-shell__td-51">
                      <span className="admin-shell__span-52 admin-shell__span-8">
                        {nhanLoai(it.category)}
                      </span>
                    </td>
                    <td className="admin-shell__td-53">
                      {it.lon?.toFixed(4)}, {it.lat?.toFixed(4)}
                    </td>
                    <td className="admin-shell__td-54">
                      <div className="admin-shell__div-55">
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
                          className="admin-shell__element-56"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => xoa(it)}
                          className="admin-shell__button-57"
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

function FormDiaDiem({ form, setForm, onXong }) {
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");

  function dat(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function luu(e) {
    e.preventDefault();
    setDangLuu(true);
    setLoi("");
    const body = {
      name: form.name.trim(),
      lon: Number(form.lon),
      lat: Number(form.lat),
      tourism: form.tourism || null,
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
        className="admin-modal__card admin-shell__form-63"
      >
        <div className="admin-shell__div-64">
          <h2 className="admin-shell__text-65">
            {form.id ? "Chỉnh sửa cơ sở lưu trú" : "Thêm mới cơ sở lưu trú"}
          </h2>
          <button
            type="button"
            className="admin-shell__button-66"
            onClick={() => setForm(null)}
          >
            <span className="material-symbols-outlined admin-shell__span-67">close</span>
          </button>
        </div>

        <label className="admin-shell__label-68">
          <span className="admin-shell__icon-69">Tên cơ sở *</span>
          <input
            required
            value={form.name}
            onChange={(e) => dat("name", e.target.value)}
            className="admin-shell__input-70 admin-shell__input-11"
          />
        </label>

        <div className="admin-shell__div-71">
          <label className="admin-shell__label-72">
            <span className="admin-shell__span-73">Kinh độ (Longitude) *</span>
            <input
              required
              type="number"
              step="any"
              value={form.lon}
              onChange={(e) => dat("lon", e.target.value)}
              className="admin-shell__element-74 admin-shell__element-12"
            />
          </label>
          <label className="admin-shell__label-75">
            <span className="admin-shell__span-76">Vĩ độ (Latitude) *</span>
            <input
              required
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => dat("lat", e.target.value)}
              className="admin-shell__element-77 admin-shell__element-13"
            />
          </label>
        </div>

        <label className="admin-shell__label-78">
          <span className="admin-shell__span-79">Loại hình lưu trú</span>
          <input
            value={form.tourism}
            onChange={(e) => dat("tourism", e.target.value)}
            placeholder="hotel, guest_house, hostel, resort, homestay…"
            className="admin-shell__element-80 admin-shell__element-14"
          />
        </label>

        <div className="admin-shell__div-81">
          <label className="admin-shell__label-82">
            <span className="admin-shell__span-83">Hạng sao (0 - 5)</span>
            <input
              type="number"
              min={0}
              max={5}
              value={form.stars}
              onChange={(e) => dat("stars", e.target.value)}
              className="admin-shell__element-84 admin-shell__element-15"
            />
          </label>
          <label className="admin-shell__label-85">
            <span className="admin-shell__span-86">Mức giá</span>
            <select
              value={form.price_range}
              onChange={(e) => dat("price_range", e.target.value)}
              className="admin-shell__select-87 admin-shell__select-16"
            >
              <option value="">Không rõ</option>
              <option value="Rẻ">Bình dân / Tiết kiệm</option>
              <option value="Trung bình">Trung bình</option>
              <option value="Sang trọng">Cao cấp / Sang trọng</option>
            </select>
          </label>
        </div>

        <label className="admin-shell__label-88">
          <span className="admin-shell__span-89">Địa chỉ cụ thể</span>
          <input
            value={form.address}
            onChange={(e) => dat("address", e.target.value)}
            className="admin-shell__input-90 admin-shell__input-17"
          />
        </label>

        {loi && <p className="admin-shell__text-91">{loi}</p>}

        <div className="admin-shell__div-92">
          <button
            type="button"
            onClick={() => setForm(null)}
            className="admin-shell__button-93 admin-shell__button-18"
          >
            Huỷ bỏ
          </button>
          <button
            type="submit"
            disabled={dangLuu}
            className="admin-shell__button-94"
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
      setTin(kq.message || `Đã xác nhận thanh toán đơn ${p.booking_code}.`);
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

      {/* Filter Tabs Pills */}
      <div className="admin-filter-tabs" role="group" aria-label="Lọc trạng thái giao dịch">
        {LOC_THANH_TOAN.map(([v, nhan]) => (
          <button
            key={v}
            type="button"
            onClick={() => setLoc(v)}
            className={`admin-filter-tabs__item ${
              loc === v
                ? "admin-filter-tabs__item--active"
                : ""
            }`}
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
            <table className="admin-data-table admin-shell__table-109">
              <thead>
                <tr className="admin-shell__tr-110">
                  <th className="admin-shell__th-111">Mã giao dịch</th>
                  <th className="admin-shell__th-112">Mã đơn</th>
                  <th className="admin-shell__th-113">Tour</th>
                  <th className="admin-shell__th-114">Số tiền</th>
                  <th className="admin-shell__th-115">Trạng thái</th>
                  <th className="admin-shell__th-116">Thao tác</th>
                </tr>
              </thead>
              <tbody className="admin-shell__table-body">
                {ds.map((p) => {
                  let statusTone = "neutral";
                  if (p.status === "SUCCESS") {
                    statusTone = "success";
                  } else if (p.status === "PENDING") {
                    statusTone = "info";
                  } else if (p.status === "MISMATCH" || p.status === "FAILED") {
                    statusTone = "danger";
                  }

                  return (
                    <tr key={p.id} className="admin-shell__tr-117" title={p.note || undefined}>
                      <td className="admin-shell__td-118">
                        {p.txn_ref}
                        <span className="admin-shell__span-119">
                          {NHAN_CACH_TRA[p.method] || p.method}
                          {ngay(p.created_at) ? ` · ${ngay(p.created_at)}` : ""}
                        </span>
                      </td>
                      <td className="admin-shell__td-120">
                        {p.booking_code}
                      </td>
                      <td className="admin-shell__td-121">
                        {p.tour_name}
                      </td>
                      <td className="admin-shell__td-122">
                        {so(p.amount)} đ
                      </td>
                      <td className="admin-shell__td-123">
                        <span
                          className={`admin-shell__span-124 admin-shell__payment-status admin-shell__payment-status--${statusTone}`}
                        >
                          <span className={`admin-shell__span-125 admin-shell__payment-dot--${statusTone}`}></span>
                          <span>{NHAN_THANH_TOAN[p.status] || p.status}</span>
                        </span>
                        {p.confirmed_by_name && (
                          <span className="admin-shell__span-126">
                            Bởi {p.confirmed_by_name}
                          </span>
                        )}
                      </td>
                      <td className="admin-shell__td-127">
                        {bamDuoc(p.status) ? (
                          <button
                            type="button"
                            onClick={() => xacNhan(p)}
                            disabled={dangChay === p.id}
                            className="admin-shell__element-128"
                          >
                            <span className="material-symbols-outlined admin-shell__span-129">verified</span>
                            <span>{dangChay === p.id ? "Đang xử lý..." : "Xác nhận nhận tiền"}</span>
                          </button>
                        ) : (
                          <span className="admin-shell__span-130">Đã chốt</span>
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

function toneDatTour(status) {
  if (["PAID", "CONFIRMED", "COMPLETED"].includes(status)) return "success";
  if (["PENDING_PAYMENT", "PARTIALLY_PAID"].includes(status)) return "info";
  if (["EXPIRED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_OPERATOR", "NO_SHOW"].includes(status)) return "danger";
  return "neutral";
}

function DatTour() {
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    api
      .adminTourBookings()
      .then((d) => setDs(d.bookings || []))
      .catch((e) => {
        setLoi(e.message);
        setDs([]);
      });
  }, []);

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

  if (!ds.length) {
    return (
      <div className="admin-shell__div-133 admin-shell__div-25">
        <div className="admin-shell__div-134">
          <span className="material-symbols-outlined admin-shell__span-135">confirmation_number</span>
        </div>
        <h3 className="admin-shell__text-136">Chưa có lượt đặt tour nào</h3>
        <p className="admin-shell__text-137">Khi khách hoàn tất đặt chỗ tour, đơn hàng sẽ hiển thị ở đây.</p>
      </div>
    );
  }

  return (
    <div className="admin-data-card admin-bookings">
      <div className="admin-data-card__scroll">
        <table className="admin-data-table admin-shell__table-140">
          <thead>
            <tr className="admin-shell__tr-141">
              <th>Mã đơn</th>
              <th className="admin-shell__th-142">Khách hàng</th>
              <th className="admin-shell__th-143">Tour du lịch</th>
              <th className="admin-shell__th-144">Khởi hành</th>
              <th className="admin-bookings__money-heading">Tổng tiền</th>
              <th className="admin-shell__th-145">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="admin-shell__table-body">
            {ds.map((b) => (
              <tr key={b.id} className="admin-shell__tr-146">
                <td className="admin-bookings__code">
                  {b.code || `#${b.id}`}
                  <span>{ngay(b.created_at)}</span>
                </td>
                <td className="admin-shell__td-147">
                  <span className="admin-shell__span-148">{b.full_name}</span>
                  <span className="admin-shell__span-149">{b.phone} · {b.guests} khách</span>
                </td>
                <td className="admin-shell__td-150">
                  {b.tour_name || `#${b.tour_id}`}
                </td>
                <td className="admin-shell__td-151">
                  <span className="admin-shell__span-152">
                    <span className="material-symbols-outlined admin-shell__span-153">calendar_month</span>
                    <span>{b.depart_date || "—"}</span>
                  </span>
                </td>
                <td className="admin-bookings__money">
                  {so(b.total_price)} đ
                </td>
                <td className="admin-shell__td-154">
                  <span className={`admin-shell__span-124 admin-shell__payment-status admin-shell__payment-status--${toneDatTour(b.status)}`}>
                    <span className={`admin-shell__span-125 admin-shell__payment-dot--${toneDatTour(b.status)}`} />
                    {NHAN_DAT_TOUR[b.status] || b.status || "Chưa xác định"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
