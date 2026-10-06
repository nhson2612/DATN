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
    <div className="op-departure-picker__div-1 op-departure-picker__div-1">
      <div className="op-departure-picker__div-2">
        <div className="op-departure-picker__div-3 op-departure-picker__div-2">
          <span className="material-symbols-outlined op-departure-picker__span-4">travel_explore</span>
        </div>
        <div className="op-departure-picker__div-5">
          <span className="op-departure-picker__icon-6">
            Tour đang quản lý đợt
          </span>
          <span className="op-departure-picker__span-7">
            {selectedTour ? selectedTour.name : "Chưa chọn tour nào"}
          </span>
        </div>
      </div>

      {/* Combobox Searchable Dropdown */}
      <div className="op-departure-picker__div-8" ref={containerRef}>
        {/* Trigger button */}
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen(!open)}
          className="op-departure-picker__element-9 op-departure-picker__element-3"
        >
          <div className="op-departure-picker__div-10">
            <span className="material-symbols-outlined op-departure-picker__span-11 op-departure-picker__span-4">
              search
            </span>
            <span className="op-departure-picker__icon-12">
              {selectedTour ? selectedTour.name : "Tìm & chọn tour..."}
            </span>
          </div>
          <span className="material-symbols-outlined op-departure-picker__span-13 op-departure-picker__span-5">
            unfold_more
          </span>
        </button>

        {/* Popover content */}
        {open && (
          <div
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            className="fade-in op-departure-picker__div-14 op-departure-picker__div-6"
          >
            {/* Input search */}
            <div className="op-departure-picker__div-15">
              <span className="material-symbols-outlined op-departure-picker__span-16">
                search
              </span>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên tour, điểm đến..."
                className="op-departure-picker__element-17 op-departure-picker__element-7"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="op-departure-picker__button-18 op-departure-picker__button-8"
                >
                  <span className="material-symbols-outlined op-departure-picker__span-19">close</span>
                </button>
              )}
            </div>

            {/* List options */}
            <div className="op-departure-picker__div-20">
              {filteredTours.length === 0 ? (
                <div className="op-departure-picker__div-21">
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
                      className={`op-departure-picker__element-24   ${
                        isSelected
                          ? "op-departure-picker__element-22--variant-1"
                          : "op-departure-picker__element-23--variant-2"
                      }`}
                    >
                      <div className="op-departure-picker__div-25">
                        <div className="op-departure-picker__div-26">{tour.name}</div>
                        <div
                          className={`op-departure-picker__div-29   ${
                            isSelected ? "op-departure-picker__div-27--variant-1" : "op-departure-picker__div-28--variant-2"
                          }`}
                        >
                          {tour.duration_days ? `${tour.duration_days} ngày` : ""}{" "}
                          {tour.status ? `• Trạng thái: ${tour.status}` : ""}
                        </div>
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined op-departure-picker__span-30 op-departure-picker__span-9">
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
