import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../shared/api";
import Dropdown from "../../../shared/common/Dropdown";
import CardSkeleton from "../../../shared/skeletons/CardSkeleton";
import { getProvinceImage } from "./provinceImages";
import VoyageDrawer from "../../../shared/layout/VoyageDrawer";
import "../home/Home.css";
import "../../tours/Tours.css";
import "./Trips.css";

const isoNgay = (d) => d.toISOString().slice(0, 10);

function khoiTaoForm() {
  const batDau = new Date();
  batDau.setDate(batDau.getDate() + 7);
  const ketThuc = new Date(batDau);
  ketThuc.setDate(ketThuc.getDate() + 2);
  return { name: "", start_date: isoNgay(batDau), end_date: isoNgay(ketThuc) };
}

function soNgay(start, end) {
  if (!start || !end) return 1;
  const ms = new Date(end) - new Date(start);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/**
 * Định dạng ngày theo chuẩn ngắn gọn: Sep 11 – 14 hoặc Sep 2 – Oct 15
 */
function formatTripDates(startDate, durationDays) {
  if (!startDate) return `${durationDays || 1} days`;
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + Math.max(0, (durationDays || 1) - 1));

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const sMonth = MONTHS[start.getMonth()];
  const eMonth = MONTHS[end.getMonth()];
  const sDay = start.getDate();
  const eDay = end.getDate();

  if (sMonth === eMonth) {
    return `${sMonth} ${sDay} – ${eDay}`;
  }
  return `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
}

const EXPERIENCES = [
  { id: "nature", label: "Nature & Parks", icon: "forest", desc: "Mountains, bays & limestone cliffs" },
  { id: "food", label: "Food & Cuisine", icon: "restaurant", desc: "Street food & local authentic flavors" },
  { id: "culture", label: "Culture & Heritage", icon: "temple_buddhist", desc: "Ancient towns, temples & history" },
  { id: "adventure", label: "Adventure & Trekking", icon: "hiking", desc: "Kayaking, motorbiking & trails" },
  { id: "relaxation", label: "Relaxation & Beach", icon: "beach_access", desc: "Coastal resorts & tranquility" },
  { id: "nightlife", label: "Nightlife & City", icon: "nightlife", desc: "Skybars, night markets & vibes" },
  { id: "shopping", label: "Shopping & Crafts", icon: "shopping_bag", desc: "Handicrafts & local specialty gifts" },
  { id: "local", label: "Local Life", icon: "diversity_3", desc: "Homestays & village experiences" },
  { id: "photo", label: "Photography", icon: "photo_camera", desc: "Scenic viewpoints & golden hour" },
];

export default function Trips({ user, onNeedAuth, onLogout }) {
  const [ds, setDs] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [filterOption, setFilterOption] = useState("recent"); // 'recent' | 'upcoming' | 'name'
  const [form, setForm] = useState(() => khoiTaoForm());
  const [modalSearchQuery, setModalSearchQuery] = useState("");

  // Chế độ tạo chuyến đi (Planner flow 2 stages)
  const [isCreatingTrip, setIsCreatingTrip] = useState(false);
  const [plannerStep, setPlannerStep] = useState(1); // 1: Where to go | 2: Experiences
  const [selectedInterests, setSelectedInterests] = useState(["nature", "food", "culture"]);
  const [isDestDropdownOpen, setIsDestDropdownOpen] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);

  // Navigation & Scroll states
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
  const nav = useNavigate();

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
      setIsNavSearchOpen(false);
      nav(`/tour?q=${encodeURIComponent(navSearchQuery.trim())}`);
    } else {
      navSearchInputRef.current?.focus();
    }
  };

  // Tải danh sách chuyến đi khi đã đăng nhập
  useEffect(() => {
    if (!user) {
      setDs([]);
      return;
    }
    api.itineraries().then((d) => setDs(d.itineraries || [])).catch(() => setDs([]));
    api.destinations(60)
      .then((res) => setDestinations(res?.destinations || (Array.isArray(res) ? res : [])))
      .catch(() => setDestinations([]));
  }, [user]);

  // Xử lý scroll mượt mà
  const handleScroll = () => {
    const scrollTop =
      screenRef.current?.scrollTop ??
      window.scrollY ??
      document.documentElement.scrollTop ??
      0;
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
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (el) el.removeEventListener("scroll", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function startCreateTrip() {
    if (!user) {
      onNeedAuth?.();
      return;
    }
    setIsCreatingTrip(true);
    setPlannerStep(1);
    setModalSearchQuery("");
    setSelectedInterests(["nature", "food", "culture"]);
    setForm(khoiTaoForm());
  }

  function handleSelectDestination(destName) {
    const cleanName = destName.replace(/^(Thành phố|Tỉnh)\s+/i, "");
    setForm((cu) => ({
      ...cu,
      name: `Trip to ${cleanName}`,
    }));
    setModalSearchQuery(destName);
    setIsDestDropdownOpen(false);
  }

  async function handleCreateTrip(e) {
    e?.preventDefault();
    if (!form.name.trim() || dangLuu) return;
    setDangLuu(true);
    try {
      const dest = modalSearchQuery.trim();
      const descParts = [];
      if (form.description?.trim()) descParts.push(form.description.trim());
      if (selectedInterests.length > 0) {
        const labels = selectedInterests
          .map((id) => EXPERIENCES.find((exp) => exp.id === id)?.label)
          .filter(Boolean);
        descParts.push(`Interests: ${labels.join(", ")}`);
      }

      const d = await api.saveItinerary({
        name: form.name.trim(),
        description: descParts.join(" · "),
        destination: dest || null,
        start_date: form.start_date || null,
        duration_days: soNgay(form.start_date, form.end_date),
        sections: [{ key: "muon-di", name: "Địa điểm muốn đi" }],
        stops: [],
      });
      nav(`/chuyen-di/${d.id}`);
    } catch (err) {
      console.error("Lỗi khi tạo chuyến đi:", err);
    } finally {
      setDangLuu(false);
    }
  }

  async function xoa(id, e) {
    e?.stopPropagation?.();
    if (!window.confirm("Xoá chuyến đi này?")) return;
    try {
      await api.deleteItinerary(id);
      setDs((cu) => (cu || []).filter((x) => x.id !== id));
    } catch (err) {
      console.error("Lỗi xoá chuyến đi:", err);
    }
  }

  const filteredDestinations = destinations.filter((d) =>
    (d.name || "").toLowerCase().includes(modalSearchQuery.toLowerCase())
  );

  // Lọc và sắp xếp danh sách chuyến đi
  const tripsHienThi = [...(ds || [])]
    .filter((t) => {
      if (!searchFilter.trim()) return true;
      const term = searchFilter.toLowerCase();
      return (
        (t.name || "").toLowerCase().includes(term) ||
        (t.destination || "").toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (filterOption === "name") {
        return (a.name || "").localeCompare(b.name || "");
      }
      if (filterOption === "upcoming") {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return dateA - dateB;
      }
      return (b.id || 0) - (a.id || 0);
    });

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

  // =========================================================================
  // GIAO DIỆN PLANNER TOÀN MÀN HÌNH (STAGE 1 & STAGE 2 THEO index.html)
  // =========================================================================
  if (isCreatingTrip) {
    return (
      <section className="planner-screen">
        {/* Cột trái: Ảnh bìa và Quote phong cách Voyage với hiệu ứng crossfade */}
        <aside className="planner-side">
          <div className="planner-side-imgs">
            <img
              src="https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1400&q=88"
              alt="Voyage banner 1"
              className={`planner-side-img ${
                plannerStep === 1 ? "planner-side-img--active" : ""
              }`}
            />
            <img
              src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1400&q=88"
              alt="Voyage banner 2"
              className={`planner-side-img ${
                plannerStep === 2 ? "planner-side-img--active" : ""
              }`}
            />
          </div>
          <span
            className="planner-side-brand"
            onClick={() => setIsCreatingTrip(false)}
            role="button"
            tabIndex={0}
          >
            Voyage
          </span>
          <div className="planner-side-quote">
            <div
              className={`planner-quote-item ${
                plannerStep === 1 ? "planner-quote-item--active" : ""
              }`}
            >
              Good
              <br />
              trips better
              <br />
              people
            </div>
            <div
              className={`planner-quote-item ${
                plannerStep === 2 ? "planner-quote-item--active" : ""
              }`}
            >
              More
              <br />
              than a trip
            </div>
          </div>
        </aside>

        {/* Cột phải: Khối thao tác và form */}
        <main className="planner-main">
          {/* Thanh top bar điều hướng */}
          <div className="planner-top">
            <span
              className="planner-top-brand"
              onClick={() => setIsCreatingTrip(false)}
              role="button"
              tabIndex={0}
            >
              Voyage
            </span>
            <div className="planner-step-badge">{plannerStep} / 2</div>
            <div className="planner-progress">
              <span style={{ width: plannerStep === 1 ? "50%" : "100%" }} />
            </div>
            <div className="planner-step-name">
              {plannerStep === 1 ? "Trip details" : "Your interests"}
            </div>
            <button
              type="button"
              className="planner-close-btn"
              onClick={() => setIsCreatingTrip(false)}
              title="Quay lại danh sách chuyến đi"
            >
              <span>✕</span>
              <span>Close</span>
            </button>
          </div>

          {/* Thân planner với hiệu ứng trượt 2 màn mượt mà */}
          <div className="planner-body">
            <div className="planner-slider-viewport">
              <div
                className="planner-slider-track"
                style={{
                  transform:
                    plannerStep === 1 ? "translateX(0%)" : "translateX(-50%)",
                }}
              >
                {/* =======================================================
                   STAGE 1: Where do you want to go?
                   ======================================================= */}
                <div
                  className={`planner-step-panel ${
                    plannerStep === 1
                      ? "planner-step-panel--active"
                      : "planner-step-panel--inactive"
                  }`}
                  aria-hidden={plannerStep !== 1}
                >
                  <h1>
                    Where do you want
                    <br />
                    to go?
                  </h1>
                  <p className="planner-step-sub">Tell us a bit about your trip.</p>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (form.name.trim()) {
                        setPlannerStep(2);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }
                    }}
                  >
                    {/* Điểm đến (Destination) */}
                    <div className="planner-formrow">
                      <label>Destination</label>
                      <div className="relative w-full">
                        <div className="planner-input-box">
                          <span className="material-symbols-outlined text-[20px] text-zinc-400">
                            near_me
                          </span>
                          <input
                            type="text"
                            placeholder="e.g. Da Nang, Hanoi, Sapa, Phu Quoc..."
                            value={modalSearchQuery}
                            onChange={(e) => {
                              setModalSearchQuery(e.target.value);
                              setIsDestDropdownOpen(true);
                            }}
                            onFocus={() => setIsDestDropdownOpen(true)}
                            autoFocus
                          />
                          {modalSearchQuery && (
                            <button
                              type="button"
                              className="text-zinc-400 hover:text-zinc-700 text-sm"
                              onClick={() => setModalSearchQuery("")}
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {isDestDropdownOpen &&
                          filteredDestinations.length > 0 &&
                          modalSearchQuery && (
                            <div className="planner-autocomplete">
                              {filteredDestinations.slice(0, 7).map((d) => (
                                <button
                                  key={d.slug || d.name}
                                  type="button"
                                  className="planner-autocomplete-item"
                                  onClick={() => handleSelectDestination(d.name)}
                                >
                                  <span className="material-symbols-outlined text-[17px] text-zinc-400">
                                    location_on
                                  </span>
                                  <span>{d.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                      </div>
                    </div>

                    {/* Tên chuyến đi (Trip Name) */}
                    <div className="planner-formrow">
                      <label>Trip name</label>
                      <div className="planner-input-box">
                        <span className="material-symbols-outlined text-[20px] text-zinc-400">
                          edit
                        </span>
                        <input
                          type="text"
                          placeholder="e.g. Trip to Da Nang & Hoi An"
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          required
                        />
                      </div>
                    </div>

                    {/* Thời gian (Dates) */}
                    <div className="planner-formrow">
                      <label>Dates</label>
                      <div className="planner-dates-row">
                        <div className="planner-input-box">
                          <span className="material-symbols-outlined text-[19px] text-zinc-400">
                            calendar_today
                          </span>
                          <input
                            type="date"
                            value={form.start_date}
                            onChange={(e) => {
                              const start = e.target.value;
                              setForm((cu) => ({
                                ...cu,
                                start_date: start,
                                end_date:
                                  cu.end_date && cu.end_date < start
                                    ? start
                                    : cu.end_date,
                              }));
                            }}
                          />
                        </div>
                        <span className="planner-date-arrow">→</span>
                        <div className="planner-input-box">
                          <span className="material-symbols-outlined text-[19px] text-zinc-400">
                            event
                          </span>
                          <input
                            type="date"
                            min={form.start_date}
                            value={form.end_date}
                            onChange={(e) =>
                              setForm({ ...form, end_date: e.target.value })
                            }
                          />
                        </div>
                        <span className="planner-duration-tag">
                          {soNgay(form.start_date, form.end_date)} days
                        </span>
                      </div>
                    </div>

                    {/* Ghi chú thêm (Note - optional) */}
                    <div className="planner-formrow">
                      <label>Note (optional)</label>
                      <div className="planner-input-box">
                        <span className="material-symbols-outlined text-[20px] text-zinc-400">
                          notes
                        </span>
                        <input
                          type="text"
                          placeholder="e.g. Family vacation, street food exploration..."
                          value={form.description || ""}
                          onChange={(e) =>
                            setForm({ ...form, description: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    {/* Nút hành động Stage 1 */}
                    <div className="planner-actions">
                      <button
                        type="submit"
                        className="planner-btn"
                        disabled={!form.name.trim()}
                      >
                        <span>Next →</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* =======================================================
                   STAGE 2: What kind of experiences do you like?
                   ======================================================= */}
                <div
                  className={`planner-step-panel ${
                    plannerStep === 2
                      ? "planner-step-panel--active"
                      : "planner-step-panel--inactive"
                  }`}
                  aria-hidden={plannerStep !== 2}
                >
                  <h1>
                    What kind of experiences
                    <br />
                    do you like?
                  </h1>
                  <p className="planner-step-sub">Choose a few, we'll create a trip that fits you.</p>

                  <div className="planner-interests">
                    {EXPERIENCES.map((exp) => {
                      const active = selectedInterests.includes(exp.id);
                      return (
                        <button
                          key={exp.id}
                          type="button"
                          className={`planner-interest ${active ? "active" : ""}`}
                          onClick={() => {
                            setSelectedInterests((prev) =>
                              active
                                ? prev.filter((x) => x !== exp.id)
                                : [...prev, exp.id]
                            );
                          }}
                        >
                          <span className="check">✓</span>
                          <span className="material-symbols-outlined symbol">
                            {exp.icon}
                          </span>
                          <div>
                            <div className="planner-interest-title">
                              {exp.label}
                            </div>
                            <div className="planner-interest-desc">
                              {exp.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Nút hành động Stage 2 */}
                  <div
                    className="planner-actions"
                    style={{ justifyContent: "space-between" }}
                  >
                    <button
                      type="button"
                      className="planner-btn ghost"
                      onClick={() => {
                        setPlannerStep(1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      className="planner-btn"
                      onClick={handleCreateTrip}
                      disabled={dangLuu}
                    >
                      <span>
                        {dangLuu ? "Creating itinerary..." : "Create itinerary →"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </section>
    );
  }

  return (
    <section className="trips-screen" ref={screenRef} onScroll={handleScroll}>
      {/* 1. Hero Banner với hình nền núi đèo và Navbar */}
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
              'url("https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=2400&q=85")',
            ...heroBgStyle,
          }}
        />
        <div className="page-hero-overlay" style={heroOverlayStyle} />

        <div className="page-hero-inner tours-shell">
          {/* Top Navbar */}
          <header className="voyage-nav" style={navFadeStyle}>
            <Link to="/" className="voyage-brand">
              Voyage
            </Link>

            <nav className="voyage-navlinks">
              <Link to="/" className="voyage-navlink">
                Destinations
              </Link>
              <Link to="/tour" className="voyage-navlink">
                Tours
              </Link>
              <Link to="/chuyen-di" className="voyage-navlink voyage-navlink--active">
                Experiences
              </Link>
            </nav>

            <div className="voyage-actions">
              {/* Expandable Search Bar */}
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

          {/* Hero Content */}
          <div className="page-hero-content" style={heroContentStyle}>
            <h1>Plan your journeys</h1>
            <p>Bespoke itineraries, curated stays, and effortless routes across Vietnam.</p>
          </div>
        </div>
      </div>

      {/* 2. Floating Sticky Action Bar */}
      <div
        ref={searchbarRef}
        className={`searchbar-sticky-outer ${isSticky ? "is-sticky" : ""}`}
      >
        <div className="tours-shell">
          <div className="trips-bar">
            {/* Search within trips */}
            <div className="trips-search-box">
              <span className="material-symbols-outlined trips-search-icon">
                search
              </span>
              <input
                type="text"
                placeholder="Search trips by name or destination..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="trips-search-input"
              />
              {searchFilter && (
                <button
                  type="button"
                  className="trips-search-clear"
                  onClick={() => setSearchFilter("")}
                  aria-label="Clear filter"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Actions: Minimalist Sort Dropdown + CTA */}
            <div className="trips-bar-actions">
              <Dropdown
                variant="minimal"
                value={filterOption}
                options={[
                  { value: "recent", label: "Recently updated" },
                  { value: "upcoming", label: "Upcoming trips" },
                  { value: "name", label: "Tên chuyến (A – Z)" },
                ]}
                onChange={(val) => setFilterOption(val)}
              />

              <button
                type="button"
                onClick={startCreateTrip}
                className="trips-plan-cta"
              >
                <span className="material-symbols-outlined text-[19px]">add</span>
                <span>Plan new trip</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Content Area */}
      <div className="tours-shell trips-content-wrapper">
        {/* Guest state */}
        {!user && (
          <div className="trips-guest-hero">
            <div className="trips-guest-card">
              <div className="trips-guest-icon">
                <span className="material-symbols-outlined text-[32px]">route</span>
              </div>
              <h2>Your travel stories, organized effortlessly</h2>
              <p>
                Sign in to create, customize, and save interactive itineraries with
                AI-powered route optimization and local recommendations.
              </p>
              <div className="trips-guest-actions">
                <button
                  type="button"
                  onClick={onNeedAuth}
                  className="trips-plan-cta"
                >
                  Sign in to your account
                </button>
                <Link to="/tour" className="trips-guest-secondary-btn">
                  Explore curated tours
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {user && ds === null && (
          <div className="voyage-trips-grid pt-6">
            <CardSkeleton count={3} />
          </div>
        )}

        {/* Empty state */}
        {user && ds !== null && tripsHienThi.length === 0 && (
          <div className="trips-empty-box">
            <div className="trips-empty-icon">
              <span className="material-symbols-outlined text-[28px]">
                flight_takeoff
              </span>
            </div>
            <h3>
              {searchFilter
                ? "No matching itineraries found"
                : "No trips planned yet"}
            </h3>
            <p>
              {searchFilter
                ? "Try adjusting your search query or clear the filter."
                : "Click 'Plan new trip' to craft your first bespoke route with AI assistance."}
            </p>
            {!searchFilter && (
              <button
                type="button"
                onClick={startCreateTrip}
                className="trips-plan-cta"
              >
                <span className="material-symbols-outlined text-[19px]">add</span>
                <span>Plan your first trip</span>
              </button>
            )}
          </div>
        )}

        {/* Trips Grid */}
        {user && tripsHienThi.length > 0 && (
          <>
            <div className="trips-meta-header">
              <h2 className="trips-meta-title">Your itineraries</h2>
              <div className="trips-meta-count">
                <span>{tripsHienThi.length}</span>{" "}
                {tripsHienThi.length === 1 ? "itinerary" : "itineraries"}
              </div>
            </div>

            <div className="voyage-trips-grid">
              {tripsHienThi.map((t) => (
                <VoyageTripCard
                  key={t.id}
                  t={t}
                  user={user}
                  nav={nav}
                  xoa={xoa}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* 4. Slide-out Menu Drawer dùng chung */}
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

/**
 * Thẻ chuyến đi phong cách Voyage Luxury
 */
function VoyageTripCard({ t, user, nav, xoa }) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  const diem = (t.stops_details || []).filter((s) => s.day !== -1);
  const placesCount = diem.length;
  const diemDen = (
    t.destination ||
    (t.description || "").replace(/^Điểm đến:\s*/, "")
  ).trim();

  const imageUrl = getProvinceImage(diemDen, t.name);
  const datesStr = formatTripDates(t.start_date, t.duration_days);

  const handleShare = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}/chuyen-di/${t.id}`;
    navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!showMenu) return;
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showMenu]);

  return (
    <article
      className="voyage-trip-card"
      onClick={() => nav(`/chuyen-di/${t.id}`)}
    >
      {/* Vùng ảnh */}
      <div className="voyage-trip-card__image-wrap">
        <img
          src={imageUrl}
          alt={t.name}
          className="voyage-trip-card__image"
          loading="lazy"
        />

        {/* Badges */}
        <div className="voyage-trip-card__badge">
          <span>{t.duration_days ? `${t.duration_days} Days` : "Custom"}</span>
        </div>

        {/* Overlay buttons: Share & Options */}
        <div
          className="voyage-trip-card__overlay-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleShare}
            className="voyage-trip-card__action-btn"
            title="Share itinerary link"
          >
            <span className="material-symbols-outlined text-[16px]">
              {copied ? "check" : "ios_share"}
            </span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="voyage-trip-card__action-btn"
              title="More options"
            >
              <span className="material-symbols-outlined text-[18px]">
                more_horiz
              </span>
            </button>

            {showMenu && (
              <div className="voyage-trip-card__dropdown">
                <button
                  type="button"
                  onClick={() => nav(`/chuyen-di/${t.id}`)}
                  className="voyage-trip-card__dropdown-item"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    open_in_new
                  </span>
                  <span>Open itinerary</span>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="voyage-trip-card__dropdown-item"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    content_copy
                  </span>
                  <span>Copy link</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    setShowMenu(false);
                    xoa(t.id, e);
                  }}
                  className="voyage-trip-card__dropdown-item voyage-trip-card__dropdown-item--delete"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    delete
                  </span>
                  <span>Delete trip</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thông tin chuyến đi */}
      <div className="voyage-trip-card__body">
        <h3 className="voyage-trip-card__title" title={t.name}>
          {t.name}
        </h3>

        <div className="voyage-trip-card__meta">
          <div className="voyage-trip-card__meta-item">
            <span className="material-symbols-outlined text-[15px]">
              calendar_today
            </span>
            <span>{datesStr}</span>
          </div>
          <span className="voyage-trip-card__dot">•</span>
          <div className="voyage-trip-card__meta-item">
            <span className="material-symbols-outlined text-[15px]">
              location_on
            </span>
            <span>
              {placesCount} {placesCount <= 1 ? "place" : "places"}
            </span>
          </div>
        </div>

        <div className="voyage-trip-card__footer">
          <span className="voyage-trip-card__dest">
            <span className="material-symbols-outlined text-[15px] text-zinc-400">
              near_me
            </span>
            <span>{diemDen || "Vietnam"}</span>
          </span>
          <div className="round-go">
            <span className="material-symbols-outlined">arrow_forward</span>
          </div>
        </div>
      </div>
    </article>
  );
}
