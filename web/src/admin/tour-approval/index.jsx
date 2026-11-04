import { useCallback, useEffect, useState } from "react";

import { api } from "../../shared/api";
import Toast from "../../shared/common/Toast";
import "../../shared/bento/BentoDashboard.css";
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
            <table className="bento-table">
              <thead>
                <tr>
                  <th>Tour & Điểm Đến</th>
                  <th>Nhà Điều Hành</th>
                  <th>Trạng Thái</th>
                  <th>Thời Lượng</th>
                  <th>Gửi Ngày</th>
                  <th>Thao Tác</th>
                </tr>
              </thead>
              <tbody>
                {tours.map((tour) => (
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
                          <div
                            style={{ fontWeight: "700", color: "var(--bento-text-dark)", cursor: "pointer" }}
                            onClick={() => setXemTourId(tour.id)}
                          >
                            {tour.name}
                          </div>
                          {tour.summary && (
                            <div style={{ fontSize: "11px", color: "var(--bento-text-muted)", marginTop: "2px" }}>
                              {tour.summary}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: "600" }}>
                      {tour.company_name || "—"}
                    </td>
                    <td>
                      <span className="pill pill-lime">
                        CHỜ DUYỆT
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--bento-font-mono)", fontWeight: "800", color: "var(--bento-text-dark)" }}>
                      {tour.duration_days} ngày
                    </td>
                    <td style={{ fontSize: "12px", color: "#64748b" }}>
                      {ngay(tour.created_at)}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => setXemTourId(tour.id)}
                          title="Xem toàn bộ thông tin chi tiết tour"
                          aria-label="Chi tiết tour"
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
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>visibility</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => duyet(tour)}
                          title="Phê duyệt tour"
                          aria-label="Duyệt tour"
                          style={{
                            width: "32px",
                            height: "32px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "6px",
                            border: "none",
                            background: "#0f172a",
                            color: "#ffffff",
                            cursor: "pointer",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDangTuChoi((prev) => (prev === tour.id ? null : tour.id));
                            setLyDo("");
                            setLoiLyDo("");
                          }}
                          title="Từ chối tour"
                          aria-label="Từ chối tour"
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
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>close</span>
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
