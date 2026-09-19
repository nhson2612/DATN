import { useCallback, useEffect, useState } from "react";

import { api } from "../../shared/api";
import Toast from "../../shared/common/Toast";
import AdminTourDetailModal from "./AdminTourDetailModal";
import "./TourApproval.css";

const ngay = (v) => (v ? new Date(v).toLocaleDateString("vi-VN") : "—");

/** UC-AD02 — hàng đợi tour chờ duyệt: duyệt hoặc từ chối kèm lý do. */
export default function TourApproval() {
  const [tours, setTours] = useState(null);
  const [loi, setLoi] = useState("");
  const [bao, setBao] = useState("");
  const [dangTuChoi, setDangTuChoi] = useState(null);
  const [lyDo, setLyDo] = useState("");
  const [loiLyDo, setLoiLyDo] = useState("");
  const [xemTourId, setXemTourId] = useState(null);

  const taiLai = useCallback(() => {
    api
      .adminToursChoDuyet()
      .then((data) => setTours(data.tours || []))
      .catch((error) => {
        setLoi(error.message);
        setTours([]);
      });
  }, []);

  useEffect(() => {
    taiLai();
  }, [taiLai]);

  const duyet = async (tour) => {
    setLoi("");
    setBao("");
    try {
      await api.adminDuyetTour(tour.id);
      setBao(`Đã duyệt tour "${tour.name}", tour đã được phát hành.`);
      setXemTourId(null);
      taiLai();
    } catch (error) {
      setLoi(error.message);
    }
  };

  const tuChoiVoiLyDo = async (tour, lyDoGui) => {
    const lyDoTrim = (lyDoGui || "").trim();
    if (!lyDoTrim) {
      setLoi("Vui lòng nhập lý do từ chối để nhà điều hành biết và chỉnh sửa.");
      return;
    }
    setLoi("");
    setBao("");
    try {
      await api.adminTuChoiTour(tour.id, lyDoTrim);
      setBao(`Đã từ chối tour "${tour.name}".`);
      setDangTuChoi(null);
      setLyDo("");
      setLoiLyDo("");
      setXemTourId(null);
      taiLai();
    } catch (error) {
      setLoi(error.message);
    }
  };

  const tuChoi = async (tour) => {
    if (!lyDo.trim()) {
      setLoiLyDo("Vui lòng nhập lý do từ chối để nhà điều hành biết và chỉnh sửa.");
      return;
    }
    await tuChoiVoiLyDo(tour, lyDo);
  };

  return (
    <div className="space-y-4">
      {/* Toast thông báo */}
      {bao && <Toast message={bao} onClose={() => setBao("")} />}
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}

      {tours === null ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center shadow-xs">
          <p className="text-zinc-500 text-sm">Đang tải danh sách tour chờ duyệt...</p>
        </div>
      ) : tours.length === 0 ? (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-2xl">verified</span>
          </div>
          <h3 className="text-base font-semibold text-zinc-900">Không có tour nào chờ duyệt</h3>
          <p className="text-xs text-zinc-500 mt-1">
            Tất cả yêu cầu phê duyệt tour từ các nhà điều hành đã được xử lý xong.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[280px]">Tour</th>
                  <th className="py-3 px-4 min-w-[160px]">Nhà điều hành</th>
                  <th className="py-3 px-4 min-w-[110px] hidden sm:table-cell">Thời lượng</th>
                  <th className="py-3 px-4 min-w-[110px] hidden md:table-cell">Gửi ngày</th>
                  <th className="py-3 px-4 text-right min-w-[180px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {tours.map((tour) => (
                  <tr key={tour.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3.5 px-4 align-top">
                      <button
                        type="button"
                        onClick={() => setXemTourId(tour.id)}
                        className="text-left group cursor-pointer block"
                        title="Bấm để xem toàn bộ thông tin chi tiết tour"
                      >
                        <span className="tour-duyet__ten text-zinc-900 font-semibold group-hover:text-blue-600 transition-colors">
                          {tour.name}
                        </span>
                      </button>
                      {tour.summary && (
                        <span className="tour-duyet__tom-tat text-zinc-500 text-xs line-clamp-2">
                          {tour.summary}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 align-middle font-medium text-zinc-800">
                      {tour.company_name || "—"}
                    </td>
                    <td className="py-3.5 px-4 align-middle hidden sm:table-cell text-zinc-600 text-xs">
                      {tour.duration_days} ngày
                    </td>
                    <td className="py-3.5 px-4 align-middle hidden md:table-cell text-zinc-500 text-xs tabular-nums">
                      {ngay(tour.created_at)}
                    </td>
                    <td className="py-3.5 px-4 align-middle text-right">
                      <div className="tour-duyet__thao-tac">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
                          onClick={() => setXemTourId(tour.id)}
                          title="Xem toàn bộ thông tin chi tiết tour"
                        >
                          <span className="material-symbols-outlined text-sm">visibility</span>
                          <span>Chi tiết</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer"
                          onClick={() => duyet(tour)}
                        >
                          <span className="material-symbols-outlined text-sm">check</span>
                          <span>Duyệt</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-zinc-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-zinc-700 text-xs font-medium rounded-lg transition-colors cursor-pointer"
                          onClick={() => {
                            setDangTuChoi((prev) => (prev === tour.id ? null : tour.id));
                            setLyDo("");
                            setLoiLyDo("");
                          }}
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                          <span>Từ chối</span>
                        </button>
                      </div>

                      {dangTuChoi === tour.id && (
                        <div className="mt-3 p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-left">
                          <p className="text-xs font-semibold text-zinc-700 mb-1.5">Lý do từ chối tour:</p>
                          <div className="flex gap-2">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Ví dụ: Hình ảnh chưa rõ ràng, lịch trình thiếu điểm..."
                              value={lyDo}
                              onChange={(event) => setLyDo(event.target.value)}
                              className="flex-1 bg-white border border-zinc-200 rounded-md px-3 py-1.5 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900"
                            />
                            <button
                              type="button"
                              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shrink-0"
                              onClick={() => tuChoi(tour)}
                            >
                              Xác nhận từ chối
                            </button>
                            <button
                              type="button"
                              className="px-2.5 py-1.5 bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-600 text-xs font-medium rounded-md transition-colors cursor-pointer shrink-0"
                              onClick={() => setDangTuChoi(null)}
                            >
                              Đóng
                            </button>
                          </div>
                          {loiLyDo && <span className="tour-duyet__ly-do-loi">{loiLyDo}</span>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal xem chi tiết tour của Admin */}
      {xemTourId && (
        <AdminTourDetailModal
          tourId={xemTourId}
          onClose={() => setXemTourId(null)}
          onApprove={duyet}
          onReject={tuChoiVoiLyDo}
        />
      )}
    </div>
  );
}
