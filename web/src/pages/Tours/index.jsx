import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import TourCard from "./components/TourCard";
import TourFilters from "./components/TourFilters";
import ToursHero from "./components/ToursHero";
import ToursToolbar from "./components/ToursToolbar";
import "./Tours.css";

/**
 * Trang danh sách tour trọn gói (Tours Page).
 * Tách từ .design/Tours.html:
 * - Khối 1: HeroSection (ToursHero) gồm Banner, Search Bar, Trust Badges
 * - Khối 2: FilterSidebar (TourFilters) 3 cột bên trái
 * - Khối 3: TourCatalogSection gồm Toolbar (ToursToolbar) + Lưới thẻ tour (TourCard) 9 cột bên phải
 * Quản lý toàn bộ URL search params, skeleton loading và empty state.
 */
export default function Tours() {
  const [sp, setSp] = useSearchParams();
  const [provinces, setProvinces] = useState([]);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [viewMode, setViewMode] = useState("grid");

  // Đọc các giá trị lọc từ URL search params
  const provinceId = sp.get("province_id") || "";
  const departFrom = sp.get("depart_from") || "";
  const departTo = sp.get("depart_to") || "";
  const priceMin = sp.get("price_min") || "";
  const priceMax = sp.get("price_max") || sp.get("max_price") || "";
  const maxDays = sp.get("max_days") || "";
  const minDays = sp.get("min_days") || "";
  const guests = sp.get("guests") || "";
  const sort = sp.get("sort") || "";

  // Gom các filter thành một object để truyền xuống component con
  const filters = useMemo(
    () => ({
      province_id: provinceId,
      depart_from: departFrom,
      depart_to: departTo,
      price_min: priceMin,
      price_max: priceMax,
      max_days: maxDays,
      min_days: minDays,
      guests: guests,
    }),
    [provinceId, departFrom, departTo, priceMin, priceMax, maxDays, minDays, guests]
  );

  // Tải danh sách tỉnh/thành có tour phục vụ bộ lọc
  useEffect(() => {
    let mounted = true;
    api.tourProvinces()
      .then((res) => {
        if (mounted && res?.provinces) {
          setProvinces(res.provinces);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Tải danh sách tour theo bộ lọc từ backend
  useEffect(() => {
    setIsLoading(true);
    const queryParams = {
      province_id: provinceId,
      depart_from: departFrom,
      depart_to: departTo,
      price_min: priceMin,
      price_max: priceMax,
      max_days: maxDays,
      min_days: minDays,
      guests: guests,
      sort: sort,
    };

    api.tours(queryParams)
      .then((res) => {
        setData(res);
      })
      .catch(() => {
        setData({ items: [], total: 0 });
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [provinceId, departFrom, departTo, priceMin, priceMax, maxDays, minDays, guests, sort]);

  // Đếm số lượng điều kiện lọc đang được kích hoạt
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (provinceId) count++;
    if (departFrom) count++;
    if (departTo) count++;
    if (priceMin || priceMax) count++;
    if (maxDays || minDays) count++;
    if (guests && guests !== "1") count++;
    return count;
  }, [provinceId, departFrom, departTo, priceMin, priceMax, maxDays, minDays, guests]);

  // Cập nhật bộ lọc lên URL
  const handleUpdateFilter = (updates) => {
    const next = Object.fromEntries(sp);
    Object.entries(updates).forEach(([key, val]) => {
      if (val === "" || val == null) {
        delete next[key];
        if (key === "price_max") delete next["max_price"];
      } else {
        next[key] = String(val);
        if (key === "price_max") delete next["max_price"];
      }
    });
    setSp(next);
  };

  // Gỡ bỏ một hoặc nhiều điều kiện lọc cụ thể
  const handleRemoveFilter = (keys) => {
    const next = Object.fromEntries(sp);
    keys.forEach((k) => {
      delete next[k];
      if (k === "price_max") delete next["max_price"];
    });
    setSp(next);
  };

  // Cập nhật sắp xếp
  const handleSortChange = (newSort) => {
    const next = Object.fromEntries(sp);
    if (!newSort) {
      delete next.sort;
    } else {
      next.sort = newSort;
    }
    setSp(next);
  };

  // Đặt lại toàn bộ bộ lọc
  const handleResetFilters = () => {
    const next = {};
    if (sort) next.sort = sort;
    setSp(next);
  };

  return (
    <div className="tours-page">
      {/* KHỐI 1: HERO SECTION theo .design/Tours.html (dòng 50-81) */}
      <div className="tours-page__hero-pane">
        <ToursHero
          provinces={provinces}
          selectedProvinceId={provinceId}
          onSelectProvince={(pId) => handleUpdateFilter({ province_id: pId })}
        />
      </div>

      {/* KHỐI 2 & 3: FILTER CỐ ĐỊNH + DANH SÁCH TOUR CUỘN RIÊNG */}
      <div className="tours-page__body">
        <TourFilters
          filters={filters}
          provinces={provinces}
          onFilterChange={handleUpdateFilter}
          onReset={handleResetFilters}
          activeCount={activeFilterCount}
          isOpenMobile={isMobileFilterOpen}
          onCloseMobile={() => setIsMobileFilterOpen(false)}
        />

        <main id="tours-catalog" className="tours-page__scroll">
          <div className="tours-page__container">
            {/* THANH CÔNG CỤ: Số lượng, Sắp xếp, View mode, Active tags */}
            <ToursToolbar
              total={data?.total || data?.items?.length || 0}
              isLoading={isLoading}
              sort={sort}
              onSortChange={handleSortChange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              filters={filters}
              provinces={provinces}
              onRemoveFilter={handleRemoveFilter}
              onReset={handleResetFilters}
              onOpenMobileFilters={() => setIsMobileFilterOpen(true)}
              activeCount={activeFilterCount}
            />

            {/* Trạng thái tải: Skeleton Loading */}
            {isLoading && (
              <div className="tours-page__grid" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="tours-skeleton-card">
                    <div className="tours-skeleton-media" />
                    <div className="tours-skeleton-body">
                      <div className="tours-skeleton-line-title" />
                      <div className="tours-skeleton-line-feature" />
                      <div
                        className="tours-skeleton-line-feature"
                        style={{ width: "50%" }}
                      />
                    </div>
                    <div className="tours-skeleton-footer">
                      <div className="tours-skeleton-price" />
                      <div className="tours-skeleton-btn" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Trạng thái rỗng (Empty state) */}
            {!isLoading && (!data?.items || data.items.length === 0) && (
              <div className="tours-empty">
                <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500 mb-4">
                  <i className="fa-solid fa-compass text-3xl" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  Không tìm thấy tour phù hợp
                </h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">
                  Không có chuyến đi nào thoả mãn toàn bộ tiêu chí lọc hiện tại.
                  Bạn hãy thử nới lỏng khoảng ngày, mức ngân sách hoặc chọn điểm đến khác nhé.
                </p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="px-6 py-2.5 bg-[#ea580c] hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer inline-flex items-center gap-2 shadow-sm"
                  >
                    <i className="fa-solid fa-rotate-left" />
                    <span>Xóa toàn bộ bộ lọc</span>
                  </button>
                )}
              </div>
            )}

            {/* Lưới / Danh sách các thẻ tour */}
            {!isLoading && data?.items?.length > 0 && (
              <div
                className={
                  viewMode === "list" ? "tours-page__list" : "tours-page__grid"
                }
              >
                {data.items.map((tour) => (
                  <TourCard
                    key={tour.id}
                    tour={tour}
                    viewMode={viewMode}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
