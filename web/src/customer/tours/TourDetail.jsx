import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { api } from "../../shared/api";
import AppNavbar from "../../shared/layout/AppNavbar";
import TourBookingWizard from "../booking/TourBookingWizard";
import "./TourDetail.css";

// Hình ảnh phong cảnh dự phòng theo tỉnh thành
const PROVINCE_COVER_MAP = {
  "hồ chí minh": "/images/provinces/ho-chi-minh.jpg",
  "hà nội": "/images/provinces/ha-noi.jpg",
  "đà nẵng": "/images/tour-danang.jpg",
  "quảng ninh": "/images/tour-halong.jpg",
  "hạ long": "/images/tour-halong.jpg",
  "lào cai": "/images/tour-sapa.jpg",
  "sapa": "/images/tour-sapa.jpg",
  "kiên giang": "/images/tour-phuquoc.jpg",
  "phú quốc": "/images/tour-phuquoc.jpg",
  "khánh hòa": "/images/provinces/khanh-hoa.jpg",
  "nha trang": "/images/provinces/khanh-hoa.jpg",
};

function formatVND(val) {
  return Number(val || 0).toLocaleString("vi-VN") + "₫";
}

function formatDateDisplay(dStr) {
  if (!dStr) return "";
  const parts = String(dStr).split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dStr;
}

export default function TourDetail({ user, onNeedAuth, onLogout }) {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();

  const [tour, setTour] = useState(null);
  const [similarTours, setSimilarTours] = useState([]);
  const [loading, setLoading] = useState(true);

  // Booking Widget State
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [activeTab, setActiveTab] = useState("tong-quan");
  const [isSaved, setIsSaved] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const [isBookingWizardOpen, setIsBookingWizardOpen] = useState(
    () => searchParams.get("book") === "1"
  );

  // 1. Tải chi tiết tour từ Backend API
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    api
      .tour(slug)
      .then((data) => {
        if (!isMounted) return;
        const apiTour = data?.tour || data;
        if (apiTour && (apiTour.id || apiTour.slug)) {
          // Chuẩn hóa departures
          const departuresList = Array.isArray(apiTour.departures)
            ? apiTour.departures.map((d) => ({
                ...d,
                departure_date: d.departure_date || d.depart_date,
                price: Number(d.effective_price || d.price || d.sale_price || d.list_price || apiTour.price_from || 0),
                available_seats: d.available_seats ?? d.seats_left ?? 10,
              }))
            : [];

          const normalizedTour = {
            ...apiTour,
            departures: departuresList,
            duration:
              apiTour.duration ||
              `${apiTour.duration_days || 2} Ngày ${Math.max(1, (apiTour.duration_days || 2) - 1)} Đêm`,
            transportation_str: Array.isArray(apiTour.transportation)
              ? apiTour.transportation.join(" • ")
              : apiTour.transportation || "Xe du lịch đời mới",
            rating: apiTour.rating || 4.9,
            reviews_count: apiTour.reviews_count || 128,
            operator_name: apiTour.operator_name || "Aura Voyage Partner",
          };

          setTour(normalizedTour);
          if (departuresList.length > 0) {
            setSelectedDeparture(departuresList[0]);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Lỗi khi tải chi tiết tour:", err);
        setLoading(false);
      });

    // Tải các tour tương tự
    api
      .tours({ limit: 6 })
      .then((res) => {
        if (!isMounted) return;
        const all = res?.tours || res?.items || (Array.isArray(res) ? res : []);
        const filtered = all.filter((t) => t.slug !== slug);
        setSimilarTours(filtered.slice(0, 3));
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Bộ sưu tập ảnh hiển thị (Bento Gallery)
  const galleryImages = useMemo(() => {
    if (!tour) return [];
    const list = [];
    const provKey = (tour.province_name || "").toLowerCase();
    const fallbackCover =
      Object.entries(PROVINCE_COVER_MAP).find(([k]) => provKey.includes(k))?.[1] ||
      "/images/tour-halong.jpg";

    const mainCover = tour.cover_url || fallbackCover;
    list.push(mainCover);

    if (Array.isArray(tour.images)) {
      tour.images.forEach((img) => {
        const u = typeof img === "string" ? img : img?.url;
        if (u && !list.includes(u)) {
          list.push(u);
        }
      });
    }

    // Bổ sung thêm ảnh nếu tour có ít hơn 5 ảnh
    const defaultFillers = [
      "/images/vietnam-1.jpg",
      "/images/vietnam-2.jpg",
      "/images/vietnam-3.jpg",
      "/images/vietnam-4.jpg",
      "/images/vietnam-5.jpg",
    ];
    let fIdx = 0;
    while (list.length < 5 && fIdx < defaultFillers.length) {
      if (!list.includes(defaultFillers[fIdx])) {
        list.push(defaultFillers[fIdx]);
      }
      fIdx++;
    }

    return list;
  }, [tour]);

  // Điều hướng bằng bàn phím và khóa cuộn khi mở Lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setLightboxIndex(null);
      } else if (e.key === "ArrowRight") {
        setLightboxIndex((prev) => (prev + 1) % galleryImages.length);
      } else if (e.key === "ArrowLeft") {
        setLightboxIndex(
          (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
        );
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [lightboxIndex, galleryImages.length]);

  // Đơn giá hiện tại
  const baseUnitPrice = useMemo(() => {
    if (selectedDeparture?.price) return Number(selectedDeparture.price);
    if (tour?.price_from) return Number(tour.price_from);
    return 1990000;
  }, [selectedDeparture, tour]);

  const adultTotal = adults * baseUnitPrice;
  const childTotal = children * Math.round(baseUnitPrice * 0.75);
  const grandTotal = adultTotal + childTotal;

  // Cuộn mượt tới section
  const scrollToSection = (sectionId) => {
    setActiveTab(sectionId);
    const el = document.getElementById(sectionId);
    if (el) {
      const topOffset = el.getBoundingClientRect().top + window.pageYOffset - 110;
      window.scrollTo({ top: topOffset, behavior: "smooth" });
    }
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopyNotice(true);
      setTimeout(() => setCopyNotice(false), 2500);
    }
  };

  if (loading || !tour) {
    return (
      <div className="tour-detail-page">
        <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />
        <main className="tour-detail-container">
          <div className="tour-detail-skeleton-shell">
            <div className="skeleton-line skeleton-title" />
            <div className="skeleton-line skeleton-meta" />
            <div className="skeleton-gallery-box" />
          </div>
        </main>
      </div>
    );
  }

  const cleanProvince =
    tour.province_name?.replace(/^(Thành phố|Tỉnh)\s+/i, "") || "Việt Nam";

  return (
    <div className="tour-detail-page">
      {/* 1. TOP NAVBAR */}
      <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />

      {/* TOAST SAO CHÉP LIÊN KẾT */}
      {copyNotice && (
        <div className="tour-detail-toast" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span>Đã sao chép liên kết chuyến đi!</span>
        </div>
      )}

      {/* 2. HEADER TIÊU ĐỀ TOUR */}
      <header className="tour-detail-header">
        <div className="tour-detail-container">
          <nav className="detail-breadcrumbs" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <span className="sep">/</span>
            <Link to="/tour">Tour trọn gói</Link>
            <span className="sep">/</span>
            <span className="current">{cleanProvince}</span>
          </nav>

          <div className="detail-header-main-row">
            <div className="detail-header-left">
              <div className="detail-tags-row">
                <span className="detail-province-pill">{cleanProvince}</span>
                {tour.is_sale && (
                  <span className="detail-sale-pill">Ưu đãi độc quyền</span>
                )}
                <span className="detail-operator-tag">
                  Tổ chức bởi <strong>{tour.operator_name}</strong>
                </span>
              </div>

              <h1 className="detail-tour-name">{tour.name}</h1>

              <div className="detail-meta-row">
                <div className="detail-rating-pill">
                  <span className="star-icon">★</span>
                  <span className="score">{tour.rating}</span>
                  <span className="count">({tour.reviews_count} đánh giá)</span>
                </div>
                <span className="meta-divider">•</span>
                <div className="detail-meta-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>{tour.duration}</span>
                </div>
                <span className="meta-divider">•</span>
                <div className="detail-meta-item">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{tour.departure_location || cleanProvince}</span>
                </div>
              </div>
            </div>

            {/* Các nút tương tác: Lưu & Chia sẻ (icon trần chuẩn MXH, không bọc chữ/card) */}
            <div className="detail-header-actions">
              <button
                type="button"
                className={`detail-action-btn ${isSaved ? "active" : ""}`}
                onClick={() => setIsSaved(!isSaved)}
                title={isSaved ? "Bỏ lưu tour" : "Lưu tour"}
                aria-label={isSaved ? "Bỏ lưu tour" : "Lưu tour"}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
              </button>

              <button
                type="button"
                className="detail-action-btn"
                onClick={handleShare}
                title="Chia sẻ tour"
                aria-label="Chia sẻ tour"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16 6 12 2 8 6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 3. BENTO 5-GRID PHOTO GALLERY + KEY FACTS BAR */}
      <section className="tour-gallery-wrap">
        <div className="tour-detail-container">
          <div className="gallery-bento-grid">
            {/* Ảnh lớn bên trái */}
            <div
              className="gallery-hero-tile"
              onClick={() => setLightboxIndex(0)}
              role="button"
              tabIndex={0}
              title="Xem ảnh toàn cảnh"
            >
              {tour.discount_pct > 0 && (
                <div className="detail-ribbon-tag">-{tour.discount_pct}%</div>
              )}
              <img
                src={galleryImages[0]}
                alt={tour.name}
                className="gallery-img-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/images/tour-halong.jpg";
                }}
              />
            </div>

            {/* 4 ảnh phụ bên phải */}
            <div className="gallery-sub-grid">
              {galleryImages.slice(1, 5).map((imgUrl, idx) => (
                <div
                  key={idx}
                  className={`gallery-sub-tile ${idx === 3 ? "tile-last" : ""}`}
                  onClick={() => setLightboxIndex(idx + 1)}
                  role="button"
                  tabIndex={0}
                  title="Bấm để xem phóng to"
                >
                  <img
                    src={imgUrl}
                    alt={`Ảnh trải nghiệm ${idx + 1}`}
                    className="gallery-img-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/images/tour-halong.jpg";
                    }}
                  />
                  {idx === 3 && (
                    <button
                      type="button"
                      className="view-all-photos-pill"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex(0);
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                        <circle cx="9" cy="9" r="2" />
                        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                      </svg>
                      <span>Tất cả {galleryImages.length} ảnh</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 4 THÔNG SỐ CỐT LÕI (Dải băng nổi đồng bộ màu chủ đạo, không dùng ô vuông icon) */}
          <div className="key-facts-strip-bar">
            <div className="key-fact-cell">
              <span className="fact-kicker">THỜI LƯỢNG</span>
              <strong className="fact-value">{tour.duration}</strong>
            </div>
            <div className="key-fact-cell">
              <span className="fact-kicker">PHƯƠNG TIỆN</span>
              <strong className="fact-value">{tour.transportation_str}</strong>
            </div>
            <div className="key-fact-cell">
              <span className="fact-kicker">ĐIỂM ĐÓN KHÁCH</span>
              <strong className="fact-value">
                {tour.departure_location || "Trung tâm " + cleanProvince}
              </strong>
            </div>
            <div className="key-fact-cell">
              <span className="fact-kicker">BẢO HIỂM DU LỊCH</span>
              <strong className="fact-value">Trọn gói 100.000.000đ / vụ</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 5. STICKY ANCHOR TABS BAR */}
      <nav className="detail-sticky-nav" aria-label="Menu chi tiết tour">
        <div className="tour-detail-container">
          <div className="sticky-nav-inner">
            {[
              { id: "tong-quan", label: "Tổng quan" },
              { id: "trai-nghiem", label: "Điểm nổi bật" },
              { id: "lich-trinh", label: "Lịch trình theo ngày" },
              { id: "dich-vu", label: "Dịch vụ & Chính sách" },
              { id: "danh-gia", label: "Đánh giá" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`sticky-tab-btn ${activeTab === tab.id ? "active" : ""}`}
                onClick={() => scrollToSection(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* 6. MAIN CONTENT (2 CỘT: TRÁI SỐNG ĐỘNG KHÔNG CARD LỒNG CARD - PHẢI STICKY BOOKING) */}
      <main className="tour-detail-main">
        <div className="tour-detail-container">
          <div className="detail-layout-grid">
            {/* CỘT TRÁI */}
            <div className="detail-main-col">
              {/* PHẦN 1: TỔNG QUAN & BANNER SKY GRADIENT ĐẶC TRƯNG */}
              <section id="tong-quan" className="detail-section-surface">
                <div className="section-eyebrow-tag">GIỚI THIỆU HÀNH TRÌNH</div>
                <h2 className="section-heading">Về hành trình này</h2>
                <p className="tour-lead-summary">
                  {tour.summary ||
                    tour.description ||
                    "Hành trình được đội ngũ chuyên môn thiết kế bài bản, kết hợp khám phá các điểm đến biểu tượng và ẩm thực đặc sản bản địa trọn gói."}
                </p>

                {tour.description && tour.description !== tour.summary && (
                  <p className="tour-full-desc">{tour.description}</p>
                )}

                {/* Dải Sky-Gradient đặc trưng của Aura Voyage (không dùng card lồng card hay ô vuông icon) */}
                <div className="overview-sky-banner">
                  <div className="sky-banner-item">
                    <span className="sky-banner-label">✦ TIÊU CHUẨN LỊCH TRÌNH</span>
                    <strong className="sky-banner-title">Cam kết đúng lịch trình</strong>
                    <span className="sky-banner-desc">
                      Đảm bảo đầy đủ thời lượng và các điểm tham quan theo chương trình công bố.
                    </span>
                  </div>
                  <div className="sky-banner-divider" />
                  <div className="sky-banner-item">
                    <span className="sky-banner-label">✦ MINH BẠCH CHI PHÍ</span>
                    <strong className="sky-banner-title">Không phụ phí ẩn</strong>
                    <span className="sky-banner-desc">
                      Mọi khoản vé tham quan, xe đưa đón và bảo hiểm đều đã tính trọn gói.
                    </span>
                  </div>
                </div>
              </section>

              {/* PHẦN 2: ĐIỂM NỔI BẬT — NỀN SKY GRADIENT ĐẶC TRƯNG & ẢNH TRỰC QUAN KIỂU HOME JOURNEY */}
              <section id="trai-nghiem" className="detail-section-surface detail-section-sky">
                <div className="section-eyebrow-tag">TRẢI NGHIỆM ĐÁNG NHỚ</div>
                <h2 className="section-heading">Điểm nổi bật của hành trình</h2>

                <div className="highlights-visual-showcase">
                  {(tour.highlights && tour.highlights.length > 0
                    ? tour.highlights
                    : [
                        "Khám phá di sản thiên nhiên kỳ vĩ",
                        "Thưởng thức ẩm thực đặc sản bản địa",
                        "Check-in các danh thắng nổi tiếng",
                      ]
                  ).map((hl, hIdx) => {
                    const title = typeof hl === "string" ? hl : hl.title || hl.name;
                    const bgPhoto =
                      galleryImages[(hIdx + 1) % galleryImages.length] ||
                      galleryImages[0];
                    return (
                      <div key={hIdx} className="highlight-visual-tile">
                        <img
                          src={bgPhoto}
                          alt={title}
                          className="highlight-tile-img"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/images/tour-halong.jpg";
                          }}
                        />
                        <div className="highlight-tile-scrim" />
                        <div className="highlight-tile-content">
                          <span className="highlight-tile-num">
                            0{hIdx + 1}
                          </span>
                          <h3 className="highlight-tile-title">{title}</h3>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* PHẦN 3: LỊCH TRÌNH THEO NGÀY — TIMELINE LIỀN MẠCH KHÔNG BỌC CARD CON */}
              <section id="lich-trinh" className="detail-section-surface">
                <div className="section-heading-row">
                  <div>
                    <div className="section-eyebrow-tag">LỘ TRÌNH CHI TIẾT</div>
                    <h2 className="section-heading">Lịch trình theo ngày</h2>
                  </div>
                  <span className="section-kicker-pill">
                    {tour.duration_days || 2} ngày khám phá
                  </span>
                </div>

                {Array.isArray(tour.itinerary) && tour.itinerary.length > 0 ? (
                  <div className="itinerary-days-container">
                    {/* Thanh chọn ngày nhanh */}
                    <div className="itinerary-day-tabs">
                      {tour.itinerary.map((d, dIdx) => (
                        <button
                          key={dIdx}
                          type="button"
                          className={`day-selector-pill ${
                            activeDayIndex === dIdx ? "active" : ""
                          }`}
                          onClick={() => setActiveDayIndex(dIdx)}
                        >
                          <span>Ngày {d.day || dIdx + 1}</span>
                        </button>
                      ))}
                    </div>

                    {/* Timeline lộ trình liền mạch */}
                    <div className="itinerary-flat-list">
                      {tour.itinerary.map((dayItem, dIdx) => {
                        const isSelected = activeDayIndex === dIdx;
                        return (
                          <div
                            key={dIdx}
                            className={`itinerary-day-row ${
                              isSelected ? "expanded" : "collapsed"
                            }`}
                          >
                            <div
                              className="itinerary-day-header"
                              onClick={() =>
                                setActiveDayIndex(isSelected ? -1 : dIdx)
                              }
                              role="button"
                              tabIndex={0}
                            >
                              <div className="day-header-left">
                                <span className="day-num-label">
                                  NGÀY 0{dayItem.day || dIdx + 1}
                                </span>
                                <h3 className="day-main-title">{dayItem.title}</h3>
                              </div>
                              <span className="day-toggle-indicator">
                                {isSelected ? "Thu gọn −" : "Chi tiết +"}
                              </span>
                            </div>

                            {isSelected && (
                              <div className="itinerary-day-body">
                                {dayItem.description && (
                                  <p className="day-overview-desc">
                                    {dayItem.description}
                                  </p>
                                )}

                                {/* Danh sách địa điểm cụ thể trong ngày */}
                                {Array.isArray(dayItem.places) &&
                                  dayItem.places.length > 0 && (
                                    <div className="itinerary-places-timeline">
                                      {dayItem.places.map((place, pIdx) => (
                                        <div key={pIdx} className="timeline-node">
                                          <div className="node-marker">
                                            <span className="node-dot" />
                                            {pIdx < dayItem.places.length - 1 && (
                                              <span className="node-line" />
                                            )}
                                          </div>
                                          <div className="node-content">
                                            <div className="node-top-row">
                                              <h4 className="place-name">
                                                {place.name}
                                              </h4>
                                              {place.category && (
                                                <span className="place-category-chip">
                                                  {place.category}
                                                </span>
                                              )}
                                            </div>
                                            {place.dia_chi && (
                                              <div className="place-address">
                                                <span>{place.dia_chi}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                {/* Checklist lưu ý trong ngày */}
                                {Array.isArray(dayItem.checklist) &&
                                  dayItem.checklist.length > 0 && (
                                    <div className="day-checklist-flat">
                                      <span className="checklist-heading">
                                        Lưu ý chuẩn bị trong ngày:
                                      </span>
                                      <ul className="checklist-items">
                                        {dayItem.checklist.map((c, cIdx) => (
                                          <li key={cIdx}>
                                            <span className="check-bullet">✓</span>
                                            <span>{c}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="empty-itinerary-note">
                    Lịch trình khởi hành chi tiết sẽ được trưởng đoàn cập nhật và gửi trước 24 giờ.
                  </p>
                )}
              </section>

              {/* PHẦN 4: DỊCH VỤ BAO GỒM & CHÍNH SÁCH (KHÔNG BỌC CARD CON) */}
              <section id="dich-vu" className="detail-section-surface">
                <div className="section-eyebrow-tag">QUYỀN LỢI KHÁCH HÀNG</div>
                <h2 className="section-heading">Dịch vụ bao gồm & Chính sách</h2>

                <div className="inclusions-comparison-grid">
                  {/* Cột bao gồm */}
                  <div className="inclusion-col">
                    <h3 className="inclusion-col-title included-heading">
                      Giá tour đã bao gồm
                    </h3>
                    <ul className="inclusions-list">
                      {(tour.included && tour.included.length > 0
                        ? tour.included
                        : [
                            "Xe du lịch đời mới máy lạnh theo lịch trình",
                            "Khách sạn tiêu chuẩn 2 khách/phòng",
                            "Vé tham quan các điểm theo chương trình",
                            "Hướng dẫn viên chuyên nghiệp suốt tuyến",
                            "Bảo hiểm du lịch mức 100.000.000đ/vụ",
                            "Nước suối và khăn lạnh trên xe",
                          ]
                      ).map((item, idx) => (
                        <li key={idx}>
                          <span className="bullet-check">✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Cột chưa bao gồm */}
                  <div className="inclusion-col">
                    <h3 className="inclusion-col-title excluded-heading">
                      Chưa bao gồm
                    </h3>
                    <ul className="inclusions-list">
                      {(tour.excluded && tour.excluded.length > 0
                        ? tour.excluded
                        : [
                            "Vé máy bay / tàu hỏa đến điểm tập trung",
                            "Chi phí ăn uống và giải trí ngoài chương trình",
                            "Phụ thu phòng đơn (nếu có nhu cầu ở riêng)",
                            "Tiền tip bồi dưỡng lái xe & hướng dẫn viên",
                            "Thuế VAT 8% (nếu xuất hóa đơn)",
                          ]
                      ).map((item, idx) => (
                        <li key={idx}>
                          <span className="bullet-cross">✕</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Chính sách hoàn hủy — Dải mốc thời gian trực quan (không bọc card con) */}
                <div className="cancellation-policy-flat">
                  <h3 className="policy-flat-title">Chính sách hủy tour & Đổi ngày</h3>
                  <div className="policy-milestones-row">
                    {(tour.cancellation_policy && tour.cancellation_policy.length > 0
                      ? tour.cancellation_policy
                      : [
                          { days_before: 15, refund_percent: 100, note: "Miễn phí hủy" },
                          { days_before: 7, refund_percent: 70, note: "Hoàn 70% tổng giá" },
                          { days_before: 3, refund_percent: 50, note: "Hoàn 50% tổng giá" },
                          { days_before: 1, refund_percent: 0, note: "Không hoàn tiền" },
                        ]
                    ).map((pol, pIdx) => (
                      <div key={pIdx} className="milestone-step">
                        <span className="step-time">Trước {pol.days_before} ngày</span>
                        <span
                          className={`step-percent ${
                            pol.refund_percent >= 70
                              ? "high"
                              : pol.refund_percent > 0
                              ? "mid"
                              : "low"
                          }`}
                        >
                          Hoàn {pol.refund_percent}%
                        </span>
                        <span className="step-note">
                          {pol.note || "Theo hợp đồng lữ hành"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* PHẦN 5: ĐÁNH GIÁ THỰC TẾ */}
              <section id="danh-gia" className="detail-section-surface">
                <div className="section-eyebrow-tag">PHẢN HỒI DU KHÁCH</div>
                <h2 className="section-heading">Đánh giá từ khách hàng</h2>

                <div className="reviews-summary-flat">
                  <div className="score-main-box">
                    <div className="score-top-line">
                      <span className="big-rating">{tour.rating}</span>
                      <span className="score-badge-pill">★ Tuyệt vời</span>
                    </div>
                    <div className="stars-row">★★★★★</div>
                    <span className="sub-count">
                      Dựa trên {tour.reviews_count} đánh giá thực tế
                    </span>
                  </div>

                  <div className="score-bars-box">
                    {[
                      { star: "5 sao", pct: "86%" },
                      { star: "4 sao", pct: "11%" },
                      { star: "3 sao", pct: "3%" },
                      { star: "2 sao", pct: "0%" },
                      { star: "1 sao", pct: "0%" },
                    ].map((row) => (
                      <div key={row.star} className="rating-bar-line">
                        <span className="star-name">{row.star}</span>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: row.pct }} />
                        </div>
                        <span className="bar-pct">{row.pct}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Danh sách bình luận 2 cột thoáng, không bọc card con */}
                <div className="reviews-feedback-grid">
                  <div className="review-comment-item">
                    <div className="comment-header">
                      <div className="user-details">
                        <span className="user-name">Trần Minh</span>
                        <span className="tour-badge">Chuyến đi gia đình • Tháng 10/2026</span>
                      </div>
                      <span className="comment-stars">★★★★★</span>
                    </div>
                    <p className="comment-content">
                      “Lịch trình tour được tổ chức cực kỳ chỉn chu, đúng giờ. Xe đưa đón mới và tài xế rất cẩn thận. Hướng dẫn viên nhiệt tình, chu đáo hỗ trợ cả nhà suốt chuyến đi.”
                    </p>
                  </div>

                  <div className="review-comment-item">
                    <div className="comment-header">
                      <div className="user-details">
                        <span className="user-name">Hoàng Yến</span>
                        <span className="tour-badge">Đi cùng bạn bè • Tháng 09/2026</span>
                      </div>
                      <span className="comment-stars">★★★★★</span>
                    </div>
                    <p className="comment-content">
                      “Tour giá hợp lý, trọn gói đúng như mô tả không bị phát sinh chi phí. Khách sạn trung tâm tiện đi dạo buổi tối. Chắc chắn sẽ quay lại với Aura Voyage!”
                    </p>
                  </div>
                </div>
              </section>
            </div>

            {/* CỘT PHẢI: STICKY BOOKING CARD */}
            <aside className="detail-sidebar-col">
              <div className="sticky-booking-widget">
                <div className="widget-price-header">
                  <span className="price-kicker">GIÁ TRỌN GÓI / KHÁCH</span>
                  <div className="price-main-line">
                    <span className="price-number">{formatVND(baseUnitPrice)}</span>
                    <span className="price-unit">/ khách</span>
                  </div>
                  {tour.original_price && tour.original_price > baseUnitPrice && (
                    <div className="price-strikethrough-row">
                      <span className="old-price">{formatVND(tour.original_price)}</span>
                      <span className="discount-tag">
                        Tiết kiệm {Math.round(((tour.original_price - baseUnitPrice) / tour.original_price) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                {/* Chọn ngày khởi hành */}
                <div className="widget-field-group">
                  <label className="field-label">
                    <span>NGÀY KHỞI HÀNH</span>
                    {selectedDeparture && (
                      <span className="seats-available-badge">
                        Còn {selectedDeparture.available_seats} chỗ
                      </span>
                    )}
                  </label>

                  {Array.isArray(tour.departures) && tour.departures.length > 0 ? (
                    <select
                      className="departure-select-input"
                      value={selectedDeparture?.id || ""}
                      onChange={(e) => {
                        const found = tour.departures.find(
                          (d) => String(d.id) === e.target.value
                        );
                        if (found) setSelectedDeparture(found);
                      }}
                    >
                      {tour.departures.map((d) => (
                        <option key={d.id} value={d.id}>
                          {formatDateDisplay(d.departure_date)} (còn {d.available_seats} chỗ) — {formatVND(d.price)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="departure-fallback-box">
                      <span>Khởi hành: <strong>Hàng ngày theo yêu cầu</strong></span>
                    </div>
                  )}
                </div>

                {/* Chọn số lượng khách */}
                <div className="widget-field-group">
                  <label className="field-label">SỐ LƯỢNG HÀNH KHÁCH</label>

                  {/* Người lớn */}
                  <div className="pax-counter-row">
                    <div className="pax-info">
                      <span className="pax-name">Người lớn (từ 12 tuổi)</span>
                      <span className="pax-sub">{formatVND(baseUnitPrice)} / khách</span>
                    </div>
                    <div className="counter-actions">
                      <button
                        type="button"
                        className="counter-btn"
                        disabled={adults <= 1}
                        onClick={() => setAdults((prev) => Math.max(1, prev - 1))}
                      >
                        -
                      </button>
                      <span className="counter-val">{adults}</span>
                      <button
                        type="button"
                        className="counter-btn"
                        onClick={() => setAdults((prev) => prev + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Trẻ em */}
                  <div className="pax-counter-row">
                    <div className="pax-info">
                      <span className="pax-name">Trẻ em (4 - 11 tuổi)</span>
                      <span className="pax-sub">75% vé ({formatVND(Math.round(baseUnitPrice * 0.75))})</span>
                    </div>
                    <div className="counter-actions">
                      <button
                        type="button"
                        className="counter-btn"
                        disabled={children <= 0}
                        onClick={() => setChildren((prev) => Math.max(0, prev - 1))}
                      >
                        -
                      </button>
                      <span className="counter-val">{children}</span>
                      <button
                        type="button"
                        className="counter-btn"
                        onClick={() => setChildren((prev) => prev + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bảng tính chi phí */}
                <div className="widget-summary-breakdown">
                  <div className="breakdown-row">
                    <span>Người lớn ({adults}x)</span>
                    <span>{formatVND(adultTotal)}</span>
                  </div>
                  {children > 0 && (
                    <div className="breakdown-row">
                      <span>Trẻ em ({children}x)</span>
                      <span>{formatVND(childTotal)}</span>
                    </div>
                  )}
                  <div className="breakdown-total-row">
                    <span className="total-label">Tổng thanh toán:</span>
                    <span className="total-val">{formatVND(grandTotal)}</span>
                  </div>
                </div>

                {/* Nút đặt tour phong cách mây trời như trang Home */}
                <button
                  type="button"
                  className="btn-primary-book"
                  onClick={() => setIsBookingWizardOpen(true)}
                >
                  <span>Đặt tour ngay</span>
                  <span className="book-arrow">→</span>
                </button>

                {/* Cam kết tin cậy */}
                <div className="widget-trust-points">
                  <div className="trust-point-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                    <span>Bảo hiểm chuyến đi 100tr/vụ</span>
                  </div>
                  <div className="trust-point-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <span>Giữ chỗ miễn phí trong 24 giờ</span>
                  </div>
                  <div className="trust-point-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span>Hotline hỗ trợ 24/7: 1900 6868</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>

      {/* 7. TOUR TƯƠNG TỰ GỢI Ý */}
      {similarTours.length > 0 && (
        <section className="detail-similar-tours-section">
          <div className="tour-detail-container">
            <div className="similar-header-row">
              <div>
                <span className="similar-eyebrow">KHÁM PHÁ THÊM</span>
                <h2 className="similar-section-title">Hành trình du lịch bạn có thể thích</h2>
              </div>
              <Link to="/tour" className="similar-all-link">
                Xem tất cả tour →
              </Link>
            </div>

            <div className="similar-cards-grid">
              {similarTours.map((st) => (
                <Link key={st.id} to={`/tours/${st.slug || st.id}`} className="similar-tour-card">
                  <div className="similar-card-photo">
                    <img
                      src={st.cover_url || "/images/tour-halong.jpg"}
                      alt={st.name}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/images/tour-halong.jpg";
                      }}
                    />
                    <span className="similar-duration-tag">
                      {st.duration_days || 2}N{Math.max(1, (st.duration_days || 2) - 1)}Đ
                    </span>
                  </div>
                  <div className="similar-card-info">
                    <h3 className="similar-tour-title">{st.name}</h3>
                    <div className="similar-tour-footer">
                      <span className="similar-price">Từ {formatVND(st.price_from)}</span>
                      <span className="similar-btn-link">Chi tiết ›</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. TOUR BOOKING WIZARD MODAL */}
      <TourBookingWizard
        open={isBookingWizardOpen}
        onClose={() => setIsBookingWizardOpen(false)}
        tour={tour}
        initialDeparture={selectedDeparture}
        initialGuests={adults + children}
        user={user}
        onNeedAuth={onNeedAuth}
      />

      {/* 9. LIGHTBOX ALBUM ẢNH PHÓNG TO */}
      {lightboxIndex !== null && (
        <div
          className="tour-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="tour-lightbox__panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="tour-lightbox__header">
              <span className="tour-lightbox__counter">
                {lightboxIndex + 1} / {galleryImages.length}
              </span>
              <span className="tour-lightbox__tour-name">{tour.name}</span>
              <button
                type="button"
                className="tour-lightbox__close-btn"
                onClick={() => setLightboxIndex(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="tour-lightbox__stage">
              <button
                type="button"
                className="tour-lightbox__nav-btn prev"
                onClick={() =>
                  setLightboxIndex(
                    (prev) => (prev - 1 + galleryImages.length) % galleryImages.length
                  )
                }
                aria-label="Ảnh trước"
              >
                ‹
              </button>
              <div className="tour-lightbox__viewport">
                <img
                  src={galleryImages[lightboxIndex]}
                  alt="Ảnh chi tiết"
                  className="tour-lightbox__active-img"
                />
              </div>
              <button
                type="button"
                className="tour-lightbox__nav-btn next"
                onClick={() =>
                  setLightboxIndex((prev) => (prev + 1) % galleryImages.length)
                }
                aria-label="Ảnh tiếp"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
