import React from "react";

export default function PlaceListHero({
  destination,
  destinationsList,
  selectedDestName,
  nhomName,
  timKiemInput,
  onSearchChange,
  onSearchClear,
  onDestinationChange,
  onBackClick,
}) {
  return (
    <header className="place-list-hero">
      <div className="place-list-hero__content">
        <button type="button" onClick={onBackClick} className="place-list-hero__back-btn">
          <i className="fa-solid fa-arrow-left" /> Trang trước
        </button>

        <div className="place-list-hero__header">
          <div>
            <span className="place-list-hero__badge">
              <i className="fa-solid fa-compass text-emerald-500 mr-1.5" />
              Khám phá Du lịch
            </span>
            <h1 className="place-list-hero__title">
              {nhomName || "Địa điểm"} {destination ? `tại ${selectedDestName}` : "trên Toàn quốc"}
            </h1>
            <p className="place-list-hero__subtitle">
              Tìm kiếm hàng nghìn điểm tham quan, ẩm thực, vui chơi và chỗ lưu trú lý tưởng cho chuyến đi của bạn.
            </p>
          </div>

          {/* Destination Selector Dropdown */}
          <div className="place-list-hero__selector">
            <label htmlFor="destination-select" className="place-list-hero__label">
              <i className="fa-solid fa-location-dot text-emerald-600" /> Điểm đến:
            </label>
            <select
              id="destination-select"
              value={destination}
              onChange={onDestinationChange}
              className="place-list-hero__select"
            >
              <option value="">🇻🇳 Tất cả tỉnh thành (Toàn quốc)</option>
              {destinationsList.map((d) => (
                <option key={d.slug} value={d.slug}>
                  {d.name} ({d.so_dia_diem.toLocaleString("vi-VN")} điểm)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search Bar */}
        <div className="place-list-search-bar">
          <div className="place-list-search-input-wrapper">
            <i className="fa-solid fa-magnifying-glass place-list-search-icon" />
            <input
              type="text"
              value={timKiemInput}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Nhập tên địa điểm, danh thắng, nhà hàng hoặc khu nghỉ dưỡng..."
              className="place-list-search-input"
            />
            {timKiemInput && (
              <button
                type="button"
                onClick={onSearchClear}
                className="place-list-search-clear"
                title="Xoá tìm kiếm"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
