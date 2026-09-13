import { useMemo, useState } from "react";
import PlannerLodgingPicker from "./PlannerLodgingPicker";
import PlannerPlacePicker from "./PlannerPlacePicker";
import TimeRangePicker from "../../../shared/common/TimeRangePicker";
import CostPicker from "../../../shared/common/CostPicker";
import {
  dongPhu,
  nhanNgay,
  tinhKhoangCachKm,
  uocTinhThoiGian,
} from "./plannerUtils";
import "./PlannerDay.css";

/**
 * Component hiển thị một ngày trong lịch trình theo phong cách Wanderlog (ảnh nuo.png)
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
  onSapXepLai,
  onXem,
  onDatChoNgu,
  onBoChoNgu,
  onToiUu,
  dangLuu,
  toiUu,
  duong,
  onCapNhatStop,
  onThemNote,
  onThemChecklist,
  nav,
}) {
  const [keo, setKeo] = useState(false);
  const [moChon, setMoChon] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const [newChecklistText, setNewChecklistText] = useState({});

  // Đếm các điểm tham quan thực tế (không tính note hay checklist)
  const placesOnly = useMemo(
    () => ds.filter((s) => s.role !== "note" && s.role !== "checklist"),
    [ds]
  );

  // Tính tổng quãng đường và nhãn hiển thị theo nguồn dữ liệu
  const nhanQuangDuong = useMemo(() => {
    if (duong?.met) {
      return `~${(duong.met / 1000).toFixed(1)} km`;
    }
    if (toiUu?.sau_m) {
      return `~${(toiUu.sau_m / 1000).toFixed(1)} km`;
    }
    let tong = 0;
    for (let i = 0; i < placesOnly.length - 1; i++) {
      const d = tinhKhoangCachKm(placesOnly[i], placesOnly[i + 1]);
      if (d) tong += d;
    }
    return tong > 0 ? `~${tong.toFixed(1)} km` : null;
  }, [placesOnly, duong, toiUu]);

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

  // Toggle checklist sub-item
  const toggleChecklistItem = (stop, itemId) => {
    if (!onCapNhatStop) return;
    const currentItems = stop.items || [];
    const updated = currentItems.map((it) =>
      it.id === itemId ? { ...it, checked: !it.checked } : it
    );
    onCapNhatStop(stop, { items: updated });
  };

  // Thêm sub-item vào checklist
  const handleAddChecklistItem = (stop) => {
    const text = (newChecklistText[stop.id] || "").trim();
    if (!text || !onCapNhatStop) return;
    const currentItems = stop.items || [];
    const updated = [
      ...currentItems,
      { id: `chk_item_${Date.now()}`, text, checked: false },
    ];
    onCapNhatStop(stop, { items: updated });
    setNewChecklistText((prev) => ({ ...prev, [stop.id]: "" }));
  };

  // Xoá sub-item khỏi checklist
  const handleRemoveChecklistItem = (stop, itemId) => {
    if (!onCapNhatStop) return;
    const currentItems = stop.items || [];
    const updated = currentItems.filter((it) => it.id !== itemId);
    onCapNhatStop(stop, { items: updated });
  };

  const placeIndexMap = useMemo(() => {
    const map = new Map();
    let count = 0;
    (ds || []).forEach((s) => {
      if (s.role !== "note" && s.role !== "checklist") {
        count += 1;
        map.set(`${s.type}-${s.id}`, count);
      }
    });
    return map;
  }, [ds]);

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
      {/* 1. Header ngày chuẩn Wanderlog (ảnh nuo.png) */}
      <div
        className="planner-day__header"
        onClick={() => {
          if (!isExpanded && onToggleExpand) onToggleExpand();
        }}
      >
        <div className="planner-day__header-left">
          {onToggleExpand && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              className="planner-day__toggle-chevron"
              title={isExpanded ? "Thu gọn ngày" : "Mở rộng ngày"}
            >
              <span className="material-symbols-outlined">
                {isExpanded ? "keyboard_arrow_down" : "chevron_right"}
              </span>
            </button>
          )}

          <div className="planner-day__header-titles">
            <h3 className="planner-day__title">
              {nhanNgay(startDate, ngay)}
            </h3>
            <p className="planner-day__subtitle">
              {placesOnly.length} địa điểm
              {nhanQuangDuong && ` · ${nhanQuangDuong}`}
              {choNgu ? ` · Nghỉ tại: ${choNgu.name}` : ""}
              {toiUu && toiUu.sau_m < toiUu.truoc_m && (
                <span className="planner-day__optimization-result">
                  (↓ giảm {((toiUu.truoc_m - toiUu.sau_m) / 1000).toFixed(1)} km)
                </span>
              )}
            </p>
          </div>
        </div>

        <div
          className="planner-day__header-right"
          onClick={(e) => e.stopPropagation()}
        >
          {isExpanded && placesOnly.length >= 3 && (
            <button
              type="button"
              onClick={onToiUu}
              disabled={dangLuu}
              className="planner-day__optimize-link"
              title="Sắp lại thứ tự cho đi ít đường nhất"
            >
              <span className="material-symbols-outlined text-[15px]">route</span>
              <span className="planner-day__optimize-link-text">
                {dangLuu ? "Đang sắp..." : "Optimize route"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Nội dung chi tiết chỉ hiện khi ngày đang mở */}
      {isExpanded && (
        <div className="planner-day__content">
          {/* Timeline các điểm dừng, ghi chú, checklist */}
          {ds.length === 0 ? (
            <p className="planner-day__empty">
              Chưa có hoạt động nào trong ngày này. Nhấp vào thanh bên dưới để thêm địa điểm hoặc ghi chú.
            </p>
          ) : (
            <div className="planner-day__timeline">
              {ds.map((s, i) => {
                const isDragging = draggingIndex === i;
                const isDropTarget =
                  dragOverIndex === i && draggingIndex !== null && draggingIndex !== i;

                // A. Thẻ Ghi chú (Note) theo phong cách Wanderlog (ảnh nuo.png)
                if (s.role === "note" || s.type === "note") {
                  return (
                    <div
                      key={`${s.type}-${s.id}`}
                      className="planner-day__timeline-item"
                    >
                      <div className="planner-day__marker-col">
                        <span className="planner-day__note-marker">
                          <span className="material-symbols-outlined text-[16px]">
                            description
                          </span>
                        </span>
                        <div className="planner-day__connector-dotted" />
                      </div>

                      <div className="planner-day__note-card">
                        <textarea
                          rows={2}
                          value={s.text || ""}
                          placeholder="Viết hoặc dán ghi chú vào đây..."
                          onChange={(e) => {
                            if (onCapNhatStop) {
                              onCapNhatStop(s, { text: e.target.value });
                            }
                          }}
                          className="planner-day__note-textarea"
                        />
                        <button
                          type="button"
                          onClick={() => onBoNgay(s)}
                          className="planner-day__item-delete-btn"
                          title="Xoá ghi chú"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                }

                // B. Thẻ Danh sách công việc (Checklist) theo Wanderlog (ảnh nuo.png)
                if (s.role === "checklist" || s.type === "checklist") {
                  const items = s.items || [];
                  return (
                    <div
                      key={`${s.type}-${s.id}`}
                      className="planner-day__timeline-item"
                    >
                      <div className="planner-day__marker-col">
                        <span className="planner-day__note-marker">
                          <span className="material-symbols-outlined text-[16px]">
                            checklist
                          </span>
                        </span>
                        <div className="planner-day__connector-dotted" />
                      </div>

                      <div className="planner-day__checklist-card">
                        <div className="planner-day__checklist-head">
                          <input
                            type="text"
                            value={s.title || "Check list"}
                            onChange={(e) => {
                              if (onCapNhatStop) {
                                onCapNhatStop(s, { title: e.target.value });
                              }
                            }}
                            className="planner-day__checklist-title-input"
                            placeholder="Tiêu đề checklist..."
                          />
                          <button
                            type="button"
                            onClick={() => onBoNgay(s)}
                            className="planner-day__item-delete-btn"
                            title="Xoá checklist"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              delete
                            </span>
                          </button>
                        </div>

                        <div className="planner-day__checklist-items">
                          {items.map((it) => (
                            <div
                              key={it.id}
                              className="planner-day__checklist-item-row"
                            >
                              <button
                                type="button"
                                onClick={() => toggleChecklistItem(s, it.id)}
                                className={`planner-day__round-checkbox ${
                                  it.checked
                                    ? "planner-day__round-checkbox--checked"
                                    : ""
                                }`}
                              >
                                {it.checked && (
                                  <span className="material-symbols-outlined text-[14px]">
                                    check
                                  </span>
                                )}
                              </button>
                              <span
                                className={`planner-day__checklist-text ${
                                  it.checked
                                    ? "planner-day__checklist-text--done"
                                    : ""
                                }`}
                              >
                                {it.text}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveChecklistItem(s, it.id)
                                }
                                className="planner-day__sub-item-remove"
                                title="Xoá mục"
                              >
                                <span className="material-symbols-outlined text-[14px]">
                                  close
                                </span>
                              </button>
                            </div>
                          ))}

                          {/* Ô thêm mục checklist mới */}
                          <div className="planner-day__checklist-add-row">
                            <span className="planner-day__round-checkbox planner-day__round-checkbox--placeholder" />
                            <input
                              type="text"
                              placeholder="Thêm mục việc cần làm..."
                              value={newChecklistText[s.id] || ""}
                              onChange={(e) =>
                                setNewChecklistText((prev) => ({
                                  ...prev,
                                  [s.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleAddChecklistItem(s);
                                }
                              }}
                              className="planner-day__checklist-input"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddChecklistItem(s)}
                              className="planner-day__checklist-add-btn"
                            >
                              Thêm
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                // C. Thẻ Địa điểm (Place) chuẩn Wanderlog với Teardrop Pin Marker (ảnh nuo.png)
                const currentPlaceNum =
                  placeIndexMap.get(`${s.type}-${s.id}`) || 1;

                // Tìm điểm địa điểm tiếp theo để tính khoảng cách
                const nextPlace = ds
                  .slice(i + 1)
                  .find((item) => item.role !== "note" && item.role !== "checklist");
                const kmChặng = nextPlace ? tinhKhoangCachKm(s, nextPlace) : null;
                const tgChặng = kmChặng ? uocTinhThoiGian(kmChặng) : null;
                const canNavigate = Boolean(
                  s.id && !String(s.id).startsWith("serper:") && nav
                );

                return (
                  <div key={`${s.type}-${s.id}`} className="planner-day__stop-wrapper">
                    <div
                      className={`planner-day__timeline-item ${
                        isDragging ? "planner-day__timeline-item--dragging" : ""
                      } ${
                        isDropTarget ? "planner-day__timeline-item--drop-target" : ""
                      }`}
                    >
                      {/* Cột marker giọt nước (Teardrop Marker) chuẩn ảnh nuo.png */}
                    <div className="planner-day__marker-col">
                      <div className="planner-day__teardrop">
                        <span className="planner-day__teardrop-number">
                          {currentPlaceNum}
                        </span>
                      </div>
                      <div className="planner-day__connector-dotted" />
                    </div>

                    {/* Khối thẻ địa điểm */}
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
                      {/* Hàng trên: Kéo thả, Tên điểm, Nút xoá */}
                      <div className="planner-day__stop-head">
                        <div
                          role="button"
                          tabIndex={0}
                          className="planner-day__drag-handle"
                          draggable
                          onDragStart={(e) => handleDragStart(e, s, i)}
                          onDragEnd={handleDragEnd}
                          aria-label={`Kéo thả để sắp xếp ${s.name}`}
                          title="Kéo thả sắp xếp lại vị trí"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            drag_indicator
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => onXem && onXem(s)}
                            className="planner-day__stop-name"
                            title="Nhấp để xem trên bản đồ"
                          >
                            {s.name}
                          </button>
                          {dongPhu(s) && (
                            <p className="planner-day__stop-addr">
                              <span className="material-symbols-outlined text-[13px] text-slate-400">
                                location_on
                              </span>
                              <span>{dongPhu(s)}</span>
                            </p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => onBoNgay(s)}
                          className="planner-day__item-delete-btn"
                          aria-label={`Bỏ ${s.name} khỏi Ngày ${ngay}`}
                          title="Bỏ khỏi ngày này (vẫn giữ trong danh sách chờ)"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                        </button>
                      </div>

                      {/* Dòng ghi chú địa điểm theo Wanderlog */}
                      <input
                        type="text"
                        value={s.note || ""}
                        placeholder="Add notes, links, etc. here..."
                        onChange={(e) => {
                          if (onCapNhatStop) {
                            onCapNhatStop(s, { note: e.target.value });
                          }
                        }}
                        className="planner-day__stop-note-input"
                      />

                      {/* Hàng nút hành động chuẩn Wanderlog (ảnh nuo.png) */}
                      <div className="planner-day__stop-actions-row">
                        {/* 1. Mark as visited */}
                        <button
                          type="button"
                          onClick={() => {
                            if (onCapNhatStop) {
                              onCapNhatStop(s, { visited: !s.visited });
                            }
                          }}
                          className={`planner-day__action-pill ${
                            s.visited ? "planner-day__action-pill--visited" : ""
                          }`}
                          title={
                            s.visited ? "Đã đánh dấu ghé thăm" : "Đánh dấu đã ghé thăm"
                          }
                        >
                          <span className="material-symbols-outlined text-[15px]">
                            {s.visited ? "check_circle" : "check"}
                          </span>
                          <span>Mark as visited</span>
                        </button>

                        {/* 2. Add time / Time Range Picker */}
                        <TimeRangePicker
                          timeStart={s.time_start}
                          timeEnd={s.time_end}
                          onChange={(start, end) => {
                            if (onCapNhatStop) {
                              onCapNhatStop(s, {
                                time_start: start,
                                time_end: end,
                                time_range:
                                  start && end
                                    ? `${start} - ${end}`
                                    : start || end || "",
                              });
                            }
                          }}
                        />

                        {/* 3. Add cost / Cost Picker */}
                        <CostPicker
                          cost={s.cost}
                          onChange={(newCost) => {
                            if (onCapNhatStop) {
                              onCapNhatStop(s, { cost: newCost });
                            }
                          }}
                        />

                        {/* 4. Khám phá POI (nếu có id nội bộ) */}
                        {canNavigate && (
                          <button
                            type="button"
                            onClick={() => nav(`/dia-diem/${s.type}/${s.id}`)}
                            className="planner-day__action-pill"
                            title="Xem trang chi tiết điểm đến"
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              explore
                            </span>
                            <span>Khám phá</span>
                          </button>
                        )}
                      </div>

                      {/* Footer của card: Emojis và nhãn Added by you */}
                      <div className="planner-day__stop-footer">
                        <div className="planner-day__emoji-row">
                          {["👍", "❤️", "⭐"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                if (onCapNhatStop) {
                                  onCapNhatStop(s, {
                                    reaction:
                                      s.reaction === emoji ? null : emoji,
                                  });
                                }
                              }}
                              className={`planner-day__emoji-btn ${
                                s.reaction === emoji
                                  ? "planner-day__emoji-btn--active"
                                  : ""
                              }`}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>

                        <span className="planner-day__added-by">
                          {s.reaction ? `Đã chọn ${s.reaction} · ` : ""}Added by you
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Khoảng cách / thời gian di chuyển nằm Ở DƯỚI VÀ BÊN NGOÀI thẻ planner-day__stop-card (chuẩn ảnh w4.png) */}
                  {kmChặng != null && (
                    <div className="planner-day__transit-step">
                      <div className="planner-day__transit-marker-col">
                        <div className="planner-day__connector-dotted" style={{ minHeight: "1.75rem" }} />
                      </div>
                      <div className="planner-day__transit-body">
                        <div className="planner-day__transit-line-content">
                          <span className="material-symbols-outlined text-[15px] text-slate-500">
                            {kmChặng > 1.5 ? "directions_car" : "directions_walk"}
                          </span>
                          <span className="planner-day__transit-text">
                            {tgChặng ? `${tgChặng} • ` : ""}~{kmChặng} km
                          </span>
                          {s.lat && s.lon && nextPlace?.lat && nextPlace?.lon && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&origin=${s.lat},${s.lon}&destination=${nextPlace.lat},${nextPlace.lon}`}
                              target="_blank"
                              rel="noreferrer"
                              className="planner-day__transit-directions-btn"
                              title="Xem chỉ đường trên Google Maps"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                arrow_drop_down
                              </span>
                              <span>Directions</span>
                            </a>
                          )}
                        </div>
                        <span className="planner-day__transit-from">
                          from {s.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}

          {/* Component chỗ nghỉ đêm */}
          <PlannerLodgingPicker
            ngay={ngay}
            ds={placesOnly}
            choNgu={choNgu}
            diemDen={diemDen}
            onDat={onDatChoNgu}
            onBo={onBoChoNgu}
          />

          {/* 3. Thanh tác vụ thêm nhanh cuối mỗi ngày chuẩn Wanderlog (ảnh nuo.png) */}
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
                nhan="Hoặc tìm địa điểm mới thêm vào ngày"
                placeholder="Nhập tên địa điểm, quán ăn..."
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
            <div className="planner-day__quick-bar">
              {/* Input pill: Add a place */}
              <button
                type="button"
                onClick={() => setMoChon(true)}
                className="planner-day__quick-add-place"
              >
                <span className="material-symbols-outlined text-[18px] text-slate-400">
                  location_on
                </span>
                <span>Thêm địa điểm vào Ngày {ngay}...</span>
              </button>

              {/* Nút thêm Note nhanh */}
              {onThemNote && (
                <button
                  type="button"
                  onClick={() => onThemNote(ngay)}
                  className="planner-day__quick-btn"
                  title="Thêm ghi chú vào ngày này"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    description
                  </span>
                </button>
              )}

              {/* Nút thêm Checklist nhanh */}
              {onThemChecklist && (
                <button
                  type="button"
                  onClick={() => onThemChecklist(ngay)}
                  className="planner-day__quick-btn"
                  title="Thêm danh sách công việc vào ngày này"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    checklist
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
