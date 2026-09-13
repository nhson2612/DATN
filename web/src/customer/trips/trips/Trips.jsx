import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../shared/api";
import CardSkeleton from "../../../shared/skeletons/CardSkeleton";
import { getProvinceImage } from "./provinceImages";
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
 * Định dạng ngày theo chuẩn Wanderlog: Sep 11 – 14 hoặc Sep 2 – Oct 15 (ảnh rhr.png)
 */
function formatTripDates(startDate, durationDays) {
  if (!startDate) return `${durationDays || 1} ngày`;
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + Math.max(0, (durationDays || 1) - 1));

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
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

export default function Trips({ user, onNeedAuth }) {
  const [ds, setDs] = useState(null);
  const [dangTao, setDangTao] = useState(false);
  const [destinations, setDestinations] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOption, setFilterOption] = useState("recent"); // 'recent' | 'upcoming' | 'name'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [form, setForm] = useState(() => khoiTaoForm());
  const filterRef = useRef(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!user) {
      onNeedAuth();
      setDs([]);
      return;
    }
    api.itineraries().then((d) => setDs(d.itineraries)).catch(() => setDs([]));
    api.destinations(60)
      .then((res) => setDestinations(res?.destinations || (Array.isArray(res) ? res : [])))
      .catch(() => setDestinations([]));
  }, [user]);

  // Click outside cho dropdown filter
  useEffect(() => {
    if (!showFilterDropdown) return;
    const handleOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showFilterDropdown]);

  function startCreateTrip() {
    if (!user) {
      onNeedAuth();
      return;
    }
    setDangTao(true);
    setSearchQuery("");
    setForm(khoiTaoForm());
  }

  function handleSelectDestination(destName) {
    const cleanName = destName.replace(/^(Thành phố|Tỉnh)\s+/i, "");
    setForm((cu) => ({ ...cu, name: `Trip to ${cleanName}` }));
    setSearchQuery(destName);
  }

  async function tao(e) {
    e?.preventDefault();
    if (!form.name.trim()) return;
    const dest = searchQuery.trim();
    const d = await api.saveItinerary({
      name: form.name.trim(),
      description: "",
      destination: dest || null,
      start_date: form.start_date || null,
      duration_days: soNgay(form.start_date, form.end_date),
      sections: [{ key: "muon-di", name: "Địa điểm muốn đi" }],
      stops: [],
    });
    nav(`/chuyen-di/${d.id}`);
  }

  async function xoa(id, e) {
    e?.stopPropagation?.();
    if (!confirm("Xoá chuyến đi này?")) return;
    await api.deleteItinerary(id);
    setDs((cu) => cu.filter((x) => x.id !== id));
  }

  const filteredDestinations = destinations.filter((d) =>
    (d.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sắp xếp danh sách chuyến đi theo bộ lọc
  const tripsHienThi = [...(ds || [])].sort((a, b) => {
    if (filterOption === "name") {
      return (a.name || "").localeCompare(b.name || "");
    }
    if (filterOption === "upcoming") {
      const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
      const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
      return dateA - dateB;
    }
    // Mặc định 'recent'
    return (b.id || 0) - (a.id || 0);
  });

  return (
    <main className="wander-trips-page">
      {/* 1. Header chính chuẩn phong cách Wanderlog (ảnh rhr.png) */}
      <div className="wander-trips-page__top-row">
        <h1 className="wander-trips-page__title">Recently viewed and upcoming</h1>
        <button
          type="button"
          onClick={startCreateTrip}
          className="wander-trips-page__plan-btn"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Plan new trip</span>
        </button>
      </div>

      {/* 2. Dòng bộ lọc sắp xếp: Recently viewed ▾ */}
      <div className="wander-trips-page__filter-row" ref={filterRef}>
        <button
          type="button"
          onClick={() => setShowFilterDropdown(!showFilterDropdown)}
          className="wander-trips-page__filter-btn"
        >
          <span>
            {filterOption === "recent"
              ? "Recently viewed"
              : filterOption === "upcoming"
              ? "Upcoming trips"
              : "A – Z"}
          </span>
          <span className="material-symbols-outlined text-[18px] text-zinc-500">
            arrow_drop_down
          </span>
        </button>

        {showFilterDropdown && (
          <div className="wander-trips-page__filter-dropdown animate-in fade-in zoom-in-95 duration-100">
            <button
              type="button"
              onClick={() => {
                setFilterOption("recent");
                setShowFilterDropdown(false);
              }}
              className={`wander-trips-page__filter-item ${
                filterOption === "recent" ? "active" : ""
              }`}
            >
              Recently viewed
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterOption("upcoming");
                setShowFilterDropdown(false);
              }}
              className={`wander-trips-page__filter-item ${
                filterOption === "upcoming" ? "active" : ""
              }`}
            >
              Upcoming trips
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterOption("name");
                setShowFilterDropdown(false);
              }}
              className={`wander-trips-page__filter-item ${
                filterOption === "name" ? "active" : ""
              }`}
            >
              Tên chuyến (A – Z)
            </button>
          </div>
        )}
      </div>

      {/* Modal tạo chuyến mới (Plan new trip) */}
      {dangTao && (
        <div className="trips-modal-overlay" onClick={() => setDangTao(false)}>
          <div className="trips-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="trips-modal-header">
              <h2 className="trips-modal-heading">Plan a new trip</h2>
              <button
                type="button"
                onClick={() => setDangTao(false)}
                className="trips-modal-close"
                title="Đóng"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <form onSubmit={tao} className="trips-modal-body space-y-4">
              <div className="relative">
                <label className="trips-form-label">Điểm đến</label>
                <div className="relative">
                  <span className="material-symbols-outlined trips-modal-icon">
                    location_on
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm thành phố (Hà Nội, Đà Nẵng, Sa Pa)..."
                    className="trips-modal-input trips-modal-input--with-icon"
                  />
                </div>

                {filteredDestinations.length > 0 &&
                  searchQuery &&
                  searchQuery !== form.name.replace("Trip to ", "").replace("Du lịch ", "") && (
                    <div className="trips-dropdown-list">
                      {filteredDestinations.slice(0, 6).map((d) => (
                        <button
                          key={d.slug || d.name}
                          type="button"
                          onClick={() => handleSelectDestination(d.name)}
                          className="trips-dropdown-item"
                        >
                          <span className="material-symbols-outlined text-[16px] text-zinc-400">
                            pin_drop
                          </span>
                          <span>{d.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
              </div>

              <div>
                <label className="trips-form-label">Tên chuyến đi</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ví dụ: Trip to Hanoi"
                  className="trips-modal-input"
                />
              </div>

              <div className="trips-modal-dates">
                <div>
                  <label className="trips-form-label">Ngày bắt đầu</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => {
                      const start = e.target.value;
                      setForm((cu) => ({
                        ...cu,
                        start_date: start,
                        end_date:
                          cu.end_date && cu.end_date < start ? start : cu.end_date,
                      }));
                    }}
                    className="trips-modal-input"
                  />
                </div>
                <div>
                  <label className="trips-form-label">Ngày kết thúc</label>
                  <input
                    type="date"
                    min={form.start_date}
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                    className="trips-modal-input"
                  />
                </div>
              </div>

              <p className="trips-modal-hint">
                Chuyến đi {soNgay(form.start_date, form.end_date)} ngày.
              </p>

              <div className="trips-modal-footer">
                <button
                  type="button"
                  onClick={() => setDangTao(false)}
                  className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:text-zinc-900 rounded-full"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={!form.name.trim()}
                  className="wander-trips-page__plan-btn"
                >
                  Tạo chuyến đi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trạng thái chưa đăng nhập */}
      {!user && (
        <div className="trips-empty">
          <span className="trips-empty__icon">
            <span className="material-symbols-outlined text-[36px]">travel_explore</span>
          </span>
          <h2 className="trips-empty__title">Chuyến đi được lưu theo tài khoản</h2>
          <p className="trips-empty__desc">
            Đăng nhập để xem các chuyến đi và lịch trình của bạn.
          </p>
          <button onClick={onNeedAuth} className="wander-trips-page__plan-btn">
            Đăng nhập
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {user && ds === null && (
        <div className="wander-trips-grid">
          <CardSkeleton count={4} />
        </div>
      )}

      {/* Danh sách rỗng */}
      {user && ds?.length === 0 && (
        <div className="trips-empty">
          <span className="trips-empty__icon">
            <span className="material-symbols-outlined text-[36px]">flight_takeoff</span>
          </span>
          <h2 className="trips-empty__title">No trips planned yet</h2>
          <p className="trips-empty__desc">
            Bấm vào nút "Plan new trip" để bắt đầu lên lịch trình cho chuyến đi tiếp theo của bạn!
          </p>
          <button onClick={startCreateTrip} className="wander-trips-page__plan-btn">
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Plan new trip</span>
          </button>
        </div>
      )}

      {/* 3. Lưới danh sách thẻ chuyến đi chuẩn phong cách Wanderlog (ảnh rhr.png) */}
      {!!ds?.length && (
        <div className="wander-trips-grid">
          {tripsHienThi.map((t) => (
            <TheChuyen key={t.id} t={t} user={user} nav={nav} xoa={xoa} />
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * Thẻ chuyến đi đơn lẻ chuẩn phong cách Wanderlog (ảnh rhr.png)
 */
function TheChuyen({ t, user, nav, xoa }) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  const diem = (t.stops_details || []).filter((s) => s.day !== -1);
  const placesCount = diem.length;
  const diemDen = (t.destination || (t.description || "").replace(/^Điểm đến:\s*/, "")).trim();

  // Lấy ảnh Wikimedia mặc định theo tỉnh thành
  const imageUrl = getProvinceImage(diemDen, t.name);

  // Chữ cái đầu của người dùng cho avatar
  const userInitial = (
    user?.full_name ||
    user?.name ||
    user?.email ||
    "S"
  )[0].toUpperCase();

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
      className="wander-trip-card"
      onClick={() => nav(`/chuyen-di/${t.id}`)}
    >
      {/* Vùng ảnh Wikimedia với overlay buttons (ảnh rhr.png) */}
      <div className="wander-trip-card__image-wrap">
        <img
          src={imageUrl}
          alt={t.name}
          className="wander-trip-card__image"
          loading="lazy"
        />

        {/* Nút tác vụ nổi trên ảnh: Share & Three dots */}
        <div
          className="wander-trip-card__overlay-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={handleShare}
            className="wander-trip-card__share-btn"
            title="Chia sẻ liên kết chuyến đi"
          >
            <span className="material-symbols-outlined text-[15px]">
              {copied ? "check" : "ios_share"}
            </span>
            <span>{copied ? "Copied" : "Share"}</span>
          </button>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="wander-trip-card__more-btn"
              title="Tuỳ chọn khác"
            >
              <span className="material-symbols-outlined text-[18px]">
                more_horiz
              </span>
            </button>

            {showMenu && (
              <div className="wander-trip-card__menu-dropdown animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => nav(`/chuyen-di/${t.id}`)}
                  className="wander-trip-card__menu-item"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    open_in_new
                  </span>
                  <span>Mở chuyến đi</span>
                </button>
                <button
                  type="button"
                  onClick={handleShare}
                  className="wander-trip-card__menu-item"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    content_copy
                  </span>
                  <span>Sao chép liên kết</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    setShowMenu(false);
                    xoa(t.id, e);
                  }}
                  className="wander-trip-card__menu-item wander-trip-card__menu-item--delete"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    delete
                  </span>
                  <span>Xoá chuyến đi</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thông tin chuyến đi bên dưới ảnh (ảnh rhr.png) */}
      <div className="wander-trip-card__body">
        <h3 className="wander-trip-card__title" title={t.name}>
          {t.name}
        </h3>

        <div className="wander-trip-card__meta">
          <span className="wander-trip-card__avatar">{userInitial}</span>
          <span className="wander-trip-card__bullet">•</span>
          <span className="wander-trip-card__dates">{datesStr}</span>
          <span className="wander-trip-card__bullet">•</span>
          <span className="wander-trip-card__places">
            {placesCount} {placesCount <= 1 ? "place" : "places"}
          </span>
        </div>
      </div>
    </article>
  );
}
