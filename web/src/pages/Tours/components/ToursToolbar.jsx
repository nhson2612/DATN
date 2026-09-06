import { useMemo } from "react";
import "./ToursToolbar.css";

/**
 * Định dạng ngày sang DD/MM/YYYY.
 */
function formatVnDate(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Định dạng tiền tệ rút gọn.
 */
function formatCompactPrice(price) {
  const num = Number(price);
  if (!num) return "0đ";
  if (num >= 1000000) {
    const tr = num / 1000000;
    return `${tr.toLocaleString("vi-VN")} tr`;
  }
  return `${num.toLocaleString("vi-VN")}đ`;
}

/**
 * Component Thanh công cụ phía trên danh sách tour theo .design/Tours.html (dòng 184-218):
 * - Đếm số lượng tour tìm thấy
 * - Dropdown sắp xếp chuẩn backend (price_asc, price_desc, date_asc)
 * - Nút chuyển chế độ xem (Lưới / Danh sách)
 * - Hàng active tags xoá nhanh & nút Xóa bộ lọc
 */
export default function ToursToolbar({
  total = 0,
  isLoading = false,
  sort = "",
  onSortChange,
  viewMode = "grid",
  onViewModeChange,
  filters = {},
  provinces = [],
  onRemoveFilter,
  onReset,
  onOpenMobileFilters,
  activeCount = 0,
}) {
  // Gom danh sách active chips
  const activeTags = useMemo(() => {
    const tags = [];

    if (filters.province_id) {
      const p = provinces.find(
        (item) => String(item.id) === String(filters.province_id)
      );
      const pName = p
        ? p.name.replace(/^(Thành phố|Tỉnh)\s+/, "")
        : `Điểm đến #${filters.province_id}`;
      tags.push({
        id: "province",
        label: pName,
        keys: ["province_id"],
      });
    }

    if (filters.max_days) {
      tags.push({
        id: "duration",
        label: `Thời lượng: ≤ ${filters.max_days} ngày`,
        keys: ["max_days"],
      });
    }

    if (filters.min_days) {
      tags.push({
        id: "duration-min",
        label: `Thời lượng: ≥ ${filters.min_days} ngày`,
        keys: ["min_days"],
      });
    }

    if (filters.price_min || filters.price_max) {
      let priceLabel = "";
      if (filters.price_min && filters.price_max) {
        priceLabel = `${formatCompactPrice(filters.price_min)} - ${formatCompactPrice(filters.price_max)}`;
      } else if (filters.price_min) {
        priceLabel = `Từ ${formatCompactPrice(filters.price_min)}`;
      } else {
        priceLabel = `Dưới ${formatCompactPrice(filters.price_max)}`;
      }
      tags.push({
        id: "price",
        label: `Giá: ${priceLabel}`,
        keys: ["price_min", "price_max"],
      });
    }

    if (filters.depart_from) {
      tags.push({
        id: "depart_from",
        label: `Từ: ${formatVnDate(filters.depart_from)}`,
        keys: ["depart_from"],
      });
    }

    if (filters.depart_to) {
      tags.push({
        id: "depart_to",
        label: `Đến: ${formatVnDate(filters.depart_to)}`,
        keys: ["depart_to"],
      });
    }

    if (filters.guests && filters.guests !== "1") {
      tags.push({
        id: "guests",
        label: `${filters.guests} chỗ`,
        keys: ["guests"],
      });
    }

    return tags;
  }, [filters, provinces]);

  return (
    <div className="tours-toolbar">
      {/* Hàng trên: Đếm tour + Sắp xếp + Chuyển view + Nút mobile filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div className="flex items-baseline space-x-2">
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {isLoading ? "Đang tìm kiếm tour..." : `Tìm thấy ${total} tour phù hợp`}
          </h2>
          <span className="text-xs text-slate-400 font-normal">
            (Cập nhật gần nhất)
          </span>
        </div>

        <div className="flex items-center space-x-3 sm:space-x-4 flex-wrap gap-y-2">
          {/* Nút bật bộ lọc trên màn hình di động/tablet */}
          <button
            type="button"
            onClick={onOpenMobileFilters}
            className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors cursor-pointer"
            aria-label="Mở bộ lọc tìm kiếm"
          >
            <i className="fa-solid fa-sliders text-xs" />
            <span>Bộ lọc</span>
            {activeCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-orange-600 text-white text-[10px] font-black flex items-center justify-center">
                {activeCount}
              </span>
            )}
          </button>

          {/* Sắp xếp */}
          <div className="flex items-center space-x-2 text-sm">
            <span className="text-slate-500 text-xs shrink-0">Sắp xếp:</span>
            <div className="relative">
              <select
                id="tours-sort-select"
                value={sort}
                onChange={(e) => onSortChange(e.target.value)}
                className="rounded-lg border border-gray-200 text-xs font-semibold text-slate-800 pr-8 py-2 focus:ring-orange-500 focus:border-orange-500 bg-white outline-none cursor-pointer"
              >
                <option value="">Phổ biến nhất</option>
                <option value="price_asc">Giá từ thấp đến cao</option>
                <option value="price_desc">Giá từ cao đến thấp</option>
                <option value="date_asc">Khởi hành sớm nhất</option>
              </select>
            </div>
          </div>

          {/* Nút chuyển kiểu xem: Grid / List */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => onViewModeChange?.("grid")}
              className={`rounded-lg py-1.5 px-2.5 font-medium flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Xem dạng lưới"
            >
              <i className="fa-solid fa-table-cells-large text-sm" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange?.("list")}
              className={`rounded-lg py-1.5 px-2.5 font-medium flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-white text-orange-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Xem dạng danh sách"
            >
              <i className="fa-solid fa-list text-sm" />
            </button>
          </div>
        </div>
      </div>

      {/* Hàng dưới: Active Badges Chips */}
      {activeTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 pt-1">
          {activeTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200"
            >
              <span>{tag.label}</span>
              <button
                type="button"
                onClick={() => onRemoveFilter(tag.keys)}
                className="ml-2 text-slate-400 hover:text-slate-600 font-bold cursor-pointer text-sm leading-none"
                title={`Xóa điều kiện ${tag.label}`}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 ml-1 cursor-pointer transition-colors"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}
    </div>
  );
}
