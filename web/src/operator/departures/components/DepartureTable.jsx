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
      <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center shadow-2xs">
        <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-zinc-400">
          <span className="material-symbols-outlined text-2xl">event_busy</span>
        </div>
        <h4 className="text-base font-semibold text-zinc-900 mb-1">Chưa có đợt khởi hành nào</h4>
        <p className="text-sm text-zinc-500 max-w-sm mx-auto">
          Tour này hiện chưa mở ngày khởi hành nào. Hãy bấm &quot;Mở đợt&quot; để thiết lập ngày chạy và giá bán.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden shadow-2xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/75 text-xs font-semibold text-zinc-600 uppercase tracking-wider">
              <th className="py-3 px-4">Ngày khởi hành</th>
              <th className="py-3 px-4">Giá bán hiệu lực</th>
              <th className="py-3 px-4">Tình trạng chỗ</th>
              <th className="py-3 px-4">Quy mô đoàn</th>
              <th className="py-3 px-4">Trạng thái</th>
              <th className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/80">
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
                <tr key={departure.id} className="hover:bg-zinc-50/60 transition-colors">
                  {/* Ngày khởi hành */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-zinc-900">{date(departure.depart_date)}</div>
                    {weekday && (
                      <div className="text-xs text-zinc-500 capitalize">{weekday}</div>
                    )}
                  </td>

                  {/* Giá bán & Giá gốc */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-baseline gap-1.5 flex-wrap">
                      <span className="font-bold text-zinc-900">
                        {money(departure.effective_price || departure.sale_price || departure.list_price)}
                      </span>
                      {isSale && discountPct > 0 && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          -{discountPct}%
                        </span>
                      )}
                    </div>
                    {isSale && departure.list_price && (
                      <div className="text-xs text-zinc-600 line-through">
                        Gốc: {money(departure.list_price)}
                      </div>
                    )}
                  </td>

                  {/* Chỗ ngồi */}
                  <td className="py-3.5 px-4 min-w-[150px]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-zinc-700">
                        {soldSeats}/{totalSeats} chỗ
                      </span>
                      <span className={departure.seats_left === 0 ? "font-bold text-rose-600" : "text-zinc-500"}>
                        {departure.seats_left === 0 ? "Hết chỗ" : `Còn ${departure.seats_left} chỗ`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden border border-zinc-200/50">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          fillPct >= 90 ? "bg-rose-500" : fillPct >= 50 ? "bg-amber-500" : "bg-zinc-800"
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </td>

                  {/* Quy mô đoàn */}
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      <span className="material-symbols-outlined text-xs">group</span>
                      Tối thiểu {departure.min_pax || 1} khách
                    </span>
                  </td>

                  {/* Trạng thái */}
                  <td className="py-3.5 px-4">
                    <StatusTag value={departure.status} />
                  </td>

                  {/* Thao tác */}
                  <td className="py-3.5 px-4 text-right">
                    {renderActions ? (
                      renderActions(departure)
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        {onEditSale && (
                          <button
                            type="button"
                            onClick={() => onEditSale(departure)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-2xs"
                            title="Đặt hoặc sửa giá khuyến mãi"
                          >
                            <span className="material-symbols-outlined text-sm">percent</span>
                            {isSale ? "Sửa sale" : "Đặt sale"}
                          </button>
                        )}
                        {onExportGuests && (
                          <button
                            type="button"
                            onClick={() => onExportGuests(departure.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900 transition-colors shadow-2xs"
                            title="Xuất file CSV danh sách khách"
                          >
                            <span className="material-symbols-outlined text-sm">download</span>
                            Xuất CSV
                          </button>
                        )}
                        {onCancelDeparture && departure.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => onCancelDeparture(departure)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300 transition-colors shadow-2xs"
                            title="Huỷ đợt khởi hành này"
                          >
                            <span className="material-symbols-outlined text-sm">event_busy</span>
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
