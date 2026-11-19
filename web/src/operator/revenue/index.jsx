import { useCallback, useEffect, useMemo, useState } from "react";

import { api } from "../../shared/api";
import Notice from "../common/Notice";
import StatusTag from "../common/StatusTag";
import { date } from "../../shared/lib/format";

const vnd = (val) => `${Number(val || 0).toLocaleString("vi-VN")} đ`;

const METHOD_NAMES = {
  PAYOS: "VietQR payOS",
  STRIPE: "Thẻ quốc tế Stripe",
  CHUYEN_KHOAN: "Chuyển khoản ngân hàng",
  MOMO: "Ví MoMo",
};

function formatMonthLabel(ym = "") {
  const parts = String(ym).split("-");
  if (parts.length === 2) return `Tháng ${parts[1]}/${parts[0]}`;
  return ym;
}

const thStyle = {
  textAlign: "left",
  color: "#64748b",
  fontSize: "11.5px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "11px 14px",
  background: "#f8fafc",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

const tdStyle = {
  padding: "13px 14px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
  color: "#0f172a",
  fontSize: "13.5px",
};

const tfootTdStyle = {
  padding: "13px 14px",
  background: "#f8fafc",
  borderTop: "2px solid #e2e8f0",
  fontWeight: 700,
  color: "#0f172a",
  fontSize: "13.5px",
  whiteSpace: "nowrap",
};

/** Màn "Doanh thu": Báo cáo thống kê dạng bảng phẳng (Theo tháng, Theo tour, Theo khách hàng, Phương thức, Giao dịch). */
export default function RevenueScreen() {
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("by_month");
  const [search, setSearch] = useState("");

  const loadRevenue = useCallback(() => {
    setLoading(true);
    api
      .operatorRevenue()
      .then((res) => setRevenue(res))
      .catch((error) => setMessage(error.message || "Không tải được dữ liệu doanh thu."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadRevenue();
  }, [loadRevenue]);

  const summary = useMemo(() => revenue?.summary || {}, [revenue]);
  const months = useMemo(() => revenue?.months || [], [revenue]);
  const byTour = useMemo(() => revenue?.by_tour || [], [revenue]);
  const byCustomer = useMemo(() => revenue?.by_customer || [], [revenue]);
  const byMethod = useMemo(() => revenue?.by_method || [], [revenue]);
  const recentTx = useMemo(() => revenue?.recent_transactions || [], [revenue]);

  const filteredTours = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return byTour;
    return byTour.filter((t) => (t.tour_name || "").toLowerCase().includes(q));
  }, [byTour, search]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return byCustomer;
    return byCustomer.filter(
      (c) =>
        (c.customer_name || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    );
  }, [byCustomer, search]);

  const filteredTx = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recentTx;
    return recentTx.filter(
      (tx) =>
        (tx.booking_code || "").toLowerCase().includes(q) ||
        (tx.customer_name || "").toLowerCase().includes(q) ||
        (tx.tour_name || "").toLowerCase().includes(q) ||
        (tx.method || "").toLowerCase().includes(q)
    );
  }, [recentTx, search]);

  const handleExportCsv = () => {
    let headers = [];
    let rows = [];

    if (activeTab === "by_month") {
      headers = [
        "Tháng",
        "Đơn đã thu",
        "Tổng số khách",
        "Số tour có khách",
        "Trung bình/đơn (VND)",
        "Doanh thu thực thu (VND)",
        "Tỷ trọng (%)",
      ];
      rows = months.map((m) => [
        `"${m.month}"`,
        m.bookings || 0,
        m.guests || 0,
        m.tours_count || 0,
        m.avg_order_value || 0,
        m.revenue || 0,
        m.share_pct || 0,
      ]);
    } else if (activeTab === "by_tour") {
      headers = [
        "Mã Tour",
        "Tên Tour",
        "Giá niêm yết (VND)",
        "Số đợt mở",
        "Đơn đã thu",
        "Tổng đơn đặt",
        "Số khách",
        "Doanh thu thực thu (VND)",
        "Tỷ trọng (%)",
      ];
      rows = filteredTours.map((t) => [
        t.tour_id,
        `"${(t.tour_name || "").replace(/"/g, '""')}"`,
        t.price_from || 0,
        t.departures_count || 0,
        t.bookings || 0,
        t.total_bookings || 0,
        t.guests || 0,
        t.revenue || 0,
        t.share_pct || 0,
      ]);
    } else if (activeTab === "by_customer") {
      headers = [
        "Khách hàng",
        "Email",
        "Số điện thoại",
        "Số đơn đã thanh toán",
        "Tổng số khách",
        "Tổng chi tiêu (VND)",
        "Tỷ trọng (%)",
        "Thanh toán gần nhất",
      ];
      rows = filteredCustomers.map((c) => [
        `"${(c.customer_name || "").replace(/"/g, '""')}"`,
        `"${(c.email || "").replace(/"/g, '""')}"`,
        `"${(c.phone || "").replace(/"/g, '""')}"`,
        c.bookings || 0,
        c.guests || 0,
        c.revenue || 0,
        c.share_pct || 0,
        `"${date(c.last_paid_at)}"`,
      ]);
    } else if (activeTab === "by_method") {
      headers = ["Phương thức thanh toán", "Số đơn", "Doanh thu (VND)", "Tỷ trọng (%)"];
      rows = byMethod.map((pm) => [
        `"${METHOD_NAMES[pm.method] || pm.method}"`,
        pm.bookings || 0,
        pm.revenue || 0,
        pm.share_pct || 0,
      ]);
    } else {
      headers = [
        "Mã đơn",
        "Khách hàng",
        "Liên hệ",
        "Tour",
        "Phương thức",
        "Số tiền (VND)",
        "Thời gian",
        "Trạng thái",
      ];
      rows = filteredTx.map((tx) => [
        `"${tx.booking_code || `#${tx.booking_id}`}"`,
        `"${(tx.customer_name || "").replace(/"/g, '""')}"`,
        `"${(tx.customer_phone || tx.customer_email || "").replace(/"/g, '""')}"`,
        `"${(tx.tour_name || "").replace(/"/g, '""')}"`,
        `"${METHOD_NAMES[tx.method] || tx.method || ""}"`,
        tx.amount || 0,
        `"${date(tx.confirmed_at)}"`,
        `"${tx.booking_status || ""}"`,
      ]);
    }

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `doanh-thu-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section>
      {/* 1. TIÊU ĐỀ TRANG */}
      <header
        className="op-section-head"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          paddingBottom: "18px",
          marginBottom: "20px",
          borderBottom: "1px solid #e2e8f0",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", margin: 0 }}>
            Doanh thu
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
            Bảng kê doanh thu thực thu theo tháng, theo tour, theo khách hàng và sổ giao dịch.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={loadRevenue}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              background: "#ffffff",
              color: "#0f172a",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Làm mới
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              padding: "8px 14px",
              borderRadius: "6px",
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#ffffff",
              fontWeight: 600,
              fontSize: "13px",
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Xuất CSV
          </button>
        </div>
      </header>

      <Notice onClose={() => setMessage("")}>{message}</Notice>

      {loading ? (
        <p style={{ color: "#64748b", padding: "24px 0" }}>Đang tải dữ liệu doanh thu...</p>
      ) : (
        revenue && (
          <>
            {/* 2. DẢI TÓM TẮT SỐ LIỆU LIỀN MẠCH (.op-stats) — KHÔNG TÁCH CARD RỜI */}
            <div
              className="op-stats"
              style={{
                gridTemplateColumns: "repeat(4, 1fr)",
                marginBottom: "24px",
              }}
            >
              <div>
                <small>Tổng thực thu</small>
                <strong>{vnd(summary.gross_revenue)}</strong>
              </div>
              <div>
                <small>Đơn đã thanh toán / Tổng đơn</small>
                <strong>
                  {summary.paid_bookings || 0} / {summary.total_bookings || 0}
                </strong>
              </div>
              <div>
                <small>Tổng khách đã phục vụ</small>
                <strong>{summary.total_guests || 0} khách</strong>
              </div>
              <div>
                <small>Trung bình / đơn</small>
                <strong>{vnd(summary.avg_order_value)}</strong>
              </div>
            </div>

            {/* 3. THANH TAB GẠCH CHÂN & Ô LỌC PHẲNG (KHÔNG BỌC CARD) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #e2e8f0",
                marginBottom: "16px",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", gap: "24px", overflowX: "auto" }}>
                {[
                  { id: "by_month", label: `Theo tháng (${months.length})` },
                  { id: "by_tour", label: `Theo tour (${byTour.length})` },
                  { id: "by_customer", label: `Theo khách hàng (${byCustomer.length})` },
                  { id: "by_method", label: `Phương thức thanh toán (${byMethod.length})` },
                  { id: "transactions", label: `Sổ giao dịch (${recentTx.length})` },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        padding: "10px 0",
                        border: "none",
                        borderBottom: active ? "2px solid #0f172a" : "2px solid transparent",
                        background: "transparent",
                        color: active ? "#0f172a" : "#64748b",
                        fontWeight: active ? 700 : 500,
                        fontSize: "13.5px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        marginBottom: "-1px",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {(activeTab === "by_tour" ||
                activeTab === "by_customer" ||
                activeTab === "transactions") && (
                <div style={{ paddingBottom: "8px" }}>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Lọc nhanh trong bảng..."
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #d4d4d8",
                      fontSize: "13px",
                      width: "240px",
                      background: "#ffffff",
                      color: "#0f172a",
                    }}
                  />
                </div>
              )}
            </div>

            {/* 4. BẢNG BÁO CÁO CHI TIẾT */}

            {/* BẢNG 1: THEO THÁNG */}
            {activeTab === "by_month" && (
              <div className="op-table">
                <table>
                  <thead>
                    <tr>
                      <th style={thStyle}>Kỳ (Tháng)</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Số đơn đã thu</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Số lượng khách</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Số tour phát sinh</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Trung bình / đơn</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Doanh thu thực thu</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {months.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#64748b" }}>
                          Chưa có dữ liệu doanh thu theo tháng.
                        </td>
                      </tr>
                    ) : (
                      months.map((m) => (
                        <tr key={m.month}>
                          <td style={{ ...tdStyle, whiteSpace: "nowrap", fontWeight: 600 }}>
                            {formatMonthLabel(m.month)}{" "}
                            <span style={{ color: "#64748b", fontWeight: 400 }}>({m.month})</span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            {m.bookings}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            {m.guests || 0}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            {m.tours_count || 0}
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            {vnd(m.avg_order_value)}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              fontWeight: 700,
                            }}
                          >
                            {vnd(m.revenue)}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              color: "#475569",
                            }}
                          >
                            {m.share_pct || 0}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {months.length > 0 && (
                    <tfoot>
                      <tr>
                        <td style={tfootTdStyle}>Tổng cộng</td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {summary.paid_bookings || 0}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {summary.total_guests || 0}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>—</td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {vnd(summary.avg_order_value)}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {vnd(summary.gross_revenue)}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>100%</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* BẢNG 2: THEO TOUR */}
            {activeTab === "by_tour" && (
              <div className="op-table">
                <table>
                  <thead>
                    <tr>
                      <th style={thStyle}>STT</th>
                      <th style={thStyle}>Tên Tour</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Giá niêm yết</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Số đợt mở</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Đơn đã thu / Tổng</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Số khách</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Doanh thu thực thu</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTours.map((t, index) => (
                      <tr key={t.tour_id}>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#64748b" }}>
                          {index + 1}
                        </td>
                        <td style={{ ...tdStyle, minWidth: "240px" }}>
                          <div style={{ fontWeight: 600, color: "#0f172a" }}>{t.tour_name}</div>
                          <small style={{ color: "#64748b" }}>
                            Mã #{t.tour_id} · {t.duration_days || 1} ngày
                          </small>
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          {vnd(t.price_from)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          {t.departures_count || 0}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          {t.bookings} / {t.total_bookings}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          {t.guests || 0}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            fontWeight: 700,
                          }}
                        >
                          {vnd(t.revenue)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            color: "#475569",
                          }}
                        >
                          {t.share_pct || 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filteredTours.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={tfootTdStyle}>
                          Tổng cộng ({filteredTours.length} tour)
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {filteredTours.reduce((s, t) => s + (t.bookings || 0), 0)} /{" "}
                          {filteredTours.reduce((s, t) => s + (t.total_bookings || 0), 0)}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {filteredTours.reduce((s, t) => s + (t.guests || 0), 0)}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {vnd(filteredTours.reduce((s, t) => s + (t.revenue || 0), 0))}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {Math.round(
                            filteredTours.reduce((s, t) => s + Number(t.share_pct || 0), 0)
                          )}
                          %
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* BẢNG 3: THEO KHÁCH HÀNG */}
            {activeTab === "by_customer" && (
              <div className="op-table">
                <table style={{ minWidth: "100%" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>STT</th>
                      <th style={thStyle}>Khách hàng & Liên hệ</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Số đơn đã thu</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tổng số khách</th>
                      <th style={thStyle}>Giao dịch gần nhất</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tổng chi tiêu</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: "#64748b" }}>
                          Không có dữ liệu khách hàng.
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((c, index) => (
                        <tr key={c.customer_key}>
                          <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#64748b" }}>
                            {index + 1}
                          </td>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 600, color: "#0f172a" }}>
                              {c.customer_name || "Khách du lịch"}
                            </div>
                            <small style={{ color: "#64748b" }}>
                              {c.phone || "—"} · {c.email || "—"}
                            </small>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            {c.bookings} đơn
                          </td>
                          <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                            {c.guests || 0} khách
                          </td>
                          <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#475569" }}>
                            {date(c.last_paid_at)}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              fontWeight: 700,
                            }}
                          >
                            {vnd(c.revenue)}
                          </td>
                          <td
                            style={{
                              ...tdStyle,
                              textAlign: "right",
                              whiteSpace: "nowrap",
                              color: "#475569",
                            }}
                          >
                            {c.share_pct || 0}%
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredCustomers.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={tfootTdStyle}>
                          Tổng cộng ({filteredCustomers.length} khách hàng)
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {filteredCustomers.reduce((s, c) => s + (c.bookings || 0), 0)} đơn
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {filteredCustomers.reduce((s, c) => s + (c.guests || 0), 0)} khách
                        </td>
                        <td style={tfootTdStyle}>—</td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {vnd(filteredCustomers.reduce((s, c) => s + (c.revenue || 0), 0))}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {Math.round(
                            filteredCustomers.reduce((s, c) => s + Number(c.share_pct || 0), 0)
                          )}
                          %
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* BẢNG 4: PHƯƠNG THỨC THANH TOÁN */}
            {activeTab === "by_method" && (
              <div className="op-table">
                <table>
                  <thead>
                    <tr>
                      <th style={thStyle}>Phương thức thanh toán</th>
                      <th style={thStyle}>Cổng xử lý</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Số đơn thành công</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tổng doanh thu</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tỷ trọng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byMethod.map((pm) => (
                      <tr key={`${pm.method}-${pm.provider}`}>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", fontWeight: 600 }}>
                          {METHOD_NAMES[pm.method] || pm.method}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#475569" }}>
                          {pm.provider}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          {pm.bookings}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            fontWeight: 700,
                          }}
                        >
                          {vnd(pm.revenue)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            color: "#475569",
                          }}
                        >
                          {pm.share_pct || 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {byMethod.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={tfootTdStyle}>
                          Tổng cộng
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {summary.paid_bookings || 0}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {vnd(summary.gross_revenue)}
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>100%</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* BẢNG 5: SỔ GIAO DỊCH THU TIỀN */}
            {activeTab === "transactions" && (
              <div className="op-table">
                <table>
                  <thead>
                    <tr>
                      <th style={thStyle}>Mã đơn</th>
                      <th style={thStyle}>Khách hàng</th>
                      <th style={thStyle}>Tour</th>
                      <th style={thStyle}>Phương thức</th>
                      <th style={thStyle}>Thời gian xác nhận</th>
                      <th style={thStyle}>Trạng thái đơn</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Số tiền thu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTx.map((tx) => (
                      <tr key={tx.payment_id}>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", fontWeight: 600 }}>
                          {tx.booking_code || `#${tx.booking_id}`}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 600 }}>{tx.customer_name}</div>
                          <small style={{ color: "#64748b" }}>
                            {tx.customer_phone || tx.customer_email || `${tx.guests} khách`}
                          </small>
                        </td>
                        <td style={{ ...tdStyle, minWidth: "220px" }}>{tx.tour_name}</td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          {METHOD_NAMES[String(tx.method || "").toUpperCase()] || tx.method}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#475569" }}>
                          {date(tx.confirmed_at)}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          <StatusTag value={tx.booking_status} />
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            fontWeight: 700,
                          }}
                        >
                          {vnd(tx.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {filteredTx.length > 0 && (
                    <tfoot>
                      <tr>
                        <td colSpan={6} style={tfootTdStyle}>
                          Tổng cộng ({filteredTx.length} giao dịch)
                        </td>
                        <td style={{ ...tfootTdStyle, textAlign: "right" }}>
                          {vnd(filteredTx.reduce((s, tx) => s + (tx.amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}
