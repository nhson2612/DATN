import { useEffect, useId, useMemo, useRef, useState } from "react";

/** Hàm chuẩn hóa tiếng Việt để tìm kiếm không dấu / có dấu */
function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

/**
 * Bộ chọn Tour tích hợp tìm kiếm thông minh theo chuẩn Shadcn Combobox.
 * Hỗ trợ tìm kiếm theo tên tour, slug, số ngày; đóng khi click ra ngoài.
 */
export default function DeparturePicker({ tours = [], tourId, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxId = useId();

  const selectedTour = useMemo(
    () => tours.find((t) => String(t.id) === String(tourId)),
    [tours, tourId]
  );

  // Lọc tour theo từ khóa tìm kiếm (hỗ trợ không dấu)
  const filteredTours = useMemo(() => {
    if (!search.trim()) return tours;
    const q = normalizeText(search.trim());
    return tours.filter((tour) => {
      const nameNorm = normalizeText(tour.name);
      const slugNorm = normalizeText(tour.slug);
      const summaryNorm = normalizeText(tour.summary);
      return nameNorm.includes(q) || slugNorm.includes(q) || summaryNorm.includes(q);
    });
  }, [tours, search]);

  // Click outside & phím Esc để đóng popover
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Auto focus ô search khi mở
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSelect = (id) => {
    onChange(String(id));
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-zinc-200 shadow-2xs mb-6">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-md bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-600 shrink-0">
          <span className="material-symbols-outlined text-lg">travel_explore</span>
        </div>
        <div className="min-w-0">
          <span className="text-xs font-medium text-zinc-500 block leading-tight">
            Tour đang quản lý đợt
          </span>
          <span className="text-sm font-semibold text-zinc-900 truncate block">
            {selectedTour ? selectedTour.name : "Chưa chọn tour nào"}
          </span>
        </div>
      </div>

      {/* Combobox Searchable Dropdown */}
      <div className="relative w-full sm:w-[380px]" ref={containerRef}>
        {/* Trigger button */}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm bg-white hover:bg-zinc-50/80 border border-zinc-200 text-zinc-900 rounded-md transition-colors font-medium shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-zinc-900 text-left"
        >
          <div className="flex items-center gap-2 min-w-0 truncate">
            <span className="material-symbols-outlined text-base text-zinc-400 shrink-0">
              search
            </span>
            <span className="truncate">
              {selectedTour ? selectedTour.name : "Tìm & chọn tour..."}
            </span>
          </div>
          <span className="material-symbols-outlined text-base text-zinc-400 shrink-0">
            unfold_more
          </span>
        </button>

        {/* Popover content */}
        {open && (
          <div
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            className="absolute left-0 sm:left-auto right-0 top-full mt-1.5 w-full bg-white border border-zinc-200 rounded-lg shadow-xl p-1.5 z-40 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Input search */}
            <div className="relative mb-1.5 px-1 pt-1">
              <span className="material-symbols-outlined text-base text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên tour, điểm đến..."
                className="w-full bg-zinc-50 border border-zinc-200 rounded-md pl-8 pr-7 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              )}
            </div>

            {/* List options */}
            <div className="max-h-[240px] overflow-y-auto space-y-0.5 pt-0.5">
              {filteredTours.length === 0 ? (
                <div className="p-4 text-center text-xs text-zinc-400">
                  Không tìm thấy tour phù hợp
                </div>
              ) : (
                filteredTours.map((tour) => {
                  const isSelected = String(tour.id) === String(tourId);
                  return (
                    <button
                      key={tour.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(tour.id)}
                      className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-md text-xs text-left transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-zinc-900 text-white font-semibold"
                          : "hover:bg-zinc-100/80 text-zinc-800"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{tour.name}</div>
                        <div
                          className={`text-[11px] truncate mt-0.5 ${
                            isSelected ? "text-zinc-300" : "text-zinc-600"
                          }`}
                        >
                          {tour.duration_days ? `${tour.duration_days} ngày` : ""}{" "}
                          {tour.status ? `• Trạng thái: ${tour.status}` : ""}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-sm shrink-0 text-white">
                          check
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
