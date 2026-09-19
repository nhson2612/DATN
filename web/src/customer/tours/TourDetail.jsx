import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../../shared/api";
import DetailSkeleton from "../../shared/skeletons/DetailSkeleton";
import TourBookingWizard from "../booking/TourBookingWizard";
import VoyageDrawer from "../../shared/layout/VoyageDrawer";
import "./TourDetail.css";

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function cleanText(str) {
  if (!str) return "";
  return String(str).replaceAll("—", " - ").replaceAll("–", "-");
}

function getWeekday(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return WEEKDAYS[d.getDay()] || "";
}

function formatFullDate(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    const weekday = getWeekday(dateStr);
    return `${weekday}, ${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getDayTimeline(day) {
  if (Array.isArray(day?.timeline) && day.timeline.length > 0) {
    return day.timeline;
  }

  const places = (day?.places || []).map((place, index) => ({
    id: `place-${place?.id || index}`,
    type: "place",
    place,
  }));
  const note = day?.description ? [{ id: "day-note", type: "note", text: day.description }] : [];
  const checklist = day?.checklist?.length
    ? [{ id: "day-checklist", type: "checklist", items: day.checklist }]
    : [];
  return [...places, ...note, ...checklist];
}

function getPlaceNote(day, place) {
  const saved = day?.place_notes?.[place?.id];
  if (typeof saved === "string") return saved;
  if (saved && typeof saved === "object") return saved.note || saved.text || "";
  return place?.note || "";
}

function TourTimelineContent({ day }) {
  const timeline = getDayTimeline(day);

  return (
    <div className="tour-detail__timeline-detail">
      {timeline.map((item, index) => {
        if (item.type === "place") {
          const place = item.place || {};
          const time = place.time_range || [place.time_start, place.time_end].filter(Boolean).join(" – ");
          const note = getPlaceNote(day, place);
          return (
            <article key={item.id || `place-${index}`} className="tour-detail__timeline-place">
              <span className="material-symbols-outlined">location_on</span>
              <div>
                <div className="tour-detail__timeline-place-head">
                  <strong>{cleanText(place.name) || "Điểm tham quan"}</strong>
                  {time && <time>{time}</time>}
                </div>
                {place.dia_chi && <p>{cleanText(place.dia_chi)}</p>}
                {note && <p className="tour-detail__timeline-place-note">{cleanText(note)}</p>}
              </div>
            </article>
          );
        }

        if (item.type === "note") {
          return (
            <aside key={item.id || `note-${index}`} className="tour-detail__timeline-note">
              <span className="material-symbols-outlined">sticky_note_2</span>
              <p>{cleanText(item.text)}</p>
            </aside>
          );
        }

        if (item.type === "checklist") {
          const items = item.items || [];
          return (
            <section key={item.id || `checklist-${index}`} className="tour-detail__timeline-checklist">
              <div>
                <span className="material-symbols-outlined">checklist</span>
                <strong>Danh sách việc cần làm</strong>
              </div>
              <ul>
                {items.map((check, checkIndex) => {
                  const text = typeof check === "string" ? check : check?.text;
                  const checked = typeof check === "object" && Boolean(check?.checked);
                  return (
                    <li key={check?.id || `${item.id || "check"}-${checkIndex}`} className={checked ? "tour-detail__timeline-check--done" : ""}>
                      <span className="material-symbols-outlined">{checked ? "check_circle" : "radio_button_unchecked"}</span>
                      {cleanText(text)}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        }

        return null;
      })}
    </div>
  );
}

export default function TourDetail({ user, onNeedAuth, onLogout }) {
  const { slug } = useParams();
  const nav = useNavigate();

  // Trạng thái dữ liệu tour
  const [tour, setTour] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [isBookingDrawerOpen, setIsBookingDrawerOpen] = useState(false);
  const [heroImageIndex, setHeroImageIndex] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isNavSearchOpen, setIsNavSearchOpen] = useState(false);
  const [navSearchQuery, setNavSearchQuery] = useState("");
  const [scrollProgress, setScrollProgress] = useState(0);
  const navSearchRef = useRef(null);
  const navSearchInputRef = useRef(null);
  const detailScreenRef = useRef(null);
  const scrollFrameRef = useRef(null);

  // Số lượng khách
  const [adults, setAdults] = useState(2);
  const [activeTab, setActiveTab] = useState("overview");

  // Tour tương tự
  const [relatedTours, setRelatedTours] = useState([]);

  // Modal Lightbox xem trọn bộ ảnh
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const [openItineraryDays, setOpenItineraryDays] = useState({});

  // Accordion mở/đóng các mục lưu ý
  const [openAccordion, setOpenAccordion] = useState({
    included: true,
    excluded: false,
    childPrice: false,
    paymentTerms: false,
    bookingTerms: false,
    cancellation: false,
    forceMajeure: false,
    contact: false,
  });

  const toggleAccordion = (key) => {
    setOpenAccordion((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    const handleNavSearchClickOutside = (event) => {
      if (navSearchRef.current && !navSearchRef.current.contains(event.target)) {
        setIsNavSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleNavSearchClickOutside);
    return () => document.removeEventListener("mousedown", handleNavSearchClickOutside);
  }, []);

  const handleNavSearchSubmit = (event) => {
    event?.preventDefault();
    if (!navSearchQuery.trim()) {
      navSearchInputRef.current?.focus();
      return;
    }
    setIsNavSearchOpen(false);
    nav(`/tour?q=${encodeURIComponent(navSearchQuery.trim())}`);
  };

  useEffect(() => {
    const screen = detailScreenRef.current;
    if (!screen) return undefined;

    const handleScroll = () => {
      const scrollTop = screen.scrollTop;
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = requestAnimationFrame(() => {
        setScrollProgress(Math.min(1, Math.max(0, scrollTop / 240)));
      });
    };

    screen.scrollTop = 0;
    setScrollProgress(0);
    screen.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      screen.removeEventListener("scroll", handleScroll);
      if (scrollFrameRef.current) cancelAnimationFrame(scrollFrameRef.current);
    };
  }, [slug]);

  // Lọc tháng cho đợt khởi hành
  const [selectedMonthKey, setSelectedMonthKey] = useState("");
  const departuresSectionRef = useRef(null);

  // Tải các tour gợi ý tương tự thật từ API
  const fetchRelatedTours = useCallback(async (currentTour) => {
    try {
      let toursRes = await api.tours({ province_id: currentTour.province_id, limit: 6 });
      let list = (toursRes?.items || []).filter((item) => item.slug !== currentTour.slug);

      if (list.length < 3) {
        const fallbackRes = await api.tours({ limit: 8 });
        const fallbackList = (fallbackRes?.items || []).filter(
          (item) => item.slug !== currentTour.slug && !list.some((existing) => existing.id === item.id)
        );
        list = [...list, ...fallbackList];
      }

      setRelatedTours(list.slice(0, 4));
    } catch {
      setRelatedTours([]);
    }
  }, []);

  // Tải chi tiết tour từ backend
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api.tour(slug)
      .then((data) => {
        if (!isMounted) return;
        const t = data.tour;
        setTour(t);
        setError("");
        setAdults(2);
        setActiveTab("overview");
        setHeroImageIndex(0);
        // Chọn đợt khởi hành đầu tiên còn chỗ
        const firstAvailable = t.departures?.find((d) => d.status === "OPEN" && d.seats_left > 0);
        const initDep = firstAvailable || t.departures?.[0] || null;
        setSelectedDeparture(initDep);

        // Khởi tạo tháng được chọn từ đợt khởi hành đầu tiên
        if (initDep?.depart_date) {
          const d = new Date(initDep.depart_date);
          setSelectedMonthKey(`${d.getFullYear()}-${d.getMonth() + 1}`);
        }

        fetchRelatedTours(t);
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Không thể tải thông tin tour.");
        setTour(null);
        setRelatedTours([]);
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug, fetchRelatedTours]);

  // Danh sách ảnh hợp lệ
  const galleryImages = useMemo(() => {
    const list = [];
    if (tour?.cover_url) list.push(tour.cover_url);
    if (Array.isArray(tour?.images)) {
      tour.images.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list;
  }, [tour]);

  // Ảnh hero trôi và chuyển cảnh như trang Home.
  useEffect(() => {
    if (galleryImages.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setHeroImageIndex((current) => (current + 1) % galleryImages.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [galleryImages]);

  // Phân nhóm các đợt khởi hành theo tháng
  const departuresByMonth = useMemo(() => {
    const deps = tour?.departures || [];
    const map = new Map();

    deps.forEach((dep) => {
      if (!dep.depart_date) return;
      const d = new Date(dep.depart_date);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const label = `Tháng ${d.getMonth() + 1} ${d.getFullYear()}`;

      if (!map.has(key)) {
        map.set(key, { key, label, list: [] });
      }
      map.get(key).list.push(dep);
    });

    return Array.from(map.values());
  }, [tour?.departures]);

  // Cập nhật selectedMonthKey nếu chưa có
  useEffect(() => {
    if (departuresByMonth.length > 0 && !selectedMonthKey) {
      setSelectedMonthKey(departuresByMonth[0].key);
    }
  }, [departuresByMonth, selectedMonthKey]);

  // Danh sách đợt khởi hành của tháng đang chọn
  const currentMonthDepartures = useMemo(() => {
    if (!selectedMonthKey) return tour?.departures || [];
    const found = departuresByMonth.find((m) => m.key === selectedMonthKey);
    return found ? found.list : tour?.departures || [];
  }, [departuresByMonth, selectedMonthKey, tour?.departures]);

  // Giá hiệu lực và giá gốc
  const effectiveUnitPrice = useMemo(() => {
    if (selectedDeparture) {
      return selectedDeparture.effective_price || selectedDeparture.price || 0;
    }
    return tour?.price_from || 0;
  }, [selectedDeparture, tour?.price_from]);

  const originalUnitPrice = useMemo(() => {
    if (selectedDeparture) {
      return selectedDeparture.list_price || 0;
    }
    return tour?.original_price || 0;
  }, [selectedDeparture, tour?.original_price]);

  // Cuộn tới phần chọn ngày khởi hành
  const handleScrollToDepartures = () => {
    setActiveTab("departures");
    requestAnimationFrame(() => {
      departuresSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  // Lightbox keyboard navigation
  useEffect(() => {
    if (!isLightboxOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsLightboxOpen(false);
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, galleryImages.length]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f4f6f8] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <DetailSkeleton />
        </div>
      </main>
    );
  }

  if (error || !tour) {
    return (
      <main className="min-h-screen bg-[#f4f6f8] flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-sm border border-zinc-200">
          <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-2xl">error</span>
          </div>
          <h2 className="text-lg font-bold text-zinc-900 mb-2">Không tìm thấy thông tin tour</h2>
          <p className="text-xs text-zinc-500 mb-6">{cleanText(error) || "Tour không tồn tại hoặc đã ngừng hoạt động."}</p>
          <button
            type="button"
            onClick={() => nav("/tour")}
            className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs rounded-full transition-colors cursor-pointer"
          >
            Quay lại danh sách tour
          </button>
        </div>
      </main>
    );
  }

  // Mã tour định danh
  const tourCode = tour.slug ? tour.slug.slice(0, 8).toUpperCase() : `TOUR#${tour.id}`;
  const heroFade = Math.max(0, 1 - scrollProgress * 1.1);
  const heroMask = scrollProgress > 0.02
    ? `linear-gradient(to top, transparent 0%, transparent ${Math.max(0, scrollProgress * 115 - 15).toFixed(1)}%, #000 ${Math.min(100, scrollProgress * 115 + 15).toFixed(1)}%, #000 100%)`
    : undefined;
  const heroBackgroundStyle = {
    opacity: heroFade,
    filter: scrollProgress > 0.02 ? `blur(${(scrollProgress * 6).toFixed(1)}px)` : undefined,
    transform: scrollProgress > 0.01 ? `translateY(${(scrollProgress * 16).toFixed(1)}px)` : undefined,
    ...(heroMask ? { WebkitMaskImage: heroMask, maskImage: heroMask } : {}),
  };
  const heroForegroundStyle = {
    opacity: heroFade,
    transform: scrollProgress > 0.01 ? `translateY(${(-scrollProgress * 18).toFixed(1)}px)` : undefined,
  };

  return (
    <main className="tour-detail" ref={detailScreenRef}>
      <section className="tour-detail__hero" style={{ pointerEvents: scrollProgress >= 0.9 ? "none" : "auto" }}>
        <div className="tour-detail__hero-background" style={heroBackgroundStyle} aria-hidden="true">
          {(galleryImages.length ? galleryImages : [tour.cover_url || "/assets/images/placeholder.jpg"]).map((image, index) => (
            <div
              key={image || index}
              className={`tour-detail__hero-image ${heroImageIndex === index ? "tour-detail__hero-image--active" : ""}`}
              style={{ backgroundImage: `url(${image})` }}
            />
          ))}
        </div>
        <div className="tour-detail__hero-overlay" style={heroForegroundStyle} />
        <header className="tour-detail__nav voyage-nav tour-detail__shell" style={heroForegroundStyle}>
          <Link to="/" className="voyage-brand">Voyage</Link>
          <nav className="voyage-navlinks" aria-label="Điều hướng chính">
            <Link to="/" className="voyage-navlink">Destinations</Link>
            <Link to="/tour" className="voyage-navlink voyage-navlink--active">Tours</Link>
            <Link to="/chuyen-di" className="voyage-navlink">Experiences</Link>
          </nav>
          <div className="voyage-actions">
            <div className={`voyage-nav-search ${isNavSearchOpen ? "voyage-nav-search--open" : ""}`} ref={navSearchRef}>
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
                <span className="material-symbols-outlined text-[19px]">search</span>
              </button>
              <form className="voyage-nav-search-form" onSubmit={handleNavSearchSubmit}>
                <input
                  ref={navSearchInputRef}
                  type="text"
                  className="voyage-nav-search-input"
                  placeholder="Search destinations, tours..."
                  value={navSearchQuery}
                  onChange={(event) => setNavSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setIsNavSearchOpen(false);
                  }}
                  tabIndex={isNavSearchOpen ? 0 : -1}
                />
                {isNavSearchOpen && (
                  <button type="button" className="voyage-nav-search-close" onClick={() => { setIsNavSearchOpen(false); setNavSearchQuery(""); }} aria-label="Close search">✕</button>
                )}
              </form>
            </div>
            <button
              type="button"
              className="voyage-iconbtn"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open menu"
              title="Menu"
            >
              <span className="material-symbols-outlined text-[20px]">menu</span>
            </button>
          </div>
        </header>
        <div className="tour-detail__hero-content tour-detail__shell" style={heroForegroundStyle}>
          <div className="tour-detail__kicker">
            <span className="material-symbols-outlined">location_on</span>
            {tour.province_name || "Việt Nam"}
          </div>
          <h1>{tour.name}</h1>
          <div className="tour-detail__hero-meta">
            <p>
              {tour.duration_days > 1 ? `${tour.duration_days} ngày ${tour.duration_days - 1} đêm` : "Trong ngày"}
              {tour.operator_name ? ` · ${tour.operator_name}` : ""}
            </p>
            {galleryImages.length > 1 && (
              <div className="tour-detail__hero-indicators" aria-label="Chọn ảnh tour">
                {galleryImages.map((image, index) => (
                  <button
                    key={image || index}
                    type="button"
                    className={`tour-detail__hero-indicator ${heroImageIndex === index ? "tour-detail__hero-indicator--active" : ""}`}
                    onClick={() => setHeroImageIndex(index)}
                    aria-label={`Ảnh ${index + 1}`}
                    aria-current={heroImageIndex === index ? "true" : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <nav className="tour-detail__tabs" aria-label="Điều hướng nội dung tour">
        <div className="tour-detail__shell" role="tablist" aria-label="Thông tin tour">
          {[
            ["overview", "Tổng quan"],
            ["departures", "Khởi hành"],
            ["services", "Bao gồm & không bao gồm"],
            ["information", "Thông tin tour"],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`tour-panel-${id}`}
              className={`tour-detail__tab ${activeTab === id ? "tour-detail__tab--active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="tour-detail__content tour-detail__shell">

        {/* 3. Hero Section (Cột trái ảnh lớn + Cột phải widget tóm tắt & Đặt tour - Chuẩn ảnh 123.png) */}
        {activeTab === "overview" && (
        <div id="tour-panel-overview" role="tabpanel" className="tour-detail__panel">
        <section className="tour-detail__overview">
          <div className="tour-detail__overview-copy">
            <h2>{tour.name}</h2>
            {tour.summary && <p>{cleanText(tour.summary)}</p>}
          </div>
          <dl className="tour-detail__overview-facts">
            <div>
              <dt>Thời lượng</dt>
              <dd>{tour.duration_days > 1 ? `${tour.duration_days} ngày ${tour.duration_days - 1} đêm` : "Trong ngày"}</dd>
            </div>
            <div>
              <dt>Giá từ</dt>
              <dd>{effectiveUnitPrice.toLocaleString("vi-VN")}₫ <small>/ khách</small></dd>
            </div>
            <div>
              <dt>Khởi hành</dt>
              <dd>{selectedDeparture ? formatFullDate(selectedDeparture.depart_date) : "Đang cập nhật"}</dd>
            </div>
          </dl>
        </section>
        </div>
        )}

        {/* 4. Section "Lịch trình khởi hành" (Departures Picker - Chuẩn ảnh 123.png) */}
        {activeTab === "departures" && (
        <section id="tour-panel-departures" role="tabpanel" ref={departuresSectionRef} className="tour-detail__panel tour-detail__section tour-detail__departures">
          <h2>Lịch trình khởi hành</h2>

          {departuresByMonth.length > 0 ? (
            <div className="tour-detail__departures-content">
              {/* Tabs chọn tháng */}
              <div className="tour-detail__month-tabs" role="tablist" aria-label="Chọn tháng khởi hành">
                {departuresByMonth.map((m) => {
                  const isActive = selectedMonthKey === m.key;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMonthKey(m.key)}
                      className={`tour-detail__month-tab ${
                        isActive
                          ? "tour-detail__month-tab--active"
                          : ""
                      }`}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>

              {/* Danh sách các đợt khởi hành trong tháng */}
              <div className="tour-detail__departure-grid">
                {currentMonthDepartures.map((d) => {
                  const isSelected = selectedDeparture?.id === d.id;
                  const isAvailable = d.seats_left > 0 && d.status === "OPEN";
                  const price = d.effective_price || d.price || 0;

                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => {
                        if (isAvailable) setSelectedDeparture(d);
                      }}
                      className={`tour-detail__departure-card ${
                        isSelected
                          ? "tour-detail__departure-card--selected"
                          : isAvailable
                          ? ""
                          : "tour-detail__departure-card--unavailable"
                      }`}
                    >
                      <span className="tour-detail__departure-copy">
                        <span className="tour-detail__departure-date">
                          <span className="material-symbols-outlined">event</span>
                          <strong>
                            {formatFullDate(d.depart_date)}
                          </strong>
                        </span>
                        <span className="tour-detail__departure-price">
                          <strong>{price.toLocaleString("vi-VN")}₫</strong>
                          {d.list_price && d.list_price > price && (
                            <span>
                              {d.list_price.toLocaleString("vi-VN")}₫
                            </span>
                          )}
                        </span>
                        <span className={`tour-detail__departure-seats ${isAvailable ? "tour-detail__departure-seats--available" : ""}`}>
                          {isAvailable ? `Còn ${d.seats_left} chỗ` : "Hết chỗ"}
                        </span>
                      </span>

                      <span className="tour-detail__departure-state">
                        {isSelected ? (
                          <span className="tour-detail__departure-check">
                            <span className="material-symbols-outlined">check</span>
                          </span>
                        ) : isAvailable ? (
                          <span className="tour-detail__departure-select">
                            Chọn
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="tour-detail__empty-state">
              Hiện chưa có đợt khởi hành nào được mở bán. Vui lòng liên hệ để được hỗ trợ.
            </div>
          )}

          {selectedDeparture?.seats_left > 0 && selectedDeparture.status === "OPEN" && (
            <div className="tour-detail__departure-action">
              <p>
                Đang chọn <strong>{formatFullDate(selectedDeparture.depart_date)}</strong>
                <span> · Còn {selectedDeparture.seats_left} chỗ</span>
              </p>
              <button type="button" onClick={() => setIsBookingDrawerOpen(true)}>
                Đặt tour
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          )}
        </section>
        )}

        {activeTab === "overview" && (
        <div className="tour-detail__panel">
        <section className="tour-detail__section tour-detail__highlights">
          <h2>Điểm nhấn chương trình</h2>
          <div className="tour-detail__highlights-content">
            {Array.isArray(tour.highlights) && tour.highlights.length > 0 ? (
              <ul className="tour-detail__highlights-list">
                {tour.highlights.map((hl, idx) => (
                  <li key={idx}>
                    <span aria-hidden="true">{String(idx + 1).padStart(2, "0")}</span>
                    <span>{cleanText(hl)}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {tour.description && (
              <p className="tour-detail__highlights-description">
                {cleanText(tour.description)}
              </p>
            )}
          </div>
        </section>
        </div>
        )}

        {/* 7. Section "Lịch trình" (Itinerary Cards - Chuẩn ảnh 345.png & 567.png) */}
        {activeTab === "overview" && (
        <section className="tour-detail__panel tour-detail__section space-y-4">
          <h2 className="text-xl font-bold text-zinc-900">Lịch trình</h2>
          {Array.isArray(tour.itinerary) && tour.itinerary.length > 0 ? (
            <div className="tour-detail__timeline">
              {tour.itinerary.map((dayItem, dIdx) => (
                <article
                  key={dIdx}
                  className="tour-detail__timeline-day"
                >
                  <div className="tour-detail__day-label">Ngày {dayItem.day || dIdx + 1}</div>
                  <div className="tour-detail__timeline-body">
                    <button
                      type="button"
                      onClick={() => {
                        const dayKey = dayItem.day || dIdx + 1;
                        setOpenItineraryDays((previous) => ({
                          ...previous,
                          [dayKey]: !previous[dayKey],
                        }));
                      }}
                      className="tour-detail__timeline-item"
                      aria-expanded={Boolean(openItineraryDays[dayItem.day || dIdx + 1])}
                    >
                      <span className="tour-detail__timeline-dot" aria-hidden="true" />
                      <img
                        src={dayItem.places?.[0]?.anh || tour.cover_url || "/assets/images/placeholder.jpg"}
                        alt={dayItem.title || `Hành trình ngày ${dayItem.day || dIdx + 1}`}
                      />
                      <span className="tour-detail__timeline-copy">
                        <strong>{dayItem.title || "Hành trình chi tiết"}</strong>
                        <span>
                          {cleanText(dayItem.description) ||
                            `${dayItem.places?.length || 0} điểm tham quan trong ngày`}
                        </span>
                      </span>
                      <span className={`material-symbols-outlined tour-detail__timeline-arrow ${openItineraryDays[dayItem.day || dIdx + 1] ? "tour-detail__timeline-arrow--open" : ""}`} aria-hidden="true">
                        keyboard_arrow_down
                      </span>
                    </button>
                    {openItineraryDays[dayItem.day || dIdx + 1] && (
                      <TourTimelineContent day={dayItem} />
                    )}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center text-zinc-500 text-xs border border-zinc-100">
              Lịch trình chi tiết đang được cập nhật.
            </div>
          )}
        </section>
        )}

        {activeTab === "services" && (
          <section id="tour-panel-services" role="tabpanel" className="tour-detail__section space-y-4">
            <h2 className="text-xl font-bold text-zinc-900">Bao gồm & không bao gồm</h2>
            <div className="bg-white rounded-2xl shadow-xs border border-zinc-100 overflow-hidden divide-y divide-zinc-100">
              <div className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleAccordion("included")}
                  className="w-full py-4 px-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <span className="text-xs sm:text-sm font-bold text-zinc-900">Giá tour bao gồm</span>
                  <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${openAccordion.included ? "rotate-180" : ""}`}>keyboard_arrow_down</span>
                </button>
                {openAccordion.included && (
                  <div className="px-6 pb-5 pt-1 text-xs text-zinc-700 space-y-2">
                    {Array.isArray(tour.included) && tour.included.length > 0 ? (
                      <ul className="space-y-1.5">
                        {tour.included.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm text-emerald-600 shrink-0 mt-0.5">check_circle</span>
                            <span>{cleanText(item)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-zinc-500">Chưa có thông tin.</p>}
                  </div>
                )}
              </div>
              <div className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleAccordion("excluded")}
                  className="w-full py-4 px-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  <span className="text-xs sm:text-sm font-bold text-zinc-900">Giá tour không bao gồm</span>
                  <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${openAccordion.excluded ? "rotate-180" : ""}`}>keyboard_arrow_down</span>
                </button>
                {openAccordion.excluded && (
                  <div className="px-6 pb-5 pt-1 text-xs text-zinc-700 space-y-2">
                    {Array.isArray(tour.excluded) && tour.excluded.length > 0 ? (
                      <ul className="space-y-1.5">
                        {tour.excluded.map((item, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="material-symbols-outlined text-sm text-rose-600 shrink-0 mt-0.5">cancel</span>
                            <span>{cleanText(item)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-zinc-500">Chưa có thông tin.</p>}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 8. Section "Những thông tin cần lưu ý" (Accordion - Chuẩn ảnh 567.png & 890.png) */}
        {activeTab === "information" && (
        <>
        <section className="tour-detail__section space-y-4">
          <h2 className="text-xl font-bold text-zinc-900">Những thông tin cần lưu ý</h2>
          <div className="bg-white rounded-2xl shadow-xs border border-zinc-100 overflow-hidden divide-y divide-zinc-100">
            {/* 3. Lưu ý giá trẻ em */}
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("childPrice")}
                className="w-full py-4 px-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-zinc-900">Lưu ý giá trẻ em</span>
                <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${openAccordion.childPrice ? "rotate-180" : ""}`}>
                  keyboard_arrow_down
                </span>
              </button>
              {openAccordion.childPrice && (
                <div className="px-6 pb-5 pt-1 text-xs text-zinc-700 space-y-2">
                  <p>• Trẻ em dưới 5 tuổi: Miễn phí giá tour (cha mẹ tự túc các chi phí phát sinh nếu có).</p>
                  <p>• Trẻ em từ 5 đến 11 tuổi: Tính 75% giá tour người lớn, ngủ chung giường với bố mẹ.</p>
                  <p>• Trẻ em từ 12 tuổi trở lên: Tính giá như người lớn, hưởng đầy đủ dịch vụ tiêu chuẩn.</p>
                </div>
              )}
            </div>

            {/* 4. Điều kiện thanh toán */}
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("paymentTerms")}
                className="w-full py-4 px-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-zinc-900">Điều kiện thanh toán</span>
                <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${openAccordion.paymentTerms ? "rotate-180" : ""}`}>
                  keyboard_arrow_down
                </span>
              </button>
              {openAccordion.paymentTerms && (
                <div className="px-6 pb-5 pt-1 text-xs text-zinc-700 space-y-2">
                  <p>• Thanh toán giữ chỗ: Đặt cọc 50% tổng giá trị tour ngay khi xác nhận đặt tour.</p>
                  <p>• Thanh toán phần còn lại: Hoàn tất 100% trước ngày khởi hành tối thiểu 3 ngày.</p>
                  <p>• Hình thức thanh toán: Chuyển khoản ngân hàng trực tiếp (hỗ trợ VietQR quét mã tức thì) hoặc thẻ thanh toán quốc tế.</p>
                </div>
              )}
            </div>

            {/* 5. Điều kiện đăng ký */}
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("bookingTerms")}
                className="w-full py-4 px-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-zinc-900">Điều kiện đăng ký</span>
                <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${openAccordion.bookingTerms ? "rotate-180" : ""}`}>
                  keyboard_arrow_down
                </span>
              </button>
              {openAccordion.bookingTerms && (
                <div className="px-6 pb-5 pt-1 text-xs text-zinc-700 space-y-2">
                  <p>• Khách hàng vui lòng mang theo Căn cước công dân (CCCD) hoặc Hộ chiếu bản gốc còn hạn khi tham gia tour.</p>
                  <p>• Trẻ em dưới 14 tuổi cần mang theo Giấy khai sinh bản sao trích lục hoặc Hộ chiếu.</p>
                </div>
              )}
            </div>

            {/* 6. Chính sách hoàn hủy tour */}
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("cancellation")}
                className="w-full py-4 px-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-zinc-900">Lưu ý về chuyển hoặc hủy tour</span>
                <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${openAccordion.cancellation ? "rotate-180" : ""}`}>
                  keyboard_arrow_down
                </span>
              </button>
              {openAccordion.cancellation && (
                <div className="px-6 pb-5 pt-1 text-xs text-zinc-700 space-y-3">
                  {Array.isArray(tour.cancellation_policy) && tour.cancellation_policy.length > 0 ? (
                    <div className="border border-zinc-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 font-semibold text-zinc-600 border-b border-zinc-200">
                          <tr>
                            <th className="py-2.5 px-4">Thời gian thông báo hủy</th>
                            <th className="py-2.5 px-4 text-right">Tỷ lệ hoàn tiền</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {tour.cancellation_policy.map((moc, idx) => (
                            <tr key={idx}>
                              <td className="py-2 px-4">Từ {moc.days_before} ngày trước khởi hành</td>
                              <td className="py-2 px-4 text-right font-bold text-blue-700">{moc.refund_percent}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>• Hủy trước 7 ngày khởi hành: Hoàn 100% chi phí.</p>
                  )}
                </div>
              )}
            </div>

            {/* 7. Trường hợp bất khả kháng */}
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("forceMajeure")}
                className="w-full py-4 px-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-zinc-900">Trường hợp bất khả kháng</span>
                <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${openAccordion.forceMajeure ? "rotate-180" : ""}`}>
                  keyboard_arrow_down
                </span>
              </button>
              {openAccordion.forceMajeure && (
                <div className="px-6 pb-5 pt-1 text-xs text-zinc-700 space-y-2">
                  <p>Trong trường hợp bất khả kháng do thiên tai, bão lũ, dịch bệnh hoặc lệnh cấm từ cơ quan chức năng, hai bên sẽ phối hợp dời ngày khởi hành hoặc hoàn lại 100% tiền tour theo quy định.</p>
                </div>
              )}
            </div>

            {/* 8. Liên hệ */}
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => toggleAccordion("contact")}
                className="w-full py-4 px-6 text-left flex items-center justify-between hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <span className="text-xs sm:text-sm font-bold text-zinc-900">Liên hệ</span>
                <span className={`material-symbols-outlined text-zinc-500 transition-transform duration-200 ${openAccordion.contact ? "rotate-180" : ""}`}>
                  keyboard_arrow_down
                </span>
              </button>
              {openAccordion.contact && (
                <div className="px-6 pb-5 pt-1 text-xs text-zinc-700 space-y-2">
                  <p>• Hotline chăm sóc khách hàng 24/7: <strong className="text-blue-700">1900 6868</strong></p>
                  <p>• Email hỗ trợ: <strong className="text-blue-700">hotro@dulichvietnam.vn</strong></p>
                  <p>• Địa chỉ văn phòng giao dịch tại các thành phố lớn trên toàn quốc.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 9. Section "Các chương trình khác" (Related Tours - Chuẩn ảnh 890.png) */}
        {relatedTours.length > 0 && (
          <section className="tour-detail__section space-y-4 pt-4">
            <h2 className="text-xl font-bold text-zinc-900">Các chương trình khác</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedTours.map((rTour) => {
                const rPrice = rTour.price_from || rTour.price || 0;
                return (
                  <div
                    key={rTour.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-xs border border-zinc-100 flex flex-col group hover:shadow-md transition-all"
                  >
                    {/* Ảnh tour */}
                    <div className="relative aspect-16/10 overflow-hidden bg-zinc-100">
                      <img
                        src={rTour.cover_url || "/assets/images/placeholder.jpg"}
                        alt={rTour.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-2.5 left-2.5 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                        Giá tốt
                      </span>
                      <Link
                        to={`/tour/${rTour.slug}`}
                        className="absolute bottom-2.5 right-2.5 bg-black/60 hover:bg-black/80 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full backdrop-blur-xs flex items-center gap-1 transition-colors"
                      >
                        <span className="material-symbols-outlined text-xs">visibility</span>
                        <span>Xem nhanh</span>
                      </Link>
                    </div>

                    {/* Nội dung card */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div>
                        <Link
                          to={`/tour/${rTour.slug}`}
                          className="font-bold text-xs sm:text-sm text-zinc-900 group-hover:text-blue-700 transition-colors line-clamp-2"
                        >
                          {rTour.name}
                        </Link>
                        <div className="flex items-center gap-3 text-[11px] text-zinc-500 mt-2">
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs text-zinc-400">pin_drop</span>
                            {rTour.province_name || "Việt Nam"}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-xs text-zinc-400">schedule</span>
                            {rTour.duration_days > 1 ? `${rTour.duration_days} ngày` : "Trong ngày"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
                        <div>
                          <span className="block text-[10px] text-zinc-400">Giá từ:</span>
                          <strong className="text-sm font-extrabold text-blue-700">
                            {rPrice.toLocaleString("vi-VN")}₫
                          </strong>
                        </div>
                        <Link
                          to={`/tour/${rTour.slug}`}
                          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold rounded-full transition-colors"
                        >
                          Xem chi tiết
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        </>
        )}
      </div>

      {/* Modal Lightbox phóng to ảnh */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">close</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
            }}
            className="absolute left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>

          <img
            src={galleryImages[lightboxIndex]}
            alt={`Ảnh tour ${lightboxIndex + 1}`}
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
            }}
            className="absolute right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-2xl">arrow_forward</span>
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/60 text-white text-xs font-semibold">
            {lightboxIndex + 1} / {galleryImages.length}
          </div>
        </div>
      )}

      {/* Menu Drawer dùng chung */}
      <VoyageDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={user}
        onNeedAuth={onNeedAuth}
        onLogout={onLogout}
      />

      {/* Drawer đặt tour */}
      <TourBookingWizard
        open={isBookingDrawerOpen}
        onClose={() => setIsBookingDrawerOpen(false)}
        tour={tour}
        initialDeparture={selectedDeparture}
        initialGuests={adults}
        user={user}
        onNeedAuth={onNeedAuth}
      />
    </main>
  );
}
