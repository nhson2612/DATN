import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api";
import AppNavbar from "../../shared/layout/AppNavbar";
import TourEmptyState from "./components/TourEmptyState";
import "./Tours.css";

// Bản đồ ảnh dự phòng nội bộ theo tỉnh/địa danh đảm bảo không bao giờ bị lỗi ảnh
const LOCAL_PROVINCE_IMAGES = {
  "quảng ninh": "/images/tour-halong.jpg",
  "đà nẵng": "/images/tour-danang.jpg",
  "kiên giang": "/images/tour-phuquoc.jpg",
  "phú quốc": "/images/tour-phuquoc.jpg",
  "lào cai": "/images/tour-sapa.jpg",
  "sapa": "/images/tour-sapa.jpg",
  "khánh hòa": "/images/provinces/khanh-hoa.jpg",
  "nha trang": "/images/provinces/khanh-hoa.jpg",
  "lâm đồng": "/images/provinces/lam-dong.jpg",
  "đà lạt": "/images/provinces/lam-dong.jpg",
  "hà nội": "/images/provinces/ha-noi.jpg",
  "hồ chí minh": "/images/provinces/ho-chi-minh.jpg",
  "bắc ninh": "/images/provinces/bac-ninh.jpg",
};

function resolveTourImage(tour) {
  const prov = (tour?.province_name || tour?.province || "").toLowerCase();
  const slug = (tour?.slug || "").toLowerCase();

  for (const [key, path] of Object.entries(LOCAL_PROVINCE_IMAGES)) {
    if (prov.includes(key) || slug.includes(key)) {
      return path;
    }
  }

  if (tour?.cover_url && !tour.cover_url.includes("example.com") && !tour.cover_url.includes("uploads/tours")) {
    return tour.cover_url;
  }

  return "/images/tour-halong.jpg";
}

// CẤU HÌNH CÁC TÙY CHỌN BỘ LỌC
export const DURATION_OPTIONS = [
  { value: "", label: "Tất cả thời lượng" },
  { value: "1", label: "1 ngày" },
  { value: "2", label: "2 ngày 1 đêm" },
  { value: "3", label: "3 ngày 2 đêm" },
  { value: "4", label: "Từ 4 ngày trở lên" },
];

export const PRICE_OPTIONS = [
  { value: "", label: "Tất cả mức giá" },
  { value: "under2m", label: "Dưới 2.000.000₫" },
  { value: "2mto4m", label: "2 - 4 triệu" },
  { value: "above4m", label: "Trên 4 triệu" },
];

export const SORT_OPTIONS = [
  { value: "default", label: "Mặc định" },
  { value: "sale_first", label: "Ưu đãi nhiều nhất" },
  { value: "price_asc", label: "Giá tăng dần" },
  { value: "price_desc", label: "Giá giảm dần" },
];

function formatPrice(val) {
  return Number(val || 0).toLocaleString("vi-VN") + "₫";
}

export default function Tours({ user, onNeedAuth, onLogout }) {
  const [sp] = useSearchParams();

  // Danh sách tỉnh thành từ Backend API
  const [provinces, setProvinces] = useState([]);

  // Dữ liệu tour và phân trang từ Backend API
  const [tours, setTours] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  // Bộ lọc
  const [searchQuery, setSearchQuery] = useState(sp.get("q") || "");
  const [debouncedQuery, setDebouncedQuery] = useState(sp.get("q") || "");
  const [selectedProvinceIds, setSelectedProvinceIds] = useState([]);
  const [selectedDuration, setSelectedDuration] = useState("");
  const [selectedPriceRange, setSelectedPriceRange] = useState("");
  const [selectedSort, setSelectedSort] = useState("default");

  // Popover đang mở: null | "province" | "duration" | "price" | "sort"
  const [openPopover, setOpenPopover] = useState(null);
  const [provSearch, setProvSearch] = useState("");
  const filterBarRef = useRef(null);

  // Đóng popover khi click bên ngoài
  useEffect(() => {
    function handleClickOutside(e) {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target)) {
        setOpenPopover(null);
      }
    }
    if (openPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPopover]);

  // Lọc danh sách tỉnh thành theo từ khóa tìm nhanh trong popover
  const filteredProvinces = useMemo(() => {
    if (!provSearch.trim()) return provinces;
    const q = provSearch.trim().toLowerCase();
    return provinces.filter((p) => p.name.toLowerCase().includes(q));
  }, [provinces, provSearch]);

  // Danh sách các tỉnh đang được chọn làm active chips
  const activeProvinces = useMemo(() => {
    if (!selectedProvinceIds || selectedProvinceIds.length === 0) return [];
    return provinces.filter((p) => selectedProvinceIds.includes(p.id));
  }, [provinces, selectedProvinceIds]);

  const hasAnyFilter = useMemo(() => {
    return Boolean(
      searchQuery.trim() ||
      selectedProvinceIds.length > 0 ||
      selectedDuration ||
      selectedPriceRange ||
      selectedSort !== "default"
    );
  }, [searchQuery, selectedProvinceIds, selectedDuration, selectedPriceRange, selectedSort]);

  // Thao tác toggle tỉnh thành trong bộ lọc
  const handleToggleProvince = (id) => {
    setSelectedProvinceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    setPage(1);
  };

  const handleRemoveProvince = (id) => {
    setSelectedProvinceIds((prev) => prev.filter((x) => x !== id));
    setPage(1);
  };

  const handleClearAllProvinces = () => {
    setSelectedProvinceIds([]);
    setPage(1);
  };

  // Hero carousel (Lấy các tour giảm giá/nổi bật nhất từ backend)
  const [heroSlides, setHeroSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Yêu thích
  const [favorites, setFavorites] = useState(() => {
    try {
      const saved = localStorage.getItem("aura_tour_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const isInitialMount = useRef(true);

  // 1. Lấy danh sách tỉnh thành và tour nổi bật cho Hero từ Backend khi khởi động
  useEffect(() => {
    // Lấy tỉnh thành có tour mở bán
    api
      .tourProvinces(false)
      .then((res) => {
        if (res?.provinces && Array.isArray(res.provinces)) {
          setProvinces(res.provinces);
        }
      })
      .catch((err) => console.warn("Lỗi tải tỉnh thành:", err?.message));

    // Lấy top 3-5 tour ưu đãi nhất làm Hero Carousel
    api
      .tours({ sort: "sale_first", page: 1, page_size: 5 })
      .then((res) => {
        if (res?.items && res.items.length > 0) {
          setHeroSlides(res.items.slice(0, 3));
        }
      })
      .catch((err) => console.warn("Lỗi tải hero tours:", err?.message));
  }, []);

  // 2. Debounce tìm kiếm từ khóa 350ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1); // Reset về trang 1 khi gõ tìm kiếm mới
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Tự động chuyển slide Hero mỗi 6s
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  // 4. Hàm gọi Backend API tìm kiếm và lọc tour
  const fetchToursFromBackend = useCallback(() => {
    setLoading(true);

    const params = {
      page,
      page_size: pageSize,
    };

    if (debouncedQuery.trim()) {
      params.q = debouncedQuery.trim();
    }

    if (selectedProvinceIds.length > 0) {
      params.province_ids = selectedProvinceIds.join(",");
    }

    if (selectedDuration === "1") {
      params.min_days = 1;
      params.max_days = 1;
    } else if (selectedDuration === "2") {
      params.min_days = 2;
      params.max_days = 2;
    } else if (selectedDuration === "3") {
      params.min_days = 3;
      params.max_days = 3;
    } else if (selectedDuration === "4") {
      params.min_days = 4;
    }

    if (selectedPriceRange === "under2m") {
      params.price_max = 2000000;
    } else if (selectedPriceRange === "2mto4m") {
      params.price_min = 2000000;
      params.price_max = 4000000;
    } else if (selectedPriceRange === "above4m") {
      params.price_min = 4000000;
    }

    if (selectedSort === "price-asc" || selectedSort === "price_asc") {
      params.sort = "price_asc";
    } else if (selectedSort === "price-desc" || selectedSort === "price_desc") {
      params.sort = "price_desc";
    } else if (selectedSort === "sale-first" || selectedSort === "sale_first") {
      params.sort = "sale_first";
    }

    api
      .tours(params)
      .then((res) => {
        if (res?.items) {
          setTours(res.items);
          setTotal(res.total ?? res.items.length);
        } else {
          setTours([]);
          setTotal(0);
        }
      })
      .catch((err) => {
        console.error("Lỗi khi gọi API tìm kiếm tour:", err);
        setTours([]);
        setTotal(0);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    page,
    pageSize,
    debouncedQuery,
    selectedProvinceIds,
    selectedDuration,
    selectedPriceRange,
    selectedSort,
  ]);

  // Gọi API mỗi khi filter hoặc page thay đổi
  useEffect(() => {
    fetchToursFromBackend();
  }, [fetchToursFromBackend]);

  // Xử lý chuyển trang
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== page) {
      setPage(newPage);
      const gridEl = document.getElementById("toursListAnchor");
      if (gridEl) {
        gridEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Đặt lại toàn bộ bộ lọc về mặc định
  const handleResetFilters = () => {
    setSearchQuery("");
    setDebouncedQuery("");
    setSelectedProvinceIds([]);
    setSelectedDuration("");
    setSelectedPriceRange("");
    setSelectedSort("default");
    setPage(1);
    setOpenPopover(null);
  };

  // Chọn nhanh gợi ý điểm đến từ Empty State
  const handleSelectSuggestion = (destName) => {
    const term = destName.toLowerCase();
    const matched = provinces.find((p) => p.name.toLowerCase().includes(term));
    if (matched) {
      setSelectedProvinceIds([matched.id]);
      setSearchQuery("");
      setDebouncedQuery("");
    } else {
      setSelectedProvinceIds([]);
      setSearchQuery(destName);
      setDebouncedQuery(destName);
    }
    setSelectedDuration("");
    setSelectedPriceRange("");
    setSelectedSort("default");
    setPage(1);
  };

  // Toggle favorite
  const toggleFavorite = (tourId) => {
    setFavorites((prev) => {
      const next = prev.includes(tourId)
        ? prev.filter((id) => id !== tourId)
        : [...prev, tourId];
      try {
        localStorage.setItem("aura_tour_favorites", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <div className="tours-page-shell">
      {/* 1. TOP NAVBAR HỆ THỐNG */}
      <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />

      <div className="tours-page-wrap">
        {/* HEADER SECTION */}
        <div className="matdash-page-header">
          <h1 className="matdash-page-title">Hành trình du lịch nổi bật</h1>
        </div>

        {/* ====================================================================
             PHẦN 1: HERO FEATURED SPLIT CARD (CAROUSEL TỪ BACKEND TOURS)
             ==================================================================== */}
        {heroSlides.length > 0 && (
          <section className="hero-featured-card" aria-label="Tour nổi bật ưu đãi">
            <div className="carousel-window">
              <div
                className="carousel-track"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {heroSlides.map((slide) => {
                  const imgUrl = resolveTourImage(slide);
                  const isSale = slide.is_sale || (slide.discount_pct && slide.discount_pct > 0);
                  const discountPct = slide.discount_pct || (slide.original_price && slide.price_from ? Math.round(((slide.original_price - slide.price_from) / slide.original_price) * 100) : 0);

                  return (
                    <div className="carousel-slide" key={slide.id}>
                      <div className="slide-copy">
                        <div className="slide-tag-row">
                          <span className="slide-category-pill">
                            {slide.province_name || "Việt Nam"}
                          </span>
                          {isSale && discountPct > 0 && (
                            <span className="slide-deal-badge">
                              Ưu đãi độc quyền giảm {discountPct}%
                            </span>
                          )}
                        </div>

                        <h2 className="slide-title">{slide.name}</h2>

                        <p className="slide-desc">
                          {slide.summary || slide.description || "Hành trình khám phá trọn gói chuẩn mực kết hợp lưu trú cao cấp, ẩm thực bản địa và lịch trình được thiết kế tỉ mỉ."}
                        </p>

                        <div className="slide-footer-row">
                          <div className="slide-price-box">
                            <span className="slide-price-main">
                              {formatPrice(slide.price_from)}
                            </span>
                            {slide.original_price && slide.original_price > slide.price_from && (
                              <span className="slide-price-struck">
                                {formatPrice(slide.original_price)}
                              </span>
                            )}
                          </div>
                          <Link
                            to={`/tours/${slide.slug || slide.id}`}
                            className="slide-cta-button"
                          >
                            Đặt chuyến đi ngay →
                          </Link>
                        </div>
                      </div>

                      <div className="slide-visual-box">
                        {isSale && discountPct > 0 && (
                          <span className="ribbon-tag">-{discountPct}%</span>
                        )}
                        <img
                          src={imgUrl}
                          alt={slide.name}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/images/tour-halong.jpg";
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {heroSlides.length > 1 && (
              <div className="carousel-nav-row">
                <div className="carousel-indicators">
                  {heroSlides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`carousel-dot ${idx === currentSlide ? "active" : ""}`}
                      onClick={() => setCurrentSlide(idx)}
                      aria-label={`Slide ${idx + 1}`}
                    />
                  ))}
                </div>
                <div className="carousel-btn-group">
                  <button
                    type="button"
                    className="carousel-arrow"
                    onClick={() =>
                      setCurrentSlide(
                        (prev) => (prev - 1 + heroSlides.length) % heroSlides.length
                      )
                    }
                    aria-label="Trước"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="carousel-arrow"
                    onClick={() =>
                      setCurrentSlide((prev) => (prev + 1) % heroSlides.length)
                    }
                    aria-label="Tiếp"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ====================================================================
             PHẦN 2: THANH BỘ LỌC DU LỊCH TINH GỌN (FLOATING POPOVERS TỰ ĐỘNG ĐÓNG)
             ==================================================================== */}
        <div className="travel-filter-bar" ref={filterBarRef} id="all-tours">
          {/* Ô TÌM KIẾM TỪ KHÓA */}
          <div className="filter-search-box">
            <svg className="filter-search-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              className="filter-search-field"
              placeholder="Tìm theo tên tour, điểm đến..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="filter-clear-search-btn"
                onClick={() => setSearchQuery("")}
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>

          <div className="filter-pills-cluster">
            {/* 1. NÚT ĐIỂM ĐẾN (POPOVER) */}
            <div className="popover-anchor">
              <button
                type="button"
                className={`filter-dropdown-pill ${selectedProvinceIds.length > 0 ? "has-value" : ""} ${openPopover === "province" ? "is-open" : ""}`}
                onClick={() => setOpenPopover(openPopover === "province" ? null : "province")}
              >
                <span>{selectedProvinceIds.length > 0 ? `Điểm đến (${selectedProvinceIds.length})` : "Điểm đến"}</span>
                <span className="pill-arrow">▾</span>
              </button>

              {openPopover === "province" && (
                <div className="floating-popover-menu">
                  <div className="floating-popover-header">
                    <span>Chọn điểm đến</span>
                    {selectedProvinceIds.length > 0 && (
                      <button type="button" className="popover-reset-btn" onClick={handleClearAllProvinces}>Bỏ chọn</button>
                    )}
                  </div>
                  {provinces.length > 6 && (
                    <div className="popover-search-input">
                      <input
                        type="text"
                        placeholder="Tìm tỉnh thành..."
                        value={provSearch}
                        onChange={(e) => setProvSearch(e.target.value)}
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="popover-items-list">
                    {filteredProvinces.map((p) => {
                      const isChecked = selectedProvinceIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          className={`popover-row-item ${isChecked ? "checked" : ""}`}
                          onClick={() => handleToggleProvince(p.id)}
                        >
                          <span className="checkbox-indicator">{isChecked ? "✓" : ""}</span>
                          <span>{p.name.replace(/^(Thành phố|Tỉnh)\s+/i, "")}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. NÚT THỜI LƯỢNG (POPOVER) */}
            <div className="popover-anchor">
              <button
                type="button"
                className={`filter-dropdown-pill ${selectedDuration ? "has-value" : ""} ${openPopover === "duration" ? "is-open" : ""}`}
                onClick={() => setOpenPopover(openPopover === "duration" ? null : "duration")}
              >
                <span>{selectedDuration ? (DURATION_OPTIONS.find((d) => d.value === selectedDuration)?.label || "Thời lượng") : "Thời lượng"}</span>
                {selectedDuration ? (
                  <span
                    className="pill-clear-x"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDuration("");
                      setPage(1);
                    }}
                  >
                    ✕
                  </span>
                ) : (
                  <span className="pill-arrow">▾</span>
                )}
              </button>

              {openPopover === "duration" && (
                <div className="floating-popover-menu small-menu">
                  <div className="floating-popover-header">
                    <span>Thời lượng chuyến đi</span>
                  </div>
                  <div className="popover-items-list">
                    {DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`popover-row-item ${selectedDuration === opt.value ? "checked" : ""}`}
                        onClick={() => {
                          setSelectedDuration(opt.value);
                          setPage(1);
                          setOpenPopover(null);
                        }}
                      >
                        <span className="radio-indicator">{selectedDuration === opt.value ? "●" : "○"}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. NÚT MỨC GIÁ (POPOVER) */}
            <div className="popover-anchor">
              <button
                type="button"
                className={`filter-dropdown-pill ${selectedPriceRange ? "has-value" : ""} ${openPopover === "price" ? "is-open" : ""}`}
                onClick={() => setOpenPopover(openPopover === "price" ? null : "price")}
              >
                <span>{selectedPriceRange ? (PRICE_OPTIONS.find((p) => p.value === selectedPriceRange)?.label || "Mức giá") : "Mức giá"}</span>
                {selectedPriceRange ? (
                  <span
                    className="pill-clear-x"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPriceRange("");
                      setPage(1);
                    }}
                  >
                    ✕
                  </span>
                ) : (
                  <span className="pill-arrow">▾</span>
                )}
              </button>

              {openPopover === "price" && (
                <div className="floating-popover-menu small-menu">
                  <div className="floating-popover-header">
                    <span>Khoảng giá ngân sách</span>
                  </div>
                  <div className="popover-items-list">
                    {PRICE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`popover-row-item ${selectedPriceRange === opt.value ? "checked" : ""}`}
                        onClick={() => {
                          setSelectedPriceRange(opt.value);
                          setPage(1);
                          setOpenPopover(null);
                        }}
                      >
                        <span className="radio-indicator">{selectedPriceRange === opt.value ? "●" : "○"}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 4. NÚT SẮP XẾP (POPOVER) */}
            <div className="popover-anchor">
              <button
                type="button"
                className={`filter-dropdown-pill ${selectedSort !== "default" ? "has-value" : ""} ${openPopover === "sort" ? "is-open" : ""}`}
                onClick={() => setOpenPopover(openPopover === "sort" ? null : "sort")}
              >
                <span>{selectedSort !== "default" ? (SORT_OPTIONS.find((s) => s.value === selectedSort)?.label || "Sắp xếp") : "Sắp xếp"}</span>
                {selectedSort !== "default" ? (
                  <span
                    className="pill-clear-x"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSort("default");
                      setPage(1);
                    }}
                  >
                    ✕
                  </span>
                ) : (
                  <span className="pill-arrow">▾</span>
                )}
              </button>

              {openPopover === "sort" && (
                <div className="floating-popover-menu small-menu">
                  <div className="floating-popover-header">
                    <span>Ưu tiên hiển thị</span>
                  </div>
                  <div className="popover-items-list">
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`popover-row-item ${selectedSort === opt.value ? "checked" : ""}`}
                        onClick={() => {
                          setSelectedSort(opt.value);
                          setPage(1);
                          setOpenPopover(null);
                        }}
                      >
                        <span className="radio-indicator">{selectedSort === opt.value ? "●" : "○"}</span>
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* NÚT ĐẶT LẠI NẾU CÓ BỘ LỌC */}
            {hasAnyFilter && (
              <button type="button" className="filter-clear-all-pill" onClick={handleResetFilters}>
                ✕ Xóa lọc
              </button>
            )}
          </div>
        </div>

        {/* CÁC CHIP TỈNH ĐANG CHỌN (NẾU CÓ NHIỀU TỈNH) */}
        {activeProvinces.length > 0 && (
          <div className="active-provinces-ribbon">
            <span className="active-provinces-lead">Đang lọc theo:</span>
            {activeProvinces.map((prov) => (
              <span className="active-prov-tag" key={prov.id}>
                {prov.name.replace(/^(Thành phố|Tỉnh)\s+/i, "")}
                <button type="button" onClick={() => handleRemoveProvince(prov.id)}>✕</button>
              </span>
            ))}
            <button type="button" className="active-prov-clear-all" onClick={handleClearAllProvinces}>Xóa tất cả tỉnh</button>
          </div>
        )}

        <div id="toursListAnchor" />

        {/* ====================================================================
             PHẦN 3: LƯỚI CARD DU LỊCH TỪ BACKEND
             ==================================================================== */}
        {loading ? (
          <div className="matdash-grid" aria-busy="true" aria-label="Đang tải danh sách tour">
            {Array.from({ length: pageSize }).map((_, idx) => (
              <div className="tour-card tour-card-skeleton" key={idx}>
                <div className="card-photo-wrap skeleton-box skeleton-photo" />
                <div className="card-body-wrap">
                  <div className="card-content-top">
                    <div className="card-kicker-row">
                      <span className="skeleton-box skeleton-pill" />
                      <span className="skeleton-box skeleton-rating" />
                    </div>
                    <div className="skeleton-box skeleton-title-line-1" />
                    <div className="skeleton-box skeleton-title-line-2" />
                  </div>
                  <div className="card-bottom-action-row">
                    <div className="skeleton-price-stack">
                      <div className="skeleton-box skeleton-price-val" />
                      <div className="skeleton-box skeleton-price-sub" />
                    </div>
                    <div className="skeleton-box skeleton-cta-btn" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : tours.length === 0 ? (
          <TourEmptyState
            onReset={handleResetFilters}
            onSelectSuggestion={handleSelectSuggestion}
            hasActiveFilters={hasAnyFilter}
          />
        ) : (
          <div className="matdash-grid">
            {tours.map((tour) => {
              const isFav = favorites.includes(tour.id);
              const imgUrl = resolveTourImage(tour);
              const durDays = tour.duration_days || 3;
              const durText = `${durDays}N${Math.max(1, durDays - 1)}Đ`;
              const isSale = tour.is_sale || (tour.discount_pct && tour.discount_pct > 0);
              const discountPct = tour.discount_pct || (tour.original_price && tour.price_from ? Math.round(((tour.original_price - tour.price_from) / tour.original_price) * 100) : 0);

              return (
                <article className="tour-card" key={tour.id}>
                  <div className="card-photo-wrap">
                    <Link to={`/tours/${tour.slug || tour.id}`}>
                      <img
                        src={imgUrl}
                        alt={tour.name}
                        className="card-photo-img"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/images/tour-halong.jpg";
                        }}
                      />
                    </Link>

                    {isSale && discountPct > 0 && (
                      <span className="ribbon-tag">-{discountPct}%</span>
                    )}

                    <button
                      type="button"
                      className={`card-heart-btn ${isFav ? "active" : ""}`}
                      aria-label="Lưu vào yêu thích"
                      onClick={() => toggleFavorite(tour.id)}
                    >
                      <svg viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </button>

                    <span className="card-duration-badge">{durText}</span>
                  </div>

                  <div className="card-body-wrap">
                    <div className="card-content-top">
                      <div className="card-kicker-row">
                        <span className="card-tag-pill">
                          {tour.province_name ? tour.province_name.replace(/^(Thành phố|Tỉnh)\s+/i, "") : "Việt Nam"}
                        </span>
                        <div className="card-rating-group">
                          <span className="star">★</span> 4.9{" "}
                          <span className="card-reviews-num">(450+)</span>
                        </div>
                      </div>

                      <h3 className="card-title-heading">
                        <Link to={`/tours/${tour.slug || tour.id}`}>{tour.name}</Link>
                      </h3>
                    </div>

                    <div className="card-bottom-action-row">
                      <div className="card-price-group">
                        <span className="card-price-current">
                          {formatPrice(tour.price_from)}
                        </span>
                        {tour.original_price && tour.original_price > tour.price_from ? (
                          <span className="card-price-old">
                            {formatPrice(tour.original_price)}
                          </span>
                        ) : (
                          <span className="card-price-sub">/ khách trọn gói</span>
                        )}
                      </div>

                      <Link
                        to={`/tours/${tour.slug || tour.id}`}
                        className="card-cta-btn"
                      >
                        Đặt tour →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* PHÂN TRANG TƯƠNG TÁC THẬT */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <button
              type="button"
              className="page-btn"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
              style={{ opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? "not-allowed" : "pointer" }}
            >
              ‹
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pNum) => (
              <button
                key={pNum}
                type="button"
                className={`page-btn ${pNum === page ? "active" : ""}`}
                onClick={() => handlePageChange(pNum)}
              >
                {pNum}
              </button>
            ))}
            <button
              type="button"
              className="page-btn"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
              style={{ opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? "not-allowed" : "pointer" }}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
