import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../shared/api";
import Notice from "../common/Notice";
import StatusTag from "../common/StatusTag";
import { date } from "../../shared/lib/format";

const vnd = (val) => `${Number(val || 0).toLocaleString("vi-VN")} đ`;

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

/** Màn "Quản lý khách hàng": vừa khít 100% màn hình, bấm vào khách hàng xổ ngay danh sách các tour và đơn đặt của người đó. */
export default function CustomersScreen() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("spent_desc");
  const [expandedKey, setExpandedKey] = useState(null);

  const loadCustomers = useCallback(() => {
    setLoading(true);
    api
      .operatorCustomers()
      .then((res) => {
        setData(res);
      })
      .catch((err) => setMessage(err.message || "Không tải được danh sách khách hàng."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const customers = useMemo(() => data?.customers || [], [data]);
  const summary = useMemo(() => data?.summary || {}, [data]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customers.filter((c) => {
      if (tierFilter === "PAID" && c.paid_bookings === 0) return false;
      if (tierFilter === "VIP" && c.tier !== "VIP") return false;
      if (tierFilter === "LEAD" && c.paid_bookings > 0) return false;

      if (!q) return true;
      const inName = (c.full_name || "").toLowerCase().includes(q);
      const inEmail = (c.email || "").toLowerCase().includes(q);
      const inPhone = (c.phone || "").toLowerCase().includes(q);
      const inTour = (c.tours_booked || []).some((t) => t.toLowerCase().includes(q));
      const inCode = (c.bookings || []).some((b) => (b.code || "").toLowerCase().includes(q));
      return inName || inEmail || inPhone || inTour || inCode;
    });

    list = [...list];
    if (sortBy === "spent_desc") {
      list.sort(
        (a, b) =>
          (b.total_spent || 0) - (a.total_spent || 0) ||
          (b.total_bookings || 0) - (a.total_bookings || 0)
      );
    } else if (sortBy === "bookings_desc") {
      list.sort(
        (a, b) =>
          (b.total_bookings || 0) - (a.total_bookings || 0) ||
          (b.total_spent || 0) - (a.total_spent || 0)
      );
    } else if (sortBy === "recent_desc") {
      list.sort((a, b) =>
        String(b.last_booking_at || "").localeCompare(String(a.last_booking_at || ""))
      );
    } else if (sortBy === "name_asc") {
      list.sort((a, b) =>
        String(a.full_name || "").localeCompare(String(b.full_name || ""), "vi")
      );
    }
    return list;
  }, [customers, search, tierFilter, sortBy]);

  const toggleExpand = (key) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const handleExportCsv = () => {
    if (!filteredCustomers.length) {
      setMessage("Không có dữ liệu khách hàng để xuất CSV.");
      return;
    }
    const headers = [
      "Họ tên",
      "Email",
      "Số điện thoại",
      "Tổng đơn đặt",
      "Đơn thành công",
      "Tổng khách phục vụ",
      "Tổng chi tiêu (VND)",
      "Các tour đã đặt",
      "Đặt gần nhất",
    ];
    const rows = filteredCustomers.map((c) => [
      `"${(c.full_name || "").replace(/"/g, '""')}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      `"${(c.phone || "").replace(/"/g, '""')}"`,
      c.total_bookings || 0,
      c.paid_bookings || 0,
      c.paid_guests || 0,
      c.total_spent || 0,
      `"${(c.tours_booked || []).join("; ").replace(/"/g, '""')}"`,
      `"${date(c.last_booking_at)}"`,
    ]);
    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `khach-hang-operator-${new Date().toISOString().slice(0, 10)}.csv`;
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
            Khách hàng
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0" }}>
            Danh sách khách hàng đặt tour, lịch sử chuyến đi và tổng chi tiêu tại đơn vị của bạn.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={loadCustomers}
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

      {/* 2. DẢI TÓM TẮT SỐ LIỆU (.op-stats) */}
      <div
        className="op-stats"
        style={{
          gridTemplateColumns: "repeat(4, 1fr)",
          marginBottom: "24px",
        }}
      >
        <div>
          <small>Tổng số khách hàng</small>
          <strong>{summary.total_customers || 0}</strong>
        </div>
        <div>
          <small>Khách đã thanh toán</small>
          <strong>{summary.paid_customers || 0}</strong>
        </div>
        <div>
          <small>Tổng lượt hành khách</small>
          <strong>{summary.total_paid_guests || 0} khách</strong>
        </div>
        <div>
          <small>Chi tiêu TB / khách</small>
          <strong>{vnd(summary.avg_customer_value || 0)}</strong>
        </div>
      </div>

      {/* 3. THANH TAB GẠCH CHÂN & Ô TÌM KIẾM */}
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
            { id: "ALL", label: `Tất cả (${customers.length})` },
            {
              id: "PAID",
              label: `Đã thanh toán (${customers.filter((c) => c.paid_bookings > 0).length})`,
            },
            {
              id: "VIP",
              label: `Khách quen (${customers.filter((c) => c.tier === "VIP").length})`,
            },
            {
              id: "LEAD",
              label: `Chưa hoàn tất (${customers.filter((c) => c.paid_bookings === 0).length})`,
            },
          ].map((tab) => {
            const active = tierFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTierFilter(tab.id)}
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

        <div style={{ display: "flex", gap: "8px", alignItems: "center", paddingBottom: "8px" }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm tên, SĐT, email, mã đơn..."
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
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: "6px 10px",
              borderRadius: "6px",
              border: "1px solid #d4d4d8",
              fontSize: "13px",
              background: "#ffffff",
              color: "#0f172a",
              whiteSpace: "nowrap",
            }}
          >
            <option value="spent_desc">Chi tiêu cao nhất</option>
            <option value="bookings_desc">Số đơn nhiều nhất</option>
            <option value="recent_desc">Đặt gần nhất</option>
            <option value="name_asc">Tên A → Z</option>
          </select>
        </div>
      </div>

      {/* 4. BẢNG KHÁCH HÀNG (GỌN 6 CỘT, VỪA KHÍT 100% MÀN HÌNH, BẤM XỔ CHI TIẾT TOUR CỦA NGƯỜI ĐÓ) */}
      {loading ? (
        <p style={{ color: "#64748b", padding: "24px 0" }}>Đang tải danh sách khách hàng...</p>
      ) : (
        <div className="op-table">
          <table style={{ minWidth: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, width: "22%" }}>Khách hàng & Liên hệ</th>
                <th style={{ ...thStyle, width: "34%" }}>Các tour đã đặt</th>
                <th style={{ ...thStyle, textAlign: "right", width: "12%" }}>Đơn thu / Tổng</th>
                <th style={{ ...thStyle, textAlign: "right", width: "14%" }}>Tổng thực thu</th>
                <th style={{ ...thStyle, width: "10%" }}>Đặt gần nhất</th>
                <th style={{ ...thStyle, textAlign: "right", width: "8%" }}>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: "center", color: "#64748b" }}>
                    Không tìm thấy khách hàng nào khớp với bộ lọc hiện tại.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((c) => {
                  const isOpen = expandedKey === c.customer_key;
                  const toursList = c.tours_booked || [];

                  // Thống kê nhanh từng tour mà khách này đã đặt
                  const tourBreakdownMap = {};
                  for (const b of c.bookings || []) {
                    const tKey = b.tour_id || b.tour_name;
                    if (!tourBreakdownMap[tKey]) {
                      tourBreakdownMap[tKey] = {
                        tour_id: b.tour_id,
                        tour_name: b.tour_name,
                        total_bookings: 0,
                        paid_bookings: 0,
                        guests: 0,
                        spent: 0,
                      };
                    }
                    tourBreakdownMap[tKey].total_bookings += 1;
                    tourBreakdownMap[tKey].guests += Number(b.guests || 1);
                    if (["PAID", "CONFIRMED", "COMPLETED"].includes(b.status)) {
                      tourBreakdownMap[tKey].paid_bookings += 1;
                      tourBreakdownMap[tKey].spent += Number(b.total_price || 0);
                    }
                  }
                  const tourBreakdown = Object.values(tourBreakdownMap);

                  return (
                    <Fragment key={c.customer_key}>
                      <tr
                        onClick={() => toggleExpand(c.customer_key)}
                        style={{
                          cursor: "pointer",
                          background: isOpen ? "#f8fafc" : undefined,
                        }}
                        title="Bấm để xem toàn bộ các tour và đơn đặt của khách hàng này"
                      >
                        {/* Cột 1: Khách hàng & Liên hệ */}
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>{c.full_name}</div>
                          <small style={{ color: "#64748b", marginTop: "2px", display: "block" }}>
                            {c.phone || "—"} · {c.email || "—"}
                          </small>
                        </td>

                        {/* Cột 2: Các tour đã đặt */}
                        <td style={tdStyle}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                            {toursList.slice(0, 2).map((tName) => (
                              <div
                                key={tName}
                                style={{
                                  fontSize: "13px",
                                  color: "#0f172a",
                                  fontWeight: 500,
                                }}
                              >
                                • {tName}
                              </div>
                            ))}
                            {toursList.length > 2 && (
                              <span
                                style={{
                                  fontSize: "12px",
                                  color: "#0f172a",
                                  fontWeight: 700,
                                  textDecoration: "underline",
                                  marginTop: "2px",
                                }}
                              >
                                {isOpen
                                  ? "Ẩn bớt danh sách tour ▲"
                                  : `+Xem thêm ${toursList.length - 2} tour khác (tổng ${toursList.length} tour) ▾`}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Cột 3: Đơn thu / Tổng */}
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <div style={{ fontWeight: 700 }}>
                            {c.paid_bookings} / {c.total_bookings} đơn
                          </div>
                          <small style={{ color: "#64748b" }}>
                            {c.paid_guests} khách đã thu
                          </small>
                        </td>

                        {/* Cột 4: Tổng thực thu */}
                        <td
                          style={{
                            ...tdStyle,
                            textAlign: "right",
                            whiteSpace: "nowrap",
                            fontWeight: 700,
                          }}
                        >
                          {vnd(c.total_spent)}
                        </td>

                        {/* Cột 5: Đặt gần nhất */}
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#475569" }}>
                          {date(c.last_booking_at)}
                        </td>

                        {/* Cột 6: Nút Xem các tour / đơn */}
                        <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(c.customer_key);
                            }}
                            style={{
                              padding: "6px 11px",
                              borderRadius: "6px",
                              border: "1px solid #0f172a",
                              background: isOpen ? "#0f172a" : "#ffffff",
                              color: isOpen ? "#ffffff" : "#0f172a",
                              fontSize: "12.5px",
                              fontWeight: 600,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {isOpen ? "Đóng ▲" : `Xem (${c.total_bookings}) ▾`}
                          </button>
                        </td>
                      </tr>

                      {/* HÀNG MỞ RỘNG: HIỂN THỊ TỔNG HỢP CÁC TOUR & CHI TIẾT TỪNG ĐƠN CỦA KHÁCH NÀY */}
                      {isOpen && (
                        <tr>
                          <td
                            colSpan={6}
                            style={{
                              padding: "16px 20px 22px",
                              background: "#f8fafc",
                              borderBottom: "2px solid #cbd5e1",
                            }}
                          >
                            {/* Phần A: Tổng hợp theo từng Tour mà khách này đã đặt */}
                            <div style={{ marginBottom: "16px" }}>
                              <div
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  color: "#0f172a",
                                  marginBottom: "8px",
                                }}
                              >
                                1. Tổng hợp các Tour mà {c.full_name} đã đặt ({tourBreakdown.length} tour)
                              </div>
                              <table
                                style={{
                                  width: "100%",
                                  minWidth: "100%",
                                  borderCollapse: "collapse",
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <thead>
                                  <tr>
                                    <th style={thStyle}>STT</th>
                                    <th style={thStyle}>Tên Tour</th>
                                    <th style={{ ...thStyle, textAlign: "right" }}>Đơn đã thanh toán / Tổng đơn</th>
                                    <th style={{ ...thStyle, textAlign: "right" }}>Tổng số khách</th>
                                    <th style={{ ...thStyle, textAlign: "right" }}>Thực thu từ tour này</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {tourBreakdown.map((tb, i) => (
                                    <tr key={tb.tour_id || tb.tour_name}>
                                      <td style={{ ...tdStyle, width: "50px", color: "#64748b" }}>
                                        {i + 1}
                                      </td>
                                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                                        {tb.tour_name}
                                      </td>
                                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                                        {tb.paid_bookings} / {tb.total_bookings} đơn
                                      </td>
                                      <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                                        {tb.guests} người
                                      </td>
                                      <td
                                        style={{
                                          ...tdStyle,
                                          textAlign: "right",
                                          whiteSpace: "nowrap",
                                          fontWeight: 700,
                                        }}
                                      >
                                        {vnd(tb.spent)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            {/* Phần B: Danh sách từng đơn đặt cụ thể của khách này */}
                            <div>
                              <div
                                style={{
                                  fontSize: "12.5px",
                                  fontWeight: 700,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.04em",
                                  color: "#0f172a",
                                  marginBottom: "8px",
                                }}
                              >
                                2. Lịch sử từng đơn đặt tour ({(c.bookings || []).length} đơn)
                              </div>
                              <table
                                style={{
                                  width: "100%",
                                  minWidth: "100%",
                                  borderCollapse: "collapse",
                                  background: "#ffffff",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <thead>
                                  <tr>
                                    <th style={thStyle}>Mã đơn</th>
                                    <th style={thStyle}>Tên Tour</th>
                                    <th style={thStyle}>Ngày khởi hành</th>
                                    <th style={{ ...thStyle, textAlign: "right" }}>Số khách</th>
                                    <th style={{ ...thStyle, textAlign: "right" }}>Tổng tiền</th>
                                    <th style={thStyle}>Trạng thái</th>
                                    <th style={thStyle}>Ngày đặt</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(c.bookings || []).map((b) => (
                                    <tr key={b.id}>
                                      <td style={{ ...tdStyle, whiteSpace: "nowrap", fontWeight: 600 }}>
                                        {b.code || `#${b.id}`}
                                      </td>
                                      <td style={tdStyle}>
                                        <Link
                                          to="/operator/bookings"
                                          style={{
                                            color: "#0f172a",
                                            fontWeight: 500,
                                            textDecoration: "none",
                                          }}
                                        >
                                          {b.tour_name}
                                        </Link>
                                      </td>
                                      <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#475569" }}>
                                        {date(b.depart_date)}
                                      </td>
                                      <td style={{ ...tdStyle, whiteSpace: "nowrap", textAlign: "right" }}>
                                        {b.guests} người
                                      </td>
                                      <td
                                        style={{
                                          ...tdStyle,
                                          whiteSpace: "nowrap",
                                          textAlign: "right",
                                          fontWeight: 700,
                                        }}
                                      >
                                        {vnd(b.total_price)}
                                      </td>
                                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                                        <StatusTag value={b.status} />
                                      </td>
                                      <td style={{ ...tdStyle, whiteSpace: "nowrap", color: "#64748b" }}>
                                        {date(b.created_at)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
