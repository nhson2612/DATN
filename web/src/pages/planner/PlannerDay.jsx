import { useMemo, useState } from "react";
import PlannerLodgingPicker from "./PlannerLodgingPicker";
import PlannerPlacePicker from "./PlannerPlacePicker";
import {
  dongPhu,
  mauTheoNgay,
  nhanNgay,
  tinhKhoangCachKm,
  uocTinhThoiGian,
} from "./plannerUtils";
import "./PlannerDay.css";

/**
 * Component hiển thị một ngày trong lịch trình (thẻ ngày, timeline dọc, accordion)
 */
export default function PlannerDay({
  ngay,
  startDate,
  diemDen,
  ds = [],
  choNgu,
  chuaXep = [],
  isExpanded = true,
  onToggleExpand,
  onHover,
  onXep,
  onBoNgay,
  onChuyen,
  onSapXepLai,
  onXem,
  onDatChoNgu,
  onBoChoNgu,
  onToiUu,
  dangLuu,
  toiUu,
  onVeDuong,
  dangVe,
  duong,
}) {
  const [keo, setKeo] = useState(false);
  const [moChon, setMoChon] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const mauNgay = useMemo(() => mauTheoNgay(ngay), [ngay]);

  // Tính tổng quãng đường ước tính giữa các điểm dừng
  const tongKmUocTinh = useMemo(() => {
    if (duong?.met) {
      return (duong.met / 1000).toFixed(1);
    }
    if (toiUu?.sau_m) {
      return (toiUu.sau_m / 1000).toFixed(1);
    }
    let tong = 0;
    for (let i = 0; i < ds.length - 1; i++) {
      const d = tinhKhoangCachKm(ds[i], ds[i + 1]);
      if (d) tong += d;
    }
    return tong > 0 ? tong.toFixed(1) : null;
  }, [ds, duong, toiUu]);

  const handleDragStart = (e, s, index) => {
    setDraggingIndex(index);
    setDragOverIndex(null);
    const card = e.currentTarget.closest(".planner-day__stop-card");
    if (card && e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(card, 20, 20);
    }
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({
        source: "day-reorder",
        day: ngay,
        index,
        stop: { type: s.type, id: s.id },
      })
    );
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
    setDragOverIndex(null);
  };

  const handleCardDragOver = (e, index) => {
    if (draggingIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleCardDragLeave = (e, index) => {
    if (draggingIndex === null) return;
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverIndex === index) {
        setDragOverIndex(null);
      }
    }
  };

  const handleCardDrop = (e, targetIndex) => {
    if (draggingIndex === null) return;
    e.preventDefault();
    e.stopPropagation();
    const sourceIndex = draggingIndex;
    setDraggingIndex(null);
    setDragOverIndex(null);

    if (sourceIndex === targetIndex) return;

    const sourceStop = ds[sourceIndex];
    if (sourceStop && onSapXepLai) {
      onSapXepLai(sourceStop, targetIndex);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setKeo(false);
    setDraggingIndex(null);
    setDragOverIndex(null);
    try {
      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.source === "day-reorder") return;
      onXep(d, ngay);
      if (!isExpanded && onToggleExpand) {
        onToggleExpand();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <section
      onMouseEnter={() => onHover && onHover(ngay)}
      onMouseLeave={() => onHover && onHover(null)}
      onDragOver={(e) => {
        if (draggingIndex !== null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setKeo(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) {
          setKeo(false);
        }
      }}
      onDrop={handleDrop}
      className={`planner-day ${
        isExpanded ? "planner-day--expanded" : "planner-day--collapsed"
      } ${keo ? "planner-day--drag-over" : ""}`}
    >
      {/* Header ngày */}
      <div
        className="planner-day__header"
        onClick={() => {
          if (!isExpanded && onToggleExpand) onToggleExpand();
        }}
      >
        <div className="planner-day__header-main">
          <div className="planner-day__header-title-row">
            <span
              className="planner-day__badge"
              style={{ backgroundColor: mauNgay }}
            >
              NGÀY {ngay}
            </span>
            <h3 className="planner-day__title">{nhanNgay(startDate, ngay)}</h3>
          </div>
          <p className="planner-day__meta">
            {ds.length} địa điểm
            {tongKmUocTinh && ` • Quãng đường: ~${tongKmUocTinh} km`}
            {choNgu ? ` • Nghỉ tại: ${choNgu.name}` : ""}
          </p>
        </div>

        <div
          className="planner-day__actions"
          onClick={(e) => e.stopPropagation()}
        >
          {isExpanded && ds.length >= 3 && (
            <button
              type="button"
              onClick={onToiUu}
              disabled={dangLuu}
              className="planner-day__action-btn"
              title="Sắp lại thứ tự cho đi ít đường nhất"
            >
              {dangLuu ? "Đang sắp tuyến..." : "Sắp tuyến tối ưu"}
            </button>
          )}

          {isExpanded && ds.length >= 2 && (
            <button
              type="button"
              onClick={onVeDuong}
              disabled={dangVe}
              className={`planner-day__action-btn ${
                duong ? "planner-day__action-btn--active" : ""
              }`}
              title="Tính đường bộ thật bằng OSRM / pgRouting"
            >
              {dangVe ? "Đang tính..." : duong ? "Đã vẽ đường" : "Đường bộ"}
            </button>
          )}

          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="planner-day__toggle-btn"
              title={isExpanded ? "Thu gọn ngày" : "Mở rộng chi tiết"}
            >
              <i
                className={`fa-solid ${
                  isExpanded ? "fa-chevron-up" : "fa-chevron-down"
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {/* Nội dung chi tiết chỉ hiện khi ngày đang mở */}
      {isExpanded && (
        <>
          {/* Thông báo kết quả tối ưu */}
          {toiUu && (
            <p className="planner-day__note">
              <i className="fa-solid fa-bolt" />
              <span>
                Đã tối ưu lộ trình: {(toiUu.truoc_m / 1000).toFixed(1)} km còn{" "}
                <b>{(toiUu.sau_m / 1000).toFixed(1)} km</b>{" "}
                <span className="planner-day__note-dim">(chim bay)</span>
              </span>
            </p>
          )}

          {/* Thông báo kết quả đường bộ thật */}
          {duong && (
            <p className="planner-day__note">
              <i className="fa-solid fa-route" />
              <span>
                Đường bộ di chuyển: <b>{(duong.met / 1000).toFixed(1)} km</b>{" "}
                <span className="planner-day__note-dim">
                  ({duong.isClosed ? "khép kín qua nơi nghỉ" : `${ds.length - 1} chặng`})
                </span>
              </span>
            </p>
          )}

          {/* Timeline các điểm dừng */}
          {ds.length === 0 ? (
            <p className="planner-day__empty">
              Chưa có địa điểm nào trong ngày này. Bạn có thể kéo thả điểm từ danh sách chờ hoặc bấm nút bên dưới.
            </p>
          ) : (
            <div className="planner-day__timeline">
              {ds.map((s, i) => {
                const tiepTheo = ds[i + 1];
                const kmChặng = tiepTheo ? tinhKhoangCachKm(s, tiepTheo) : null;
                const tgChặng = kmChặng ? uocTinhThoiGian(kmChặng) : null;
                const isDragging = draggingIndex === i;
                const isDropTarget =
                  dragOverIndex === i && draggingIndex !== null && draggingIndex !== i;

                return (
                  <div
                    key={`${s.type}-${s.id}`}
                    className={`flex flex-col gap-1 ${
                      isDragging ? "planner-day__stop-row--dragging" : ""
                    } ${isDropTarget ? "planner-day__stop-row--drop-target" : ""}`}
                  >
                    <div className="planner-day__stop-row">
                      {/* Vòng số đánh dấu màu theo ngày */}
                      <span
                        className="planner-day__marker"
                        style={{ backgroundColor: mauNgay }}
                      >
                        {i + 1}
                      </span>

                      {/* Thẻ điểm dừng */}
                      <div
                        className={`planner-day__stop-card ${
                          isDragging ? "planner-day__stop-card--dragging" : ""
                        } ${
                          isDropTarget ? "planner-day__stop-card--drop-target" : ""
                        }`}
                        onDragOver={(e) => handleCardDragOver(e, i)}
                        onDragLeave={(e) => handleCardDragLeave(e, i)}
                        onDrop={(e) => handleCardDrop(e, i)}
                      >
                        {/* Tay cầm kéo thả sắp xếp thứ tự */}
                        <div
                          role="button"
                          tabIndex={0}
                          className="planner-day__drag-handle"
                          draggable
                          onDragStart={(e) => handleDragStart(e, s, i)}
                          onDragEnd={handleDragEnd}
                          aria-label={`Kéo thả để sắp xếp ${s.name}`}
                          title="Kéo để sắp xếp lại thứ tự"
                        >
                          <i className="fa-solid fa-grip-vertical" />
                        </div>

                        <button
                          type="button"
                          onClick={() => onXem(s)}
                          className="planner-day__stop-main"
                          title="Xem trên bản đồ"
                        >
                          <span className="planner-day__stop-tag">
                            ĐIỂM DỪNG {i + 1}
                          </span>
                          <h4 className="planner-day__stop-name">{s.name}</h4>
                          {dongPhu(s) && (
                            <p className="planner-day__stop-desc">{dongPhu(s)}</p>
                          )}
                        </button>

                        <div className="planner-day__stop-tools">
                          <div className="planner-day__reorder">
                            <button
                              type="button"
                              onClick={() => onChuyen(s, -1)}
                              disabled={i === 0}
                              aria-label="Lên trước"
                              className="planner-day__reorder-btn"
                              title="Chuyển lên trước"
                            >
                              <i className="fa-solid fa-caret-up" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onChuyen(s, 1)}
                              disabled={i === ds.length - 1}
                              aria-label="Xuống sau"
                              className="planner-day__reorder-btn"
                              title="Chuyển xuống sau"
                            >
                              <i className="fa-solid fa-caret-down" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => onBoNgay(s)}
                            className="planner-day__remove-btn"
                            aria-label={`Bỏ ${s.name} khỏi Ngày ${ngay}`}
                            title="Bỏ khỏi ngày này (vẫn giữ trong mục)"
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Dòng khoảng cách giữa 2 điểm dừng liên tiếp */}
                    {tiepTheo && kmChặng != null && (
                      <div className="planner-day__distance-row">
                        <i className="fa-solid fa-arrow-down-long planner-day__distance-icon" />
                        <span className="planner-day__distance-text">
                          Di chuyển ~{kmChặng} km {tgChặng ? `• ${tgChặng} đi xe` : ""}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Component chỗ nghỉ đêm theo phong cách indigo của Interary.html */}
          <PlannerLodgingPicker
            ngay={ngay}
            ds={ds}
            choNgu={choNgu}
            diemDen={diemDen}
            onDat={onDatChoNgu}
            onBo={onBoChoNgu}
          />

          {/* Chọn thêm điểm dừng cho ngày */}
          {moChon ? (
            <div className="planner-day__picker-box">
              {chuaXep.length > 0 && (
                <>
                  <p className="planner-day__picker-label">
                    Chọn nhanh từ danh sách muốn đi:
                  </p>
                  <div className="planner-day__chips">
                    {chuaXep.map((s) => (
                      <button
                        key={`${s.type}-${s.id}`}
                        type="button"
                        onClick={() => {
                          onXep(s, ngay);
                          setMoChon(false);
                        }}
                        className="planner-day__chip"
                      >
                        + {s.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <PlannerPlacePicker
                diemDen={diemDen}
                nhan="Hoặc tìm địa điểm mới khác"
                placeholder="Nhập tên địa điểm, quán ăn muốn thêm..."
                moSan
                onChon={(p) => {
                  onXep(p, ngay);
                  setMoChon(false);
                }}
              />

              <button
                type="button"
                onClick={() => setMoChon(false)}
                className="planner-day__picker-close"
              >
                Đóng
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setMoChon(true)}
              className="planner-day__add-btn"
            >
              <i className="fa-solid fa-plus text-[11px]" />
              <span>+ Thêm điểm dừng vào Ngày {ngay}</span>
            </button>
          )}
        </>
      )}
    </section>
  );
}
