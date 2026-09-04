import React from "react";

export default function PlaceListControls({
  categories,
  activeCategory,
  onCategoryChange,
  quickFilters,
  selectedQuickFilters,
  onToggleQuickFilter,
  onClearAllFilters,
  hasActiveFilters,
}) {
  return (
    <section className="place-list-controls">
      {/* Category Tabs */}
      <div className="place-list-tabs no-scrollbar">
        {Object.entries(categories).map(([k, v]) => {
          const isActive = k === activeCategory || (k === "tat_ca" && !activeCategory);
          return (
            <button
              key={k}
              type="button"
              onClick={() => onCategoryChange(k)}
              className={`place-list-tab ${isActive ? "place-list-tab--active" : ""}`}
            >
              <i className={`fa-solid ${v.icon}`} />
              <span>{v.ten}</span>
            </button>
          );
        })}
      </div>

      {/* Quick Filter Chips */}
      <div className="place-list-quick-filters">
        <span className="place-list-filters-label">Bộ lọc nhanh:</span>
        <div className="place-list-chips-container">
          {quickFilters.map((f) => {
            const isSelected = selectedQuickFilters.some((sf) => sf.id === f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onToggleQuickFilter(f)}
                className={`place-filter-chip ${isSelected ? "place-filter-chip--active" : ""}`}
              >
                <i className={`fa-solid ${f.icon}`} />
                <span>{f.label}</span>
                {isSelected && <i className="fa-solid fa-check text-xs ml-1" />}
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearAllFilters}
              className="place-filter-clear-btn"
              title="Xoá tất cả bộ lọc"
            >
              <i className="fa-solid fa-arrow-rotate-left mr-1" /> Xoá bộ lọc
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
