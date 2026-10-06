import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api";
import VoyageDrawer from "../../shared/layout/VoyageDrawer";
import AuraHeader from "../../shared/layout/AuraHeader";
import "./Tours.css";
import "../trips/home/Home.css";

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

function formatPrice(val) {
  return Number(val || 0).toLocaleString("vi-VN");
}

const REGION_MAP = {
  bac: ["Hà Nội", "Quảng Ninh", "Lào Cai", "Ninh Bình", "Hà Giang", "Cao Bằng", "Yên Bái", "Hải Phòng"],
  trung: ["Đà Nẵng", "Quảng Nam", "Thừa Thiên Huế", "Khánh Hòa", "Lâm Đồng", "Bình Định", "Quảng Bình"],
  nam: ["Hồ Chí Minh", "Kiên Giang", "Cần Thơ", "Bà Rịa - Vũng Tàu", "An Giang", "Tây Ninh"],
};

const CATEGORY_OPTIONS = [
  { value: "Tất cả", label: "Tất cả các loại" },
  { value: "Tour trọn gói", label: "Tour trọn gói" },
  { value: "Tour tiết kiệm", label: "Tour tiết kiệm" },
  { value: "City tour", label: "City tour" },
  { value: "Biển đảo", label: "Biển đảo" },
  { value: "Văn hóa", label: "Văn hóa & Di sản" },
  { value: "Lịch sử", label: "Lịch sử" },
  { value: "Ẩm thực", label: "Ẩm thực" },
  { value: "Nghỉ dưỡng", label: "Nghỉ dưỡng" },
];

const DEPARTURE_OPTIONS = [
  { value: "Tất cả", label: "Tất cả điểm khởi hành" },
  { value: "Đà Nẵng", label: "TP. Đà Nẵng" },
  { value: "Hồ Chí Minh", label: "TP. Hồ Chí Minh" },
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "Khánh Hòa", label: "Khánh Hòa / Cam Ranh" },
  { value: "Lâm Đồng", label: "Lâm Đồng / Đà Lạt" },
  { value: "Bắc Ninh", label: "Bắc Ninh" },
  { value: "Theo điểm hẹn", label: "Theo điểm hẹn nhà điều hành" },
];

const DESTINATION_OPTIONS = [
  { value: "Tất cả", label: "Tất cả điểm đến" },
  { value: "Đà Nẵng", label: "Đà Nẵng" },
  { value: "Hồ Chí Minh", label: "TP. Hồ Chí Minh" },
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "Khánh Hòa", label: "Khánh Hòa / Nha Trang" },
  { value: "Lâm Đồng", label: "Lâm Đồng / Đà Lạt" },
  { value: "Bắc Ninh", label: "Bắc Ninh" },
  { value: "Quảng Ninh", label: "Quảng Ninh / Hạ Long" },
  { value: "Kiên Giang", label: "Kiên Giang / Phú Quốc" },
];

const DATE_OPTIONS = [
  { value: "Tất cả", label: "Tất cả ngày" },
  { value: "Tháng 10/2026", label: "Tháng 10/2026" },
  { value: "06/10", label: "06/10/2026 (3 tour)" },
  { value: "09/10", label: "09/10/2026 (8 tour)" },
  { value: "13/10", label: "13/10/2026 (8 tour)" },
  { value: "15/10", label: "15/10/2026 (11 tour)" },
  { value: "17/10", label: "17/10/2026 (14 tour)" },
  { value: "22/10", label: "22/10/2026 (27 tour)" },
  { value: "29/10", label: "29/10/2026 (22 tour)" },
];

const SORT_OPTIONS = [
  { value: "date_asc", label: "Ngày khởi hành gần nhất" },
  { value: "price_asc", label: "Giá tăng dần" },
  { value: "price_desc", label: "Giá giảm dần" },
];

const SIDEBAR_DEST_OPTIONS = [
  { value: "", label: "Chọn điểm đến" },
  { value: "Hồ Chí Minh", label: "TP. Hồ Chí Minh" },
  { value: "Hà Nội", label: "Hà Nội" },
  { value: "Đà Nẵng", label: "Đà Nẵng" },
  { value: "Quảng Ninh", label: "Quảng Ninh / Hạ Long" },
  { value: "Kiên Giang", label: "Phú Quốc / Kiên Giang" },
  { value: "Lâm Đồng", label: "Đà Lạt / Lâm Đồng" },
  { value: "Khánh Hòa", label: "Khánh Hòa / Nha Trang" },
  { value: "Bắc Ninh", label: "Bắc Ninh" },
];

const ATTRACTION_OPTIONS = [
  { value: "", label: "Chọn điểm tham quan" },
  { value: "Dinh Độc Lập", label: "Dinh Độc Lập" },
  { value: "Bà Nà Hills", label: "Bà Nà Hills" },
  { value: "Hồ Gươm", label: "Hồ Gươm" },
  { value: "Chợ Bến Thành", label: "Chợ Bến Thành" },
];



// Dữ liệu Featured Destinations cho Hero Carousel
const FEATURED_HERO_DESTINATIONS = [
  {
    id: "halong",
    title: "Vịnh Hạ Long",
    subtitle: "DI SẢN THIÊN NHIÊN THẾ GIỚI",
    image:
      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=80",
    slug: "tour-ha-long-tiet-kiem",
  },
  {
    id: "hoian",
    title: "Phố Cổ Hội An",
    subtitle: "DI SẢN VĂN HÓA THẾ GIỚI",
    image:
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1600&q=80",
    slug: "tour-hoi-an-di-san",
  },
  {
    id: "trangan",
    title: "Tràng An Ninh Bình",
    subtitle: "QUẦN THỂ DANH THẮNG KÉP",
    image:
      "https://images.unsplash.com/photo-1578637387939-43c525550085?auto=format&fit=crop&w=1600&q=80",
    slug: "tour-ninh-binh-trang-an",
  },
  {
    id: "dalat",
    title: "Đà Lạt Mộng Mơ",
    subtitle: "CAO NGUYÊN NGHỈ DƯỠNG",
    image:
      "https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=1600&q=80",
    slug: "tour-da-lat-mong-mo-4n3d",
  },
];

const TOUR_TYPES = [
  { id: "cultural", label: "Cultural", viLabel: "Văn hóa" },
  { id: "nature", label: "Nature", viLabel: "Thiên nhiên" },
  { id: "adventure", label: "Adventure", viLabel: "Khám phá" },
  { id: "relaxation", label: "Relaxation", viLabel: "Nghỉ dưỡng" },
  { id: "family", label: "Family", viLabel: "Gia đình" },
];

export default function Tours({ user, onNeedAuth, onLogout }) {
  const [sp, setSp] = useSearchParams();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearchStaggered, setIsSearchStaggered] = useState(false);
  const [isToursStaggered, setIsToursStaggered] = useState(false);
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState(sp.get("q") || "");
  const searchInputRef = useRef(null);
  const cardsRowRef = useRef(null);

  // Danh sách tour phổ biến lấy từ dữ liệu tour thật của hệ thống
  const popularSearchTours = useMemo(() => {
    const list = data?.items ? [...data.items] : [];
    list.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0) || Number(b.view_count || 0) - Number(a.view_count || 0));
    return list.slice(0, 4);
  }, [data]);

  // Kết quả tìm kiếm theo thời gian thực (Live Search) từ toàn bộ tour thật
  const liveSearchResults = useMemo(() => {
    if (!searchInput.trim()) return [];
    const q = searchInput.trim().toLowerCase();
    const list = data?.items ? [...data.items] : [];
    return list.filter((t) => {
      const title = (t.title || t.name || "").toLowerCase();
      const prov = (t.province_name || "").toLowerCase();
      const desc = (t.overview || t.description || "").toLowerCase();
      const tags = Array.isArray(t.tags) ? t.tags.join(" ").toLowerCase() : "";
      return title.includes(q) || prov.includes(q) || desc.includes(q) || tags.includes(q);
    });
  }, [searchInput, data]);

  const scrollCardsLeft = () => {
    if (cardsRowRef.current) {
      cardsRowRef.current.scrollBy({ left: -310, behavior: "smooth" });
    }
  };

  const scrollCardsRight = () => {
    if (cardsRowRef.current) {
      cardsRowRef.current.scrollBy({ left: 310, behavior: "smooth" });
    }
  };

  // Hero Carousel State
  const [heroIndex, setHeroIndex] = useState(0);
  const currentHero = FEATURED_HERO_DESTINATIONS[heroIndex] || FEATURED_HERO_DESTINATIONS[0];
  const [heroProgress, setHeroProgress] = useState(0);

  // Tự động chạy thanh tiến trình 5s mỗi điểm đến nổi bật chuẩn xác theo thời gian thực
  useEffect(() => {
    let startTime = Date.now();
    const DURATION = 5000; // 5s mỗi điểm đến

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / DURATION) * 100);
      setHeroProgress(pct);

      if (elapsed >= DURATION) {
        startTime = Date.now();
        setHeroProgress(0);
        setHeroIndex((idx) => (idx + 1) % FEATURED_HERO_DESTINATIONS.length);
      }
    }, 40);

    return () => clearInterval(timer);
  }, []);

  const nextHeroSlide = () => {
    setHeroProgress(0);
    setHeroIndex((prev) => (prev + 1) % FEATURED_HERO_DESTINATIONS.length);
  };

  // Filter States matching 71e1395b-bccc-4a83-a52e-cbac8550f078.png
  const [filterDestination, setFilterDestination] = useState(sp.get("destination") || "all");
  const [filterDate, setFilterDate] = useState(sp.get("date") || "");
  const [filterDuration, setFilterDuration] = useState(Number(sp.get("max_days")) || 14);
  const [filterPrice, setFilterPrice] = useState(Number(sp.get("max_price")) || 50000000);
  const [selectedTypes, setSelectedTypes] = useState(new Set());
  const [sortBy, setSortBy] = useState("popular");

  const searchQuery = sp.get("q") || "";

  const resetFilters = () => {
    setFilterDestination("all");
    setFilterDate("");
    setFilterDuration(14);
    setFilterPrice(50000000);
    setSelectedTypes(new Set());
    setSortBy("popular");
    setSp({});
  };

  const toggleType = (typeId) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(typeId)) next.delete(typeId);
      else next.add(typeId);
      return next;
    });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsToursStaggered(true);
    }, 80);
    return () => clearTimeout(timer);
  }, []);

  const openSearch = () => {
    setIsSearchOpen(true);
    setIsSearchStaggered(false);
    setTimeout(() => {
      setIsSearchStaggered(true);
      searchInputRef.current?.focus();
    }, 80);
  };

  const closeSearch = () => {
    setIsSearchStaggered(false);
    setIsSearchOpen(false);
    setTimeout(() => {
      setIsToursStaggered(true);
    }, 80);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else if (isSearchOpen) {
          closeSearch();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, isSearchOpen]);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    const params = { limit: 40 };
    if (searchQuery) params.q = searchQuery;

    api
      .tours(params)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error("Lỗi tải danh sách tour:", err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [searchQuery]);

  const handleRegionFilter = (regionKey) => {
    const next = new URLSearchParams(sp);
    if (!regionKey || regionKey === activeRegion) {
      next.delete("region");
    } else {
      next.set("region", regionKey);
    }
    setSp(next);
  };

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    const next = new URLSearchParams(sp);
    if (searchInput.trim()) {
      next.set("q", searchInput.trim());
    } else {
      next.delete("q");
    }
    setSp(next);
    closeSearch();
  };

  // Đếm số lượng tour động cho từng loại (Cultural, Nature, Adventure, Relaxation, Family)
  const typeCounts = useMemo(() => {
    const counts = { cultural: 0, nature: 0, adventure: 0, relaxation: 0, family: 0 };
    const toursList = data?.items || [];
    toursList.forEach((t) => {
      const text = `${t.title || t.name || ""} ${t.description || ""} ${t.overview || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
      if (text.includes("văn hóa") || text.includes("di sản") || text.includes("chùa") || text.includes("lịch sử") || text.includes("cultural")) counts.cultural++;
      if (text.includes("thiên nhiên") || text.includes("vịnh") || text.includes("núi") || text.includes("rừng") || text.includes("biển") || text.includes("nature")) counts.nature++;
      if (text.includes("khám phá") || text.includes("trải nghiệm") || text.includes("trekking") || text.includes("adventure") || text.includes("safari")) counts.adventure++;
      if (text.includes("nghỉ dưỡng") || text.includes("resort") || text.includes("relaxation") || text.includes("spa")) counts.relaxation++;
      if (text.includes("gia đình") || text.includes("tiết kiệm") || text.includes("family") || text.includes("trẻ em")) counts.family++;
    });
    return counts;
  }, [data]);

  const filteredTours = useMemo(() => {
    let list = data?.items ? [...data.items] : [];

    // Search query từ ô tìm kiếm nhanh nếu có
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) => {
        const title = (t.title || t.name || "").toLowerCase();
        const prov = (t.province_name || "").toLowerCase();
        const desc = (t.overview || t.description || "").toLowerCase();
        return title.includes(q) || prov.includes(q) || desc.includes(q);
      });
    }

    // 1. Lọc theo Điểm đến (Destination)
    if (filterDestination && filterDestination !== "all") {
      const destTarget = filterDestination.toLowerCase();
      list = list.filter((t) => {
        const prov = (t.province_name || "").toLowerCase();
        const title = (t.title || t.name || "").toLowerCase();
        return prov.includes(destTarget) || title.includes(destTarget);
      });
    }

    // 2. Lọc theo Ngày đi (Date)
    if (filterDate.trim()) {
      const dTarget = filterDate.trim().toLowerCase();
      list = list.filter((t) => {
        if (Array.isArray(t.departures)) {
          return t.departures.some((dep) => (dep.depart_date || "").includes(dTarget));
        }
        return (t.ngay_gan_nhat || "").includes(dTarget);
      });
    }

    // 3. Lọc theo Thời gian (Duration in days)
    if (filterDuration < 14) {
      list = list.filter((t) => {
        const days = Number(t.duration_days || t.num_days || 1);
        return days <= filterDuration;
      });
    }

    // 4. Lọc theo Giá (Price max)
    if (filterPrice < 50000000) {
      list = list.filter((t) => {
        const price = Number(t.price_from || 0);
        return price <= filterPrice;
      });
    }

    // 5. Lọc theo Loại tour (Selected Types)
    if (selectedTypes.size > 0) {
      list = list.filter((t) => {
        const text = `${t.title || t.name || ""} ${t.description || ""} ${t.overview || ""} ${(t.tags || []).join(" ")}`.toLowerCase();
        if (selectedTypes.has("cultural") && (text.includes("văn hóa") || text.includes("di sản") || text.includes("chùa") || text.includes("lịch sử") || text.includes("cultural"))) return true;
        if (selectedTypes.has("nature") && (text.includes("thiên nhiên") || text.includes("vịnh") || text.includes("núi") || text.includes("rừng") || text.includes("biển") || text.includes("nature"))) return true;
        if (selectedTypes.has("adventure") && (text.includes("khám phá") || text.includes("trải nghiệm") || text.includes("trekking") || text.includes("adventure") || text.includes("safari"))) return true;
        if (selectedTypes.has("relaxation") && (text.includes("nghỉ dưỡng") || text.includes("resort") || text.includes("relaxation") || text.includes("spa"))) return true;
        if (selectedTypes.has("family") && (text.includes("gia đình") || text.includes("tiết kiệm") || text.includes("family") || text.includes("trẻ em"))) return true;
        return false;
      });
    }

    // Sắp xếp
    if (sortBy === "price_asc") {
      list.sort((a, b) => Number(a.price_from || 0) - Number(b.price_from || 0));
    } else if (sortBy === "price_desc") {
      list.sort((a, b) => Number(b.price_from || 0) - Number(a.price_from || 0));
    } else if (sortBy === "duration_asc") {
      list.sort((a, b) => Number(a.duration_days || 1) - Number(b.duration_days || 1));
    } else {
      // popular
      list.sort((a, b) => (b.is_sale ? 1 : 0) - (a.is_sale ? 1 : 0) || Number(b.view_count || 0) - Number(a.view_count || 0));
    }

    return list;
  }, [data, searchQuery, filterDestination, filterDate, filterDuration, filterPrice, selectedTypes, sortBy]);

  return (
    <div className="aura-tours">
      <main className="aura-tours__container">
        {/* =================================================== */}
        {/* VIEW 2: Tour Listing View (Staggered Animation)     */}
        {/* =================================================== */}
        <div
          className={`aura-tours__main-view ${
            isSearchOpen ? "aura-tours__main-view--hidden" : "aura-tours__main-view--active"
          } ${isToursStaggered ? "aura-tours--stagger-active" : ""}`}
          id="toursView"
        >
          <div className="aura-tours__layout-grid">
            {/* CỘT TRÁI: SIDEBAR (Logo + Menu dọc dùng chung + Bộ lọc Filters) */}
            <aside className="aura-tours__sidebar">
              <div className="aura-tours__sidebar-brand">
                <Link to="/" className="aura-home__brand" aria-label="Aura Voyage">
                  <svg
                    className="aura-home__brand-icon"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 10.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                  </svg>
                </Link>
              </div>

              {/* Dùng chung chuẩn nav hệ thống: aura-home__nav */}
              <nav className="aura-home__nav" aria-label="Main Editorial Navigation">
                <Link to="/" className="aura-home__nav-link">
                  <span>About</span>
                  <span>→</span>
                </Link>
                <span className="aura-home__nav-link aura-home__nav-link--active">
                  <span>/ Tours</span>
                </span>
                <Link to="/chuyen-di" className="aura-home__nav-link">
                  <span>Experiences</span>
                  <span>→</span>
                </Link>
                <Link to="/tai-khoan" className="aura-home__nav-link">
                  <span>Account</span>
                  <span>→</span>
                </Link>
              </nav>

              {/* Bộ lọc Sidebar theo đúng mockup */}
              <div className="aura-tours__sidebar-filters">
                {/* 1. DESTINATION */}
                <div className="aura-tours__filter-group">
                  <label className="aura-tours__filter-title">DESTINATION</label>
                  <div className="aura-tours__select-wrapper">
                    <select
                      value={filterDestination}
                      onChange={(e) => setFilterDestination(e.target.value)}
                      className="aura-tours__filter-select"
                    >
                      <option value="all">All destinations</option>
                      <option value="Hà Nội">Hà Nội</option>
                      <option value="Hồ Chí Minh">TP. Hồ Chí Minh</option>
                      <option value="Đà Nẵng">Đà Nẵng</option>
                      <option value="Quảng Ninh">Hạ Long / Quảng Ninh</option>
                      <option value="Ninh Bình">Ninh Bình</option>
                      <option value="Lâm Đồng">Đà Lạt</option>
                      <option value="Kiên Giang">Phú Quốc</option>
                    </select>
                    <span className="aura-tours__select-chevron">⌵</span>
                  </div>
                </div>

                {/* 2. DATE */}
                <div className="aura-tours__filter-group">
                  <label className="aura-tours__filter-title">DATE</label>
                  <div className="aura-tours__input-wrapper">
                    <input
                      type="text"
                      placeholder="Any date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="aura-tours__filter-input"
                    />
                    <svg className="aura-tours__input-icon" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                </div>

                {/* 3. DURATION */}
                <div className="aura-tours__filter-group">
                  <label className="aura-tours__filter-title">DURATION</label>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    value={filterDuration}
                    onChange={(e) => setFilterDuration(Number(e.target.value))}
                    className="aura-tours__filter-range"
                  />
                  <div className="aura-tours__range-labels">
                    <span>1 day</span>
                    <span>14+ days</span>
                  </div>
                </div>

                {/* 4. PRICE (VND) */}
                <div className="aura-tours__filter-group">
                  <label className="aura-tours__filter-title">PRICE (VND)</label>
                  <input
                    type="range"
                    min="0"
                    max="50000000"
                    step="1000000"
                    value={filterPrice}
                    onChange={(e) => setFilterPrice(Number(e.target.value))}
                    className="aura-tours__filter-range"
                  />
                  <div className="aura-tours__range-labels">
                    <span>0</span>
                    <span>50.000.000+</span>
                  </div>
                </div>

                {/* 5. TYPE */}
                <div className="aura-tours__filter-group">
                  <label className="aura-tours__filter-title">TYPE</label>
                  <div className="aura-tours__type-list">
                    {[
                      { key: "cultural", label: "Cultural", count: 24 },
                      { key: "nature", label: "Nature", count: 18 },
                      { key: "adventure", label: "Adventure", count: 16 },
                      { key: "relaxation", label: "Relaxation", count: 12 },
                      { key: "family", label: "Family", count: 9 },
                    ].map((typeItem) => (
                      <label key={typeItem.key} className="aura-tours__checkbox-row">
                        <div className="aura-tours__checkbox-left">
                          <input
                            type="checkbox"
                            checked={selectedTypes.has(typeItem.key)}
                            onChange={() => {
                              setSelectedTypes((prev) => {
                                const next = new Set(prev);
                                if (next.has(typeItem.key)) next.delete(typeItem.key);
                                else next.add(typeItem.key);
                                return next;
                              });
                            }}
                            className="aura-tours__checkbox"
                          />
                          <span className="aura-tours__checkbox-label">{typeItem.label}</span>
                        </div>
                        <span className="aura-tours__type-count">{typeItem.count}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* CỘT PHẢI: NỘI DUNG CHÍNH (Hero tiêu đề bên cạnh ảnh + Hàng card kết quả) */}
            <div className="aura-tours__main-content">
              {/* 1. TOP HERO SECTION */}
              <section className="aura-tours__hero aura-tours__stagger aura-tours__stagger--header">
                {/* Tiêu đề Hero: Đặt bên cạnh Menu, đứng bên trái ảnh */}
                <div className="aura-tours__hero-headline-block">
                  <span className="aura-tours__hero-subtitle">EXPLORE</span>
                  <h1 className="aura-tours__hero-title">
                    Find your<br />
                    <span className="aura-tours__hero-title-accent">tour</span>
                  </h1>
                  <p className="aura-tours__hero-desc">
                    Curated journeys to extraordinary places, from cultural gems to natural wonders.
                  </p>
                </div>

                {/* Banner ảnh Hero: Chạm sát mép trên & mép phải, bo góc dưới bên trái */}
                <div className="aura-tours__hero-banner">
                  <img
                    src={currentHero.image}
                    alt={currentHero.title}
                    className="aura-tours__hero-img"
                  />

                  {/* Top-Right Circle Controls (Search & Menu) */}
                  <div className="aura-tours__hero-controls">
                    <button
                      type="button"
                      className="aura-tours__circle-btn"
                      onClick={openSearch}
                      aria-label="Tìm kiếm tour"
                    >
                      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="aura-tours__circle-btn"
                      onClick={() => setIsDrawerOpen(true)}
                      aria-label="Mở Menu"
                    >
                      <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="4" y1="7" x2="20" y2="7" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="17" x2="20" y2="17" />
                      </svg>
                    </button>
                  </div>

                  {/* Bottom-Right Featured Destination Info */}
                  <div className="aura-tours__hero-featured-card">
                    <div className="aura-tours__featured-header">
                      <span className="aura-tours__featured-label">{currentHero.subtitle}</span>
                      <div className="aura-tours__featured-title-row">
                        <h2 className="aura-tours__featured-title">{currentHero.title}</h2>
                        <button
                          type="button"
                          className="aura-tours__featured-arrow-btn"
                          onClick={nextHeroSlide}
                          aria-label="Chuyển điểm đến nổi bật tiếp theo"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="aura-tours__featured-progress-row">
                      <div className="aura-tours__featured-track">
                        <div
                          className="aura-tours__featured-fill"
                          style={{
                            width: `${heroProgress}%`,
                          }}
                        />
                      </div>
                      <span className="aura-tours__featured-count">
                        {String(heroIndex + 1).padStart(2, "0")} / {String(FEATURED_HERO_DESTINATIONS.length).padStart(2, "0")}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. BOTTOM RESULTS SECTION */}
              <section className="aura-tours__results-section aura-tours__stagger aura-tours__stagger--content">
              {/* Header kết quả: Số lượng tour & Sắp xếp */}
              <div className="aura-tours__results-header">
                <span className="aura-tours__results-count">
                  {filteredTours.length} {filteredTours.length === 1 ? "tour" : "tours"}
                </span>

                <div className="aura-tours__results-actions">
                  <div className="aura-tours__sort-group">
                    <span className="aura-tours__sort-label">Sort by:</span>
                    <select
                      className="aura-tours__sort-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="popular">Most popular</option>
                      <option value="price_asc">Price: Low to high</option>
                      <option value="price_desc">Price: High to low</option>
                      <option value="duration_asc">Duration</option>
                    </select>
                  </div>


                </div>
              </div>

              {/* Skeleton loading */}
              {isLoading && (
                <div className="aura-tours__cards-grid">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="aura-tours__skeleton aura-tours__skeleton--card" />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!isLoading && filteredTours.length === 0 && (
                <div className="aura-tours__empty">
                  <h3 className="aura-tours__empty-title">Không tìm thấy tour phù hợp</h3>
                  <p className="aura-tours__empty-desc">
                    Hiện không có hành trình nào khớp với tiêu chí tìm kiếm. Hãy thử bỏ chọn bộ lọc để xem toàn bộ tour.
                  </p>
                  <button
                    type="button"
                    className="aura-tours__filter-reset-link"
                    onClick={resetFilters}
                  >
                    Reset all filters
                  </button>
                </div>
              )}

              {/* Dạng 1 hàng ngang có nút di chuyển sang phải, trái */}
              {!isLoading && filteredTours.length > 0 && (
                <div className="aura-tours__cards-slider-container">
                  <button
                    type="button"
                    className="aura-tours__cards-arrow-btn aura-tours__cards-arrow-btn--left"
                    onClick={scrollCardsLeft}
                    aria-label="Di chuyển sang trái"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  <div ref={cardsRowRef} className="aura-tours__cards-grid aura-tours__cards-grid--horizontal">
                  {filteredTours.map((tour, index) => {
                    const cleanProvince =
                      tour.province_name?.replace(/^(Thành phố|Tỉnh)\s+/, "") ||
                      "Việt Nam";
                    const durationDays = tour.duration_days || 1;
                    const priceVal = Number(tour.price_from || 0);
                    const priceFormatted = formatPrice(priceVal);

                    const heroImage =
                      tour.primary_image ||
                      tour.cover_image ||
                      tour.image_url ||
                      (tour.images && tour.images[0]) ||
                      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80";

                    // Xác định nhãn badge (Popular, Cultural, Nature, Adventure...)
                    let badgeLabel = "";
                    let isPopular = false;
                    if (index === 0 || tour.is_featured) {
                      badgeLabel = "Popular";
                      isPopular = true;
                    } else if (tour.is_sale) {
                      badgeLabel = "Special Offer";
                    } else {
                      const text = `${tour.title || tour.name || ""} ${tour.overview || ""}`.toLowerCase();
                      if (text.includes("văn hóa") || text.includes("chùa") || text.includes("di sản")) {
                        badgeLabel = "Cultural";
                      } else if (text.includes("vịnh") || text.includes("thiên nhiên") || text.includes("núi") || text.includes("biển")) {
                        badgeLabel = "Nature";
                      } else if (text.includes("khám phá") || text.includes("trekking") || text.includes("trải nghiệm")) {
                        badgeLabel = "Adventure";
                      } else if (text.includes("nghỉ dưỡng") || text.includes("resort")) {
                        badgeLabel = "Relaxation";
                      } else {
                        badgeLabel = "Featured";
                      }
                    }

                    return (
                      <article key={tour.id || tour.tour_id || index} className="aura-tours__vcard">
                        <Link
                          to={`/tour/${tour.slug || tour.id}`}
                          className="aura-tours__vcard-img-link"
                          aria-label={tour.title || tour.name}
                        >
                          <div className="aura-tours__vcard-img-wrap">
                            <img
                              src={heroImage}
                              alt={tour.title || tour.name}
                              className="aura-tours__vcard-img"
                              loading="lazy"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.src = "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80";
                              }}
                            />
                            {badgeLabel && (
                              <span
                                className={`aura-tours__vcard-badge ${isPopular ? "aura-tours__vcard-badge--popular" : ""}`}
                              >
                                {badgeLabel}
                              </span>
                            )}
                          </div>
                        </Link>

                        <div className="aura-tours__vcard-body">
                          <h4 className="aura-tours__vcard-title" title={tour.title || tour.name}>
                            <Link to={`/tour/${tour.slug || tour.id}`}>
                              {tour.title || tour.name}
                            </Link>
                          </h4>

                          <div className="aura-tours__vcard-meta">
                            <span>{durationDays} Days</span>
                            <span className="aura-tours__vcard-dot">·</span>
                            <span>{cleanProvince}</span>
                          </div>

                          <div className="aura-tours__vcard-footer">
                            <span className="aura-tours__vcard-price">
                              {priceFormatted}₫
                            </span>

                            <Link
                              to={`/tour/${tour.slug || tour.id}`}
                              className="aura-tours__vcard-action-btn"
                              aria-label={`Xem tour ${tour.title || tour.name}`}
                            >
                              <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                                <path d="M5 12h14m-6-6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                  <button
                    type="button"
                    className="aura-tours__cards-arrow-btn aura-tours__cards-arrow-btn--right"
                    onClick={scrollCardsRight}
                    aria-label="Di chuyển sang phải"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
              </section>
            </div>
          </div>
        </div>

        {/* VIEW 3: In-Container Search View (Staggered BEM)    */}
        {/* =================================================== */}
        <section
          className={`aura-search ${
            isSearchOpen ? "aura-search--active" : "aura-search--hidden"
          } ${isSearchStaggered ? "aura-search--stagger-active" : ""}`}
          id="searchView"
        >
          <header className="aura-search__header aura-search__stagger aura-search__stagger--header">
            <div className="aura-search__header-left">
              <button
                type="button"
                className="aura-search__logo-btn"
                onClick={closeSearch}
                aria-label="Back to Tours"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 10.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="aura-search__back-btn"
                  onClick={closeSearch}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 19l-7-7 7-7" />
                  </svg>
                  Tours
                </button>
              </div>

              <button
                type="button"
                className="aura-search__close-btn"
                onClick={closeSearch}
                aria-label="Close search"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </header>

            <div className="aura-search__input-wrap aura-search__stagger aura-search__stagger--title">
              <form onSubmit={handleSearchSubmit} className="aura-search__input-box">
                <span
                  className="aura-search__caret"
                  style={{ display: searchInput ? "none" : "inline-block" }}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="aura-search__input"
                  placeholder="Find your tour"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                {searchInput && (
                  <button
                    type="button"
                    className="aura-search__clear-btn"
                    onClick={() => {
                      setSearchInput("");
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </form>
            </div>

            <div className="aura-search__content aura-search__stagger aura-search__stagger--content">
              {!searchInput ? (
                <>
                  <div className="aura-search__subhead">
                    <span className="aura-search__subhead-title">Tour thịnh hành</span>
                    <span className="aura-search__subhead-desc">Hành trình chọn lọc tại Việt Nam</span>
                  </div>

                  <div className="aura-search__grid">
                    {popularSearchTours.map((t, idx) => {
                      const heroImage =
                        t.primary_image ||
                        t.cover_image ||
                        (t.images && t.images[0]) ||
                        "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80";
                      return (
                        <article
                          key={t.id || t.slug || idx}
                          className="aura-search__card"
                          onClick={() => {
                            navigate(`/tour/${t.slug || t.id}`);
                            closeSearch();
                          }}
                        >
                          <div className="aura-search__card-thumb">
                            <img
                              src={heroImage}
                              alt={t.title || t.name}
                              className="aura-search__card-img"
                            />
                            <span className="aura-search__card-duration">
                              {t.duration_days || 1} Days
                            </span>
                          </div>
                          <h4 className="aura-search__card-title">{t.title || t.name}</h4>
                          <p className="aura-search__card-price">{formatPrice(t.price_from)}₫</p>
                        </article>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="aura-search__subhead">
                    <div className="aura-search__subhead-title">
                      <span>Kết quả tìm kiếm</span>
                      <span className="aura-search__badge">
                        {liveSearchResults.length} {liveSearchResults.length === 1 ? "tour" : "tours"}
                      </span>
                    </div>
                    <span className="aura-search__subhead-desc">Khớp với từ khóa "{searchInput}"</span>
                  </div>

                  {liveSearchResults.length > 0 ? (
                    <>
                      <div className="aura-search__grid">
                        {liveSearchResults.slice(0, 8).map((t, idx) => {
                          const heroImage =
                            t.primary_image ||
                            t.cover_image ||
                            (t.images && t.images[0]) ||
                            "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80";
                          return (
                            <article
                              key={t.id || t.slug || idx}
                              className="aura-search__card"
                              onClick={() => {
                                navigate(`/tour/${t.slug || t.id}`);
                                closeSearch();
                              }}
                            >
                              <div className="aura-search__card-thumb">
                                <img
                                  src={heroImage}
                                  alt={t.title || t.name}
                                  className="aura-search__card-img"
                                />
                                <span className="aura-search__card-duration">
                                  {t.duration_days || 1} Days
                                </span>
                              </div>
                              <h4 className="aura-search__card-title">{t.title || t.name}</h4>
                              <p className="aura-search__card-price">{formatPrice(t.price_from)}₫</p>
                            </article>
                          );
                        })}
                      </div>

                      {/* CTA xem tất cả kết quả trên trang danh sách */}
                      <div className="aura-search__cta">
                        <div className="aura-search__cta-left">
                          <div className="aura-search__cta-icon">
                            <svg
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 4v16m8-8H4" strokeLinecap="round" />
                            </svg>
                          </div>
                          <div className="aura-search__cta-text">
                            <h5 className="aura-search__cta-title">
                              Xem toàn bộ {liveSearchResults.length} tour trên trang danh sách
                            </h5>
                            <p className="aura-search__cta-desc">
                              Áp dụng từ khóa "{searchInput}" vào bộ lọc chính để tiếp tục tinh chỉnh theo ngày khởi hành, khoảng giá và loại hình tour.
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="aura-search__cta-btn"
                          onClick={handleSearchSubmit}
                        >
                          Áp dụng bộ lọc →
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="aura-search__empty-box">
                      <p className="aura-search__empty-title">
                        Không tìm thấy tour phù hợp với "{searchInput}"
                      </p>
                      <p className="aura-search__empty-desc">
                        Thử tìm kiếm theo tỉnh thành hoặc địa danh nổi tiếng:
                      </p>
                      <div className="aura-search__quick-tags">
                        {["Hạ Long", "Hà Nội", "Sài Gòn", "Đà Nẵng", "Ninh Bình", "Đà Lạt", "Phú Quốc"].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="aura-search__tag-chip"
                            onClick={() => setSearchInput(tag)}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <footer className="aura-search__footer aura-search__stagger aura-search__stagger--footer">
              <nav className="aura-search__footer-nav">
                <Link to="/" className="aura-search__footer-link">
                  About
                </Link>
                <button
                  type="button"
                  className="aura-search__footer-link aura-search__footer-link--active"
                  onClick={closeSearch}
                >
                  / Tours
                </button>
                <Link to="/chuyen-di" className="aura-search__footer-link">
                  Experiences
                </Link>
                <Link to="/tai-khoan" className="aura-search__footer-link">
                  Account
                </Link>
              </nav>
            </footer>
          </section>
      </main>

      {/* Slide-out Menu Drawer dùng chung */}
      <VoyageDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={user}
        onNeedAuth={onNeedAuth}
        onLogout={onLogout}
      />
    </div>
  );
}
