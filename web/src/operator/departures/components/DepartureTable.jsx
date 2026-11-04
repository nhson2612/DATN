import StatusTag from "../../common/StatusTag";
import { date, money } from "../../../shared/lib/format";

function getDayOfWeek(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat("vi-VN", { weekday: "long" }).format(d);
  } catch {
    return "";
  }
}

/**
 * Bảng danh sách đợt khởi hành chuẩn Shadcn UI.
 * Hiển thị đầy đủ thông tin: Ngày đi, Giá bán & Giá gốc, Chỗ ngồi & Tỉ lệ lấp đầy, Trạng thái và Thao tác.
 */
export default function DepartureTable({
  departures,
  onEditSale,
  onExportGuests,
  onCancelDeparture,
  renderActions,
}) {
  if (!departures || departures.length === 0) {
    return (
      <div className="op-departure-table__div-1 op-departure-table__div-1">
        <div className="op-departure-table__div-2">
          <span className="material-symbols-outlined op-departure-table__span-3">event_busy</span>
        </div>
        <h4 className="op-departure-table__text-4">Chưa có đợt khởi hành nào</h4>
        <p className="op-departure-table__text-5">
          Tour này hiện chưa mở ngày khởi hành nào. Hãy bấm &quot;Mở đợt&quot; để thiết lập ngày chạy và giá bán.
        </p>
      </div>
    );
  }

  return (
    <div className="op-departure-table__div-6" style={{ width: "100%", overflow: "hidden", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#ffffff" }}>
      <div className="op-departure-table__div-7" style={{ width: "100%", overflowX: "auto" }}>
        <table className="op-departure-table__table-8" style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr className="op-departure-table__tr-9">
              <th className="op-departure-table__th-10">Ngày khởi hành</th>
              <th className="op-departure-table__th-11">Giá bán hiệu lực</th>
              <th className="op-departure-table__th-12">Tình trạng chỗ</th>
              <th className="op-departure-table__th-13">Quy mô đoàn</th>
              <th className="op-departure-table__th-14">Trạng thái</th>
              <th className="op-departure-table__th-15">Thao tác</th>
            </tr>
          </thead>
          <tbody className="op-departure-table__body">
            {departures.map((departure) => {
              const soldSeats = departure.sold_seats || 0;
              const totalSeats = departure.seats_total || 20;
              const fillPct = Math.min(100, Math.round((soldSeats / totalSeats) * 100));
              const weekday = getDayOfWeek(departure.depart_date);
              const isSale = Boolean(departure.is_sale || (departure.sale_price && departure.sale_price < departure.list_price));
              const discountPct = isSale && departure.list_price
                ? Math.round(((departure.list_price - (departure.sale_price || departure.effective_price)) / departure.list_price) * 100)
                : 0;

              return (
                <tr key={departure.id} className="op-departure-table__tr-16">
                  {/* Ngày khởi hành */}
                  <td className="op-departure-table__td-17">
                    <div className="op-departure-table__div-18">{date(departure.depart_date)}</div>
                    {weekday && (
                      <div className="op-departure-table__div-19">{weekday}</div>
                    )}
                  </td>

                  {/* Giá bán & Giá gốc */}
                  <td className="op-departure-table__td-20">
                    <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                      <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "14px" }}>
                        {money(departure.effective_price || departure.sale_price || departure.list_price)}
                      </span>
                      {isSale && discountPct > 0 && (
                        <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: "600" }}>
                          (-{discountPct}%)
                        </span>
                      )}
                    </div>
                    {isSale && departure.list_price && (
                      <div style={{ fontSize: "12px", color: "#94a3b8", textDecoration: "line-through", marginTop: "2px" }}>
                        Gốc: {money(departure.list_price)}
                      </div>
                    )}
                  </td>

                  {/* Chỗ ngồi */}
                  <td className="op-departure-table__td-25">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>
                        {soldSeats}/{totalSeats} chỗ
                      </span>
                      <span style={{ fontSize: "12px", color: departure.seats_left === 0 ? "#dc2626" : "#64748b", fontWeight: "500" }}>
                        {departure.seats_left === 0 ? "Hết chỗ" : `Còn ${departure.seats_left} chỗ`}
                      </span>
                    </div>
                    <div className="op-departure-table__div-30 op-departure-table__div-4">
                      <div
                        className={`op-departure-table__div-34   ${
                          fillPct >= 90 ? "op-departure-table__div-31--variant-1" : fillPct >= 50 ? "op-departure-table__div-32--variant-2" : "op-departure-table__div-33--variant-3"
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </td>

                  {/* Quy mô đoàn (không dùng badge) */}
                  <td className="op-departure-table__td-35">
                    <span style={{ fontSize: "13px", color: "#334155" }}>
                      Tối thiểu {departure.min_pax || 1} khách
                    </span>
                  </td>

                  {/* Trạng thái */}
                  <td className="op-departure-table__td-38">
                    <StatusTag value={departure.status} />
                  </td>

                  {/* Thao tác */}
                  <td className="op-departure-table__td-39">
                    {renderActions ? (
                      renderActions(departure)
                    ) : (
                      <div className="op-departure-table__div-40" style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        {onEditSale && (
                          <button
                            type="button"
                            onClick={() => onEditSale(departure)}
                            title={isSale ? "Sửa giá khuyến mãi" : "Đặt giá khuyến mãi"}
                            aria-label={isSale ? "Sửa giá khuyến mãi" : "Đặt giá khuyến mãi"}
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              background: isSale ? "#f0fdf4" : "#ffffff",
                              color: isSale ? "#16a34a" : "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>percent</span>
                          </button>
                        )}
                        {onExportGuests && (
                          <button
                            type="button"
                            onClick={() => onExportGuests(departure.id)}
                            title="Xuất file CSV danh sách khách"
                            aria-label="Xuất CSV"
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                              color: "#475569",
                              cursor: "pointer",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>download</span>
                          </button>
                        )}
                        {onCancelDeparture && departure.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => onCancelDeparture(departure)}
                            title="Huỷ đợt khởi hành này"
                            aria-label="Huỷ đợt"
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "6px",
                              border: "1px solid #fee2e2",
                              background: "#fff1f2",
                              color: "#dc2626",
                              cursor: "pointer",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>event_busy</span>
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
