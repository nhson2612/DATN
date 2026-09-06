import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import DetailSkeleton from "../components/skeletons/DetailSkeleton";
import TourBookingWizard from "../components/modals/TourBookingWizard";
import "./TourDetail.css";

const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

function cleanText(str) {
  if (!str) return "";
  return String(str).replaceAll("—", " - ").replaceAll("–", "-");
}

function toPolicyList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((x) => cleanText(x)).filter(Boolean);
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return toPolicyList(parsed);
    } catch {
      // Không phải JSON: tách theo dòng/dấu phẩy/chấm phẩy
    }
    return value
      .split(/[,;\n]+/)
      .map((x) => cleanText(x).replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
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

export default function TourDetail({ user, onNeedAuth }) {
  const { slug } = useParams();
  const nav = useNavigate();

  // Trạng thái dữ liệu tour
  const [tour, setTour] = useState(null);
  const [error, setError] = useState("");
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Số lượng khách đặt
  const [adults, setAdults] = useState(2);

  // Điều hướng tab nội dung (active tab)
  const [activeTab, setActiveTab] = useState("tong-quan");

  // Dữ liệu tour liên quan
  const [relatedTours, setRelatedTours] = useState([]);

  // Modal Lightbox xem trọn bộ ảnh
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Tải các tour gợi ý tương tự thật từ API
  const fetchRelatedTours = useCallback(async (currentTour) => {
    try {
      let toursRes = await api.tours({ province_id: currentTour.province_id, limit: 6 });
      let list = (toursRes?.items || []).filter((item) => item.slug !== currentTour.slug);

      // Nếu trong tỉnh ít hơn 3 tour, tải thêm tour chung để gợi ý
      if (list.length < 3) {
        const fallbackRes = await api.tours({ limit: 8 });
        const fallbackList = (fallbackRes?.items || []).filter(
          (item) => item.slug !== currentTour.slug && !list.some((existing) => existing.id === item.id)
        );
        list = [...list, ...fallbackList];
      }

      setRelatedTours(list.slice(0, 3));
    } catch {
      setRelatedTours([]);
    }
  }, []);

  // Tải chi tiết tour từ backend
  useEffect(() => {
    let isMounted = true;

    api.tour(slug)
      .then((data) => {
        if (!isMounted) return;
        const t = data.tour;
        setTour(t);
        setError("");
        setAdults(2);
        setActiveTab("tong-quan");

        // Mặc định chọn đợt khởi hành đầu tiên còn chỗ
        const firstAvailable = t.departures?.find((d) => d.status === "OPEN" && d.seats_left > 0);
        setSelectedDeparture(firstAvailable || t.departures?.[0] || null);

        // Tải các tour gợi ý tương tự theo tỉnh hoặc lân cận
        fetchRelatedTours(t);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Không thể tải thông tin tour.");
        setTour(null);
        setRelatedTours([]);
        setActiveTab("tong-quan");
      });

    return () => {
      isMounted = false;
    };
  }, [slug, fetchRelatedTours]);

  // Danh sách ảnh gallery hợp lệ
  const galleryImages = useMemo(() => {
    if (Array.isArray(tour?.images) && tour.images.length > 0) {
      return tour.images.filter(Boolean);
    }
    if (tour?.cover_url) {
      return [tour.cover_url];
    }
    return [];
  }, [tour]);

  // Đếm số đợt khởi hành còn mở bán
  const openDeparturesCount = useMemo(() => {
    return tour?.departures?.filter((d) => d.status === "OPEN" && d.seats_left > 0).length || 0;
  }, [tour]);

  // Cấu hình các tab điều khiển nội dung
  const tabs = useMemo(() => {
    const days = tour?.duration_days || 0;
    const nights = Math.max(0, days - 1);
    return [
      { id: "tong-quan", label: "Tổng quan" },
      { id: "diem-noi-bat", label: "Điểm nổi bật" },
      { id: "lich-trinh", label: `Lịch trình ${days}N${nights}Đ` },
      { id: "dich-vu", label: "Dịch vụ bao gồm" },
      { id: "danh-gia", label: "Đánh giá" },
    ];
  }, [tour?.duration_days]);

  // Chuyển tab và cuộn nhẹ lên đỉnh khung nội dung nếu thanh nav đang cuộn lướt
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    const navElem = document.querySelector(".tour-nav");
    if (navElem) {
      const rect = navElem.getBoundingClientRect();
      if (rect.top < 0) {
        navElem.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  // Hỗ trợ bàn phím điều hướng tab theo chuẩn WAI-ARIA
  const handleTabKeyDown = (e, currentIndex) => {
    let targetIndex = null;
    if (e.key === "ArrowRight") {
      targetIndex = (currentIndex + 1) % tabs.length;
    } else if (e.key === "ArrowLeft") {
      targetIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (e.key === "Home") {
      targetIndex = 0;
    } else if (e.key === "End") {
      targetIndex = tabs.length - 1;
    }
    if (targetIndex !== null) {
      e.preventDefault();
      const nextTab = tabs[targetIndex];
      handleTabChange(nextTab.id);
      document.getElementById(`tab-${nextTab.id}`)?.focus();
    }
  };

  // Mở lightbox tại vị trí ảnh chỉ định
  const handleOpenLightbox = (index) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };

  // Chuyển ảnh trong lightbox
  const handleLightboxNav = useCallback((direction) => {
    if (galleryImages.length === 0) return;
    setLightboxIndex((prev) => {
      const nextIndex = prev + direction;
      if (nextIndex < 0) return galleryImages.length - 1;
      if (nextIndex >= galleryImages.length) return 0;
      return nextIndex;
    });
  }, [galleryImages.length]);

  // Lắng nghe phím ESC để đóng lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isLightboxOpen) return;
      if (e.key === "Escape") setIsLightboxOpen(false);
      if (e.key === "ArrowLeft") handleLightboxNav(-1);
      if (e.key === "ArrowRight") handleLightboxNav(1);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, handleLightboxNav]);

  if (error) {
    return (
      <main className="tour-detail">
        <div className="tour-detail__container" style={{ paddingTop: "3rem" }}>
          <div className="tour-reviews__empty">
            <div className="tour-reviews__empty-icon" style={{ backgroundColor: "#fee2e2", color: "#b91c1c" }}>
              <span className="material-symbols-outlined">error</span>
            </div>
            <h2 className="tour-reviews__empty-title">Không tìm thấy thông tin tour</h2>
            <p className="tour-reviews__empty-sub">{cleanText(error)}</p>
            <button
              onClick={() => nav("/tour")}
              className="tour-booking-box__btn-secondary"
              style={{ width: "auto", marginTop: "1rem", padding: "0.5rem 1.25rem" }}
            >
              Quay lại danh sách tour
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!tour) return <DetailSkeleton />;

  const cleanProvince = tour.province_name?.replace(/^(Thành phố|Tỉnh)\s+/, "") || "";

  // Giá bán hiệu lực của đợt đã chọn hoặc giá khởi điểm của tour
  const effectiveUnitPrice = selectedDeparture
    ? selectedDeparture.effective_price || selectedDeparture.price
    : tour.price_from;

  const originalUnitPrice = selectedDeparture
    ? selectedDeparture.list_price
    : tour.original_price;

  const isCurrentSale = selectedDeparture
    ? selectedDeparture.is_sale
    : tour.is_sale;

  const currentDiscountPct = selectedDeparture
    ? selectedDeparture.discount_pct
    : tour.discount_pct;

  // Tính tổng tiền theo số lượng khách
  const totalCost = (effectiveUnitPrice || 0) * adults;

  return (
    <main className="tour-detail">
      {/* 1. Header & Key Meta */}
      <header className="tour-detail__header">
        <div className="tour-detail__container">
          <nav className="tour-detail__back-nav">
            <button
              onClick={() => nav("/tour")}
              className="tour-detail__back-btn"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Tất cả tour
            </button>
          </nav>

          <div className="tour-detail__badge-strip">
            {tour.is_sale ? (
              <span className="tour-detail__badge tour-detail__badge--sale">
                <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                Ưu đãi đặc biệt
              </span>
            ) : (
              <span className="tour-detail__badge tour-detail__badge--verified">
                <span className="material-symbols-outlined text-[14px]">verified</span>
                Tour trọn gói
              </span>
            )}
            {cleanProvince && (
              <span className="tour-detail__badge tour-detail__badge--verified">
                <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                {cleanProvince}
              </span>
            )}
          </div>

          <div className="tour-detail__header-body">
            <div className="tour-detail__title-col">
              <h1 className="tour-detail__title">
                {cleanText(tour.name)}
                <span className="tour-detail__duration-inline">
                  ({tour.duration_days} Ngày {Math.max(0, tour.duration_days - 1)} Đêm)
                </span>
              </h1>

              <div className="tour-detail__meta-row">
                {cleanProvince && (
                  <div className="tour-detail__meta-item">
                    <span className="material-symbols-outlined text-[18px] text-primary">location_on</span>
                    <span>{cleanProvince}</span>
                  </div>
                )}
                <div className="tour-detail__meta-item">
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">calendar_month</span>
                  <span>{openDeparturesCount} đợt khởi hành còn chỗ</span>
                </div>
                <div className="tour-detail__meta-item tour-detail__meta-item--highlight">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
                  <span>Bảo hiểm du lịch trọn gói</span>
                </div>
              </div>
            </div>

            <div className="tour-detail__price-col">
              <div>
                <div className="tour-detail__price-label">Giá chỉ từ</div>
                <div className="tour-detail__price-values">
                  <span className="tour-detail__price-current">
                    {effectiveUnitPrice?.toLocaleString("vi-VN")}₫
                  </span>
                  {isCurrentSale && originalUnitPrice && (
                    <span className="tour-detail__price-original">
                      {originalUnitPrice.toLocaleString("vi-VN")}₫
                    </span>
                  )}
                </div>
              </div>
              {isCurrentSale && currentDiscountPct > 0 && (
                <span className="tour-detail__price-discount">
                  -{currentDiscountPct}%
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* 2. Photo Gallery Bento Showcase */}
      <section className="tour-gallery">
        <div className="tour-detail__container">
          {galleryImages.length === 0 ? (
            <div className="tour-gallery__fallback">
              <span className="material-symbols-outlined text-5xl">landscape</span>
              <span className="font-semibold text-lg">Hành trình khám phá {cleanProvince || "Việt Nam"}</span>
            </div>
          ) : (
            <div className="tour-gallery__bento">
              {/* Ảnh chính hero bên trái */}
              <div
                className={`tour-gallery__hero ${galleryImages.length === 1 ? "tour-gallery__hero--full" : ""}`}
                onClick={() => handleOpenLightbox(0)}
              >
                <img
                  src={galleryImages[0]}
                  alt={cleanText(tour.name)}
                  className="tour-gallery__hero-img"
                />
                <div className="tour-gallery__hero-overlay">
                  <span className="tour-gallery__hero-tag">Trải nghiệm nổi bật</span>
                  <h2 className="tour-gallery__hero-title">{cleanText(tour.name)}</h2>
                </div>
                <span className="tour-gallery__hero-badge">
                  <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  1/{galleryImages.length}
                </span>
              </div>

              {/* Lưới ảnh phụ bên phải theo số lượng ảnh thực có */}
              {galleryImages.length > 1 && (
                <div
                  className={`tour-gallery__subgrid tour-gallery__subgrid--${Math.min(
                    galleryImages.length - 1,
                    4
                  )}`}
                >
                  {galleryImages.slice(1, 5).map((imgUrl, idx) => {
                    const actualIndex = idx + 1;
                    const remainingPhotosCount = galleryImages.length;

                    return (
                      <div
                        key={`${imgUrl}-${idx}`}
                        className="tour-gallery__subitem"
                        onClick={() => handleOpenLightbox(actualIndex)}
                      >
                        <img
                          src={imgUrl}
                          alt={`${cleanText(tour.name)} - Ảnh ${actualIndex + 1}`}
                          className="tour-gallery__subitem-img"
                          loading="lazy"
                        />
                        {/* Nếu là ô thứ 4 và còn nhiều ảnh hơn, hiển thị nút xem tất cả */}
                        {idx === 3 && remainingPhotosCount > 4 ? (
                          <div className="tour-gallery__subitem-overlay">
                            <button
                              type="button"
                              className="tour-gallery__view-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenLightbox(actualIndex);
                              }}
                            >
                              <span className="material-symbols-outlined text-[18px]">grid_view</span>
                              Xem tất cả {remainingPhotosCount} ảnh
                            </button>
                          </div>
                        ) : (
                          <span className="tour-gallery__subitem-caption">
                            Ảnh {actualIndex + 1}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 3. Key Specs Strip */}
      <section className="tour-specs">
        <div className="tour-detail__container">
          <div className="tour-specs__grid">
            <div className="tour-specs__item">
              <div className="tour-specs__icon-box">
                <span className="material-symbols-outlined text-[20px]">schedule</span>
              </div>
              <div className="tour-specs__content">
                <span className="tour-specs__label">Thời lượng</span>
                <span className="tour-specs__value">
                  {tour.duration_days} Ngày {Math.max(0, tour.duration_days - 1)} Đêm
                </span>
              </div>
            </div>

            <div className="tour-specs__item">
              <div className="tour-specs__icon-box">
                <span className="material-symbols-outlined text-[20px]">calendar_month</span>
              </div>
              <div className="tour-specs__content">
                <span className="tour-specs__label">Khởi hành</span>
                <span className="tour-specs__value">
                  {openDeparturesCount > 0
                    ? `${openDeparturesCount} đợt mở bán`
                    : "Đang cập nhật"}
                </span>
              </div>
            </div>

            <div className="tour-specs__item">
              <div className="tour-specs__icon-box">
                <span className="material-symbols-outlined text-[20px]">pin_drop</span>
              </div>
              <div className="tour-specs__content">
                <span className="tour-specs__label">Điểm đến</span>
                <span className="tour-specs__value">{cleanProvince || "Việt Nam"}</span>
              </div>
            </div>

            <div className="tour-specs__item">
              <div className="tour-specs__icon-box">
                <span className="material-symbols-outlined text-[20px]">directions_bus</span>
              </div>
              <div className="tour-specs__content">
                <span className="tour-specs__label">Vận chuyển</span>
                <span className="tour-specs__value">Xe du lịch đời mới</span>
              </div>
            </div>

            <div className="tour-specs__item">
              <div className="tour-specs__icon-box">
                <span className="material-symbols-outlined text-[20px]">verified</span>
              </div>
              <div className="tour-specs__content">
                <span className="tour-specs__label">Hình thức</span>
                <span className="tour-specs__value">Tour trọn gói</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Sticky In-Page Navigation Tab Bar */}
      <nav className="tour-nav" aria-label="Điều hướng các mục chi tiết tour">
        <div className="tour-detail__container">
          <div className="tour-nav__list" role="tablist" aria-label="Danh sách tab chi tiết tour">
            {tabs.map((t, idx) => {
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  id={`tab-${t.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${t.id}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => handleTabChange(t.id)}
                  onKeyDown={(e) => handleTabKeyDown(e, idx)}
                  className={`tour-nav__link ${isActive ? "tour-nav__link--active" : ""}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 5. Main Body 2 Cột: Cột trái nội dung (68%) - Cột phải đặt tour (32%) */}
      <section className="tour-layout">
        <div className="tour-detail__container">
          <div className="tour-layout__grid">
            {/* CỘT TRÁI: Nội dung chi tiết các tab */}
            <div className="tour-layout__main">
              {/* Tab 1: Tổng quan */}
              <article
                role="tabpanel"
                id="panel-tong-quan"
                aria-labelledby="tab-tong-quan"
                tabIndex={0}
                hidden={activeTab !== "tong-quan"}
                className={`tour-article tour-tabpanel ${activeTab === "tong-quan" ? "tour-tabpanel--active" : ""}`}
              >
                <div className="tour-article__header">
                  <span className="tour-article__accent-bar" />
                  <h2 className="tour-article__title">Về hành trình đặc biệt này</h2>
                </div>

                <div className="tour-overview__badges">
                  <span className="tour-detail__badge tour-detail__badge--verified">
                    <span className="material-symbols-outlined text-[14px]">schedule</span>
                    {tour.duration_days} Ngày {Math.max(0, tour.duration_days - 1)} Đêm
                  </span>
                  {cleanProvince && (
                    <span className="tour-detail__badge tour-detail__badge--verified">
                      <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                      {cleanProvince}
                    </span>
                  )}
                  <span className="tour-detail__badge tour-detail__badge--verified">
                    <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                    {openDeparturesCount > 0 ? `${openDeparturesCount} đợt mở bán` : "Đang cập nhật"}
                  </span>
                  <span className="tour-detail__badge tour-detail__badge--verified">
                    <span className="material-symbols-outlined text-[14px]">verified_user</span>
                    Bảo hiểm trọn gói
                  </span>
                </div>

                <p className="tour-article__desc">
                  {cleanText(tour.description || tour.summary)}
                </p>

                <div className="tour-overview__summary-grid">
                  <div className="tour-overview__summary-item">
                    <div className="tour-overview__summary-icon">
                      <span className="material-symbols-outlined text-[20px]">explore</span>
                    </div>
                    <div>
                      <div className="tour-overview__summary-label">Điểm đến tiêu biểu</div>
                      <div className="tour-overview__summary-value">{cleanProvince || "Việt Nam"}</div>
                    </div>
                  </div>
                  <div className="tour-overview__summary-item">
                    <div className="tour-overview__summary-icon">
                      <span className="material-symbols-outlined text-[20px]">directions_bus</span>
                    </div>
                    <div>
                      <div className="tour-overview__summary-label">Phương tiện vận chuyển</div>
                      <div className="tour-overview__summary-value">Xe du lịch đời mới suốt tuyến</div>
                    </div>
                  </div>
                  <div className="tour-overview__summary-item">
                    <div className="tour-overview__summary-icon">
                      <span className="material-symbols-outlined text-[20px]">verified</span>
                    </div>
                    <div>
                      <div className="tour-overview__summary-label">Hình thức tổ chức</div>
                      <div className="tour-overview__summary-value">Tour du lịch trọn gói</div>
                    </div>
                  </div>
                  <div className="tour-overview__summary-item">
                    <div className="tour-overview__summary-icon">
                      <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
                    </div>
                    <div>
                      <div className="tour-overview__summary-label">An tâm trải nghiệm</div>
                      <div className="tour-overview__summary-value">Bảo hiểm &amp; Hỗ trợ 24/7</div>
                    </div>
                  </div>
                </div>
              </article>

              {/* Tab 2: Điểm nổi bật */}
              <article
                role="tabpanel"
                id="panel-diem-noi-bat"
                aria-labelledby="tab-diem-noi-bat"
                tabIndex={0}
                hidden={activeTab !== "diem-noi-bat"}
                className={`tour-article tour-tabpanel ${activeTab === "diem-noi-bat" ? "tour-tabpanel--active" : ""}`}
              >
                <div className="tour-article__header">
                  <span className="tour-article__accent-bar" />
                  <h2 className="tour-article__title">Những trải nghiệm không thể bỏ lỡ</h2>
                </div>

                {tour.highlights && tour.highlights.length > 0 ? (
                  <div className="tour-highlights__grid">
                    {tour.highlights.map((h, i) => (
                      <div key={i} className="tour-highlights__card">
                        <div className="tour-highlights__icon-box">
                          <span className="material-symbols-outlined text-[18px]">check_circle</span>
                        </div>
                        <div className="tour-highlights__content">
                          <span className="tour-highlights__title">{cleanText(h)}</span>
                          <span className="tour-highlights__detail">
                            Khám phá điểm đến tiêu biểu trong lịch trình được tuyển chọn.
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tour-reviews__empty" style={{ padding: "2rem 1rem" }}>
                    <div className="tour-reviews__empty-icon">
                      <span className="material-symbols-outlined text-[28px]">auto_awesome</span>
                    </div>
                    <h3 className="tour-reviews__empty-title">Đang cập nhật các điểm nổi bật</h3>
                    <p className="tour-reviews__empty-sub">
                      Thông tin chi tiết về các trải nghiệm độc đáo của hành trình đang được cập nhật.
                    </p>
                  </div>
                )}
              </article>

              {/* Tab 3: Lịch trình chi tiết */}
              <article
                role="tabpanel"
                id="panel-lich-trinh"
                aria-labelledby="tab-lich-trinh"
                tabIndex={0}
                hidden={activeTab !== "lich-trinh"}
                className={`tour-article tour-tabpanel ${activeTab === "lich-trinh" ? "tour-tabpanel--active" : ""}`}
              >
                <div className="tour-article__header">
                  <span className="tour-article__accent-bar" />
                  <h2 className="tour-article__title">
                    Lịch trình chi tiết {tour.duration_days} Ngày {Math.max(0, tour.duration_days - 1)} Đêm
                  </h2>
                </div>

                {tour.itinerary && tour.itinerary.length > 0 ? (
                  <div className="tour-itinerary__list">
                    {tour.itinerary.map((dayItem) => {
                      const dayNumber = String(dayItem.day).padStart(2, "0");
                      return (
                        <div key={dayItem.day} className="tour-itinerary__day">
                          <div className="tour-itinerary__badge">{dayNumber}</div>

                          <div className="tour-itinerary__meta">
                            <span className="tour-itinerary__tag">Ngày {dayItem.day}</span>
                          </div>

                          <h3 className="tour-itinerary__day-title">
                            Ngày {dayItem.day}: {cleanText(dayItem.title)}
                          </h3>

                          <p className="tour-itinerary__day-desc">
                            {cleanText(dayItem.description)}
                          </p>

                          {dayItem.places?.length > 0 && (
                            <div className="tour-itinerary__places">
                              {dayItem.places.map((place) => (
                                <button
                                  key={place.id}
                                  type="button"
                                  onClick={() => nav(`/dia-diem/poi/${place.id}`)}
                                  className="tour-itinerary__place-btn"
                                  title={`Xem chi tiết địa điểm ${place.name}`}
                                >
                                  <span className="material-symbols-outlined text-[14px]">pin_drop</span>
                                  <span>{cleanText(place.name)}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="tour-reviews__empty" style={{ padding: "2rem 1rem" }}>
                    <div className="tour-reviews__empty-icon">
                      <span className="material-symbols-outlined text-[28px]">calendar_today</span>
                    </div>
                    <h3 className="tour-reviews__empty-title">Đang cập nhật lịch trình</h3>
                    <p className="tour-reviews__empty-sub">
                      Lịch trình chi tiết từng ngày cho hành trình này đang được hoàn thiện.
                    </p>
                  </div>
                )}
              </article>

              {/* Tab 4: Dịch vụ bao gồm & Chưa bao gồm */}
              <article
                role="tabpanel"
                id="panel-dich-vu"
                aria-labelledby="tab-dich-vu"
                tabIndex={0}
                hidden={activeTab !== "dich-vu"}
                className={`tour-article tour-tabpanel ${activeTab === "dich-vu" ? "tour-tabpanel--active" : ""}`}
              >
                <div className="tour-article__header">
                  <span className="tour-article__accent-bar" />
                  <h2 className="tour-article__title">Dịch vụ bao gồm &amp; Chính sách</h2>
                </div>

                <div className="tour-policy__grid">
                  {/* Bao gồm */}
                  <div className="tour-policy__card tour-policy__card--included">
                    <div className="tour-policy__title tour-policy__title--included">
                      <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                      <span>Giá tour ĐÃ BAO GỒM</span>
                    </div>
                    {toPolicyList(tour.included).length > 0 ? (
                      <ul className="tour-policy__list">
                        {toPolicyList(tour.included).map((item, idx) => (
                          <li key={idx} className="tour-policy__item tour-policy__item--included">
                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">done</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 py-2">Đang cập nhật danh mục bao gồm.</p>
                    )}
                  </div>

                  {/* Chưa bao gồm */}
                  <div className="tour-policy__card tour-policy__card--excluded">
                    <div className="tour-policy__title tour-policy__title--excluded">
                      <span className="material-symbols-outlined text-rose-600">cancel</span>
                      <span>Giá tour CHƯA BAO GỒM</span>
                    </div>
                    {toPolicyList(tour.excluded).length > 0 ? (
                      <ul className="tour-policy__list">
                        {toPolicyList(tour.excluded).map((item, idx) => (
                          <li key={idx} className="tour-policy__item tour-policy__item--excluded">
                            <span className="material-symbols-outlined text-[16px] shrink-0 mt-0.5">close</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-slate-500 py-2">Đang cập nhật danh mục chưa bao gồm.</p>
                    )}
                  </div>
                </div>
              </article>

              {/* Tab 5: Đánh giá từ khách hàng */}
              <article
                role="tabpanel"
                id="panel-danh-gia"
                aria-labelledby="tab-danh-gia"
                tabIndex={0}
                hidden={activeTab !== "danh-gia"}
                className={`tour-article tour-tabpanel ${activeTab === "danh-gia" ? "tour-tabpanel--active" : ""}`}
              >
                <div className="tour-article__header">
                  <span className="tour-article__accent-bar" />
                  <h2 className="tour-article__title">Đánh giá từ khách hàng</h2>
                </div>

                {/* Trạng thái thực tế: Chưa có đánh giá trong hệ thống */}
                <div className="tour-reviews__empty">
                  <div className="tour-reviews__empty-icon">
                    <span className="material-symbols-outlined text-[28px]">rate_review</span>
                  </div>
                  <h3 className="tour-reviews__empty-title">Chưa có đánh giá nào cho tour này</h3>
                  <p className="tour-reviews__empty-sub">
                    Các đánh giá từ du khách hoàn thành hành trình thực tế sẽ được hiển thị tại đây để bạn tham khảo.
                  </p>
                </div>
              </article>
            </div>

            {/* CỘT PHẢI: Sticky Luxury Booking Widget */}
            <aside className="tour-layout__aside">
              <div className="tour-booking-box">
                {/* Tiêu đề & giá hiển thị */}
                <div className="tour-booking-box__price-header">
                  <div>
                    <div className="tour-booking-box__unit-label">
                      {selectedDeparture ? "Giá đợt khởi hành đã chọn" : "Giá trọn gói mỗi khách"}
                    </div>
                    <div className="tour-booking-box__price-group">
                      <span className="tour-booking-box__price-main">
                        {effectiveUnitPrice?.toLocaleString("vi-VN")}₫
                      </span>
                      {isCurrentSale && originalUnitPrice && (
                        <span className="tour-booking-box__price-strike">
                          {originalUnitPrice.toLocaleString("vi-VN")}₫
                        </span>
                      )}
                    </div>
                  </div>

                  {isCurrentSale && currentDiscountPct > 0 && (
                    <span className="tour-booking-box__badge-save">
                      Tiết kiệm {currentDiscountPct}%
                    </span>
                  )}
                </div>

                <div className="tour-booking-box__divider" />

                {/* Chọn đợt khởi hành */}
                <div className="tour-booking-box__field">
                  <label className="tour-booking-box__field-label" htmlFor="departureSelect">
                    <span className="material-symbols-outlined text-[18px] text-primary">calendar_today</span>
                    Chọn đợt khởi hành
                  </label>

                  {tour.departures?.length > 0 ? (
                    <select
                      id="departureSelect"
                      className="tour-booking-box__select"
                      value={selectedDeparture?.id || ""}
                      onChange={(e) => {
                        const depId = Number(e.target.value);
                        const found = tour.departures.find((d) => d.id === depId);
                        if (found) setSelectedDeparture(found);
                      }}
                    >
                      {tour.departures.map((d) => {
                        const priceText = (d.effective_price || d.price)?.toLocaleString("vi-VN") + "₫";
                        const isAvailable = d.seats_left > 0 && d.status === "OPEN";
                        return (
                          <option key={d.id} value={d.id} disabled={!isAvailable}>
                            {formatFullDate(d.depart_date)} - {priceText} ({isAvailable ? `Còn ${d.seats_left} chỗ` : "Hết chỗ"})
                          </option>
                        );
                      })}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-500 py-2">
                      Hiện chưa có đợt khởi hành mở bán.
                    </p>
                  )}

                  {selectedDeparture && (
                    <div
                      className={`tour-booking-box__seats-hint ${
                        selectedDeparture.seats_left > 0
                          ? "tour-booking-box__seats-hint--ok"
                          : "tour-booking-box__seats-hint--full"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {selectedDeparture.seats_left > 0 ? "check" : "close"}
                      </span>
                      {selectedDeparture.seats_left > 0
                        ? `Còn ${selectedDeparture.seats_left} chỗ trống sẵn sàng cho đợt này`
                        : "Đợt khởi hành này đã hết chỗ"}
                    </div>
                  )}
                </div>

                {/* Chọn số lượng hành khách */}
                <div className="tour-booking-box__field">
                  <span className="tour-booking-box__field-label">
                    <span className="material-symbols-outlined text-[18px] text-primary">person_add</span>
                    Số lượng hành khách
                  </span>

                  <div className="tour-booking-box__guest-row">
                    <div className="tour-booking-box__guest-meta">
                      <span className="tour-booking-box__guest-type">Người lớn</span>
                      <span className="tour-booking-box__guest-age">Từ 12 tuổi trở lên</span>
                    </div>

                    <div className="tour-booking-box__stepper">
                      <button
                        type="button"
                        className="tour-booking-box__step-btn"
                        onClick={() => setAdults((prev) => Math.max(1, prev - 1))}
                        disabled={adults <= 1}
                        aria-label="Giảm 1 khách"
                      >
                        -
                      </button>
                      <span className="tour-booking-box__step-count">{adults}</span>
                      <button
                        type="button"
                        className="tour-booking-box__step-btn"
                        onClick={() =>
                          setAdults((prev) =>
                            Math.min(selectedDeparture?.seats_left || 20, prev + 1)
                          )
                        }
                        disabled={
                          selectedDeparture
                            ? adults >= selectedDeparture.seats_left
                            : adults >= 20
                        }
                        aria-label="Tăng 1 khách"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tóm tắt chi phí tạm tính */}
                <div className="tour-booking-box__summary">
                  <div className="tour-booking-box__summary-row">
                    <span>Tạm tính ({adults} người lớn):</span>
                    <span>{totalCost.toLocaleString("vi-VN")}₫</span>
                  </div>
                  <div className="tour-booking-box__summary-row tour-booking-box__summary-row--total">
                    <span>Tổng chi phí:</span>
                    <span className="tour-booking-box__total-amount">
                      {totalCost.toLocaleString("vi-VN")}₫
                    </span>
                  </div>
                </div>

                {/* Nút bấm đặt tour */}
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  disabled={!selectedDeparture || selectedDeparture.seats_left <= 0}
                  className="tour-booking-box__btn-primary"
                >
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                  ĐẶT TOUR NGAY (GIỮ CHỖ 30 PHÚT)
                </button>

                {/* Nút yêu cầu tư vấn */}
                <a
                  href="tel:19006868"
                  className="tour-booking-box__btn-secondary"
                >
                  <span className="material-symbols-outlined text-[18px] text-primary">support_agent</span>
                  Yêu cầu tư vấn 1:1 miễn phí
                </a>

                {/* Các huy hiệu cam kết an tâm */}
                <div className="tour-booking-box__trust-list">
                  <div className="tour-booking-box__trust-item">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">verified_user</span>
                    <span>Hoàn 100% tiền nếu bão hoặc sự cố thời tiết</span>
                  </div>
                  <div className="tour-booking-box__trust-item">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">schedule</span>
                    <span>Xác nhận tức thì qua tin nhắn &amp; Email</span>
                  </div>
                  <div className="tour-booking-box__trust-item">
                    <span className="material-symbols-outlined text-[16px] text-emerald-600">price_check</span>
                    <span>Cam kết giá tốt nhất - Không phụ phí ẩn</span>
                  </div>
                </div>

                <div className="tour-booking-box__hotline-card">
                  Hotline hỗ trợ 24/7:{" "}
                  <a href="tel:19006868" className="tour-booking-box__hotline-link">
                    1900 6868
                  </a>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* 6. Gợi ý tour tương tự thật từ API */}
      {relatedTours.length > 0 && (
        <section className="tour-related">
          <div className="tour-detail__container">
            <div className="tour-related__header">
              <div>
                <span className="tour-related__eyebrow">Gợi ý tương tự</span>
                <h2 className="tour-related__title">Hải trình &amp; Kỳ nghỉ bạn có thể thích</h2>
              </div>
              <Link to="/tour" className="tour-related__view-all">
                Xem tất cả tour
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>

            <div className="tour-related__grid">
              {relatedTours.map((r) => {
                const rProvince = r.province_name?.replace(/^(Thành phố|Tỉnh)\s+/, "") || "";
                return (
                  <Link
                    key={r.id || r.slug}
                    to={`/tour/${r.slug}`}
                    className="tour-related__card"
                  >
                    <div className="tour-related__cover">
                      {r.cover_url ? (
                        <img
                          src={r.cover_url}
                          alt={cleanText(r.name)}
                          className="tour-related__cover-img"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-400">
                          <span className="material-symbols-outlined text-4xl">landscape</span>
                        </div>
                      )}
                      {r.is_sale ? (
                        <span className="tour-related__card-badge" style={{ backgroundColor: "rgba(225, 29, 72, 0.85)" }}>
                          ƯU ĐÃI -{r.discount_pct}%
                        </span>
                      ) : rProvince ? (
                        <span className="tour-related__card-badge">
                          {rProvince}
                        </span>
                      ) : null}
                    </div>

                    <div className="tour-related__body">
                      <div>
                        {rProvince && (
                          <div className="tour-related__loc">
                            <span className="material-symbols-outlined text-[16px] text-primary">location_on</span>
                            <span>{rProvince}</span>
                          </div>
                        )}
                        <h3 className="tour-related__card-title">
                          {cleanText(r.name)}
                        </h3>
                      </div>

                      <div className="tour-related__footer">
                        <span className="tour-related__duration">
                          {r.duration_days} Ngày {Math.max(0, r.duration_days - 1)} Đêm
                        </span>
                        <div className="tour-related__price-box">
                          <span className="tour-related__price-from">Từ</span>
                          <span className="tour-related__price-num">
                            {r.price_from?.toLocaleString("vi-VN")}₫
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* 7. Modal Lightbox duyệt toàn bộ ảnh tour */}
      {isLightboxOpen && galleryImages.length > 0 && (
        <div
          className="tour-lightbox"
          onClick={(e) => e.target === e.currentTarget && setIsLightboxOpen(false)}
        >
          <div className="tour-lightbox__topbar">
            <span className="tour-lightbox__counter">
              {lightboxIndex + 1} / {galleryImages.length} ảnh
            </span>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(false)}
              className="tour-lightbox__close-btn"
              aria-label="Đóng thư viện ảnh"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="tour-lightbox__stage">
            {galleryImages.length > 1 && (
              <button
                type="button"
                onClick={() => handleLightboxNav(-1)}
                className="tour-lightbox__nav-btn tour-lightbox__nav-btn--prev"
                aria-label="Ảnh trước"
              >
                <span className="material-symbols-outlined text-[28px]">chevron_left</span>
              </button>
            )}

            <img
              src={galleryImages[lightboxIndex]}
              alt={`${cleanText(tour.name)} - Ảnh lớn ${lightboxIndex + 1}`}
              className="tour-lightbox__main-img"
            />

            {galleryImages.length > 1 && (
              <button
                type="button"
                onClick={() => handleLightboxNav(1)}
                className="tour-lightbox__nav-btn tour-lightbox__nav-btn--next"
                aria-label="Ảnh tiếp theo"
              >
                <span className="material-symbols-outlined text-[28px]">chevron_right</span>
              </button>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div className="tour-lightbox__thumbs">
              {galleryImages.map((img, idx) => (
                <div
                  key={idx}
                  className={`tour-lightbox__thumb ${idx === lightboxIndex ? "tour-lightbox__thumb--active" : ""}`}
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img
                    src={img}
                    alt={`Thumbnail ${idx + 1}`}
                    className="tour-lightbox__thumb-img"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 8. Modal đặt tour Wizard 4 bước */}
      <TourBookingWizard
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tour={tour}
        initialDeparture={selectedDeparture}
        initialGuests={adults}
        user={user}
        onNeedAuth={onNeedAuth}
      />
    </main>
  );
}
