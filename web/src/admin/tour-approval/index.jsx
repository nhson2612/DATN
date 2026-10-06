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
    <div className="admin-approval">
      {/* Toast thông báo */}
      {bao && <Toast message={bao} onClose={() => setBao("")} />}
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}

      {tours === null ? (
        <div className="tour-approval__div-2 tour-approval__div-1">
          <p className="tour-approval__text-3">Đang tải danh sách tour chờ duyệt...</p>
        </div>
      ) : tours.length === 0 ? (
        <div className="tour-approval__div-4 tour-approval__div-2">
          <div className="tour-approval__div-5">
            <span className="material-symbols-outlined tour-approval__span-6">verified</span>
          </div>
          <h3 className="tour-approval__text-7">Không có tour nào chờ duyệt</h3>
          <p className="tour-approval__text-8">
            Tất cả yêu cầu phê duyệt tour từ các nhà điều hành đã được xử lý xong.
          </p>
        </div>
      ) : (
        <div className="admin-data-card admin-approval__results">
          <div className="admin-data-card__scroll">
            <table className="admin-data-table tour-approval__table-11">
              <thead>
                <tr className="tour-approval__tr-12">
                  <th className="tour-approval__th-13">Tour</th>
                  <th className="tour-approval__th-14">Nhà điều hành</th>
                  <th className="tour-approval__th-15">Thời lượng</th>
                  <th className="tour-approval__th-16">Gửi ngày</th>
                  <th className="tour-approval__th-17">Thao tác</th>
                </tr>
              </thead>
              <tbody className="tour-approval__table-body">
                {tours.map((tour) => (
                  <tr key={tour.id} className="tour-approval__tr-18">
                    <td className="tour-approval__td-19">
                      <button
                        type="button"
                        onClick={() => setXemTourId(tour.id)}
                        className="tour-approval__button-20"
                        title="Bấm để xem toàn bộ thông tin chi tiết tour"
                      >
                        <span className="tour-duyet__ten tour-approval__span-21">
                          {tour.name}
                        </span>
                      </button>
                      {tour.summary && (
                        <span className="tour-duyet__tom-tat tour-approval__span-22">
                          {tour.summary}
                        </span>
                      )}
                    </td>
                    <td className="tour-approval__td-23">
                      {tour.company_name || "—"}
                    </td>
                    <td className="tour-approval__td-24">
                      {tour.duration_days} ngày
                    </td>
                    <td className="tour-approval__td-25">
                      {ngay(tour.created_at)}
                    </td>
                    <td className="tour-approval__td-26">
                      <div className="tour-duyet__thao-tac">
                        <button
                          type="button"
                          className="tour-approval__button-27 tour-approval__button-4"
                          onClick={() => setXemTourId(tour.id)}
                          title="Xem toàn bộ thông tin chi tiết tour"
                        >
                          <span className="material-symbols-outlined tour-approval__span-28">visibility</span>
                          <span>Chi tiết</span>
                        </button>
                        <button
                          type="button"
                          className="tour-approval__button-29"
                          onClick={() => duyet(tour)}
                        >
                          <span className="material-symbols-outlined tour-approval__span-30">check</span>
                          <span>Duyệt</span>
                        </button>
                        <button
                          type="button"
                          className="tour-approval__button-31 tour-approval__button-5"
                          onClick={() => {
                            setDangTuChoi((prev) => (prev === tour.id ? null : tour.id));
                            setLyDo("");
                            setLoiLyDo("");
                          }}
                        >
                          <span className="material-symbols-outlined tour-approval__span-32">close</span>
                          <span>Từ chối</span>
                        </button>
                      </div>

                      {dangTuChoi === tour.id && (
                        <div className="tour-approval__div-33 tour-approval__div-6">
                          <p className="tour-approval__text-34">Lý do từ chối tour:</p>
                          <div className="tour-approval__div-35">
                            <input
                              autoFocus
                              type="text"
                              placeholder="Ví dụ: Hình ảnh chưa rõ ràng, lịch trình thiếu điểm..."
                              value={lyDo}
                              onChange={(event) => setLyDo(event.target.value)}
                              className="tour-approval__element-36 tour-approval__element-7"
                            />
                            <button
                              type="button"
                              className="tour-approval__button-37 tour-approval__button-8"
                              onClick={() => tuChoi(tour)}
                            >
                              Xác nhận từ chối
                            </button>
                            <button
                              type="button"
                              className="tour-approval__button-38 tour-approval__button-9"
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
