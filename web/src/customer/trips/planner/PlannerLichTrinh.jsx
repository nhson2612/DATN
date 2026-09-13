import { useEffect, useState } from "react";
import { api } from "../../../shared/api";
import PlannerDay from "./PlannerDay";
import PlannerPlacePicker from "./PlannerPlacePicker";
import { dinhDangKhoangNgay, dongPhu } from "./plannerUtils";
import "./PlannerLichTrinh.css";

/**
 * Component panel Lịch trình chi tiết theo ngày và các điểm chưa xếp lịch
 * Chuẩn phong cách thiết kế Wanderlog (ảnh nuo.png)
 */
export default function PlannerLichTrinh({
  trip,
  cacNgay,
  theoNgay,
  choNguTheoNgay,
  chuaXep = [],
  diemDen,
  ngayRefs,
  ngayChon,
  onHover,
  onXep,
  onBoNgay,
  onXem,
  onDatChoNgu,
  onBoChoNgu,
  onToiUu,
  dangLuu,
  toiUu,
  duongTheoNgay,
  onResults,
  onThemChuaXep,
  onXoaDiem,
  onAutoAssign,
  onSapXepLai,
  onCapNhatStop,
  onThemNote,
  onThemChecklist,
  nav,
}) {
  // Trạng thái ngày đang mở rộng (mặc định mở ngày đang chọn hoặc ngày 1)
  const [expandedDays, setExpandedDays] = useState(() => ({
    [ngayChon || 1]: true,
  }));

  // Cập nhật khi người dùng bấm chọn ngày trên PlannerRail
  useEffect(() => {
    if (ngayChon) {
      setExpandedDays((prev) => ({ ...prev, [ngayChon]: true }));
    }
  }, [ngayChon]);

  const toggleDay = (ngay) => {
    setExpandedDays((prev) => ({
      ...prev,
      [ngay]: !prev[ngay],
    }));
  };

  // Trạng thái tìm kiếm nhanh trên đỉnh panel
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [moThemChuaXep, setMoThemChuaXep] = useState(false);

  const handleSearchSubmit = async (e) => {
    e?.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await api.searchPlaces({
        q,
        destination: diemDen || "",
        page_size: 8,
      });
      const items = res.items || [];
      setSearchResults(items);
      setShowSearchDropdown(true);
      if (onResults) {
        onResults(items);
      }
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="planner-itinerary">
      {/* 1. Header chính của Itinerary với Tiêu đề to và Badge ngày ở góc phải (ảnh nuo.png) */}
      <div className="planner-itinerary__top-header">
        <div className="planner-itinerary__title-row">
          <h2 className="planner-itinerary__main-title">Itinerary</h2>
          <span className="planner-itinerary__date-badge">
            <span className="material-symbols-outlined text-[15px]">
              calendar_month
            </span>
            <span>
              {dinhDangKhoangNgay(trip?.start_date, trip?.duration_days)}
            </span>
          </span>
        </div>
      </div>

      {/* 2. Thanh tìm kiếm trên đỉnh panel lịch trình */}
      <div className="planner-itinerary__search-card">
        <form onSubmit={handleSearchSubmit} className="planner-itinerary__search-wrap">
          <span className="material-symbols-outlined planner-itinerary__search-icon">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm thêm địa điểm cho chuyến đi..."
            className="planner-itinerary__search-input"
          />
          <span className="planner-itinerary__search-hint">
            {searching ? "Đang tìm..." : "Enter ↵"}
          </span>
        </form>

        {/* Dropdown kết quả tìm kiếm nhanh */}
        {showSearchDropdown && searchResults.length > 0 && (
          <div className="planner-itinerary__search-dropdown">
            <div className="flex items-center justify-between pb-1 px-1 border-b border-slate-100">
              <span className="text-[11px] font-bold text-slate-500">
                Kết quả tìm kiếm ({searchResults.length})
              </span>
              <button
                type="button"
                onClick={() => setShowSearchDropdown(false)}
                className="text-[11px] text-slate-400 hover:text-slate-600 font-semibold"
              >
                Đóng
              </button>
            </div>
            {searchResults.map((p) => (
              <div key={`${p.type}-${p.id}`} className="planner-itinerary__search-item">
                <div className="planner-itinerary__search-item-info">
                  <p className="planner-itinerary__search-item-name">{p.name}</p>
                  <p className="planner-itinerary__search-item-meta">{dongPhu(p)}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (onThemChuaXep) onThemChuaXep(p);
                      else onXep(p, 1);
                      setShowSearchDropdown(false);
                      setSearchQuery("");
                    }}
                    className="planner-itinerary__search-item-btn"
                    title="Thêm vào danh sách muốn đi"
                  >
                    + Lưu
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Nhóm Địa điểm muốn đi / Chưa xếp lịch */}
      <div className="planner-itinerary__unassigned">
        <div className="planner-itinerary__unassigned-header">
          <div className="flex-1 min-w-0">
            <div className="planner-itinerary__unassigned-title-wrap">
              <span className="planner-itinerary__unassigned-dot" />
              <h3 className="planner-itinerary__unassigned-title">
                Địa điểm muốn đi
              </h3>
              <span className="planner-itinerary__unassigned-count">
                {chuaXep.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kéo thả vào ngày hoặc chọn ngày để lên lịch
            </p>
          </div>

          {onAutoAssign && chuaXep.length > 0 && (
            <button
              type="button"
              onClick={onAutoAssign}
              className="planner-itinerary__unassigned-action"
              title="Tự động chia đều các điểm vào các ngày"
            >
              <span className="material-symbols-outlined text-[15px]">
                auto_awesome
              </span>
              <span>Chia đều theo ngày</span>
            </button>
          )}
        </div>

        {chuaXep.length === 0 ? (
          <p className="planner-itinerary__unassigned-empty">
            Chưa có địa điểm chờ xếp lịch. Bạn có thể tìm thêm ở ô tìm kiếm phía trên.
          </p>
        ) : (
          <div className="planner-itinerary__unassigned-grid">
            {chuaXep.map((s) => (
              <div
                key={`${s.type}-${s.id}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/json",
                    JSON.stringify({ type: s.type, id: s.id })
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
                className="planner-itinerary__unassigned-card"
              >
                <div className="planner-itinerary__unassigned-card-top">
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onXem && onXem(s)}
                      className="planner-itinerary__unassigned-name"
                      title="Xem trên bản đồ"
                    >
                      {s.name}
                    </button>
                    {dongPhu(s) && (
                      <p className="planner-itinerary__unassigned-desc">
                        {dongPhu(s)}
                      </p>
                    )}
                  </div>

                  {onXoaDiem && (
                    <button
                      type="button"
                      onClick={() => onXoaDiem(s)}
                      className="text-slate-400 hover:text-rose-600 text-xs p-0.5 transition-colors"
                      title="Xoá khỏi danh sách"
                    >
                      <span className="material-symbols-outlined text-[15px]">
                        close
                      </span>
                    </button>
                  )}
                </div>

                <div className="planner-itinerary__unassigned-card-bot">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Xếp vào:
                  </span>
                  <select
                    value=""
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val) onXep(s, val);
                    }}
                    className="planner-itinerary__unassigned-select"
                  >
                    <option value="" disabled>
                      Chọn ngày...
                    </option>
                    {cacNgay.map((d) => (
                      <option key={d} value={d}>
                        Ngày {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}

        {moThemChuaXep ? (
          <div className="mt-2">
            <PlannerPlacePicker
              diemDen={diemDen}
              nhan="Tìm địa điểm thêm vào danh sách chờ"
              moSan
              onChon={(p) => {
                if (onThemChuaXep) onThemChuaXep(p);
                setMoThemChuaXep(false);
              }}
            />
            <button
              type="button"
              onClick={() => setMoThemChuaXep(false)}
              className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 py-1.5 mt-1"
            >
              Đóng
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setMoThemChuaXep(true)}
            className="w-full mt-1 py-2 border border-dashed border-slate-300 hover:border-teal-500 rounded-xl text-xs font-semibold text-slate-600 hover:text-teal-700 flex items-center justify-center gap-1.5 transition bg-white"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            <span>Thêm địa điểm vào danh sách chờ</span>
          </button>
        )}
      </div>

      {/* 4. Danh sách các ngày (Wanderlog Day Blocks) */}
      <div className="planner-itinerary__days">
        {cacNgay.map((ngay) => (
          <div key={ngay} ref={(el) => (ngayRefs.current[ngay] = el)}>
            <PlannerDay
              ngay={ngay}
              startDate={trip?.start_date}
              diemDen={diemDen}
              ds={theoNgay[ngay] || []}
              choNgu={choNguTheoNgay[ngay]}
              chuaXep={chuaXep}
              isExpanded={Boolean(expandedDays[ngay])}
              onToggleExpand={() => toggleDay(ngay)}
              onHover={onHover}
              onXep={onXep}
              onBoNgay={onBoNgay}
              onSapXepLai={onSapXepLai}
              onXem={onXem}
              onDatChoNgu={onDatChoNgu}
              onBoChoNgu={onBoChoNgu}
              onToiUu={() => onToiUu(ngay)}
              dangLuu={dangLuu}
              toiUu={toiUu?.day === ngay ? toiUu : null}
              duong={duongTheoNgay?.[ngay] || null}
              onCapNhatStop={onCapNhatStop}
              onThemNote={onThemNote}
              onThemChecklist={onThemChecklist}
              nav={nav}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
