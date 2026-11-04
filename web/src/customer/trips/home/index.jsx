import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../shared/api";
import AppNavbar from "../../../shared/layout/AppNavbar";
import "./Home.css";

const FALLBACK_DEST_IMAGES = [
  "/images/tour-halong.jpg",
  "/images/tour-danang.jpg",
  "/images/tour-phuquoc.jpg",
  "/images/tour-sapa.jpg",
  "/images/vietnam-1.jpg",
  "/images/vietnam-2.jpg",
];

const JOURNEY_STEPS = [
  {
    id: 0,
    title: "Chọn Điểm Đến\n& Sở Thích",
    desc: "Khám phá danh lam thắng cảnh, văn hóa bản địa và ẩm thực đặc sắc phù hợp riêng với gu du lịch của bạn.",
    photo: "/images/provinces/kien-giang.jpg",
    link: "/tour",
    actionText: "TÌM HIỂU THÊM >",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sky-journey-badge-icon">
        <circle cx="12" cy="12" r="9" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 1,
    title: "Tự Động Tối Ưu\nLịch Trình",
    desc: "Thuật toán thông minh sắp xếp thứ tự điểm đến, tuyến đường di chuyển hợp lý và thời gian biểu hoàn hảo.",
    photo: "/images/tour-phuquoc.jpg",
    link: "/trips",
    actionText: "TÌM HIỂU THÊM >",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="sky-journey-badge-icon">
        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
      </svg>
    ),
  },
  {
    id: 2,
    title: "Khởi Hành &\nTận Hưởng",
    desc: "Tự tin xách ba lô lên đường với bản đồ dẫn đường chi tiết, lưu trú trọn gói và hỗ trợ xuyên suốt chuyến đi.",
    photo: "/images/phu_quoc_beach_new.png",
    link: "/tai-khoan",
    actionText: "TÌM HIỂU THÊM >",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="sky-journey-badge-icon">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </svg>
    ),
  },
];

const DEFAULT_POPULAR_TOURS = [
  {
    id: "tour-ha-long",
    slug: "kham-pha-vinh-ha-long",
    name: "Khám Phá Vịnh Hạ Long Huyền Bí",
    province_name: "Quảng Ninh",
    rating: 4.9,
    cover_url: "/images/tour-halong.jpg",
  },
  {
    id: "tour-da-nang-hoi-an",
    slug: "du-lich-da-nang-hoi-an",
    name: "Hành Trình Di Sản Đà Nẵng - Hội An",
    province_name: "Đà Nẵng",
    rating: 4.8,
    cover_url: "/images/tour-danang.jpg",
  },
  {
    id: "tour-phu-quoc",
    slug: "thien-duong-dao-ngoc-phu-quoc",
    name: "Thiên Đường Đảo Ngọc Phú Quốc",
    province_name: "Kiên Giang",
    rating: 4.9,
    cover_url: "/images/tour-phuquoc.jpg",
  },
  {
    id: "tour-sa-pa",
    slug: "sa-pa-ruong-bac-thang",
    name: "Sa Pa Sương Mờ & Ruộng Bậc Thang",
    province_name: "Lào Cai",
    rating: 4.9,
    cover_url: "/images/vietnam_explore_new.png",
  },
  {
    id: "tour-nha-trang",
    slug: "nha-trang-bien-xanh",
    name: "Nha Trang Biển Xanh Cát Trắng",
    province_name: "Khánh Hòa",
    rating: 4.8,
    cover_url: "/images/travel_hero.jpg",
  },
  {
    id: "tour-da-lat",
    slug: "da-lat-thanh-pho-ngan-hoa",
    name: "Đà Lạt Mộng Mơ Ngàn Hoa",
    province_name: "Lâm Đồng",
    rating: 4.9,
    cover_url: "/images/tour-danang.jpg",
  },
];

export default function Home({ user, onNeedAuth, onLogout }) {
  const navigate = useNavigate();
  const [destIndex, setDestIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(1); // Mặc định card 2 active, di chuột sang card khác sẽ chuyển active
  const [realTours, setRealTours] = useState([]);

  useEffect(() => {
    let isMounted = true;
    api
      .tours({ page_size: 15 })
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res) ? res : res?.items || res?.data || [];
        const valid = list.filter(
          (t) =>
            t.name &&
            !t.name.toLowerCase().includes("kiem tra") &&
            !t.name.toLowerCase().includes("sdherst") &&
            !t.name.toLowerCase().includes("chay du")
        );
        if (valid.length > 0) {
          setRealTours(valid);
        }
      })
      .catch((err) => {
        console.warn("Lỗi tải tour từ DB:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const effectiveTours = realTours.length >= 3 ? realTours : DEFAULT_POPULAR_TOURS;
  const maxSlideIndex = Math.max(0, effectiveTours.length - 3);

  const nextDest = () => {
    setDestIndex((prev) => (prev >= maxSlideIndex ? 0 : prev + 1));
  };

  const prevDest = () => {
    setDestIndex((prev) => (prev <= 0 ? maxSlideIndex : prev - 1));
  };

  return (
    <div className="sky-page">
      {/* ========================================================= */}
      {/* 1. APP NAVBAR DÙNG CHUNG TOÀN HỆ THỐNG                     */}
      {/* ========================================================= */}
      <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />

      <main className="sky-main">
        {/* ========================================================= */}
        {/* 2. HERO CARD                                              */}
        {/* ========================================================= */}
        <section className="sky-hero">
          <div className="sky-hero__container">
            {/* Left Vertical Stepper */}
            <div className="sky-stepper">
              <div className="sky-stepper__item sky-stepper__item--active">
                <span className="sky-stepper__dot">1</span>
              </div>
              <div className="sky-stepper__line" />
              <div className="sky-stepper__item">
                <span className="sky-stepper__dot">2</span>
              </div>
              <div className="sky-stepper__line" />
              <div className="sky-stepper__item">
                <span className="sky-stepper__dot">3</span>
              </div>
            </div>

            {/* Left Hero Content */}
            <div className="sky-hero__content">
              <span className="sky-hero__eyebrow">✦ HỆ THỐNG DU LỊCH THÔNG MINH VIỆT NAM</span>
              <h1 className="sky-hero__title">
                Khám Phá<br />
                Vẻ Đẹp Diệu Kỳ<br />
                Việt Nam!
              </h1>

              <div className="sky-hero__actions">
                <Link
                  to="/trips"
                  onClick={(e) => {
                    if (!user && onNeedAuth) {
                      e.preventDefault();
                      onNeedAuth();
                    }
                  }}
                  className="sky-btn-primary"
                >
                  Bắt Đầu Lên Lịch
                </Link>
                <button
                  type="button"
                  className="sky-btn-play"
                  aria-label="Khám phá tour du lịch"
                  onClick={() => navigate("/tour")}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="sky-btn-play__icon">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Right Travel Visual */}
            <div className="sky-hero__visual">
              <img
                src="/images/travel_hero.jpg"
                alt="Du lịch biển Việt Nam Aura Voyage"
                className="sky-hero__plane-img"
              />
            </div>

            {/* Inset Know More Notch */}
            <div className="sky-know-more">
              <div className="sky-know-more__header">
                <span className="sky-know-more__title">Khám Phá</span>
                <span className="sky-know-more__arrow">→</span>
              </div>
              <div className="sky-know-more__body">
                <div className="sky-know-more__avatars">
                  <img
                    src="/images/tour-halong.jpg"
                    alt="Vịnh Hạ Long"
                    className="sky-know-more__avatar"
                  />
                  <img
                    src="/images/tour-danang.jpg"
                    alt="Đà Nẵng"
                    className="sky-know-more__avatar"
                  />
                  <img
                    src="/images/tour-phuquoc.jpg"
                    alt="Phú Quốc"
                    className="sky-know-more__avatar"
                  />
                </div>
                <div className="sky-know-more__info">
                  <h4 className="sky-know-more__badge-title">Danh Thắng Nổi Bật</h4>
                  <p className="sky-know-more__badge-desc">
                    Trọn vẹn trải nghiệm 63 tỉnh thành<br />trên từng bước chân!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 2. THANH ĐỐI TÁC & MẠNG XÃ HỘI TỐI GIẢN                  */}
        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* 3. POPULAR DESTINATION                                    */}
        {/* ========================================================= */}
        <section className="sky-popular">
          <div className="sky-popular__header">
            <div>
              <h2 className="sky-popular__title">Điểm Đến Thịnh Hành</h2>
              <p className="sky-popular__subtitle">Trải Nghiệm Những Vùng Đất Tuyệt Mỹ Cùng Aura Voyage</p>
            </div>

            <div className="sky-popular__controls">
              <button
                type="button"
                className="sky-carousel-btn sky-carousel-btn--prev"
                onClick={prevDest}
                aria-label="Previous Destination"
              >
                ‹
              </button>
              <button
                type="button"
                className="sky-carousel-btn sky-carousel-btn--next"
                onClick={nextDest}
                aria-label="Next Destination"
              >
                ›
              </button>
            </div>
          </div>

          <div className="sky-popular__slider-wrapper">
            <div
              className="sky-popular__track"
              style={{
                transform: `translateX(calc(-${destIndex} * ((100% + 24px) / 3)))`,
              }}
            >
              {effectiveTours.map((t, idx) => {
                const tourId = t.slug || t.id;
                const title = t.name || t.title;
                const location = t.province_name
                  ? t.province_name.replace(/^(Thành phố|Tỉnh)\s+/, "") + ", Việt Nam"
                  : "Việt Nam";
                const rating = t.rating ? Number(t.rating).toFixed(1) : (4.8 + (idx % 2) * 0.1).toFixed(1);
                const fallbackImg = FALLBACK_DEST_IMAGES[idx % FALLBACK_DEST_IMAGES.length];
                let coverImg =
                  t.cover_url ||
                  (Array.isArray(t.images) && (typeof t.images[0] === "string" ? t.images[0] : t.images[0]?.url));

                if (!coverImg || coverImg.includes("example.com")) {
                  coverImg = fallbackImg;
                }

                return (
                  <div key={tourId || idx} className="sky-popular__slide">
                    <Link to={`/tour/${tourId}`} className="sky-dest-card">
                      <div className="sky-dest-card__img-box">
                        <img
                          src={coverImg}
                          alt={title}
                          className="sky-dest-card__img"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = fallbackImg;
                          }}
                        />
                      </div>
                      <div className="sky-dest-card__body">
                        <div className="sky-dest-card__info">
                          <h3 className="sky-dest-card__title">{title}</h3>
                          <p className="sky-dest-card__loc">
                            <svg className="sky-pin-icon" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
                            </svg>
                            {location}
                          </p>
                        </div>
                        <div className="sky-dest-card__rating">
                          <span>★</span> {rating}
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* 4. HÀNH TRÌNH DU LỊCH DỄ DÀNG (HOVER DYNAMIC)              */}
        {/* ========================================================= */}
        <section className="sky-journey">
          <div className="sky-journey__header">
            <h2 className="sky-journey__title">Hành Trình Du Lịch Thật Dễ Dàng!</h2>
            <p className="sky-journey__subtitle">
              Tự do kết nối những điểm chạm độc bản, tối ưu lộ trình thông minh và an tâm tận hưởng từng khoảnh khắc kỳ nghỉ.
            </p>
          </div>

          <div className="sky-journey__grid">
            {JOURNEY_STEPS.map((step) => {
              const isActive = activeStep === step.id;
              return (
                <div
                  key={step.id}
                  className={`sky-journey-card ${isActive ? "sky-journey-card--active" : ""}`}
                  onMouseEnter={() => setActiveStep(step.id)}
                >
                  {/* 1. Ảnh nền phủ kín toàn bộ card khi inactive */}
                  <img
                    src={step.photo}
                    alt={step.title}
                    className="sky-journey-card__bg-photo"
                  />

                  {/* 2. Lớp scrim tối nhẹ khi inactive để chữ luôn rõ nét */}
                  <div className="sky-journey-card__scrim" />

                  {/* 3. Lớp màu xanh phủ từ góc trái đáy lên, mép trên là đường sóng nước uốn lượn có đỉnh và đáy sóng */}
                  <svg
                    className="sky-journey-card__wave-overlay"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M 0,0 L 0,100 L 100,100 L 100,42 C 90,48 78,26 64,36 C 50,46 40,16 30,0 L 0,0 Z"
                      fill="#2563eb"
                    />
                  </svg>

                  {/* 4. Badge icon góc trên bên trái */}
                  <div className="sky-journey-card__badge-wrapper">
                    <div className="sky-journey-card__badge">
                      {step.icon}
                    </div>
                  </div>

                  {/* 5. Nội dung card: tiêu đề, mô tả và nút tìm hiểu thêm */}
                  <div className="sky-journey-card__content">
                    <h3 className="sky-journey-card__title">
                      {step.title}
                    </h3>
                    <div className="sky-journey-card__expandable">
                      <p className="sky-journey-card__desc">
                        {step.desc}
                      </p>
                      <Link to={step.link} className="sky-journey-card__link">
                        {step.actionText}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================= */}
        {/* 5. UNLEASH WANDERLUST BANNER (GRID 2x2 CHUẨN MOCKUP)      */}
        {/* ========================================================= */}
        <section className="sky-wanderlust">
          <div className="sky-wanderlust__grid">
            {/* 1. Ô ẢNH (Top-Left - Dọc chuẩn tỉ lệ ảnh mẫu) */}
            <div className="sky-wanderlust__photo-box">
              <img
                src="/images/wanderlust_girl_clean.jpg"
                alt="Em bé vui đùa trên sóng biển"
                className="sky-wanderlust__photo"
              />
            </div>

            {/* 2. CHỮ EDITORIAL (Top-Right - Tỷ lệ và bố cục sát chữ) */}
            <div className="sky-wanderlust__editorial">
              <div className="sky-editorial-row sky-editorial-row--1">
                <span className="sky-word sky-word--unleash">UNLEASH</span>
                <p className="sky-editorial-text sky-editorial-text--top">
                  Travelling Is A Wonderful Way To Explore New Places, Learn About Different Cultures, And Gain Unique Experiences.
                </p>
              </div>

              <div className="sky-editorial-row sky-editorial-row--2">
                <span className="sky-word sky-word--wanderlust">WANDERLUST WITH</span>
              </div>

              <div className="sky-editorial-row sky-editorial-row--3">
                <p className="sky-editorial-text sky-editorial-text--bottom">
                  Travelling Is A Wonderful Way To Explore New Places, Learn About Different Cultures.
                </p>
                <span className="sky-word sky-word--brand">AURA VOYAGE</span>
              </div>
            </div>

            {/* 3. Ô ƯU ĐÃI 20% (Bottom-Left) */}
            <div className="sky-wanderlust__offer-pill">
              <span className="sky-wanderlust__offer-rate">20% OFF</span>
              <div className="sky-wanderlust__offer-expiry">
                <span>Till 28 September,</span>
                <span>2026</span>
              </div>
            </div>

            {/* 4. NÚT MÂY TRỜI (Bottom-Right - Tiếp xúc chéo góc ô ảnh) */}
            <div className="sky-wanderlust__action">
              <Link to="/tour" className="btn-cloud-1">
                <svg className="bg" viewBox="0 0 500 64" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#b8e0f6" />
                      <stop offset="40%" stopColor="#d7ebf8" />
                      <stop offset="70%" stopColor="#e8f3fa" />
                      <stop offset="100%" stopColor="#cbe6f7" />
                    </linearGradient>
                    <filter id="cloudTurbulence" x="-20%" y="-20%" width="140%" height="140%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.025 0.06" numOctaves="3" result="noise" />
                      <feColorMatrix type="matrix" values="1 0 0 0 1  0 1 0 0 1  0 0 1 0 1  0 0 0 2 -0.8" result="clouds" />
                      <feComposite in="SourceGraphic" in2="clouds" operator="in" />
                    </filter>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#skyGrad)" />
                  <ellipse cx="90" cy="30" rx="95" ry="35" fill="#ffffff" opacity="0.65" filter="blur(16px)" />
                  <ellipse cx="380" cy="25" rx="110" ry="32" fill="#ffffff" opacity="0.75" filter="blur(18px)" />
                  <ellipse cx="240" cy="48" rx="85" ry="24" fill="#ffffff" opacity="0.55" filter="blur(14px)" />
                  <ellipse cx="460" cy="45" rx="60" ry="25" fill="#ffffff" opacity="0.7" filter="blur(14px)" />
                </svg>
                <span>Book A Tour Now</span>
                <span className="sky-arrow" style={{ fontSize: "20px" }}>→</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
