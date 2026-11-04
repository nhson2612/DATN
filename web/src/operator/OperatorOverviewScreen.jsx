import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import "../shared/bento/BentoDashboard.css";

export default function OperatorOverviewScreen() {
  const [filterDep, setFilterDep] = useState("all");

  const DEPARTURES_DATA = [
    {
      id: 1,
      title: "Hạ Long Du Thuyền 5 Sao 2N1Đ",
      timeline: "01/11 ➔ 02/11 • Bến Tuần Châu",
      vehicle: "Xe 29 chỗ (29B-128.45)",
      guide: "HDV: Tuấn Kiệt (0912.345.678)",
      seats: "28 / 30 GHẾ (93%)",
      seatsStatus: "upcoming",
      price: "3.200.000 đ",
      img: "/images/tour-halong.jpg",
    },
    {
      id: 2,
      title: "Sa Pa - Bản Cát Cát - Fansipan",
      timeline: "02/11 ➔ 04/11 • Đón Trần Quang Khải",
      vehicle: "Limousine 16 chỗ (29F-089.12)",
      guide: "HDV: Hoàng Long (0988.765.432)",
      seats: "24 / 25 GHẾ (96%)",
      seatsStatus: "full",
      price: "2.850.000 đ",
      img: "/images/tour-sapa.jpg",
    },
    {
      id: 3,
      title: "Tràng An - Bái Đính 1 Ngày",
      timeline: "02/11 • Đón tại Phố Cổ Hà Nội",
      vehicle: "Xe 35 chỗ (29B-552.19)",
      guide: "HDV: Minh Anh (0904.112.233)",
      seats: "32 / 35 GHẾ (91%)",
      seatsStatus: "upcoming",
      price: "1.200.000 đ",
      img: "/images/tour-danang.jpg",
    },
  ];

  const filteredDeps = useMemo(() => {
    if (filterDep === "all") return DEPARTURES_DATA;
    if (filterDep === "upcoming") return DEPARTURES_DATA.filter((d) => d.seatsStatus === "upcoming");
    if (filterDep === "full") return DEPARTURES_DATA.filter((d) => d.seatsStatus === "full");
    return DEPARTURES_DATA;
  }, [filterDep]);

  return (
    <div className="bento-wrapper">
      {/* HÀNG TRÊN: 3 KHỐI BENTO VẬN HÀNH */}
      <div className="bento-row">
        
        {/* CARD 1 (3 CỘT): ĐƠN ĐẶT TOUR MỚI CỦA ĐƠN VỊ (THIẾT KẾ SẠCH SẼ) */}
        <div className="bento-card" style={{ gridColumn: "span 3", justifyContent: "space-between", border: "1px solid #e2e8f0" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b" }}>
                Đơn đặt tour mới hôm nay
              </span>
              <div className="avatar-stack">
                <div className="avatar-circle-sm" style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>TK</div>
                <div className="avatar-circle-sm" style={{ background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" }}>HL</div>
                <div className="avatar-more" style={{ background: "#0f172a", color: "#ffffff" }}>+2</div>
              </div>
            </div>

            <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "8px 0 0" }}>
              8.450.000 đ
            </div>
          </div>

          {/* LOG CÁC ĐƠN MỚI CỦA ĐƠN VỊ (DÒNG PHẲNG) */}
          <div className="order-flat-list">
            <div className="order-flat-row" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>#OP-4029</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>10:30 • VietQR</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "3px" }}>
                <span style={{ fontSize: "12px", color: "#475569" }}>Phạm Quỳnh Chi (2 vé)</span>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>3.200.000 đ</span>
              </div>
            </div>

            <div className="order-flat-row" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>#OP-4028</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>09:15 • Stripe</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "3px" }}>
                <span style={{ fontSize: "12px", color: "#475569" }}>David Miller (1 vé)</span>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>2.850.000 đ</span>
              </div>
            </div>

            <div className="order-flat-row" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>#OP-4027</span>
                <span style={{ fontSize: "11px", color: "#64748b" }}>08:00 • VietQR</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "3px" }}>
                <span style={{ fontSize: "12px", color: "#475569" }}>Nguyễn Văn Bình (2 vé)</span>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>2.400.000 đ</span>
              </div>
            </div>
          </div>

          <div style={{ paddingTop: "10px", borderTop: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
            <span style={{ color: "#64748b" }}>Đã xác nhận: 5 khách giữ chỗ</span>
            <Link to="/operator/bookings" style={{ color: "#0f172a", fontWeight: "600", textDecoration: "none", fontSize: "12px" }}>
              Xem tất cả ➔
            </Link>
          </div>
        </div>

        {/* CARD 2 (6 CỘT): ĐỢT KHỞI HÀNH 48H TỚI VỚI TIẾN ĐỘ GHẾ & PHƯƠNG TIỆN */}
        <div className="bento-card" style={{ gridColumn: "span 6" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--bento-text-dark)" }}>
                Đợt khởi hành 48 giờ tới
              </div>
              <div style={{ fontSize: "12px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                Theo dõi quân số hành khách, hướng dẫn viên và biển số xe trực tiếp
              </div>
            </div>
            <Link to="/operator/tours?action=create" className="btn-lime" style={{ textDecoration: "none" }}>
              + Mở đợt mới
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Đợt 1 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img src="/images/tour-halong.jpg" onError={(e) => { e.currentTarget.src = "/images/vietnam_explore_new.png"; }} style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }} alt="Tour" />
                <div>
                  <div style={{ fontWeight: "700", color: "var(--bento-text-dark)", fontSize: "14px" }}>Hạ Long 2N1Đ Du Thuyền 5 Sao</div>
                  <div style={{ fontSize: "11px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                    01/11 (07:30) • Xe 29 chỗ (29B-128.45) • HDV: Tuấn Kiệt
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--bento-font-mono)", fontSize: "13px", fontWeight: "800", color: "#16a34a" }}>28 / 30 GHẾ (93%)</div>
                <div style={{ width: "110px", height: "6px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden", marginTop: "4px" }}>
                  <div style={{ width: "93%", height: "100%", background: "#16a34a", borderRadius: "4px" }} />
                </div>
              </div>
            </div>

            {/* Đợt 2 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img src="/images/tour-sapa.jpg" onError={(e) => { e.currentTarget.src = "/images/vietnam_explore_new.png"; }} style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }} alt="Tour" />
                <div>
                  <div style={{ fontWeight: "700", color: "var(--bento-text-dark)", fontSize: "14px" }}>Sa Pa - Bản Cát Cát - Fansipan</div>
                  <div style={{ fontSize: "11px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                    02/11 (06:00) • Limousine 16 chỗ (29F-089.12) • HDV: Hoàng Long
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--bento-font-mono)", fontSize: "13px", fontWeight: "800", color: "#16a34a" }}>24 / 25 GHẾ (96%)</div>
                <div style={{ width: "110px", height: "6px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden", marginTop: "4px" }}>
                  <div style={{ width: "96%", height: "100%", background: "#16a34a", borderRadius: "4px" }} />
                </div>
              </div>
            </div>

            {/* Đợt 3 */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "#f8fafc", borderRadius: "14px", border: "1px solid #f1f5f9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img src="/images/tour-danang.jpg" onError={(e) => { e.currentTarget.src = "/images/vietnam_explore_new.png"; }} style={{ width: "48px", height: "48px", borderRadius: "12px", objectFit: "cover" }} alt="Tour" />
                <div>
                  <div style={{ fontWeight: "700", color: "var(--bento-text-dark)", fontSize: "14px" }}>Tràng An - Bái Đính 1 Ngày</div>
                  <div style={{ fontSize: "11px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                    02/11 (08:00) • Xe 35 chỗ (29B-552.19) • HDV: Minh Anh
                  </div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "var(--bento-font-mono)", fontSize: "13px", fontWeight: "800", color: "#0284c7" }}>32 / 35 GHẾ (91%)</div>
                <div style={{ width: "110px", height: "6px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden", marginTop: "4px" }}>
                  <div style={{ width: "91%", height: "100%", background: "#0284c7", borderRadius: "4px" }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CARD 3 (3 CỘT): CHỈ SỐ VẬN HÀNH ĐƠN VỊ */}
        <div className="bento-card" style={{ gridColumn: "span 3", justifyContent: "space-between", gap: "14px" }}>
          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--bento-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Doanh thu thực tế đơn vị (Gross)
            </div>
            <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", margin: "4px 0 0" }}>
              18.450.000 đ
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--bento-text-muted)", textTransform: "uppercase" }}>
              Tỷ lệ lấp đầy ghế tháng 10
            </div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--bento-text-dark)", marginTop: "2px" }}>
              88.5% <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>(52 / 55 ghế)</span>
            </div>
          </div>

          <div>
            <div style={{ fontSize: "11px", fontWeight: "700", color: "var(--bento-text-muted)", textTransform: "uppercase" }}>
              Hành khách đang đi tour
            </div>
            <div style={{ fontSize: "20px", fontWeight: "800", color: "var(--bento-text-dark)", marginTop: "2px" }}>
              28 hành khách
            </div>
          </div>

          <Link to="/operator/cancellations" style={{ textDecoration: "none" }} title="Nhấn để xử lý yêu cầu">
            <div className="cta-link-arrow">
              <span>Yêu cầu đổi/hủy vé</span>
              <span className="arrow-symbol"></span>
            </div>
            <div style={{ fontSize: "18px", fontWeight: "800", color: "#dc2626", marginTop: "2px" }}>
              01 yêu cầu chờ duyệt
            </div>
          </Link>
        </div>

      </div>

      {/* HÀNG DƯỚI: ĐIỀU PHỐI HDV & BẢNG ĐỢT KHỞI HÀNH (KHÔNG LẶP MENU ĐIỀU HƯỚNG) */}
      <div className="bento-row">
        
        {/* WIDGET HDV TRỰC CA & HỘP THƯ HỖ TRỢ (SPAN 3) */}
        <div className="bento-card" style={{ gridColumn: "span 3", justifyContent: "space-between", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "var(--bento-text-dark)", marginBottom: "4px" }}>
              HDV Trực Ca Hôm Nay
            </div>
            <div style={{ fontSize: "11px", color: "var(--bento-text-muted)", marginBottom: "12px" }}>
              Theo dõi nhân sự dẫn đoàn đang hoạt động
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="avatar-circle-sm" style={{ background: "#e2e8f0", color: "#0f172a", fontWeight: "700", fontSize: "11px" }}>TK</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--bento-text-dark)" }}>Tuấn Kiệt</div>
                    <div style={{ fontSize: "11px", color: "var(--bento-text-muted)" }}>Hạ Long • 28 khách</div>
                  </div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#16a34a", fontWeight: "600" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }}></span>
                  Đang chạy
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "10px 12px", borderRadius: "10px", border: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="avatar-circle-sm" style={{ background: "#e2e8f0", color: "#0f172a", fontWeight: "700", fontSize: "11px" }}>HL</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: "700", color: "var(--bento-text-dark)" }}>Hoàng Long</div>
                    <div style={{ fontSize: "11px", color: "var(--bento-text-muted)" }}>Sa Pa 02/11</div>
                  </div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", color: "#2563eb", fontWeight: "600" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563eb" }}></span>
                  Sẵn sàng
                </span>
              </div>
            </div>
          </div>

          <div style={{ paddingTop: "14px", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--bento-text-muted)", textTransform: "uppercase" }}>
                Hộp thư hỗ trợ
              </span>
              <span style={{ background: "#f1f5f9", color: "#475569", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "6px" }}>
                2 tin mới
              </span>
            </div>
            <Link
              to="/operator/support"
              style={{
                display: "block",
                background: "#0f172a",
                color: "#ffffff",
                textAlign: "center",
                padding: "8px 12px",
                borderRadius: "8px",
                fontWeight: "600",
                fontSize: "12.5px",
                textDecoration: "none",
              }}
            >
              Mở hộp thư khách hàng ➔
            </Link>
          </div>
        </div>

        {/* BẢNG ĐIỀU PHỐI ĐỢT KHỞI HÀNH & DANH SÁCH HÀNH KHÁCH (SPAN 9) */}
        <div className="bento-card" style={{ gridColumn: "span 9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "var(--bento-text-dark)" }}>
                Bảng điều phối đợt khởi hành & Tình trạng ghế
              </div>
              <div style={{ fontSize: "12px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                Theo dõi tình trạng lấp đầy chỗ, phân bổ xe và danh sách hành khách theo từng đợt
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div className="role-toggle-group" style={{ padding: "2px" }}>
                <button
                  type="button"
                  className={`role-tab ${filterDep === "all" ? "active" : ""}`}
                  style={{ padding: "5px 14px", fontSize: "12px", fontWeight: "700" }}
                  onClick={() => setFilterDep("all")}
                >
                  Tất cả đợt (3)
                </button>
                <button
                  type="button"
                  className={`role-tab ${filterDep === "upcoming" ? "active" : ""}`}
                  style={{ padding: "5px 14px", fontSize: "12px", fontWeight: "700" }}
                  onClick={() => setFilterDep("upcoming")}
                >
                  Sắp đi (2)
                </button>
                <button
                  type="button"
                  className={`role-tab ${filterDep === "full" ? "active" : ""}`}
                  style={{ padding: "5px 14px", fontSize: "12px", fontWeight: "700" }}
                  onClick={() => setFilterDep("full")}
                >
                  Đã đủ chỗ (1)
                </button>
              </div>
              <Link to="/operator/departures" className="btn-circle-arrow" title="Mở danh sách chi tiết" style={{ textDecoration: "none" }} />
            </div>
          </div>

          <table className="bento-table">
            <thead>
              <tr>
                <th>Tour & Lịch Trình</th>
                <th>Xe & Hướng Dẫn Viên</th>
                <th>Tình Trạng Ghế</th>
                <th>Giá Bán</th>
                <th>Hành Động</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeps.map((dep) => (
                <tr key={dep.id}>
                  <td>
                    <div className="tour-thumb-cell">
                      <img src={dep.img} onError={(e) => { e.currentTarget.src = "/images/vietnam_explore_new.png"; }} className="tour-thumb-img" alt={dep.title} />
                      <div>
                        <div style={{ fontWeight: "700", color: "var(--bento-text-dark)" }}>{dep.title}</div>
                        <div style={{ fontSize: "11px", color: "var(--bento-text-muted)" }}>{dep.timeline}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: "600", color: "var(--bento-text-dark)", fontSize: "13px" }}>{dep.vehicle}</div>
                    <div style={{ fontSize: "11px", color: "var(--bento-text-muted)" }}>{dep.guide}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>{dep.seats}</span>
                  </td>
                  <td style={{ fontFamily: "var(--bento-font-mono)", fontWeight: "700", color: "var(--bento-text-dark)" }}>
                    {dep.price}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <Link
                        to="/operator/bookings"
                        title="Xem danh sách đoàn & hành khách"
                        aria-label="Danh sách đoàn"
                        style={{
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          background: "#0f172a",
                          color: "#ffffff",
                          borderRadius: "6px",
                          transition: "background 0.15s ease",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>group</span>
                      </Link>
                      <Link
                        to="/operator/departures"
                        title="Chỉnh sửa đợt khởi hành"
                        aria-label="Chỉnh sửa đợt"
                        style={{
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "32px",
                          height: "32px",
                          background: "#ffffff",
                          color: "#475569",
                          border: "1px solid #e2e8f0",
                          borderRadius: "6px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
