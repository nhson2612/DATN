import { useState, useRef, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../shared/api";
import VoyageDrawer from "../../../shared/layout/VoyageDrawer";
import "./Home.css";

function formatPrice(val) {
  return Number(val || 0).toLocaleString("vi-VN");
}

/**
 * Trang chủ tuân thủ nghiêm ngặt chuẩn kiến trúc BEM (.aura-home và .aura-search)
 * Hiệu ứng chuyển cảnh so le (Staggered Animation) và thu phóng chuẩn 100% mockup
 */
export default function HomePage({ user, onNeedAuth, onLogout }) {
  const [isSearchView, setIsSearchView] = useState(false);
  const [isSearchStaggered, setIsSearchStaggered] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toursData, setToursData] = useState([]);
  const searchInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    api
      .tours({ limit: 40 })
      .then((res) => {
        if (isMounted && res?.items) {
          setToursData(res.items);
        }
      })
      .catch((err) => {
        console.error("Lỗi tải tour trang chủ:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const popularSearchTours = useMemo(() => {
    const list = [...toursData];
    list.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0) || Number(b.view_count || 0) - Number(a.view_count || 0));
    return list.slice(0, 4);
  }, [toursData]);

  const liveSearchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return toursData.filter((t) => {
      const title = (t.title || t.name || "").toLowerCase();
      const prov = (t.province_name || "").toLowerCase();
      const desc = (t.overview || t.description || "").toLowerCase();
      const tags = Array.isArray(t.tags) ? t.tags.join(" ").toLowerCase() : "";
      return title.includes(q) || prov.includes(q) || desc.includes(q) || tags.includes(q);
    });
  }, [searchQuery, toursData]);

  const openSearch = () => {
    setIsSearchView(true);
    setIsSearchStaggered(false);
    setTimeout(() => {
      setIsSearchStaggered(true);
      searchInputRef.current?.focus();
    }, 80);
  };

  const closeSearch = () => {
    setIsSearchStaggered(false);
    setIsSearchView(false);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else if (isSearchView) {
          closeSearch();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, isSearchView]);

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/tour?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/tour");
    }
  };

  return (
    <div className="aura-home">
      <main className="aura-home__container">
        {/* =================================================== */}
        {/* VIEW 1: Split-Screen Editorial Home                */}
        {/* =================================================== */}
        <div
          className={`aura-home__split-view ${
            isSearchView ? "aura-home__split-view--hidden" : "aura-home__split-view--active"
          }`}
          id="homeView"
        >
          {/* CỘT TRÁI: Editorial Typography, Brand & Nav */}
          <section className="aura-home__col-left">
            {/* Header trên cùng: Brand Pin + Nút tìm kiếm */}
            <header className="aura-home__header">
              <Link to="/" className="aura-home__brand" aria-label="Aura Brand Logo">
                <svg
                  className="aura-home__brand-icon"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 10.5c-1.93 0-3.5-1.57-3.5-3.5S10.07 5.5 12 5.5s3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
                </svg>
              </Link>

              <button
                type="button"
                className="aura-home__search-btn"
                onClick={openSearch}
                aria-label="Find tour"
              >
                <svg
                  className="aura-home__search-btn-icon"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>Find tour</span>
              </button>
            </header>

            {/* Khối tiêu đề chính Editorial Headline */}
            <div className="aura-home__editorial">
              <h1 className="aura-home__title">
                Discover <em>the</em> beauty <br />
                of the world around
              </h1>
              <p className="aura-home__desc">
                Escape the ordinary and find inspiration in the most breathtaking corners of
                the globe. We curate unique travel experiences tailored to your rhythm and spirit.
              </p>
            </div>

            {/* Điều hướng dọc phía dưới */}
            <nav className="aura-home__nav" aria-label="Main Editorial Navigation">
              <span className="aura-home__nav-link aura-home__nav-link--active">
                <span>/ About</span>
              </span>
              <Link to="/tour" className="aura-home__nav-link">
                <span>Tours</span>
                <span>→</span>
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
          </section>

          {/* CỘT PHẢI: Khung ảnh cảnh sắc & Card nổi */}
          <section className="aura-home__col-right">
            <div className="aura-home__visual-wrap">
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuAwajCfd2fjh7xH4MeiBvxCn9LqlCN64lAXHa70tcgUFYdonz0SZ8PxA06DzKgwQR3XNej0a5_eEclB3_zYuMYHwt71efiDox1elXKpNVjeZdZcKo7Tq_HH4h_EmgZ9FBzCqDcpGd13B5NO2VC9HqkXSbdfVR6ARTA3MKJMJhbAtIcAUzSTnHTG9hOxpkoB4iaVJDnq98nvbxtUkXe0dFjF_WbsaD74I5w547ZU6P2BVoMrZOpHD5lc_Q"
                alt="Breathtaking alpine green valley and jagged sunlit mountain peaks"
                className="aura-home__visual-img"
              />
            </div>

            {/* Nút Hamburger mở Drawer phong cách Aura */}
            <button
              type="button"
              className="aura-home__menu-btn"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open Navigation Menu"
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
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>

            {/* Card nổi tuyển chọn: "Hidden Gems" */}
            <aside className="aura-home__floating-card">
              <div className="aura-home__card-thumb">
                <img
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDxS7MoATvg0pAoqJPQquwTaycAvVwpbBL1tIqaLV3A1iOOOhEVi2ZBkXsAPEghtF5E4828OKrJZMTcetZQ0aAsKfguWG3es_ds8heWZAyBf9IHG00Z_rpexckS445vqfHvusSNFu2eHPch3QmKDeVIAc_3frqLonz0jj2axeJPk-G5-8aQ2sk1qlZHt3818in67JsVieNdw2Rtxv75ca81i_vTNnL3nb67UJfPMqdsX5_oaK0kOR_sXA"
                  alt="Alpine wooden cottage in secluded meadow"
                  className="aura-home__card-img"
                />
              </div>
              <div className="aura-home__card-body">
                <div>
                  <h3 className="aura-home__card-title">Hidden Gems</h3>
                  <p className="aura-home__card-text">
                    Explore our handpicked collection of authentic stays and secluded retreats,
                    where nature meets comfort in perfect harmony.
                  </p>
                </div>
                <div className="aura-home__card-actions">
                  <Link to="/tour" className="aura-home__card-btn">
                    Explore More
                  </Link>
                  <div aria-label="Carousel dots" className="flex items-center space-x-1.5 pr-1">
                    <span className="aura-home__card-dot aura-home__card-dot--active" />
                    <span className="aura-home__card-dot" />
                    <span className="aura-home__card-dot" />
                  </div>
                </div>
              </div>
            </aside>
          </section>
        </div>

        {/* =================================================== */}
        {/* VIEW 3: In-Container Search View (Staggered BEM)    */}
        {/* =================================================== */}
        <section
          className={`aura-search ${
            isSearchView ? "aura-search--active" : "aura-search--hidden"
          } ${isSearchStaggered ? "aura-search--stagger-active" : ""}`}
          id="searchView"
        >
          {/* Header: Back to home + Close button (Stagger 1: delay 0.05s) */}
          <header className="aura-search__header aura-search__stagger aura-search__stagger--header">
            <div className="aura-search__header-left">
              <button
                type="button"
                className="aura-search__logo-btn"
                onClick={closeSearch}
                aria-label="Back to Aura Home"
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
                Back to home
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

          {/* Huge Center Search Input (Stagger 2: delay 0.12s) */}
          <div className="aura-search__input-wrap aura-search__stagger aura-search__stagger--title">
            <form onSubmit={handleSearchSubmit} className="aura-search__input-box">
              <span className="aura-search__caret" />
              <input
                ref={searchInputRef}
                type="text"
                className="aura-search__input"
                placeholder="Find your tour"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="aura-search__clear-btn"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </form>
          </div>

          {/* Dynamic Content (Stagger 3: delay 0.20s) */}
          <div className="aura-search__content aura-search__stagger aura-search__stagger--content">
            {!searchQuery ? (
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
                        onClick={() => navigate(`/tour/${t.slug || t.id}`)}
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
                  <span className="aura-search__subhead-desc">Khớp với từ khóa "{searchQuery}"</span>
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
                            onClick={() => navigate(`/tour/${t.slug || t.id}`)}
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

                    {/* Bespoke CTA Banner */}
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
                            Xem tất cả kết quả trên trang Tour
                          </h5>
                          <p className="aura-search__cta-desc">
                            Xem danh sách đầy đủ {liveSearchResults.length} tour và lọc chi tiết theo khoảng giá, ngày khởi hành.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="aura-search__cta-btn"
                        onClick={handleSearchSubmit}
                      >
                        Khám phá tour →
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="aura-search__empty-box">
                    <p className="aura-search__empty-title">
                      Không tìm thấy tour phù hợp với "{searchQuery}"
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
                          onClick={() => setSearchQuery(tag)}
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

          {/* Bottom Nav Footer (Stagger 4: delay 0.32s) */}
          <footer className="aura-search__footer aura-search__stagger aura-search__stagger--footer">
            <nav className="aura-search__footer-nav">
              <button
                type="button"
                className="aura-search__footer-link"
                onClick={() => setIsSearchView(false)}
              >
                About
              </button>
              <Link to="/tour" className="aura-search__footer-link">
                Tours
              </Link>
              <span className="aura-search__footer-link aura-search__footer-link--active">
                / Destinations
              </span>
              <Link to="/chuyen-di" className="aura-search__footer-link">
                Booking
              </Link>
              <a href="#faq" className="aura-search__footer-link">
                FAQ
              </a>
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
