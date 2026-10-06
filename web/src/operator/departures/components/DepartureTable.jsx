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
    <div className="op-departure-table__div-6 op-departure-table__div-2">
      <div className="op-departure-table__div-7">
        <table className="op-departure-table__table-8">
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
                    <div className="op-departure-table__div-21">
                      <span className="op-departure-table__span-22">
                        {money(departure.effective_price || departure.sale_price || departure.list_price)}
                      </span>
                      {isSale && discountPct > 0 && (
                        <span className="op-departure-table__span-23 op-departure-table__span-3">
                          -{discountPct}%
                        </span>
                      )}
                    </div>
                    {isSale && departure.list_price && (
                      <div className="line-through op-departure-table__div-24">
                        Gốc: {money(departure.list_price)}
                      </div>
                    )}
                  </td>

                  {/* Chỗ ngồi */}
                  <td className="op-departure-table__td-25">
                    <div className="op-departure-table__div-26">
                      <span className="op-departure-table__span-27">
                        {soldSeats}/{totalSeats} chỗ
                      </span>
                      <span className={departure.seats_left === 0 ? "op-departure-table__span-28--variant-1" : "op-departure-table__span-29--variant-2"}>
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

                  {/* Quy mô đoàn */}
                  <td className="op-departure-table__td-35">
                    <span className="op-departure-table__span-36 op-departure-table__span-5">
                      <span className="material-symbols-outlined op-departure-table__span-37">group</span>
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
                      <div className="op-departure-table__div-40">
                        {onEditSale && (
                          <button
                            type="button"
                            onClick={() => onEditSale(departure)}
                            className="op-departure-table__button-41 op-departure-table__button-6"
                            title="Đặt hoặc sửa giá khuyến mãi"
                          >
                            <span className="material-symbols-outlined op-departure-table__span-42">percent</span>
                            {isSale ? "Sửa sale" : "Đặt sale"}
                          </button>
                        )}
                        {onExportGuests && (
                          <button
                            type="button"
                            onClick={() => onExportGuests(departure.id)}
                            className="op-departure-table__button-43 op-departure-table__button-7"
                            title="Xuất file CSV danh sách khách"
                          >
                            <span className="material-symbols-outlined op-departure-table__span-44">download</span>
                            Xuất CSV
                          </button>
                        )}
                        {onCancelDeparture && departure.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => onCancelDeparture(departure)}
                            className="op-departure-table__button-45 op-departure-table__button-8"
                            title="Huỷ đợt khởi hành này"
                          >
                            <span className="material-symbols-outlined op-departure-table__span-46">event_busy</span>
                            Huỷ đợt
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
