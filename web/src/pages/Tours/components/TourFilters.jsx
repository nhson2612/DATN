import { useEffect, useState } from "react";
import "./TourFilters.css";

// Các preset thời lượng lịch trình theo đúng thiết kế
const DURATION_PRESETS = [
  { label: "2 Ngày 1 Đêm", min: "", max: "2", sub: "Cuối tuần" },
  { label: "3 Ngày 2 Đêm", min: "", max: "3", sub: "Phổ biến nhất" },
  { label: "4 Ngày 3 Đêm", min: "", max: "4", sub: "Trọn vẹn" },
  { label: "5 Ngày 4 Đêm+", min: "5", max: "", sub: "Nghỉ dưỡng dài" },
];

// Các preset ngân sách / khách
const PRICE_PRESETS = [
  { label: "Dưới 2 tr", min: "", max: "2000000" },
  { label: "2 - 4 tr", min: "2000000", max: "4000000" },
  { label: "4 - 8 tr", min: "4000000", max: "8000000" },
  { label: "Trên 8 tr", min: "8000000", max: "" },
];

// Các preset số lượng chỗ
const GUEST_PRESETS = [
  { label: "1 chỗ", val: "" },
  { label: "2 chỗ", val: "2" },
  { label: "3 chỗ", val: "3" },
  { label: "4+ chỗ", val: "4" },
];

/**
 * Định dạng tiền tệ VND rút gọn
 */
function formatShortPrice(val) {
  if (!val) return "";
  const num = Number(val);
  if (num >= 1000000) {
    return `${(num / 1000000).toLocaleString("vi-VN")} tr`;
  }
  return `${num.toLocaleString("vi-VN")}đ`;
}

/**
 * Thành phần Accordion Collapsible dùng cho mỗi nhóm bộ lọc
 */
function AccordionSection({
  id,
  title,
  isOpen,
  hasActive = false,
  onToggle,
  onReset,
  children,
}) {
  return (
    <div className="tour-filters__accordion-item">
      {/* Header nhóm: tiêu đề + icon mũi tên (toàn bộ header có thể bấm để đóng/mở) */}
      <div
        className="tour-filters__accordion-header flex items-center justify-between cursor-pointer select-none py-1 group"
        onClick={(e) => {
          if (e.target.closest(".tour-filters__reset-btn")) return;
          onToggle();
        }}
      >
        <button
          type="button"
          id={`filter-header-${id}`}
          aria-expanded={isOpen}
          aria-controls={`filter-panel-${id}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex items-center gap-2 flex-1 text-left cursor-pointer bg-transparent border-0 p-0 focus:outline-none focus-visible:ring-1 focus-visible:ring-orange-500 rounded"
        >
          <span className="text-[12.5px] font-bold tracking-wide text-slate-900 uppercase">
            {title}
          </span>
          {hasActive && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"
              title="Đang áp dụng bộ lọc"
            />
          )}
        </button>

        <div className="flex items-center gap-2 pl-2">
          {hasActive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="tour-filters__reset-btn text-[11px] font-medium text-slate-400 hover:text-orange-600 transition-colors cursor-pointer"
            >
              Đặt lại
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            tabIndex={-1}
            aria-hidden="true"
            className="text-slate-400 group-hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors p-0 bg-transparent border-0"
          >
            <span
              className={`material-symbols-outlined tour-filters__accordion-arrow text-[20px] transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            >
              expand_more
            </span>
          </button>
        </div>
      </div>

      {/* Nội dung bộ lọc thu gọn / mở rộng mượt nhẹ */}
      <div
        id={`filter-panel-${id}`}
        role="region"
        aria-labelledby={`filter-header-${id}`}
        className="tour-filters__accordion-panel"
        data-open={isOpen}
      >
        <div className="tour-filters__accordion-inner">
          <div className="tour-filters__accordion-body">{children}</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Component Sidebar bộ lọc tìm kiếm theo đúng .design/Tours.html (dòng 86-180).
 */
export default function TourFilters({
  filters = {},
  provinces = [],
  onFilterChange,
  onReset,
  activeCount = 0,
  isOpenMobile = false,
  onCloseMobile,
}) {
  const [showAllProvinces, setShowAllProvinces] = useState(false);

  // Quản lý đóng/mở accordion: mặc định nhóm đầu tiên ("destination") mở, các nhóm khác thu gọn
  const [openSections, setOpenSections] = useState({
    destination: true,
    duration: false,
    price: false,
    dates: false,
    guests: false,
  });

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  // Khoá cuộn body khi mở drawer mobile
  useEffect(() => {
    if (isOpenMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpenMobile]);

  const {
    province_id = "",
    depart_from = "",
    depart_to = "",
    price_min = "",
    price_max = "",
    max_days = "",
    min_days = "",
    guests = "",
  } = filters;

  // Hiển thị tối đa 5 tỉnh hoặc toàn bộ khi bấm xem thêm
  const displayedProvinces = showAllProvinces ? provinces : provinces.slice(0, 6);

  // Nội dung các nhóm lọc
  const filterBody = (
    <div className="space-y-4">
      {/* Header bộ lọc */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
        <h2 className="text-[13px] font-bold tracking-wider text-slate-900 uppercase">
          BỘ LỌC TÌM KIẾM
        </h2>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            className="text-[13px] font-semibold text-orange-600 hover:text-orange-700 cursor-pointer transition-colors"
          >
            Xóa tất cả
          </button>
        )}
      </div>

      {/* Danh sách các nhóm bộ lọc accordion collapsible */}
      <div className="tour-filters__accordion">
        {/* Nhóm 1: Khu vực điểm đến */}
        <AccordionSection
          id="destination"
          title="KHU VỰC ĐIỂM ĐẾN"
          isOpen={openSections.destination}
          hasActive={Boolean(province_id)}
          onToggle={() => toggleSection("destination")}
          onReset={() => onFilterChange({ province_id: "" })}
        >
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 tour-filters__province-list">
            {displayedProvinces.map((p) => {
              const isChecked = String(province_id) === String(p.id);
              const cleanName = p.name.replace(/^(Thành phố|Tỉnh)\s+/, "");
              return (
                <label
                  key={p.id}
                  className="flex items-center justify-between text-sm text-slate-700 hover:text-slate-900 cursor-pointer select-none group"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() =>
                        onFilterChange({
                          province_id: isChecked ? "" : String(p.id),
                        })
                      }
                      className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500 cursor-pointer shrink-0"
                    />
                    <span
                      className={`text-[13.5px] truncate transition-colors ${
                        isChecked
                          ? "font-bold text-orange-600"
                          : "group-hover:text-slate-900"
                      }`}
                    >
                      {cleanName}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          {provinces.length > 6 && (
            <button
              type="button"
              onClick={() => setShowAllProvinces(!showAllProvinces)}
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 pt-3 cursor-pointer inline-flex items-center gap-1"
            >
              <span>{showAllProvinces ? "Thu gọn bớt" : `Xem thêm (${provinces.length} điểm đến)`}</span>
              <i className={`fa-solid ${showAllProvinces ? "fa-chevron-up" : "fa-chevron-down"} text-[10px]`} />
            </button>
          )}
        </AccordionSection>

        {/* Nhóm 2: Thời lượng lịch trình */}
        <AccordionSection
          id="duration"
          title="THỜI LƯỢNG LỊCH TRÌNH"
          isOpen={openSections.duration}
          hasActive={Boolean(max_days || min_days)}
          onToggle={() => toggleSection("duration")}
          onReset={() => onFilterChange({ max_days: "", min_days: "" })}
        >
          <div className="grid grid-cols-2 gap-2.5">
            {DURATION_PRESETS.map((d) => {
              const isActive =
                String(max_days) === String(d.max) &&
                String(min_days) === String(d.min);
              return (
                <button
                  key={d.label}
                  type="button"
                  onClick={() =>
                    onFilterChange({
                      max_days: isActive ? "" : d.max,
                      min_days: isActive ? "" : d.min,
                    })
                  }
                  className={`p-3 text-left rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? "border border-orange-500 bg-orange-50/20 shadow-sm"
                      : "border border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div
                    className={`text-[13px] font-bold ${
                      isActive ? "text-orange-600" : "text-slate-800"
                    }`}
                  >
                    {d.label}
                  </div>
                  <div
                    className={`text-[11px] mt-0.5 ${
                      isActive ? "text-orange-500" : "text-slate-400"
                    }`}
                  >
                    {d.sub}
                  </div>
                </button>
              );
            })}
          </div>
        </AccordionSection>

        {/* Nhóm 3: Mức ngân sách / Khách */}
        <AccordionSection
          id="price"
          title="MỨC NGÂN SÁCH / KHÁCH"
          isOpen={openSections.price}
          hasActive={Boolean(price_min || price_max)}
          onToggle={() => toggleSection("price")}
          onReset={() => onFilterChange({ price_min: "", price_max: "" })}
        >
          <div className="space-y-3">
            <div className="text-[13.5px] font-bold text-slate-800">
              {price_min && price_max
                ? `${formatShortPrice(price_min)} — ${formatShortPrice(price_max)}`
                : price_min
                ? `Từ ${formatShortPrice(price_min)} trở lên`
                : price_max
                ? `Dưới ${formatShortPrice(price_max)}`
                : "1.500.000đ — 10.000.000đ+"}
            </div>

            {/* Range Slider simulation bar matching design */}
            <div className="relative py-2">
              <div className="tour-filters__range-track">
                <div
                  className="tour-filters__range-fill"
                  style={{
                    left: price_min ? "15%" : "0%",
                    right: price_max ? "15%" : "0%",
                  }}
                />
                <div
                  className="tour-filters__range-thumb"
                  style={{ left: price_min ? "15%" : "0%" }}
                />
                <div
                  className="tour-filters__range-thumb"
                  style={{ left: price_max ? "85%" : "100%" }}
                />
              </div>
            </div>

            {/* Preset chips chọn mức giá nhanh */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {PRICE_PRESETS.map((p) => {
                const isSelected =
                  String(price_min) === String(p.min) &&
                  String(price_max) === String(p.max);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        onFilterChange({ price_min: "", price_max: "" });
                      } else {
                        onFilterChange({ price_min: p.min, price_max: p.max });
                      }
                    }}
                    className={`py-2 px-2.5 text-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "border border-orange-500 bg-orange-50 text-orange-600 font-bold"
                        : "border border-gray-200 hover:border-gray-300 text-slate-700 bg-white"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </AccordionSection>

        {/* Nhóm 4: Khoảng ngày khởi hành */}
        <AccordionSection
          id="dates"
          title="KHOẢNG NGÀY ĐI"
          isOpen={openSections.dates}
          hasActive={Boolean(depart_from || depart_to)}
          onToggle={() => toggleSection("dates")}
          onReset={() => onFilterChange({ depart_from: "", depart_to: "" })}
        >
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={depart_from}
                onChange={(e) => onFilterChange({ depart_from: e.target.value })}
                className="w-full text-xs font-medium text-slate-800 border border-gray-200 rounded-xl px-2.5 py-2 bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 block mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={depart_to}
                onChange={(e) => onFilterChange({ depart_to: e.target.value })}
                className="w-full text-xs font-medium text-slate-800 border border-gray-200 rounded-xl px-2.5 py-2 bg-white focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none"
              />
            </div>
          </div>
        </AccordionSection>

        {/* Nhóm 5: Số chỗ cần */}
        <AccordionSection
          id="guests"
          title="SỐ CHỖ CẦN"
          isOpen={openSections.guests}
          hasActive={Boolean(guests)}
          onToggle={() => toggleSection("guests")}
          onReset={() => onFilterChange({ guests: "" })}
        >
          <div className="grid grid-cols-4 gap-2">
            {GUEST_PRESETS.map((g) => {
              const isSelected = String(guests) === String(g.val);
              return (
                <button
                  key={g.label}
                  type="button"
                  onClick={() =>
                    onFilterChange({ guests: isSelected ? "" : g.val })
                  }
                  className={`py-2 text-center rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    isSelected
                      ? "border border-orange-500 bg-orange-50 text-orange-600 font-bold"
                      : "border border-gray-200 hover:border-gray-300 text-slate-700 bg-white"
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>
        </AccordionSection>
      </div>
    </div>
  );

  return (
    <>
      {/* ── BỘ LỌC DESKTOP (Sidebar 3 cột hiển thị liên tục trên lg) ── */}
      <aside
        className="tours-filter-desktop"
        data-purpose="search-filters"
      >
        {filterBody}
      </aside>

      {/* ── BỘ LỌC MOBILE (Drawer trượt từ phải khi bấm mở trên mobile/tablet) ── */}
      {isOpenMobile && (
        <div className="lg:hidden">
          {/* Lớp nền tối mờ */}
          <div
            className="tour-filters-mobile__backdrop"
            onClick={onCloseMobile}
            aria-hidden="true"
          />

          {/* Ngăn kéo bộ lọc */}
          <div className="tour-filters-mobile__drawer">
            <div>
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
                <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Bộ lọc tìm kiếm</span>
                  {activeCount > 0 && (
                    <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full font-bold">
                      {activeCount}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Đóng bộ lọc"
                >
                  <i className="fa-solid fa-xmark text-sm" />
                </button>
              </div>

              {filterBody}
            </div>

            <div className="pt-6 mt-6 border-t border-gray-100">
              <button
                type="button"
                onClick={onCloseMobile}
                className="w-full py-3.5 bg-[#ea580c] hover:bg-orange-700 text-white font-bold text-sm rounded-xl transition-colors shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Xem kết quả</span>
                <i className="fa-solid fa-check text-xs" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
