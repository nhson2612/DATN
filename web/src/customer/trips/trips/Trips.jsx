import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../../shared/api";
import Dropdown from "../../../shared/common/Dropdown";
import CardSkeleton from "../../../shared/skeletons/CardSkeleton";
import { getProvinceImage } from "./provinceImages";
import AppNavbar from "../../../shared/layout/AppNavbar";
import { AuraMascotSvg } from "../../tours/components/TourEmptyState";
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

const SORT_OPTIONS = [
  { value: "recent", label: "Mới tạo nhất", icon: "schedule" },
  { value: "oldest", label: "Cũ nhất", icon: "history" },
  { value: "upcoming", label: "Sắp khởi hành", icon: "flight_takeoff" },
  { value: "name_asc", label: "Tên chuyến (A → Z)", icon: "arrow_downward" },
  { value: "name_desc", label: "Tên chuyến (Z → A)", icon: "arrow_upward" },
  { value: "duration_desc", label: "Thời lượng (Dài nhất)", icon: "calendar_month" },
  { value: "duration_asc", label: "Thời lượng (Ngắn nhất)", icon: "calendar_today" },
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

  function handleQuickStartDestination(destName) {
    if (!user) {
      onNeedAuth?.();
      return;
    }
    setIsCreatingTrip(true);
    setPlannerStep(1);
    setSelectedInterests(["nature", "food", "culture"]);
    const baseForm = khoiTaoForm();
    const cleanName = destName.replace(/^(Thành phố|Tỉnh)\s+/i, "");
    setForm({
      ...baseForm,
      name: `Chuyến đi ${cleanName}`,
    });
    setModalSearchQuery(destName);
    setIsDestDropdownOpen(false);
  }

  function handleSelectDestination(destName) {
    const cleanName = destName.replace(/^(Thành phố|Tỉnh)\s+/i, "");
    setForm((cu) => ({
      ...cu,
      name: `Chuyến đi ${cleanName}`,
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
      nav(`/trips/${d.id}`);
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
  const tripsHienThi = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    return [...(ds || [])]
      .filter((t) => {
        if (!searchFilter.trim()) return true;
        const term = searchFilter.toLowerCase();
        return (
          (t.name || "").toLowerCase().includes(term) ||
          (t.destination || "").toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        if (filterOption === "oldest") {
          return (a.id || 0) - (b.id || 0);
        }
        if (filterOption === "name" || filterOption === "name_asc") {
          const cmp = (a.name || "").localeCompare(b.name || "", "vi", { sensitivity: "base" });
          if (cmp !== 0) return cmp;
          return (b.id || 0) - (a.id || 0);
        }
        if (filterOption === "name_desc") {
          const cmp = (b.name || "").localeCompare(a.name || "", "vi", { sensitivity: "base" });
          if (cmp !== 0) return cmp;
          return (b.id || 0) - (a.id || 0);
        }
        if (filterOption === "upcoming") {
          const getScore = (item) => {
            if (!item.start_date) return Infinity; // Không có ngày -> xếp sau cùng
            const t = new Date(item.start_date).getTime();
            if (isNaN(t)) return Infinity;
            const diff = t - todayMs;
            if (diff >= 0) return diff; // Sắp tới trong tương lai: gần nhất lên đầu
            return 1e14 + (todayMs - t); // Quá khứ: sau tương lai
          };
          const scoreA = getScore(a);
          const scoreB = getScore(b);
          if (scoreA !== scoreB) return scoreA - scoreB;
          return (b.id || 0) - (a.id || 0);
        }
        if (filterOption === "duration_desc") {
          const diff = (b.duration_days || 1) - (a.duration_days || 1);
          if (diff !== 0) return diff;
          return (b.id || 0) - (a.id || 0);
        }
        if (filterOption === "duration_asc") {
          const diff = (a.duration_days || 1) - (b.duration_days || 1);
          if (diff !== 0) return diff;
          return (b.id || 0) - (a.id || 0);
        }
        // "recent" (Mới tạo nhất)
        return (b.id || 0) - (a.id || 0);
      });
  }, [ds, searchFilter, filterOption]);

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
    <div className="sky-page trips-page-root">
      {/* 1. Thanh điều hướng đồng bộ toàn hệ thống */}
      <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />

      {/* 2. Tiêu đề trang & Giới thiệu */}
      <main className="trips-main-container tours-shell">
        <header className="trips-header-banner">
          <div className="trips-header-copy">
            <span className="trips-header-eyebrow">AURA VOYAGE • LỊCH TRÌNH CÁ NHÂN</span>
            <h1 className="trips-header-title">Lập Lịch Trình Chuyến Đi</h1>
            <p className="trips-header-desc">
              Tự do kiến tạo hành trình, tối ưu hóa cung đường và lưu lại những kỷ niệm đáng nhớ khắp Việt Nam.
            </p>
          </div>
        </header>

        {/* 3. Thanh tìm kiếm và bộ lọc chuyến đi */}
        <div className="trips-bar-wrapper">
          <div className="trips-bar">
            {/* Search within trips */}
            <div className="trips-search-box">
              <span className="material-symbols-outlined trips-search-icon">
                search
              </span>
              <input
                type="text"
                placeholder="Tìm kiếm chuyến đi theo tên hoặc điểm đến..."
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
                align="right"
                prefixIcon={
                  <span className="material-symbols-outlined text-[17px] text-slate-500">
                    swap_vert
                  </span>
                }
                value={filterOption}
                options={SORT_OPTIONS}
                onChange={(val) => setFilterOption(val)}
              />

              <button
                type="button"
                onClick={startCreateTrip}
                className="trips-plan-cta"
              >
                <span className="material-symbols-outlined text-[19px]">add</span>
                <span>Lên Lịch Ngay</span>
              </button>
            </div>
          </div>
        </div>

        {/* 4. Main Content Area */}
        <div className="trips-content-wrapper">
          {/* Guest state */}
          {!user && (
            <div className="tour-empty-state-card trips-empty-state-card" role="region" aria-label="Chưa đăng nhập">
              <div className="empty-mascot-container">
                <img
                  src="/images/aura-mascot.png"
                  alt="Linh vật du lịch Aura Voyage"
                  className="empty-mascot-img"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const next = e.currentTarget.nextElementSibling;
                    if (next) next.style.display = "block";
                  }}
                />
                <div style={{ display: "none" }}>
                  <AuraMascotSvg width={180} height={180} className="empty-mascot-graphic" />
                </div>
              </div>

              <div className="empty-content-box">
                <span className="empty-kicker-tag">LỊCH TRÌNH CÁ NHÂN HÓA</span>
                <h3 className="empty-title">Lên kế hoạch hành trình dễ dàng & trực quan</h3>
                <p className="empty-desc">
                  Đăng nhập để tự do thiết kế lịch trình theo ngày, tối ưu hóa cung đường di chuyển trên bản đồ số và lưu lại các điểm đến yêu thích khắp Việt Nam.
                </p>

                <div className="empty-action-group">
                  <button
                    type="button"
                    onClick={onNeedAuth}
                    className="empty-reset-btn"
                  >
                    <span>Lên Lịch Ngay</span>
                  </button>
                  <Link to="/tour" className="trips-empty-secondary-btn">
                    <span>Khám phá Tour trọn gói</span>
                  </Link>
                </div>

                <div className="empty-suggestions-tray">
                  <span className="empty-suggestions-label">Gợi ý điểm đến:</span>
                  <div className="empty-chips-wrap">
                    {["Hạ Long", "Đà Nẵng", "Phú Quốc", "Sa Pa", "Nha Trang", "Đà Lạt"].map(
                      (city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handleQuickStartDestination(city)}
                          className="empty-suggest-chip"
                        >
                          {city}
                        </button>
                      )
                    )}
                  </div>
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
            <div className="tour-empty-state-card trips-empty-state-card" role="region" aria-label="Chưa có lịch trình">
              <div className="empty-mascot-container">
                <img
                  src="/images/aura-mascot.png"
                  alt="Linh vật du lịch Aura Voyage"
                  className="empty-mascot-img"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const next = e.currentTarget.nextElementSibling;
                    if (next) next.style.display = "block";
                  }}
                />
                <div style={{ display: "none" }}>
                  <AuraMascotSvg width={180} height={180} className="empty-mascot-graphic" />
                </div>
              </div>

              <div className="empty-content-box">
                <span className="empty-kicker-tag">
                  {searchFilter ? "CHƯA TÌM THẤY CHUYẾN ĐI" : "CHƯA CÓ LỊCH TRÌNH"}
                </span>
                <h3 className="empty-title">
                  {searchFilter
                    ? "Không tìm thấy lịch trình phù hợp"
                    : "Bạn chưa có lịch trình chuyến đi nào"}
                </h3>
                <p className="empty-desc">
                  {searchFilter
                    ? "Từ khóa tìm kiếm hiện tại chưa khớp với chuyến đi nào đã lưu. Bạn có thể đặt lại từ khóa hoặc tạo một lịch trình mới bên dưới."
                    : "Chỉ mất vài giây để khởi tạo một chuyến đi mới. Chọn điểm đến yêu thích bên dưới để bắt đầu thiết kế lộ trình của riêng bạn."}
                </p>

                <div className="empty-action-group">
                  {searchFilter ? (
                    <button
                      type="button"
                      onClick={() => setSearchFilter("")}
                      className="empty-reset-btn"
                    >
                      <span>Xóa bộ lọc tìm kiếm</span>
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startCreateTrip}
                        className="empty-reset-btn"
                      >
                        <span>+ Lên Lịch Ngay</span>
                      </button>
                      <Link to="/tour" className="trips-empty-secondary-btn">
                        <span>Tham khảo Tour trọn gói</span>
                      </Link>
                    </>
                  )}
                </div>

                <div className="empty-suggestions-tray">
                  <span className="empty-suggestions-label">Chọn nhanh điểm đến:</span>
                  <div className="empty-chips-wrap">
                    {["Hạ Long", "Đà Nẵng", "Phú Quốc", "Sa Pa", "Nha Trang", "Đà Lạt"].map(
                      (city) => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => handleQuickStartDestination(city)}
                          className="empty-suggest-chip"
                        >
                          {city}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Trips Grid */}
          {user && tripsHienThi.length > 0 && (
            <>
              <div className="trips-meta-header">
                <h2 className="trips-meta-title">Lịch trình của bạn</h2>
                <div className="trips-meta-count">
                  <span>{tripsHienThi.length}</span> chuyến đi
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
      </main>
    </div>
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
    const url = `${window.location.origin}/trips/${t.id}`;
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
      onClick={() => nav(`/trips/${t.id}`)}
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
          <span>{t.duration_days ? `${t.duration_days} Ngày` : "Tùy chỉnh"}</span>
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
            title="Chia sẻ liên kết lịch trình"
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
              title="Tùy chọn khác"
            >
              <span className="material-symbols-outlined text-[18px]">
                more_horiz
              </span>
            </button>

            {showMenu && (
              <div className="voyage-trip-card__dropdown">
                <button
                  type="button"
                  onClick={() => nav(`/trips/${t.id}`)}
                  className="voyage-trip-card__dropdown-item"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    open_in_new
                  </span>
                  <span>Mở lịch trình</span>
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
