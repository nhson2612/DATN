import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api";
import Dropdown from "../../shared/common/Dropdown";
import VoyageDrawer from "../../shared/layout/VoyageDrawer";
import "../trips/home/Home.css";
import "./Tours.css";

function cleanText(str) {
  if (!str) return "";
  return String(str).replaceAll("—", " - ").replaceAll("–", "-");
}

function formatVnDate(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Trang danh sách tour trọn gói (Explore Tours) chuẩn thiết kế index.html
 */
export default function Tours({ user, onNeedAuth, onLogout }) {
  const [sp, setSp] = useSearchParams();
  const [provinces, setProvinces] = useState([]);
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNavSearchOpen, setIsNavSearchOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isSticky, setIsSticky] = useState(false);
  const heroRef = useRef(null);
  const searchbarRef = useRef(null);
  const navSearchRef = useRef(null);
  const navSearchInputRef = useRef(null);
  const screenRef = useRef(null);
  const rafRef = useRef(null);

  // Đóng thanh tìm kiếm trên navbar khi click ra ngoài
  useEffect(() => {
    function handleNavSearchClickOutside(event) {
      if (
        navSearchRef.current &&
        !navSearchRef.current.contains(event.target)
      ) {
        setIsNavSearchOpen(false);
      }
    }
    if (isNavSearchOpen) {
      document.addEventListener("mousedown", handleNavSearchClickOutside);
    }
    return () =>
      document.removeEventListener("mousedown", handleNavSearchClickOutside);
  }, [isNavSearchOpen]);

  const handleNavSearchSubmit = (e) => {
    e?.preventDefault();
    if (navSearchQuery.trim()) {
      updateParam("q", navSearchQuery.trim());
      setIsNavSearchOpen(false);
    }
  };

  // Xử lý cuộn mượt mà bằng requestAnimationFrame: loại bỏ hoàn toàn giật rung
  const handleScroll = () => {
    const scrollTop = screenRef.current?.scrollTop || 0;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      const threshold = 240;
      const progress = Math.min(1, Math.max(0, scrollTop / threshold));
      setScrollProgress(progress);
      setIsSticky(scrollTop >= threshold);
    });
  };

  // Reset scroll về đầu khi vào trang và lắng nghe scroll trên container chính
  useEffect(() => {
    window.scrollTo(0, 0);
    if (screenRef.current) {
      screenRef.current.scrollTop = 0;
    }
    setScrollProgress(0);
    setIsSticky(false);

    const el = screenRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
    }
    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Bộ lọc từ URL
  const provinceId = sp.get("province_id") || "";
  const departFrom = sp.get("depart_from") || "";
  const maxDays = sp.get("max_days") || "";
  const priceMax = sp.get("price_max") || sp.get("max_price") || "";
  const guests = sp.get("guests") || "2";
  const sort = sp.get("sort") || "";
  const q = sp.get("q") || "";




  // Tải danh sách tỉnh/thành
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

  // Tải danh sách tour
  useEffect(() => {
    setIsLoading(true);
    const queryParams = {
      province_id: provinceId,
      depart_from: departFrom,
      max_days: maxDays,
      price_max: priceMax,
      guests: guests,
      sort: sort,
      q: q,
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
  }, [provinceId, departFrom, maxDays, priceMax, guests, sort, q]);

  const updateParam = (key, value) => {
    const next = Object.fromEntries(sp);
    if (!value) {
      delete next[key];
    } else {
      next[key] = String(value);
    }
    setSp(next);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    // Search is reactive through sp state
  };

  const totalTours = data?.total || data?.items?.length || 0;

  // Hiệu ứng mờ dần từ dưới lên khi cuộn chuột
  const maskGradient =
    scrollProgress > 0.02
      ? (() => {
          const maskBottom = Math.min(100, Math.max(0, scrollProgress * 115 - 15));
          const maskTop = Math.min(100, maskBottom + 30);
          return `linear-gradient(to top, rgba(0,0,0,0) 0%, rgba(0,0,0,0) ${maskBottom.toFixed(1)}%, rgba(0,0,0,1) ${maskTop.toFixed(1)}%, rgba(0,0,0,1) 100%)`;
        })()
      : undefined;

  const heroBgStyle = {
    opacity: Math.max(0, 1 - scrollProgress * 1.05),
    filter: scrollProgress > 0.02 ? `blur(${(scrollProgress * 6).toFixed(1)}px)` : undefined,
    transform: scrollProgress > 0.01 ? `translateY(${(scrollProgress * 16).toFixed(1)}px)` : undefined,
    ...(maskGradient ? { WebkitMaskImage: maskGradient, maskImage: maskGradient } : {}),
    visibility: scrollProgress >= 1 ? "hidden" : "visible",
  };

  const heroOverlayStyle = {
    opacity: Math.max(0, 1 - scrollProgress * 1.15),
    ...(maskGradient ? { WebkitMaskImage: maskGradient, maskImage: maskGradient } : {}),
    visibility: scrollProgress >= 1 ? "hidden" : "visible",
  };

  const navFadeStyle = {
    opacity: Math.max(0, 1 - scrollProgress * 1.3),
    transform: scrollProgress > 0.01 ? `translateY(${(-scrollProgress * 14).toFixed(1)}px)` : undefined,
    visibility: scrollProgress >= 0.95 ? "hidden" : "visible",
  };

  const heroContentStyle = {
    opacity: Math.max(0, 1 - scrollProgress * 1.5),
    transform: scrollProgress > 0.01 ? `translateY(${(-scrollProgress * 20).toFixed(1)}px)` : undefined,
    visibility: scrollProgress >= 0.75 ? "hidden" : "visible",
  };

  return (
    <section className="tours-screen" ref={screenRef} onScroll={handleScroll}>
      {/* 1. Khối Hero Banner tích hợp Navbar chuẩn Homepage & Hero Copy cùng mờ dần khi cuộn */}
      <div
        className="page-hero"
        ref={heroRef}
        style={{
          visibility: scrollProgress >= 1 ? "hidden" : "visible",
          pointerEvents: scrollProgress >= 0.9 ? "none" : "auto",
        }}
      >
          <div
            className="page-hero-bg"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=2000&q=88')",
              ...heroBgStyle,
            }}
          />
          <div className="page-hero-overlay" style={heroOverlayStyle} />

          <div className="page-hero-inner tours-shell">
            {/* 1. Header Navigation Bar chuẩn Homepage (cũng mờ dần khi cuộn) */}
            <header className="voyage-nav" style={navFadeStyle}>
              <Link to="/" className="voyage-brand">
                Voyage
              </Link>

              <nav className="voyage-navlinks">
                <Link to="/" className="voyage-navlink">
                  Destinations
                </Link>
                <Link to="/tour" className="voyage-navlink voyage-navlink--active">
                  Tours
                </Link>
                <Link to="/chuyen-di" className="voyage-navlink">
                  Experiences
                </Link>
              </nav>

              <div className="voyage-actions">
                {/* Expandable Search Bar extending left */}
                <div
                  className={`voyage-nav-search ${
                    isNavSearchOpen ? "voyage-nav-search--open" : ""
                  }`}
                  ref={navSearchRef}
                >
                  <button
                    type="button"
                    className="voyage-nav-search-trigger"
                    onClick={() => {
                      if (!isNavSearchOpen) {
                        setIsNavSearchOpen(true);
                        setTimeout(() => navSearchInputRef.current?.focus(), 100);
                      } else if (navSearchQuery.trim()) {
                        handleNavSearchSubmit();
                      } else {
                        navSearchInputRef.current?.focus();
                      }
                    }}
                    title="Search destinations & tours"
                    aria-label="Search"
                  >
                    <span className="material-symbols-outlined text-[19px]">
                      search
                    </span>
                  </button>

                  <form
                    className="voyage-nav-search-form"
                    onSubmit={handleNavSearchSubmit}
                  >
                    <input
                      ref={navSearchInputRef}
                      type="text"
                      className="voyage-nav-search-input"
                      placeholder="Search destinations, tours..."
                      value={navSearchQuery}
                      onChange={(e) => setNavSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setIsNavSearchOpen(false);
                        }
                      }}
                      tabIndex={isNavSearchOpen ? 0 : -1}
                    />
                    {isNavSearchOpen && (
                      <button
                        type="button"
                        className="voyage-nav-search-close"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsNavSearchOpen(false);
                          setNavSearchQuery("");
                        }}
                        aria-label="Close search"
                      >
                        ✕
                      </button>
                    )}
                  </form>
                </div>

                {/* Menu Hamburger */}
                <button
                  type="button"
                  className="voyage-iconbtn"
                  onClick={() => setIsDrawerOpen(true)}
                  aria-label="Open menu"
                  title="Menu"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    menu
                  </span>
                </button>
              </div>
            </header>

            {/* Hero Copy */}
            <div className="page-hero-content" style={heroContentStyle}>
              <h1>Explore tours</h1>
              <p>Curated journeys to extraordinary places.</p>
            </div>
          </div>
        </div>

        {/* 2. Floating Sticky Searchbar: Ghim luôn tại đỉnh khi hero & nav biến mất */}
        <div
          ref={searchbarRef}
          className={`searchbar-sticky-outer ${isSticky ? "is-sticky" : ""}`}
        >
          <div className="tours-shell">
            <form className="searchbar" onSubmit={handleSearchSubmit}>
              {/* Destination */}
              <div className="searchfield">
                <Dropdown
                  variant="searchfield"
                  label="Destination"
                  prefixIcon="⌖"
                  value={provinceId}
                  options={[
                    { value: "", label: "Where to? (Tất cả)" },
                    ...provinces.map((p) => ({
                      value: String(p.id),
                      label: p.name,
                    })),
                  ]}
                  placeholder="Where to? (Tất cả)"
                  onChange={(val) => updateParam("province_id", val)}
                />
              </div>

              {/* Dates */}
              <div className="searchfield">
                <Dropdown
                  variant="searchfield"
                  label="Dates"
                  prefixIcon="▣"
                  value={departFrom}
                  options={[
                    { value: "", label: "Any dates (Tất cả)" },
                    { value: "2026-04", label: "Tháng 4, 2026" },
                    { value: "2026-05", label: "Tháng 5, 2026" },
                    { value: "2026-06", label: "Tháng 6, 2026" },
                    { value: "2026-07", label: "Tháng 7, 2026" },
                  ]}
                  placeholder="Any dates (Tất cả)"
                  onChange={(val) => updateParam("depart_from", val)}
                />
              </div>

              {/* Travellers */}
              <div className="searchfield">
                <Dropdown
                  variant="searchfield"
                  label="Travellers"
                  prefixIcon="♙"
                  value={guests}
                  options={[
                    { value: "1", label: "1 traveller" },
                    { value: "2", label: "2 travellers" },
                    { value: "3", label: "3 travellers" },
                    { value: "4", label: "4+ travellers" },
                  ]}
                  placeholder="2 travellers"
                  onChange={(val) => updateParam("guests", val)}
                />
              </div>

              <button type="submit" className="searchbtn" aria-label="Search tours">
                <span className="material-symbols-outlined">search</span>
              </button>
            </form>
          </div>
        </div>

        {/* 3. Tour Content Area: Cuộn mượt mà bên dưới thanh search đã ghim */}
        <div className="tours-shell">
          <div className="tours-content">
          {/* Minimalist Editorial Filterbar (No pills/chips) */}
          <div className="filterbar">
            <div className="filterbar-group">
              {/* Duration */}
              <Dropdown
                variant="minimal"
                value={maxDays}
                placeholder="Duration"
                options={[
                  { value: "", label: "Duration (Tất cả)" },
                  { value: "3", label: "Dưới 3 ngày" },
                  { value: "5", label: "Dưới 5 ngày" },
                  { value: "7", label: "Dưới 7 ngày" },
                ]}
                onChange={(val) => updateParam("max_days", val)}
              />

              {/* Budget */}
              <Dropdown
                variant="minimal"
                value={priceMax}
                placeholder="Budget"
                options={[
                  { value: "", label: "Budget (Tất cả)" },
                  { value: "3000000", label: "Dưới 3 triệu" },
                  { value: "6000000", label: "Dưới 6 triệu" },
                  { value: "10000000", label: "Dưới 10 triệu" },
                ]}
                onChange={(val) => updateParam("price_max", val)}
              />

              {/* Sort by */}
              <Dropdown
                variant="minimal"
                value={sort}
                placeholder="Sort by"
                options={[
                  { value: "", label: "Sort by (Mặc định)" },
                  { value: "price_asc", label: "Giá: Thấp đến cao" },
                  { value: "price_desc", label: "Giá: Cao đến thấp" },
                  { value: "newest", label: "Mới nhất" },
                ]}
                onChange={(val) => updateParam("sort", val)}
              />

              {(provinceId || departFrom || maxDays || priceMax || sort || q) && (
                <button
                  type="button"
                  className="filter-reset-btn"
                  onClick={() => setSp({})}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="filterbar-count">
              <span>{totalTours}</span> {totalTours === 1 ? "tour" : "tours"}
            </div>
          </div>

          {/* Tour List */}
          <div className="tour-list">
            {/* Loading Skeleton */}
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="tour-row-skeleton" aria-busy="true">
                  <div className="skeleton-img" />
                  <div className="skeleton-content">
                    <div className="skeleton-line-title" />
                    <div className="skeleton-line-meta" />
                    <div className="skeleton-line-desc" />
                  </div>
                  <div className="skeleton-price" />
                  <div className="skeleton-btn" />
                </div>
              ))}

            {/* Empty State */}
            {!isLoading && (!data?.items || data.items.length === 0) && (
              <div className="tours-empty-box">
                <h3>Không tìm thấy tour phù hợp</h3>
                <p>
                  Hiện không có tour nào khớp với bộ lọc đã chọn. Hãy thử chọn điểm
                  đến hoặc khoảng thời gian khác.
                </p>
                <button
                  type="button"
                  className="chip active"
                  onClick={() => setSp({})}
                >
                  Xem tất cả tour
                </button>
              </div>
            )}

            {/* Real Tour Rows */}
            {!isLoading &&
              data?.items?.map((tour) => {
                const cleanProvince =
                  tour.province_name?.replace(/^(Thành phố|Tỉnh)\s+/, "") ||
                  "Việt Nam";
                const durationText = tour.duration_days
                  ? `${tour.duration_days} Days`
                  : "Flexible";
                const departureText = tour.ngay_gan_nhat
                  ? `Khởi hành: ${formatVnDate(tour.ngay_gan_nhat)}`
                  : "Khởi hành hàng tuần";
                const priceFormatted = Number(tour.price_from || 0).toLocaleString(
                  "vi-VN"
                );

                return (
                  <Link
                    key={tour.id}
                    to={`/tour/${tour.slug || tour.id}`}
                    className="tour-row"
                  >
                    <img
                      src={
                        tour.cover_url ||
                        "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80"
                      }
                      alt={cleanText(tour.name)}
                      loading="lazy"
                    />

                    <div>
                      <h3>{cleanText(tour.name)}</h3>
                      <div className="tour-meta">
                        <span>{cleanProvince}</span>
                        <span>·</span>
                        <span>{durationText}</span>
                        <span>·</span>
                        <span>{departureText}</span>
                      </div>
                      <div className="tour-desc">
                        {cleanText(tour.summary || tour.description) ||
                          "Khám phá cảnh sắc ngoạn mục và những trải nghiệm văn hóa bản địa độc đáo cùng chuyến đi được thiết kế kỹ lưỡng."}
                      </div>
                    </div>

                    <div className="price">
                      {priceFormatted}đ
                      <small>per person</small>
                    </div>

                    <div className="round-go">
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      </div>

      {/* 5. Slide-out Menu Drawer dùng chung */}
      <VoyageDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={user}
        onNeedAuth={onNeedAuth}
        onLogout={onLogout}
      />
    </section>
  );
}
