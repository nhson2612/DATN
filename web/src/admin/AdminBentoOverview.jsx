import { useState, useMemo } from "react";
import "../shared/bento/BentoDashboard.css";

const dinhDangTien = (val) => {
  return Number(val || 0).toLocaleString("vi-VN");
};

const dinhDangNgay = (dStr) => {
  if (!dStr) return "";
  const parts = dStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
  return dStr;
};

/* MINH HOẠ NHÂN VẬT THIẾT KẾ PHẲNG KÈM DẤU HỎI ? (CHUẨN THEO ẢNH MẪU DRIBBBLE) */
function EmptyStateIllustration({ size = 96 }) {
  return (
    <svg
      width={size * 1.4}
      height={size}
      viewBox="0 0 160 110"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      {/* Vòng tròn nền pastel mềm mại */}
      <circle cx="80" cy="52" r="44" fill="#f1f5f9" />

      {/* Bóng đổ nhẹ dưới chân */}
      <ellipse cx="80" cy="98" rx="38" ry="4" fill="#e2e8f0" />

      {/* Đám mây suy nghĩ chứa dấu hỏi ? */}
      <g transform="translate(18, -6)">
        <ellipse cx="92" cy="22" rx="15" ry="12" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
        <circle cx="79" cy="33" r="2.5" fill="#cbd5e1" />
        <circle cx="75" cy="38" r="1.5" fill="#cbd5e1" />
        <text
          x="92"
          y="28"
          textAnchor="middle"
          fontSize="15"
          fontWeight="900"
          fill="#0284c7"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          ?
        </text>
      </g>

      {/* Nhân vật đồ hoạ phẳng đứng ngẫm nghĩ */}
      {/* Tóc & Đầu */}
      <circle cx="76" cy="34" r="11" fill="#1e293b" />
      <path d="M70 35 C70 29 75 25 81 25 C85 25 88 28 88 32 C85 33 81 37 78 42 Z" fill="#0f172a" />
      
      {/* Khuôn mặt */}
      <circle cx="79" cy="36" r="7.5" fill="#fde68a" />
      <circle cx="82" cy="35" r="1.2" fill="#1e293b" />

      {/* Cánh tay đưa lên cằm ngẫm nghĩ */}
      <path d="M73 56 C70 50 74 42 80 41" stroke="#f59e0b" strokeWidth="3.2" strokeLinecap="round" />

      {/* Thân áo hoodie / áo khoác màu vàng mù tạt ấm */}
      <path
        d="M69 45 C72 42 83 42 86 45 L89 70 C89 72 87 73 85 73 L69 73 C67 73 66 72 66 70 Z"
        fill="#f59e0b"
      />

      {/* Quần âu tối màu */}
      <path
        d="M69 73 L71 96 L76 96 L77 78 L79 78 L80 96 L85 96 L87 73 Z"
        fill="#1e293b"
      />

      {/* Giày */}
      <ellipse cx="73" cy="97" rx="4" ry="2" fill="#0f172a" />
      <ellipse cx="83" cy="97" rx="4" ry="2" fill="#0f172a" />

      {/* Các hạt trang trí xung quanh */}
      <circle cx="42" cy="36" r="2" fill="#94a3b8" opacity="0.6" />
      <circle cx="122" cy="46" r="2.5" fill="#94a3b8" opacity="0.6" />
      <path d="M38 58 L41 55 L44 58 L41 61 Z" fill="#cbd5e1" />
    </svg>
  );
}

export default function AdminBentoOverview({
  baoCao,
  bookings = [],
  pendingPayments = [],
  pendingTours = [],
  dangTai = false,
  khoangChon = "30_days",
  onChangeKhoang,
  onNavigateTab,
  onApproveTour,
}) {
  const [chartMode, setChartMode] = useState("line");
  const [filterStatus, setFilterStatus] = useState("pending");

  const tk = baoCao?.stats;
  const kyTruoc = baoCao?.comparison;
  const series = baoCao?.series || [];

  // 1. Tỷ lệ tăng trưởng doanh thu so với kỳ trước (tính từ số liệu thực)
  const growth = useMemo(() => {
    const curr = Number(tk?.doanh_thu || 0);
    const prev = Number(kyTruoc?.doanh_thu || 0);
    if (prev === 0) {
      if (curr === 0) return { text: "Không đổi so với kỳ trước", isPositive: false };
      return { text: "Phát sinh mới trong kỳ ↑", isPositive: true };
    }
    const diff = curr - prev;
    const pct = ((diff / prev) * 100).toFixed(1);
    const isPositive = diff >= 0;
    return {
      text: `${isPositive ? `+${pct}%` : `${pct}%`} so với kỳ trước ${isPositive ? "↑" : "↓"}`,
      isPositive,
    };
  }, [tk, kyTruoc]);

  // 2. Doanh thu hôm nay (lấy đúng ngày hiện tại trong chuỗi series thực tế)
  const todayRevenue = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayItem = series.find((s) => s.ngay === todayStr);
    return Number(todayItem?.doanh_thu || 0);
  }, [series]);

  // 3. Đơn đặt tour mới nhất (lấy dữ liệu thực từ bảng tour_bookings)
  const recentBookings = useMemo(() => {
    return (bookings || []).slice(0, 3);
  }, [bookings]);

  const recentBookingsTotal = useMemo(() => {
    return recentBookings.reduce((sum, b) => sum + Number(b.total_price || 0), 0);
  }, [recentBookings]);

  const totalGuests = useMemo(() => {
    return (bookings || []).reduce((sum, b) => sum + Number(b.guests || 1), 0);
  }, [bookings]);

  // 4. Số dư chờ đối soát thực tế từ các giao dịch PENDING
  const totalPendingAmount = useMemo(() => {
    return (pendingPayments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [pendingPayments]);

  // 5. Biểu đồ đường (Line Chart) vẽ SVG toạ độ động từ series thực tế
  const lineChartData = useMemo(() => {
    if (!series || series.length === 0) return null;
    const W = 600;
    const H = 140;
    const padBottom = 16;
    const padTop = 20;
    const usableH = H - padBottom - padTop;
    const revenues = series.map((s) => Number(s.doanh_thu || 0));
    const maxVal = Math.max(...revenues, 0);

    const n = series.length;
    const points = series.map((s, idx) => {
      const x = n > 1 ? (idx / (n - 1)) * W : W / 2;
      const y = maxVal > 0 ? (H - padBottom) - (Number(s.doanh_thu || 0) / maxVal) * usableH : H - padBottom;
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        val: Number(s.doanh_thu || 0),
        ngay: s.ngay,
      };
    });

    const pathD = points.reduce((acc, p, i) => (i === 0 ? `M${p.x},${p.y}` : `${acc} L${p.x},${p.y}`), "");
    const areaD = `${pathD} L${W},${H - 2} L0,${H - 2} Z`;

    // Lấy 5 mốc ngày phân bố đều
    const step = Math.max(1, Math.floor((n - 1) / 4));
    const dateLabels = [];
    for (let i = 0; i < n; i += step) {
      dateLabels.push(series[i].ngay);
    }
    if (dateLabels.length > 0 && dateLabels[dateLabels.length - 1] !== series[n - 1].ngay) {
      dateLabels[dateLabels.length - 1] = series[n - 1].ngay;
    }

    const peak = points.reduce((best, p) => (p.val > (best?.val || 0) ? p : best), null);
    const last = points[points.length - 1];

    return { points, pathD, areaD, dateLabels, peak, last, maxVal };
  }, [series]);

  // 6. Biểu đồ cột (Bar Chart) vẽ 7 ngày gần nhất từ dữ liệu thực tế
  const barChartData = useMemo(() => {
    if (!series || series.length === 0) return [];
    const slice = series.slice(-7);
    const maxVal = Math.max(...slice.map((s) => Number(s.doanh_thu || 0)), 0);
    const daysOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

    return slice.map((s) => {
      const d = new Date(s.ngay);
      const dayName = isNaN(d.getTime()) ? s.ngay : daysOfWeek[d.getDay()];
      const val = Number(s.doanh_thu || 0);
      const heightPct = maxVal > 0 && val > 0 ? Math.max(12, Math.round((val / maxVal) * 92)) : 6;
      let labelVal = "0";
      if (val >= 1000000) labelVal = `${(val / 1000000).toFixed(1)}M`;
      else if (val >= 1000) labelVal = `${(val / 1000).toFixed(0)}k`;
      else if (val > 0) labelVal = `${val}`;

      return {
        ngay: s.ngay,
        dayName,
        val,
        labelVal,
        heightPct,
        isPeak: val === maxVal && val > 0,
      };
    });
  }, [series]);

  // 7. Lọc danh sách tour chờ duyệt thực tế
  const filteredTours = useMemo(() => {
    if (filterStatus === "all") return pendingTours;
    if (filterStatus === "pending") {
      return (pendingTours || []).filter((t) => t.status === "PENDING_APPROVAL" || !t.status);
    }
    return (pendingTours || []).filter((t) => t.status === "ACTIVE" || t.status === "APPROVED");
  }, [pendingTours, filterStatus]);

  const pendingCount = (pendingTours || []).filter((t) => t.status === "PENDING_APPROVAL" || !t.status).length;
  const approvedCount = (pendingTours || []).filter((t) => t.status === "ACTIVE" || t.status === "APPROVED").length;

  return (
    <div className="bento-wrapper">
      {/* HÀNG TRÊN: 3 KHỐI BENTO */}
      <div className="bento-row">
        
        {/* CARD 1 (3 CỘT): ĐƠN ĐẶT TOUR MỚI THỰC TẾ */}
        <div className="bento-card card-sky-pastel" style={{ gridColumn: "span 3", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div
                className="cta-link-arrow"
                style={{ color: "#0c4a6e" }}
                onClick={() => onNavigateTab?.("bookings")}
                title="Xem danh sách đơn đặt tour"
              >
                <span>Đơn đặt tour mới</span>
                <span className="arrow-symbol"></span>
              </div>
              <span style={{ fontSize: "12px", fontWeight: "700", opacity: 0.9, color: "#0c4a6e" }}>
                {bookings.length} đơn
              </span>
            </div>

            <div style={{ fontSize: "28px", fontWeight: "800", fontFamily: "var(--bento-font-mono)", margin: "6px 0 0" }}>
              {dinhDangTien(recentBookingsTotal)} đ
            </div>
          </div>

          {/* DANH SÁCH ĐƠN HÀNG THỰC TẾ TỪ HỆ THỐNG */}
          <div className="order-flat-list">
            {recentBookings.length === 0 ? (
              <div style={{ padding: "26px 14px", textAlign: "center", color: "#0c4a6e" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "30px", opacity: 0.6, marginBottom: "4px", display: "block" }}>
                  receipt_long
                </span>
                <div style={{ fontSize: "12.5px", fontWeight: "700" }}>Chưa có đơn đặt tour mới</div>
                <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
                  Các đơn đặt tour của khách sẽ hiển thị thời gian thực tại đây
                </div>
              </div>
            ) : (
              recentBookings.map((b) => (
                <div key={b.id} className="order-flat-row">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontFamily: "var(--bento-font-mono)", fontSize: "12px", fontWeight: "800", color: "#0c4a6e" }}>
                      {b.code || `#BK-${b.id}`}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: "600", opacity: 0.85 }}>
                      {b.created_at ? new Date(b.created_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "3px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "#075985", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {b.full_name || b.contact_name || b.email || "Khách du lịch"} ({b.guests || 1} khách)
                    </span>
                    <span style={{ fontFamily: "var(--bento-font-mono)", fontSize: "13px", fontWeight: "800", color: "#082f49" }}>
                      {dinhDangTien(b.total_price)} đ
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ paddingTop: "10px", borderTop: "1px solid rgba(255, 255, 255, 0.45)", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", fontWeight: "700", color: "#0c4a6e" }}>
            <span>Tổng cộng: {totalGuests} khách giữ chỗ</span>
            <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => onNavigateTab?.("bookings")}>
              Xem tất cả ➔
            </span>
          </div>
        </div>

        {/* CARD 2 (6 CỘT): DOANH THU TOÀN SÀN THỰC TẾ */}
        <div className="bento-card" style={{ gridColumn: "span 6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div
                className="bento-header-link"
                onClick={() => onNavigateTab?.("payments")}
                title="Xem chi tiết thanh toán & đối soát"
              >
                <span>Doanh thu toàn sàn</span>
                <span className="arrow-symbol"></span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                {khoangChon === "30_days"
                  ? "30 ngày gần đây"
                  : khoangChon === "this_month"
                  ? "Tháng hiện tại"
                  : khoangChon === "last_month"
                  ? "Tháng trước"
                  : "Cả năm"}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
              <select
                value={khoangChon}
                onChange={(e) => onChangeKhoang?.(e.target.value)}
                style={{
                  fontSize: "12px",
                  fontWeight: "700",
                  color: "var(--bento-text-dark)",
                  background: "#f1f5f9",
                  padding: "6px 26px 6px 12px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  cursor: "pointer",
                  outline: "none",
                  appearance: "none",
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23475569'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 8px center",
                  backgroundSize: "13px",
                }}
              >
                <option value="30_days">30 ngày gần đây</option>
                <option value="this_month">Tháng 10/2026 (Hiện tại)</option>
                <option value="last_month">Tháng 09/2026 (Có doanh thu)</option>
                <option value="this_year">Cả năm 2026</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginTop: "10px" }}>
            <div style={{ fontSize: "38px", fontWeight: "800", color: "var(--bento-text-dark)", fontFamily: "var(--bento-font-mono)", letterSpacing: "-0.02em" }}>
              {dinhDangTien(tk?.doanh_thu)}{" "}
              <span style={{ fontSize: "18px", fontWeight: "700", color: "var(--bento-text-muted)" }}>VNĐ</span>
            </div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: "700",
                color: growth.isPositive ? "#16a34a" : "#64748b",
                background: growth.isPositive ? "#dcfce7" : "#f1f5f9",
                padding: "4px 10px",
                borderRadius: "20px",
              }}
            >
              {growth.text}
            </div>
          </div>

          <div className="chart-micro-tabs">
            <button
              className={`micro-tab-btn ${chartMode === "line" ? "active" : ""}`}
              onClick={() => setChartMode("line")}
            >
              Xu hướng ({series.length} ngày)
            </button>
            <button
              className={`micro-tab-btn ${chartMode === "week" ? "active" : ""}`}
              onClick={() => setChartMode("week")}
            >
              Theo tuần
            </button>
          </div>

          {/* KHUNG CỐ ĐỊNH 170PX CHO BIỂU ĐỒ */}
          <div className="chart-fixed-viewport">
            {chartMode === "line" ? (
              <div className="chart-view-pane">
                {lineChartData && lineChartData.maxVal > 0 ? (
                  <>
                    <div style={{ width: "100%", height: "135px", position: "relative" }}>
                      <svg viewBox="0 0 600 140" style={{ width: "100%", height: "100%", overflow: "visible" }} preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="salesGradBento" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.45" />
                            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>
                        <line x1="0" y1="138" x2="600" y2="138" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="0" y1="80" x2="600" y2="80" stroke="#f8fafc" strokeWidth="1" strokeDasharray="4 4" />
                        <line x1="0" y1="20" x2="600" y2="20" stroke="#f8fafc" strokeWidth="1" strokeDasharray="4 4" />
                        
                        <path d={lineChartData.areaD} fill="url(#salesGradBento)" />
                        <path
                          d={lineChartData.pathD}
                          fill="none"
                          stroke="#0284c7"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                        {lineChartData.peak && lineChartData.peak.val > 0 && (
                          <circle
                            cx={lineChartData.peak.x}
                            cy={lineChartData.peak.y}
                            r="5"
                            fill="#ccff00"
                            stroke="#0f172a"
                            strokeWidth="2.5"
                          />
                        )}
                        {lineChartData.last && (
                          <circle
                            cx={lineChartData.last.x}
                            cy={lineChartData.last.y}
                            r="4"
                            fill="#0284c7"
                            stroke="#ffffff"
                            strokeWidth="2"
                          />
                        )}
                      </svg>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--bento-text-muted)", fontWeight: "600", fontFamily: "var(--bento-font-mono)", padding: "0 4px" }}>
                      {lineChartData.dateLabels.map((d, idx) => (
                        <span key={d + idx}>{dinhDangNgay(d)}</span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="bento-clean-empty-state">
                    <EmptyStateIllustration size={88} />
                    <div className="bento-clean-empty-title">
                      Chưa có dữ liệu doanh thu
                    </div>
                    <div className="bento-clean-empty-desc">
                      Biểu đồ xu hướng sẽ tự động hiển thị khi phát sinh giao dịch mới trong kỳ này.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="chart-view-pane">
                {barChartData.length > 0 && barChartData.some((b) => b.val > 0) ? (
                  <>
                    <div className="bar-chart-stage">
                      {barChartData.map((item, idx) => (
                        <div key={item.ngay + idx} className="bar-column-item">
                          <span className="bar-val-bubble" style={item.isPeak ? { color: "#b45309", fontWeight: "900" } : {}}>
                            {item.labelVal}
                          </span>
                          <div
                            className="bar-pillar"
                            style={{
                              height: `${item.heightPct}%`,
                              background: item.isPeak
                                ? "#fde047"
                                : idx % 2 === 0
                                ? "#6ee7b7"
                                : "#7dd3fc",
                            }}
                            title={`${item.dayName} (${dinhDangNgay(item.ngay)}): ${dinhDangTien(item.val)} đ`}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="bar-bottom-labels">
                      {barChartData.map((item, idx) => (
                        <span
                          key={item.ngay + idx}
                          className="bar-label-item"
                          style={item.isPeak ? { color: "var(--bento-text-dark)", fontWeight: "800" } : {}}
                        >
                          {item.dayName} {item.isPeak ? "★" : ""}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="bento-clean-empty-state">
                    <EmptyStateIllustration size={88} />
                    <div className="bento-clean-empty-title">
                      Chưa có dữ liệu theo tuần
                    </div>
                    <div className="bento-clean-empty-desc">
                      Biểu đồ phân tích theo tuần sẽ tự động hiển thị khi phát sinh giao dịch mới.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CARD 3 (3 CỘT): METRIC STACK THỰC TẾ TỪ HỆ THỐNG */}
        <div className="bento-card" style={{ gridColumn: "span 3", justifyContent: "space-between", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--bento-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Doanh thu hôm nay
            </div>
            <div style={{ fontSize: "28px", fontWeight: "900", color: todayRevenue > 0 ? "#16a34a" : "var(--bento-text-dark)", fontFamily: "var(--bento-font-mono)", margin: "4px 0 0" }}>
              {dinhDangTien(todayRevenue)} đ
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--bento-text-muted)", textTransform: "uppercase" }}>
              Đơn đặt tour trong kỳ
            </div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--bento-text-dark)", fontFamily: "var(--bento-font-mono)", marginTop: "2px" }}>
              {Number(tk?.dat_tour || 0)} đơn
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--bento-text-muted)", textTransform: "uppercase" }}>
              Số khách tham gia tour
            </div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--bento-text-dark)", fontFamily: "var(--bento-font-mono)", marginTop: "2px" }}>
              {Number(tk?.so_khach || 0)} du khách
            </div>
          </div>

          <div style={{ cursor: "pointer" }} onClick={() => onNavigateTab?.("payments")} title="Nhấn để đối soát ngay">
            <div className="cta-link-arrow">
              <span>Số dư chờ đối soát VietQR</span>
              <span className="arrow-symbol"></span>
            </div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "#0284c7", fontFamily: "var(--bento-font-mono)", marginTop: "2px" }}>
              {dinhDangTien(totalPendingAmount)} đ
            </div>
          </div>
        </div>

      </div>

      {/* HÀNG DƯỚI: BẢNG PHÊ DUYỆT TOUR THỰC TẾ (CHIẾM TRỌN 12 CỘT) */}
      <div className="bento-row">
        
        <div className="bento-card" style={{ gridColumn: "span 12" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <div
                className="bento-header-link"
                onClick={() => onNavigateTab?.("tour-approval")}
                title="Mở toàn bộ danh sách phê duyệt tour"
              >
                <span>Phê duyệt tour nộp mới</span>
                <span className="arrow-symbol"></span>
              </div>
              <div style={{ fontSize: "12px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                Hồ sơ tour từ các đối tác lữ hành cần thẩm định lịch trình và mở bán
              </div>
            </div>

            <div className="role-toggle-group" style={{ padding: "2px" }}>
              <button
                type="button"
                className={`role-tab ${filterStatus === "pending" ? "active" : ""}`}
                style={{ padding: "5px 14px", fontSize: "12px", fontWeight: "700" }}
                onClick={() => setFilterStatus("pending")}
              >
                Chờ duyệt ({pendingCount})
              </button>
              <button
                type="button"
                className={`role-tab ${filterStatus === "approved" ? "active" : ""}`}
                style={{ padding: "5px 14px", fontSize: "12px", fontWeight: "700" }}
                onClick={() => setFilterStatus("approved")}
              >
                Đã duyệt ({approvedCount})
              </button>
              <button
                type="button"
                className={`role-tab ${filterStatus === "all" ? "active" : ""}`}
                style={{ padding: "5px 14px", fontSize: "12px", fontWeight: "700" }}
                onClick={() => setFilterStatus("all")}
              >
                Tất cả ({pendingTours.length})
              </button>
            </div>
          </div>

          <table className="bento-table">
            <thead>
              <tr>
                <th>Tour & Điểm Đến</th>
                <th>Nhà Điều Hành</th>
                <th>Trạng Thái</th>
                <th>Thời Lượng</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredTours.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "28px", color: "#64748b" }}>
                    Không có tour nào trong trạng thái này.
                  </td>
                </tr>
              ) : (
                filteredTours.map((tour) => (
                  <tr key={tour.id}>
                    <td>
                      <div className="tour-thumb-cell">
                        <img
                          src={tour.cover_url || "/images/vietnam_explore_new.png"}
                          onError={(e) => { e.currentTarget.src = "/images/vietnam_explore_new.png"; }}
                          className="tour-thumb-img"
                          alt={tour.name}
                        />
                        <div>
                          <div style={{ fontWeight: "700", color: "var(--bento-text-dark)" }}>{tour.name}</div>
                          <div style={{ fontSize: "11px", color: "var(--bento-text-muted)" }}>
                            {tour.summary || "Chưa có mô tả ngắn"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: "600" }}>{tour.company_name || "Nhà điều hành"}</td>
                    <td>
                      <span className={`pill ${tour.status === "ACTIVE" ? "pill-sky" : "pill-lime"}`}>
                        {tour.status === "ACTIVE" ? "ĐÃ DUYỆT" : "CHỜ DUYỆT"}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--bento-font-mono)", fontWeight: "800", color: "var(--bento-text-dark)" }}>
                      {tour.duration_days ? `${tour.duration_days} ngày` : "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        {tour.status !== "ACTIVE" && (
                          <button
                            type="button"
                            className="btn-lime"
                            onClick={() => onApproveTour?.(tour.id)}
                          >
                            Duyệt
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-ghost"
                          onClick={() => onNavigateTab?.("tour-approval")}
                        >
                          Chi tiết
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
