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
      className="tour-approval-modal__div-1"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="tour-approval-modal__div-2 tour-approval-modal__div-1">
        {/* Modal Header */}
        <div className="tour-approval-modal__div-3">
          <div className="tour-approval-modal__div-4">
            <div className="tour-approval-modal__div-5 tour-approval-modal__div-2">
              <span className="material-symbols-outlined tour-approval-modal__span-6">travel_explore</span>
            </div>
            <div className="tour-approval-modal__div-7">
              <div className="tour-approval-modal__div-8">
                <h3 className="tour-approval-modal__text-9">
                  {tour?.name || "Chi tiết tour chờ duyệt"}
                </h3>
                <span className="tour-approval-modal__span-10 tour-approval-modal__span-3">
                  <span className="tour-approval-modal__span-11" />
                  Chờ duyệt
                </span>
              </div>
              <p className="tour-approval-modal__text-12">
                Nhà điều hành: <strong className="tour-approval-modal__text-13">{tour?.operator_name || tour?.company_name || "—"}</strong>
                {tour?.province_name && <span> • Điểm đến: <strong className="tour-approval-modal__text-14">{tour.province_name}</strong></span>}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tour-approval-modal__button-15 tour-approval-modal__button-4"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined tour-approval-modal__span-16">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="tour-approval-modal__div-17">
          {dangTai ? (
            <div className="tour-approval-modal__div-18">
              <span className="material-symbols-outlined tour-approval-modal__span-19">progress_activity</span>
              <p className="tour-approval-modal__text-20">Đang tải toàn bộ thông tin tour...</p>
            </div>
          ) : loi ? (
            <div className="tour-approval-modal__div-21 tour-approval-modal__div-5">
              {loi}
            </div>
          ) : !tour ? (
            <div className="tour-approval-modal__div-22">
              Không tìm thấy dữ liệu tour.
            </div>
          ) : (
            <>
              {/* Thống kê nhanh */}
              <div className="tour-approval-modal__div-23">
                <div className="tour-approval-modal__div-24 tour-approval-modal__div-6">
                  <span className="tour-approval-modal__span-25">Thời lượng</span>
                  <span className="tour-approval-modal__span-26">
                    <span className="material-symbols-outlined tour-approval-modal__span-27">schedule</span>
                    {tour.duration_days} ngày
                  </span>
                </div>
                <div className="tour-approval-modal__div-28 tour-approval-modal__div-7">
                  <span className="tour-approval-modal__span-29">Tỉnh / Thành</span>
                  <span className="tour-approval-modal__span-30">
                    <span className="material-symbols-outlined tour-approval-modal__span-31">location_on</span>
                    {tour.province_name || "—"}
                  </span>
                </div>
                <div className="tour-approval-modal__div-32 tour-approval-modal__div-8">
                  <span className="tour-approval-modal__span-33">Giá khởi điểm</span>
                  <span className="tour-approval-modal__span-34">
                    <span className="material-symbols-outlined tour-approval-modal__span-35">payments</span>
                    {tour.price_from ? `${Number(tour.price_from).toLocaleString("vi-VN")}₫` : "Chưa đặt"}
                  </span>
                </div>
                <div className="tour-approval-modal__div-36 tour-approval-modal__div-9">
                  <span className="tour-approval-modal__span-37">Ngày gửi</span>
                  <span className="tour-approval-modal__span-38">
                    <span className="material-symbols-outlined tour-approval-modal__span-39">event</span>
                    {dinhDangNgay(tour.created_at)}
                  </span>
                </div>
              </div>

              {/* Hình ảnh */}
              <div className="tour-approval-modal__div-40">
                <h4 className="tour-approval-modal__text-41">
                  <span className="material-symbols-outlined tour-approval-modal__span-42">photo_library</span>
                  Hình ảnh tour ({images.length + (tour.cover_url ? 1 : 0)} ảnh)
                </h4>
                <div className="tour-approval-modal__div-43">
                  {tour.cover_url && (
                    <div className="tour-approval-modal__div-44 tour-approval-modal__div-10">
                      <img
                        src={tour.cover_url}
                        alt="Ảnh bìa"
                        className="tour-approval-modal__img-45"
                      />
                      <span className="tour-approval-modal__span-46">
                        Ảnh bìa chính
                      </span>
                    </div>
                  )}
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className="tour-approval-modal__div-47 tour-approval-modal__div-11"
                    >
                      <img
                        src={img}
                        alt={`Ảnh phụ ${idx + 1}`}
                        className="tour-approval-modal__img-48"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Tóm tắt & Điểm nổi bật */}
              <div className="tour-approval-modal__div-49">
                <h4 className="tour-approval-modal__text-50">
                  <span className="material-symbols-outlined tour-approval-modal__span-51">description</span>
                  Mô tả &amp; Điểm nổi bật
                </h4>
                {tour.summary && (
                  <div className="tour-approval-modal__div-52 tour-approval-modal__div-12">
                    {tour.summary}
                  </div>
                )}
                {highlights.length > 0 && (
                  <div className="tour-approval-modal__div-53">
                    <span className="tour-approval-modal__span-54">Điểm nhấn chuyến đi:</span>
                    <ul className="tour-approval-modal__ul-55">
                      {highlights.map((hl, idx) => (
                        <li
                          key={idx}
                          className="tour-approval-modal__li-56 tour-approval-modal__li-13"
                        >
                          <span className="material-symbols-outlined tour-approval-modal__span-57 tour-approval-modal__span-14">star</span>
                          <span>{hl}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {tour.description && (
                  <div className="tour-approval-modal__div-58">
                    <span className="tour-approval-modal__span-59">Mô tả chi tiết:</span>
                    <p className="tour-approval-modal__text-60 tour-approval-modal__text-15">
                      {tour.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Lịch trình chi tiết */}
              <div className="tour-approval-modal__div-61">
                <h4 className="tour-approval-modal__text-62">
                  <span className="material-symbols-outlined tour-approval-modal__span-63">route</span>
                  Lịch trình chi tiết ({itinerary.length} ngày)
                </h4>
                {itinerary.length === 0 ? (
                  <p className="tour-approval-modal__text-64">Chưa có lịch trình chi tiết.</p>
                ) : (
                  <div className="tour-approval-modal__div-65">
                    {itinerary.map((day, dIdx) => (
                      <div
                        key={dIdx}
                        className="tour-approval-modal__div-66 tour-approval-modal__div-16"
                      >
                        <div className="tour-approval-modal__div-67">
                          <span className="tour-approval-modal__span-68">
                            Ngày {dIdx + 1}
                          </span>
                          <h5 className="tour-approval-modal__h5-69">
                            {day.title || `Hành trình ngày ${dIdx + 1}`}
                          </h5>
                        </div>

                        {day.description && (
                          <p className="tour-approval-modal__text-70">{day.description}</p>
                        )}

                        {/* Điểm tham quan / Timeline */}
                        {((day.places && day.places.length > 0) || (day.timeline && day.timeline.length > 0)) && (
                          <div className="tour-approval-modal__div-71">
                            <span className="tour-approval-modal__span-72">
                              Các điểm đến &amp; hoạt động:
                            </span>
                            <div className="tour-approval-modal__div-73">
                              {(day.places || []).map((place, pIdx) => (
                                <div
                                  key={pIdx}
                                  className="tour-approval-modal__div-74 tour-approval-modal__div-17"
                                >
                                  {place.anh ? (
                                    <img
                                      src={place.anh}
                                      alt={place.name}
                                      className="tour-approval-modal__img-75 tour-approval-modal__img-18"
                                    />
                                  ) : (
                                    <div className="tour-approval-modal__div-76 tour-approval-modal__div-19">
                                      <span className="material-symbols-outlined tour-approval-modal__span-77">pin_drop</span>
                                    </div>
                                  )}
                                  <div className="tour-approval-modal__div-78">
                                    <strong className="tour-approval-modal__text-79">
                                      {place.name}
                                    </strong>
                                    {place.dia_chi && (
                                      <span className="tour-approval-modal__span-80">
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
              <div className="tour-approval-modal__div-81">
                <div className="tour-approval-modal__div-82">
                  <h4 className="tour-approval-modal__text-83">
                    <span className="material-symbols-outlined tour-approval-modal__span-84">check_circle</span>
                    Dịch vụ bao gồm ({included.length})
                  </h4>
                  {included.length > 0 ? (
                    <ul className="tour-approval-modal__ul-85">
                      {included.map((item, idx) => (
                        <li
                          key={idx}
                          className="tour-approval-modal__li-86 tour-approval-modal__li-20"
                        >
                          <span className="material-symbols-outlined tour-approval-modal__span-87 tour-approval-modal__span-21">check</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="tour-approval-modal__text-88">Chưa nhập dịch vụ bao gồm.</p>
                  )}
                </div>

                <div className="tour-approval-modal__div-89">
                  <h4 className="tour-approval-modal__text-90">
                    <span className="material-symbols-outlined tour-approval-modal__span-91">cancel</span>
                    Dịch vụ không bao gồm ({excluded.length})
                  </h4>
                  {excluded.length > 0 ? (
                    <ul className="tour-approval-modal__ul-92">
                      {excluded.map((item, idx) => (
                        <li
                          key={idx}
                          className="tour-approval-modal__li-93 tour-approval-modal__li-22"
                        >
                          <span className="material-symbols-outlined tour-approval-modal__span-94 tour-approval-modal__span-23">close</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="tour-approval-modal__text-95">Chưa nhập dịch vụ không bao gồm.</p>
                  )}
                </div>
              </div>

              {/* Chính sách hủy hoàn tiền */}
              <div className="tour-approval-modal__div-96">
                <h4 className="tour-approval-modal__text-97">
                  <span className="material-symbols-outlined tour-approval-modal__span-98">policy</span>
                  Chính sách hủy hoàn tiền ({cancellationPolicy.length} mốc)
                </h4>
                {cancellationPolicy.length > 0 ? (
                  <div className="tour-approval-modal__div-99 tour-approval-modal__div-24">
                    <table className="tour-approval-modal__table-100">
                      <thead className="tour-approval-modal__thead-101">
                        <tr>
                          <th className="tour-approval-modal__th-102">Thời gian hủy trước khởi hành</th>
                          <th className="tour-approval-modal__th-103">Tỷ lệ hoàn tiền</th>
                        </tr>
                      </thead>
                      <tbody className="tour-approval-modal__refund-body">
                        {cancellationPolicy.map((p, idx) => (
                          <tr key={idx}>
                            <td className="tour-approval-modal__td-104">
                              Từ {p.days_before} ngày trở lên
                            </td>
                            <td className="tour-approval-modal__td-105">
                              {p.refund_percent}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="tour-approval-modal__text-106">Chưa thiết lập mốc hoàn tiền.</p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="tour-approval-modal__div-107">
          {dangMoTuChoi && (
            <div className="tour-approval-modal__div-108 tour-approval-modal__div-25">
              <label className="tour-approval-modal__label-109">
                Lý do từ chối phê duyệt tour:
              </label>
              <div className="tour-approval-modal__div-110">
                <input
                  autoFocus
                  type="text"
                  placeholder="Ví dụ: Hình ảnh chưa rõ nét, lịch trình thiếu điểm đón..."
                  value={lyDoTuChoi}
                  onChange={(e) => {
                    setLyDoTuChoi(e.target.value);
                    setLoiLyDo("");
                  }}
                  className="tour-approval-modal__element-111 tour-approval-modal__element-26"
                />
                <button
                  type="button"
                  disabled={dangXuLy}
                  onClick={handleReject}
                  className="tour-approval-modal__button-112 tour-approval-modal__button-27"
                >
                  {dangXuLy ? "Đang xử lý..." : "Xác nhận từ chối"}
                </button>
                <button
                  type="button"
                  onClick={() => setDangMoTuChoi(false)}
                  className="tour-approval-modal__button-113 tour-approval-modal__button-28"
                >
                  Hủy
                </button>
              </div>
              {loiLyDo && <span className="tour-approval-modal__span-114">{loiLyDo}</span>}
            </div>
          )}

          <div className="tour-approval-modal__div-115">
            <button
              type="button"
              onClick={onClose}
              className="tour-approval-modal__button-116 tour-approval-modal__button-29"
            >
              Đóng
            </button>

            <div className="tour-approval-modal__div-117">
              {!dangMoTuChoi && (
                <button
                  type="button"
                  disabled={dangXuLy || !tour}
                  onClick={() => {
                    setDangMoTuChoi(true);
                    setLyDoTuChoi("");
                    setLoiLyDo("");
                  }}
                  className="tour-approval-modal__element-118 tour-approval-modal__element-30"
                >
                  <span className="material-symbols-outlined tour-approval-modal__span-119">close</span>
                  <span>Từ chối tour</span>
                </button>
              )}

              <button
                type="button"
                disabled={dangXuLy || !tour}
                onClick={handleApprove}
                className="tour-approval-modal__button-120"
              >
                <span className="material-symbols-outlined tour-approval-modal__span-121">check_circle</span>
                <span>{dangXuLy ? "Đang duyệt..." : "Duyệt & Phát hành tour"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
