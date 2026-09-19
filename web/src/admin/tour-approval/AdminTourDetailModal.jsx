import { useEffect, useState } from "react";
import { api } from "../../shared/api";

const dinhDangNgay = (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "—");

export default function AdminTourDetailModal({ tourId, onClose, onApprove, onReject }) {
  const [tour, setTour] = useState(null);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");

  const [dangMoTuChoi, setDangMoTuChoi] = useState(false);
  const [lyDoTuChoi, setLyDoTuChoi] = useState("");
  const [loiLyDo, setLoiLyDo] = useState("");
  const [dangXuLy, setDangXuLy] = useState(false);

  useEffect(() => {
    let daHuy = false;
    if (!tourId) return undefined;

    setDangTai(true);
    setLoi("");
    api
      .operatorTour(tourId)
      .then((data) => {
        if (!daHuy) {
          setTour(data.tour || null);
          setDangTai(false);
        }
      })
      .catch((err) => {
        if (!daHuy) {
          setLoi(err.message || "Không thể tải chi tiết tour.");
          setDangTai(false);
        }
      });

    return () => {
      daHuy = true;
    };
  }, [tourId]);

  // Đóng modal khi nhấn ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!tourId) return null;

  const handleApprove = async () => {
    if (!tour) return;
    setDangXuLy(true);
    try {
      await onApprove(tour);
    } finally {
      setDangXuLy(false);
    }
  };

  const handleReject = async () => {
    if (!lyDoTuChoi.trim()) {
      setLoiLyDo("Vui lòng nhập lý do từ chối để nhà điều hành biết và chỉnh sửa.");
      return;
    }
    setDangXuLy(true);
    try {
      await onReject(tour, lyDoTuChoi.trim());
    } finally {
      setDangXuLy(false);
    }
  };

  const itinerary = tour?.itinerary || [];
  const cancellationPolicy = tour?.cancellation_policy || [];
  const included = (tour?.included || []).filter(Boolean);
  const excluded = (tour?.excluded || []).filter(Boolean);
  const highlights = (tour?.highlights || []).filter(Boolean);
  const images = (tour?.images || []).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 bg-zinc-50/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-zinc-900 text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-lg">travel_explore</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-zinc-900 truncate">
                  {tour?.name || "Chi tiết tour chờ duyệt"}
                </h3>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Chờ duyệt
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate mt-0.5">
                Nhà điều hành: <strong className="text-zinc-700">{tour?.operator_name || tour?.company_name || "—"}</strong>
                {tour?.province_name && <span> • Điểm đến: <strong className="text-zinc-700">{tour.province_name}</strong></span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 p-1.5 rounded-lg hover:bg-zinc-200/60 transition-colors shrink-0 ml-2"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {dangTai ? (
            <div className="py-20 text-center text-zinc-500">
              <span className="material-symbols-outlined text-3xl animate-spin text-zinc-400">progress_activity</span>
              <p className="text-xs mt-2 font-medium">Đang tải toàn bộ thông tin tour...</p>
            </div>
          ) : loi ? (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
              {loi}
            </div>
          ) : !tour ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              Không tìm thấy dữ liệu tour.
            </div>
          ) : (
            <>
              {/* Thống kê nhanh */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                  <span className="text-[11px] font-medium text-zinc-400 block">Thời lượng</span>
                  <span className="text-sm font-bold text-zinc-900 mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base text-zinc-500">schedule</span>
                    {tour.duration_days} ngày
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                  <span className="text-[11px] font-medium text-zinc-400 block">Tỉnh / Thành</span>
                  <span className="text-sm font-bold text-zinc-900 mt-0.5 flex items-center gap-1 truncate">
                    <span className="material-symbols-outlined text-base text-zinc-500">location_on</span>
                    {tour.province_name || "—"}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                  <span className="text-[11px] font-medium text-zinc-400 block">Giá khởi điểm</span>
                  <span className="text-sm font-bold text-zinc-900 mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base text-zinc-500">payments</span>
                    {tour.price_from ? `${Number(tour.price_from).toLocaleString("vi-VN")}₫` : "Chưa đặt"}
                  </span>
                </div>
                <div className="p-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                  <span className="text-[11px] font-medium text-zinc-400 block">Ngày gửi</span>
                  <span className="text-sm font-bold text-zinc-900 mt-0.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-base text-zinc-500">event</span>
                    {dinhDangNgay(tour.created_at)}
                  </span>
                </div>
              </div>

              {/* Hình ảnh */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">photo_library</span>
                  Hình ảnh tour ({images.length + (tour.cover_url ? 1 : 0)} ảnh)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {tour.cover_url && (
                    <div className="relative rounded-xl overflow-hidden border border-zinc-200 group aspect-video sm:aspect-4/3 bg-zinc-100">
                      <img
                        src={tour.cover_url}
                        alt="Ảnh bìa"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs text-white text-[10px] font-semibold px-2 py-0.5 rounded-md">
                        Ảnh bìa chính
                      </span>
                    </div>
                  )}
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="relative rounded-xl overflow-hidden border border-zinc-200 group aspect-video sm:aspect-4/3 bg-zinc-100"
                    >
                      <img
                        src={img}
                        alt={`Ảnh phụ ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tóm tắt & Điểm nổi bật */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">description</span>
                  Mô tả &amp; Điểm nổi bật
                </h4>
                {tour.summary && (
                  <div className="p-3.5 bg-zinc-50 border border-zinc-200/80 rounded-xl text-xs text-zinc-700 leading-relaxed font-medium">
                    {tour.summary}
                  </div>
                )}
                {highlights.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-semibold text-zinc-700">Điểm nhấn chuyến đi:</span>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {highlights.map((hl, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 p-2 bg-amber-50/60 border border-amber-200/70 rounded-lg text-xs text-amber-950 font-medium"
                        >
                          <span className="material-symbols-outlined text-sm text-amber-600 shrink-0 mt-0.5">star</span>
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.description && (
                  <div className="space-y-1">
                    <span className="text-xs font-semibold text-zinc-700">Mô tả chi tiết:</span>
                    <p className="text-xs text-zinc-600 leading-relaxed whitespace-pre-line bg-zinc-50/50 p-3 rounded-xl border border-zinc-100">
                      {tour.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Lịch trình chi tiết */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">route</span>
                  Lịch trình chi tiết ({itinerary.length} ngày)
                </h4>
                {itinerary.length === 0 ? (
                  <p className="text-xs text-zinc-400 italic">Chưa có lịch trình chi tiết.</p>
                ) : (
                  <div className="space-y-3">
                    {itinerary.map((day, dIdx) => (
                      <div
                        key={dIdx}
                        className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/40 space-y-3 hover:border-zinc-300 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-zinc-900 text-white font-bold text-xs rounded-md">
                            Ngày {dIdx + 1}
                          </span>
                          <h5 className="text-xs font-bold text-zinc-900">
                            {day.title || `Hành trình ngày ${dIdx + 1}`}
                          </h5>
                        </div>

                        {day.description && (
                          <p className="text-xs text-zinc-600 leading-relaxed">{day.description}</p>
                        )}

                        {/* Điểm tham quan / Timeline */}
                        {((day.places && day.places.length > 0) || (day.timeline && day.timeline.length > 0)) && (
                          <div className="space-y-2 pt-1">
                            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                              Các điểm đến &amp; hoạt động:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {(day.places || []).map((place, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="flex items-center gap-2.5 p-2 bg-white border border-zinc-200 rounded-lg text-xs"
                                >
                                  {place.anh ? (
                                    <img
                                      src={place.anh}
                                      alt={place.name}
                                      className="w-10 h-10 rounded-md object-cover border border-zinc-100 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-md bg-zinc-100 flex items-center justify-center text-zinc-400 shrink-0">
                                      <span className="material-symbols-outlined text-base">pin_drop</span>
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <strong className="block text-zinc-900 font-semibold truncate">
                                      {place.name}
                                    </strong>
                                    {place.dia_chi && (
                                      <span className="block text-[11px] text-zinc-500 truncate">
                                        {place.dia_chi}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dịch vụ Bao gồm & Không bao gồm */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">check_circle</span>
                    Dịch vụ bao gồm ({included.length})
                  </h4>
                  {included.length > 0 ? (
                    <ul className="space-y-1.5">
                      {included.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-zinc-700 p-2 bg-emerald-50/50 border border-emerald-100 rounded-lg"
                        >
                          <span className="material-symbols-outlined text-sm text-emerald-600 shrink-0 mt-0.5">check</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">Chưa nhập dịch vụ bao gồm.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">cancel</span>
                    Dịch vụ không bao gồm ({excluded.length})
                  </h4>
                  {excluded.length > 0 ? (
                    <ul className="space-y-1.5">
                      {excluded.map((item, idx) => (
                        <li
                          key={idx}
                          className="flex items-start gap-2 text-xs text-zinc-700 p-2 bg-rose-50/50 border border-rose-100 rounded-lg"
                        >
                          <span className="material-symbols-outlined text-sm text-rose-600 shrink-0 mt-0.5">close</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-zinc-400 italic">Chưa nhập dịch vụ không bao gồm.</p>
                  )}
                </div>
              </div>

              {/* Chính sách hủy hoàn tiền */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base">policy</span>
                  Chính sách hủy hoàn tiền ({cancellationPolicy.length} mốc)
                </h4>
                {cancellationPolicy.length > 0 ? (
                  <div className="border border-zinc-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-50 text-zinc-500 font-semibold border-b border-zinc-200">
                        <tr>
                          <th className="py-2.5 px-4">Thời gian hủy trước khởi hành</th>
                          <th className="py-2.5 px-4 text-right">Tỷ lệ hoàn tiền</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {cancellationPolicy.map((p, idx) => (
                          <tr key={idx}>
                            <td className="py-2.5 px-4 text-zinc-700">
                              Từ {p.days_before} ngày trở lên
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-zinc-900">
                              {p.refund_percent}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">Chưa thiết lập mốc hoàn tiền.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-zinc-200 bg-zinc-50 flex flex-col gap-3">
          {dangMoTuChoi && (
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
              <label className="block text-xs font-bold text-rose-900">
                Lý do từ chối phê duyệt tour:
              </label>
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Ví dụ: Hình ảnh chưa rõ nét, lịch trình thiếu điểm đón..."
                  value={lyDoTuChoi}
                  onChange={(e) => {
                    setLyDoTuChoi(e.target.value);
                    setLoiLyDo("");
                  }}
                  className="flex-1 bg-white border border-rose-200 rounded-lg px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
                <button
                  type="button"
                  disabled={dangXuLy}
                  onClick={handleReject}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                >
                  {dangXuLy ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
                <button
                  type="button"
                  onClick={() => setDangMoTuChoi(false)}
                  className="px-2.5 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs font-medium rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Hủy
                </button>
              </div>
              {loiLyDo && <span className="text-[11px] font-medium text-rose-600">{loiLyDo}</span>}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-medium rounded-xl transition-colors cursor-pointer"
            >
              Đóng
            </button>

            <div className="flex items-center gap-2">
              {!dangMoTuChoi && (
                <button
                  type="button"
                  disabled={dangXuLy || !tour}
                  onClick={() => {
                    setDangMoTuChoi(true);
                    setLyDoTuChoi("");
                    setLoiLyDo("");
                  }}
                  className="inline-flex items-center gap-1 px-3.5 py-2 bg-white border border-zinc-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-zinc-700 text-xs font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                  <span>Từ chối tour</span>
                </button>
              )}

              <button
                type="button"
                disabled={dangXuLy || !tour}
                onClick={handleApprove}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>{dangXuLy ? "Đang duyệt..." : "Duyệt & Phát hành tour"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
