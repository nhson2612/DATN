import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { api } from "../../shared/api";
import DetailSkeleton from "../../shared/skeletons/DetailSkeleton";
import TourBookingWizard from "../booking/TourBookingWizard";
import VoyageDrawer from "../../shared/layout/VoyageDrawer";
import "./TourDetail.css";

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

export default function TourDetail({ user, onNeedAuth, onLogout }) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();

  const [tour, setTour] = useState(null);
  const [similarTours, setSimilarTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [adults] = useState(2);
  const [openDays, setOpenDays] = useState({ 0: true, 1: true });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isBookingWizardOpen, setIsBookingWizardOpen] = useState(
    () => searchParams.get("book") === "1"
  );
  const [isSaved, setIsSaved] = useState(false);
  const [heroPhotoIdx, setHeroPhotoIdx] = useState(0);
  const [activeSection, setActiveSection] = useState("overview");
  const mainContentRef = useRef(null);

  // Khi người dùng lăn chuột ở khu vực sidebar bên trái, chuyển tiếp cuộn sang cột nội dung bên phải
  useEffect(() => {
    const sidebar = document.querySelector(".aura-detail__sidebar");
    const onWheel = (e) => {
      if (mainContentRef.current) {
        mainContentRef.current.scrollTop += e.deltaY;
      }
    };
    if (sidebar) {
      sidebar.addEventListener("wheel", onWheel, { passive: true });
    }
    return () => {
      if (sidebar) {
        sidebar.removeEventListener("wheel", onWheel);
      }
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    api
      .tour(slug)
      .then((data) => {
        if (!isMounted) return;
        const tourData = data?.tour || data;
        setTour(tourData);
        if (tourData.departures && tourData.departures.length > 0) {
          setSelectedDeparture(tourData.departures[0]);
        }
        setLoading(false);

        // Tải các tour tương tự hoặc cùng địa phương
        api
          .tours({ limit: 12 })
          .then((res) => {
            if (!isMounted) return;
            const all = res?.tours || res?.items || (Array.isArray(res) ? res : []);
            const filtered = all.filter((t) => t.slug !== slug && t.id !== tourData.id);
            // Ưu tiên tour cùng tỉnh thành
            const sameProv = filtered.filter((t) => t.province_id === tourData.province_id);
            const otherProv = filtered.filter((t) => t.province_id !== tourData.province_id);
            const combined = [...sameProv, ...otherProv].slice(0, 3);
            setSimilarTours(combined);
          })
          .catch((err) => {
            console.warn("Không thể tải tour tương tự:", err);
          });
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Lỗi tải chi tiết tour:", err);
        setError(err.message || "Không thể tải thông tin tour.");
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [slug]);

  const toggleDay = (idx) => {
    setOpenDays((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const images = useMemo(() => {
    if (!tour) return [];
    const list = [];
    if (tour.cover_url) list.push(tour.cover_url);
    if (Array.isArray(tour.images)) {
      tour.images.forEach((img) => {
        const url = typeof img === "string" ? img : img?.url;
        if (url && !list.includes(url)) list.push(url);
      });
    }
    const fallbacks = [
      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=1600&q=80",
      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    ];
    let fbIdx = 0;
    while (list.length < 3) {
      list.push(fallbacks[fbIdx % fallbacks.length]);
      fbIdx++;
    }
    return list;
  }, [tour]);

  // Gallery 4 ảnh ngang
  const galleryStripPhotos = useMemo(() => {
    const list = [...images];
    const defaultPhotos = [
      "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
    ];
    let dIdx = 0;
    while (list.length < 4) {
      list.push(defaultPhotos[dIdx % defaultPhotos.length]);
      dIdx++;
    }
    return list.slice(0, 4);
  }, [images]);

  const unitPrice = useMemo(() => {
    if (selectedDeparture?.price) return Number(selectedDeparture.price);
    if (tour?.price_from) return Number(tour.price_from);
    return 0;
  }, [selectedDeparture, tour]);

  const nextHeroPhoto = () => {
    if (images.length > 0) {
      setHeroPhotoIdx((prev) => (prev + 1) % images.length);
    }
  };

  const prevHeroPhoto = () => {
    if (images.length > 0) {
      setHeroPhotoIdx((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const handleSelectTab = (sectionId) => {
    setActiveSection(sectionId);
    setTimeout(() => {
      const tabWrap = document.querySelector(".aura-detail__tab-wrapper");
      if (mainContentRef.current && tabWrap) {
        const targetScroll = Math.max(0, tabWrap.offsetTop - 40);
        if (mainContentRef.current.scrollTop < targetScroll - 80) {
          mainContentRef.current.scrollTo({ top: targetScroll, behavior: "smooth" });
        }
      }
    }, 40);
  };

  if (loading) {
    return (
      <div className="aura-detail">
        <main className="aura-detail__container">
          <DetailSkeleton />
        </main>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="aura-detail">
        <main className="aura-detail__container aura-detail__container--empty">
          <div className="aura-detail__empty-box">
            <div className="aura-detail__empty-icon">✕</div>
            <h2 className="aura-detail__empty-title">Không tìm thấy thông tin tour</h2>
            <p className="aura-detail__empty-desc">
              {cleanText(error) || "Tour không tồn tại hoặc đã tạm dừng nhận khách."}
            </p>
            <button
              type="button"
              className="aura-detail__empty-btn"
              onClick={() => nav("/tour")}
            >
              Quay lại danh sách tour
            </button>
          </div>
        </main>
      </div>
    );
  }

  const durationDays = tour.duration_days || 1;
  const durationBadge =
    durationDays > 1 ? `${durationDays} Days` : "1 Day";
  const cleanProvince =
    tour.province_name?.replace(/^(Thành phố|Tỉnh)\s+/, "") || "Việt Nam";

  // Tính toán giá hiển thị
  const curDep = selectedDeparture || (tour.departures && tour.departures[0]);
  const curSalePrice = curDep?.sale_price && curDep?.effective_price ? Number(curDep.effective_price) : Number(unitPrice);
  const priceFormatted = Number(curSalePrice).toLocaleString("vi-VN");

  // Xử lý tiêu đề thành 2 dòng (Tên chính + Phong cách / Điểm nhấn)
  const rawTourName = cleanText(tour.name);
  const tourNameParts = rawTourName.split(" - ");
  const tourTitleMain = tourNameParts[0] || rawTourName;
  const tourTitleAccent = tourNameParts[1] || "Discovery";

  return (
    <div className="aura-detail">
      <main className="aura-detail__container">
        <div className="aura-detail__layout-grid">
          {/* ========================================================= */}
          {/* CỘT TRÁI: SIDEBAR DỌC (Logo + Nav dùng chung + Anchor tabs) */}
          {/* ========================================================= */}
          <aside className="aura-detail__sidebar">
            <div className="aura-detail__sidebar-top">
              <Link to="/" className="aura-home__brand" aria-label="Aura Voyage">
                <svg
                  className="aura-home__brand-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 10.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                </svg>
              </Link>

              {/* Dùng chung bộ nav hệ thống */}
              <nav className="aura-home__nav" aria-label="Main Editorial Navigation">
                <Link to="/" className="aura-home__nav-link">
                  <span>About</span>
                  <span>→</span>
                </Link>
                <Link to="/tour" className="aura-home__nav-link aura-home__nav-link--active">
                  <span>/ Tours</span>
                </Link>
                <Link to="/chuyen-di" className="aura-home__nav-link">
                  <span>Experiences</span>
                  <span>→</span>
                </Link>
                <Link to="/tai-khoan" className="aura-home__nav-link">
                  <span>Account</span>
                  <span>→</span>
                </Link>
              </nav>
            </div>

            <div className="aura-detail__sidebar-middle">
              <Link to="/tour" className="aura-detail__back-link">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Back to tours</span>
              </Link>
            </div>

            {/* In-page Anchor Navigation theo đúng mockup */}
            <nav className="aura-detail__page-nav" aria-label="Section Navigation">
              {[
                { id: "overview", label: "Overview" },
                { id: "highlights", label: "Highlights" },
                { id: "itinerary", label: "Itinerary" },
                { id: "included", label: "What's included" },
                { id: "reviews", label: "Reviews" },
                { id: "faq", label: "FAQ" },
              ].map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  className={`aura-detail__page-nav-item ${
                    activeSection === sec.id ? "aura-detail__page-nav-item--active" : ""
                  }`}
                  onClick={() => handleSelectTab(sec.id)}
                >
                  {sec.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* ========================================================= */}
          {/* CỘT PHẢI: NỘI DUNG CHÍNH (Hero cắt chéo + Gallery + Booking + Details) */}
          {/* ========================================================= */}
          <div className="aura-detail__main-content" ref={mainContentRef}>
            {/* 1. TOP HERO SECTION */}
            <section className="aura-detail__hero">
              {/* Cột trái Hero: Breadcrumbs + Title + Description + Meta tags */}
              <div className="aura-detail__hero-text">
                <div className="aura-detail__breadcrumbs">
                  <Link to="/tour">Tours</Link>
                  <span className="aura-detail__bread-sep">/</span>
                  <span>{cleanProvince}</span>
                  <span className="aura-detail__bread-sep">/</span>
                  <span className="aura-detail__bread-current">{tourTitleMain}</span>
                </div>

                <h1 className="aura-detail__hero-title">
                  <span className="aura-detail__hero-title-main">{tourTitleMain}</span>
                  <span className="aura-detail__hero-title-sub">{tourTitleAccent}</span>
                </h1>

                <p className="aura-detail__hero-lead">
                  {cleanText(tour.summary || tour.description) ||
                    `A ${durationDays}-day journey through ${cleanProvince}'s most iconic destinations — charming towns, stunning natural views, and authentic cultural experiences.`}
                </p>

                {/* Hàng badge thông số với icon theo mockup */}
                <div className="aura-detail__hero-meta-row">
                  <div className="aura-detail__hero-meta-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>{cleanProvince}</span>
                  </div>

                  <div className="aura-detail__hero-meta-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                    <span>{durationBadge}</span>
                  </div>

                  <div className="aura-detail__hero-meta-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                      <circle cx="9" cy="7" r="4"/>
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <span>Small group</span>
                  </div>

                  <div className="aura-detail__hero-meta-pill">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
                    </svg>
                    <span>Leisure</span>
                  </div>
                </div>
              </div>

              {/* Cột phải Hero: Banner cắt chéo + Nút tròn điều khiển + Slider indicator */}
              <div className="aura-detail__hero-banner-wrap">
                <div className="aura-detail__hero-banner">
                  <img
                    src={images[heroPhotoIdx] || images[0]}
                    alt={cleanText(tour.name)}
                    className="aura-detail__hero-img"
                  />

                  {/* Top-Right Circle Controls (Search & Drawer Menu) */}
                  <div className="aura-detail__hero-controls">
                    <button
                      type="button"
                      className="aura-detail__circle-btn"
                      onClick={() => nav("/tour")}
                      aria-label="Tìm kiếm tour"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="aura-detail__circle-btn"
                      onClick={() => setIsDrawerOpen(true)}
                      aria-label="Mở Menu"
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <line x1="4" y1="7" x2="20" y2="7" />
                        <line x1="4" y1="12" x2="20" y2="12" />
                        <line x1="4" y1="17" x2="20" y2="17" />
                      </svg>
                    </button>
                  </div>

                  {/* Bottom-Right Slider Indicator & Arrows */}
                  <div className="aura-detail__hero-slider-bar">
                    <div className="aura-detail__hero-track">
                      <div
                        className="aura-detail__hero-track-fill"
                        style={{
                          width: `${((heroPhotoIdx + 1) / Math.max(1, images.length)) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="aura-detail__hero-count">
                      {String(heroPhotoIdx + 1).padStart(2, "0")} / {String(Math.max(1, images.length)).padStart(2, "0")}
                    </span>

                    <div className="aura-detail__hero-arrows">
                      <button
                        type="button"
                        className="aura-detail__arrow-btn"
                        onClick={prevHeroPhoto}
                        aria-label="Ảnh trước"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="aura-detail__arrow-btn"
                        onClick={nextHeroPhoto}
                        aria-label="Ảnh sau"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                          <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. DẢI 4 ẢNH GALLERY NGANG (Middle Photo Gallery Strip) */}
            <section className="aura-detail__gallery-strip">
              {galleryStripPhotos.map((photoUrl, pIdx) => (
                <div
                  key={pIdx}
                  className="aura-detail__gallery-strip-item"
                  onClick={() => setHeroPhotoIdx(pIdx % images.length)}
                >
                  <img
                    src={photoUrl}
                    alt={`${cleanText(tour.name)} - view ${pIdx + 1}`}
                    className="aura-detail__gallery-strip-img"
                    loading="lazy"
                  />
                </div>
              ))}
            </section>

            {/* 3. KHU VỰC THÔNG TIN CHÍNH + FLOATING BOOKING CARD */}
            <div className="aura-detail__content-split">
              <div className="aura-detail__left-flow">
                {/* Nội dung hiển thị riêng theo từng tab được chọn ở sidebar */}
                <div className="aura-detail__tab-wrapper" key={activeSection}>
                  {/* TAB 1: OVERVIEW */}
                  {activeSection === "overview" && (
                    <div className="aura-detail__tab-panel">
                      <span className="aura-detail__section-label">OVERVIEW</span>
                      <h2 className="aura-detail__section-heading">
                        {tour.tagline || `A coastal paradise of timeless beauty`}
                      </h2>
                      <div className="aura-detail__section-desc">
                        <p>
                          {cleanText(tour.description || tour.summary) ||
                            `Khám phá vẻ đẹp kỳ vĩ của ${cleanProvince}, nơi giao thoa giữa thiên nhiên tráng lệ và di sản văn hóa đặc sắc. Tận hưởng kỳ nghỉ thư thái, thưởng thức ẩm thực bản địa và lưu giữ những khoảnh khắc đáng nhớ.`}
                        </p>
                        <p>
                          Chuyến đi được thiết kế theo phong cách thư thả (leisure), tôn trọng không gian riêng tư của từng du khách, mang đến trải nghiệm tiếp cận sâu sắc các giá trị văn hóa và phong cảnh độc đáo.
                        </p>
                      </div>

                      {/* Các điểm nhấn tóm tắt của Overview */}
                      <div className="aura-detail__overview-badges">
                        <div className="aura-detail__overview-badge">
                          <span className="aura-detail__badge-num">100%</span>
                          <span className="aura-detail__badge-txt">Cam kết khởi hành đúng lịch</span>
                        </div>
                        <div className="aura-detail__overview-badge">
                          <span className="aura-detail__badge-num">&lt; 12</span>
                          <span className="aura-detail__badge-txt">Số lượng khách giới hạn mỗi đoàn</span>
                        </div>
                        <div className="aura-detail__overview-badge">
                          <span className="aura-detail__badge-num">4.9★</span>
                          <span className="aura-detail__badge-txt">Đánh giá xuất sắc từ du khách</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: HIGHLIGHTS */}
                  {activeSection === "highlights" && (
                    <div className="aura-detail__tab-panel">
                      <span className="aura-detail__section-label">HIGHLIGHTS</span>
                      <h2 className="aura-detail__section-heading">Điểm nhấn chuyến đi</h2>
                      <div className="aura-detail__highlights-editorial">
                        {Array.isArray(tour.highlights) && tour.highlights.length > 0 ? (
                          tour.highlights.map((hl, hlIdx) => (
                            <div key={hlIdx} className="aura-detail__hl-row">
                              <span className="aura-detail__hl-dash">—</span>
                              <span className="aura-detail__hl-text">{cleanText(hl)}</span>
                            </div>
                          ))
                        ) : (
                          [
                            `Trải nghiệm những danh lam thắng cảnh biểu tượng của ${cleanProvince}`,
                            "Hành trình bằng thuyền thưởng ngoạn trọn vẹn cảnh sắc kỳ vĩ",
                            "Thưởng thức tinh hoa ẩm thực và đặc sản truyền thống",
                            "Khám phá các di tích lịch sử và văn hóa bản địa độc đáo",
                            "Thời gian tự do thư giãn và cảm nhận nhịp sống thư thái",
                          ].map((hl, hlIdx) => (
                            <div key={hlIdx} className="aura-detail__hl-row">
                              <span className="aura-detail__hl-dash">—</span>
                              <span className="aura-detail__hl-text">{hl}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: ITINERARY */}
                  {activeSection === "itinerary" && (
                    <div className="aura-detail__tab-panel">
                      <div className="aura-detail__tab-head-row">
                        <div>
                          <span className="aura-detail__section-label">ITINERARY</span>
                          <h2 className="aura-detail__section-heading">Lịch trình chi tiết từng ngày</h2>
                        </div>
                        {Array.isArray(tour.itinerary) && tour.itinerary.length > 1 && (
                          <button
                            type="button"
                            className="aura-detail__expand-toggle-btn"
                            onClick={() => {
                              const allOpen = tour.itinerary.every((_, i) => openDays[i]);
                              const next = {};
                              tour.itinerary.forEach((_, i) => {
                                next[i] = !allOpen;
                              });
                              setOpenDays(next);
                            }}
                          >
                            {tour.itinerary.every((_, i) => openDays[i]) ? "Thu gọn tất cả" : "Mở rộng tất cả"}
                          </button>
                        )}
                      </div>

                      <div className="aura-detail__itinerary-list">
                        {Array.isArray(tour.itinerary) && tour.itinerary.length > 0 ? (
                          tour.itinerary.map((day, idx) => {
                            const isOpen = Boolean(openDays[idx]);
                            const dayNum = String(day.day || idx + 1).padStart(2, "0");
                            const dayTitle = day.title || `Ngày ${day.day || idx + 1}`;
                            const dayPlaces = Array.isArray(day.places) ? day.places : [];
                            const dayChecklist = Array.isArray(day.checklist) ? day.checklist : [];

                            return (
                              <div key={idx} className={`aura-detail__day-card ${isOpen ? "aura-detail__day-card--open" : ""}`}>
                                <button
                                  type="button"
                                  className="aura-detail__day-header"
                                  onClick={() => toggleDay(idx)}
                                  aria-expanded={isOpen}
                                >
                                  <div className="aura-detail__day-title-wrap">
                                    <span className="aura-detail__day-badge">NGÀY {dayNum}</span>
                                    <h3 className="aura-detail__day-name">{cleanText(dayTitle)}</h3>
                                  </div>
                                  <span className="aura-detail__day-icon">{isOpen ? "−" : "+"}</span>
                                </button>

                                {isOpen && (
                                  <div className="aura-detail__day-body">
                                    {/* Mô tả chi tiết hành trình trong ngày */}
                                    {day.description && (
                                      <p className="aura-detail__day-p">{cleanText(day.description)}</p>
                                    )}

                                    {/* Danh sách các điểm dừng chân & tham quan */}
                                    {dayPlaces.length > 0 && (
                                      <div className="aura-detail__day-places-section">
                                        <h4 className="aura-detail__day-subhead">
                                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                          </svg>
                                          <span>Điểm tham quan & dừng chân ({dayPlaces.length})</span>
                                        </h4>
                                        <div className="aura-detail__day-places-grid">
                                          {dayPlaces.map((pl, pIdx) => (
                                            <div key={pIdx} className="aura-detail__day-place-chip">
                                              <span className="aura-detail__place-order">0{pIdx + 1}</span>
                                              <div className="aura-detail__place-details">
                                                <div className="aura-detail__place-title-row">
                                                  <span className="aura-detail__place-name">{cleanText(pl.name)}</span>
                                                  {pl.category && (
                                                    <span className="aura-detail__place-cat">{cleanText(pl.category)}</span>
                                                  )}
                                                </div>
                                                {pl.dia_chi && (
                                                  <span className="aura-detail__place-address">{cleanText(pl.dia_chi)}</span>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Checklist lưu ý trong ngày */}
                                    {dayChecklist.length > 0 && (
                                      <div className="aura-detail__day-checklist-box">
                                        <span className="aura-detail__checklist-title">Lưu ý chuẩn bị:</span>
                                        <ul className="aura-detail__checklist-items">
                                          {dayChecklist.map((chk, cIdx) => (
                                            <li key={cIdx} className="aura-detail__checklist-item">
                                              <span className="aura-detail__checklist-dot">•</span>
                                              <span>{cleanText(chk)}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        ) : (
                          <div className="aura-detail__day-card aura-detail__day-card--open">
                            <div className="aura-detail__day-header">
                              <div className="aura-detail__day-title-wrap">
                                <span className="aura-detail__day-badge">NGÀY 01</span>
                                <h3 className="aura-detail__day-name">Khởi hành & Chạm ngõ miền di sản</h3>
                              </div>
                            </div>
                            <div className="aura-detail__day-body">
                              <p className="aura-detail__day-p">
                                Xe đưa đón chất lượng cao tại điểm hẹn, bắt đầu hành trình khám phá những điểm đến tráng lệ nhất.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: WHAT'S INCLUDED */}
                  {activeSection === "included" && (
                    <div className="aura-detail__tab-panel">
                      <span className="aura-detail__section-label">WHAT'S INCLUDED</span>
                      <h2 className="aura-detail__section-heading">Dịch vụ & Quyền lợi trọn gói</h2>
                      <div className="aura-detail__inclusions-grid">
                        <div className="aura-detail__inclusions-col">
                          <h4 className="aura-detail__inclusions-subhead">Bao gồm trong giá</h4>
                          <ul className="aura-detail__check-list">
                            {(Array.isArray(tour.included) && tour.included.length > 0
                              ? tour.included
                              : [
                                  "Khách sạn và resort nghỉ dưỡng tiêu chuẩn 4-5 sao",
                                  "Toàn bộ bữa ăn chính theo phong cách ẩm thực địa phương",
                                  "Xe đưa đón chất lượng cao suốt hành trình",
                                  "Vé tham quan tất cả các điểm đến trong lịch trình",
                                  "Hướng dẫn viên chuyên nghiệp đồng hành",
                                  "Bảo hiểm du lịch trọn gói",
                                ]
                            ).map((inc, iIdx) => (
                              <li key={iIdx}>
                                <span className="aura-detail__check-icon">✓</span>
                                <span>{cleanText(inc)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="aura-detail__inclusions-col">
                          <h4 className="aura-detail__inclusions-subhead">Không bao gồm</h4>
                          <ul className="aura-detail__check-list aura-detail__check-list--excluded">
                            {(Array.isArray(tour.excluded) && tour.excluded.length > 0
                              ? tour.excluded
                              : [
                                  "Chi phí phát sinh cá nhân (giặt ủi, đồ uống ngoài menu)",
                                  "Tiền tip cho hướng dẫn viên và tài xế",
                                  "Các hoạt động tự do ngoài chương trình",
                                ]
                            ).map((exc, eIdx) => (
                              <li key={eIdx}>
                                <span className="aura-detail__dash-icon">—</span>
                                <span>{cleanText(exc)}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 5: REVIEWS */}
                  {activeSection === "reviews" && (
                    <div className="aura-detail__tab-panel">
                      <span className="aura-detail__section-label">REVIEWS</span>
                      <h2 className="aura-detail__section-heading">Đánh giá từ du khách</h2>

                      <div className="aura-detail__reviews-box">
                        <div className="aura-detail__reviews-score-card">
                          <div className="aura-detail__score-main">4.9</div>
                          <div className="aura-detail__score-stars">★★★★★</div>
                          <div className="aura-detail__score-caption">Dựa trên 128 đánh giá được xác thực</div>
                        </div>

                        <div className="aura-detail__reviews-list">
                          {[
                            {
                              author: "Minh Anh, Hà Nội",
                              rating: 5,
                              date: "Tháng 9, 2026",
                              content:
                                "Chuyến đi tuyệt vời hơn cả mong đợi. Lịch trình thong thả, không bị gấp gáp, khách sạn đẹp và đồ ăn địa phương rất chuẩn vị.",
                            },
                            {
                              author: "Hoàng Long, TP. Hồ Chí Minh",
                              rating: 5,
                              date: "Tháng 8, 2026",
                              content:
                                "Hướng dẫn viên am hiểu sâu sắc về văn hóa bản địa. Xe đưa đón êm ái, đoàn nhỏ dưới 10 người nên mọi người gắn kết rất vui vẻ.",
                            },
                            {
                              author: "Thanh Trúc, Đà Nẵng",
                              rating: 5,
                              date: "Tháng 7, 2026",
                              content:
                                "Góc chụp ảnh nào cũng mê ly. Dịch vụ chăm sóc trước và trong chuyến đi cực kỳ chu đáo và chuyên nghiệp.",
                            },
                          ].map((rev, rIdx) => (
                            <div key={rIdx} className="aura-detail__review-item">
                              <div className="aura-detail__review-head">
                                <span className="aura-detail__review-author">{rev.author}</span>
                                <span className="aura-detail__review-date">{rev.date}</span>
                              </div>
                              <div className="aura-detail__review-stars">{"★".repeat(rev.rating)}</div>
                              <p className="aura-detail__review-text">{rev.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: FAQ */}
                  {activeSection === "faq" && (
                    <div className="aura-detail__tab-panel">
                      <span className="aura-detail__section-label">FAQ</span>
                      <h2 className="aura-detail__section-heading">Câu hỏi thường gặp</h2>
                      <div className="aura-detail__faq-list">
                        {[
                          {
                            q: "Tour có bao gồm đưa đón tận nơi không?",
                            a: "Có, chúng tôi hỗ trợ đón và trả khách tại các khách sạn trung tâm hoặc điểm hẹn thuận tiện đã xác nhận trước chuyến đi.",
                          },
                          {
                            q: "Chính sách hoàn hủy như thế nào?",
                            a: "Quý khách được hoàn 100% khi thông báo trước 15 ngày khởi hành, hoàn 50% trước 7 ngày, và theo quy định chi tiết trong hợp đồng dịch vụ.",
                          },
                          {
                            q: "Đoàn tối đa bao nhiêu người?",
                            a: "Chúng tôi giới hạn đoàn nhỏ dưới 12 khách để đảm bảo trải nghiệm riêng tư, chu đáo và cá nhân hóa nhất cho mỗi hành khách.",
                          },
                        ].map((faqItem, fIdx) => (
                          <div key={fIdx} className="aura-detail__faq-item">
                            <h4 className="aura-detail__faq-q">{faqItem.q}</h4>
                            <p className="aura-detail__faq-a">{faqItem.a}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ========================================================= */}
              {/* THẺ ĐẶT TOUR NỔI THEO MOCKUP (Floating Booking Card)        */}
              {/* ========================================================= */}
              <div className="aura-detail__booking-card-wrap">
                <div className="aura-detail__booking-card">
                  <span className="aura-detail__card-from">From</span>
                  <div className="aura-detail__card-price-row">
                    <span className="aura-detail__card-price">{priceFormatted}đ</span>
                    <span className="aura-detail__card-unit">/ person</span>
                  </div>

                  <button
                    type="button"
                    className="aura-detail__book-now-btn"
                    onClick={() => setIsBookingWizardOpen(true)}
                  >
                    <span>Book now</span>
                    <span className="aura-detail__btn-arrow">→</span>
                  </button>

                  <div className="aura-detail__card-fields">
                    {/* Select date */}
                    <button
                      type="button"
                      className="aura-detail__card-field-row"
                      onClick={() => setIsBookingWizardOpen(true)}
                    >
                      <div className="aura-detail__field-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <div className="aura-detail__field-texts">
                          <span className="aura-detail__field-label">Select date</span>
                          <span className="aura-detail__field-value">
                            {curDep?.depart_date ? formatVnDate(curDep.depart_date) : "Oct 13, 2026"}
                          </span>
                        </div>
                      </div>
                      <span className="aura-detail__field-chevron">›</span>
                    </button>

                    {/* Travelers */}
                    <button
                      type="button"
                      className="aura-detail__card-field-row"
                      onClick={() => setIsBookingWizardOpen(true)}
                    >
                      <div className="aura-detail__field-left">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                          <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <div className="aura-detail__field-texts">
                          <span className="aura-detail__field-label">Travelers</span>
                          <span className="aura-detail__field-value">{adults} adults</span>
                        </div>
                      </div>
                      <span className="aura-detail__field-chevron">›</span>
                    </button>
                  </div>

                  <div className="aura-detail__card-divider" />

                  {/* Save to wishlist */}
                  <button
                    type="button"
                    className={`aura-detail__wishlist-btn ${isSaved ? "aura-detail__wishlist-btn--active" : ""}`}
                    onClick={() => setIsSaved(!isSaved)}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                    </svg>
                    <span>{isSaved ? "Saved in wishlist" : "Save to wishlist"}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 4. TOUR TƯƠNG TỰ PHÍA DƯỚI CÙNG */}
            {similarTours.length > 0 && (
              <section className="aura-detail__similar-section">
                <div className="aura-detail__similar-head">
                  <h3 className="aura-detail__similar-title">Tour tương tự bạn có thể thích</h3>
                  <Link to="/tour" className="aura-detail__similar-more">
                    Xem tất cả tour →
                  </Link>
                </div>

                <div className="aura-detail__similar-cards">
                  {similarTours.map((simTour) => {
                    const simCover =
                      simTour.cover_url ||
                      (Array.isArray(simTour.images) &&
                        (typeof simTour.images[0] === "string" ? simTour.images[0] : simTour.images[0]?.url)) ||
                      "https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80";
                    const simPriceVal = Number(simTour.price_from || 0);

                    return (
                      <Link
                        key={simTour.id || simTour.slug}
                        to={`/tour/${simTour.slug || simTour.id}`}
                        className="aura-detail__sim-card"
                      >
                        <div className="aura-detail__sim-thumb">
                          <img src={simCover} alt={cleanText(simTour.name)} loading="lazy" />
                          <span className="aura-detail__sim-badge">{simTour.duration_days || 1} Days</span>
                        </div>
                        <h4 className="aura-detail__sim-title">{cleanText(simTour.name)}</h4>
                        <p className="aura-detail__sim-price">{simPriceVal.toLocaleString("vi-VN")}₫</p>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>

      {/* Global Voyage Menu Drawer */}
      <VoyageDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={user}
        onNeedAuth={onNeedAuth}
        onLogout={onLogout}
      />

      {/* Tour Booking Wizard */}
      <TourBookingWizard
        open={isBookingWizardOpen}
        onClose={() => setIsBookingWizardOpen(false)}
        tour={tour}
        initialDeparture={selectedDeparture}
        initialGuests={adults}
        user={user}
        onNeedAuth={onNeedAuth}
      />
    </div>
  );
}

