import { useMemo, useState } from "react";
import { getProvinceImage } from "../trips/provinceImages";
import { dinhDangKhoangNgay, dongPhu } from "./plannerUtils";
import PlannerDay from "./PlannerDay";
import PlannerPlacePicker from "./PlannerPlacePicker";
import "./PlannerContentFeed.css";

function formatMoney(amount) {
  if (!amount) return "đ0";
  return `đ${Number(amount).toLocaleString("vi-VN")}`;
}

export default function PlannerContentFeed({
  trip,
  stops = [],
  sections = [],
  theoMuc = {},
  cacNgay = [],
  theoNgay = {},
  choNguTheoNgay = {},
  chuaXep = [],
  diemDen = "",
  goiY = [],
  dangLuu = false,
  toiUu = null,
  duongTheoNgay = {},
  ngayChon: _ngayChon = null,
  onXep,
  onBoNgay,
  onXoaDiem,
  onThemVaoMuc,
  onThemMuc,
  onDoiTenMuc: _onDoiTenMuc,
  onXoaMuc,
  onDatChoNgu,
  onBoChoNgu,
  onSapXepLai,
  onToiUu,
  onCapNhatStop,
  onThemNote,
  onThemChecklist,
  onAutoAssign,
  onXem,
  onPick: _onPick,
  onResults: _onResults,
  nav,
}) {
  // Trạng thái đóng/mở các mục
  const [openExplore, setOpenExplore] = useState(true);
  const [openPlacesToVisit, setOpenPlacesToVisit] = useState(true);
  const [openExpenses, setOpenExpenses] = useState(true);
  const [openCustomSections, setOpenCustomSections] = useState({});

  // Trạng thái thêm danh sách mới (+ New list)
  const [dangThemList, setDangThemList] = useState(false);
  const [tenListMoi, setTenListMoi] = useState("");

  // Trạng thái mở picker cho Places to visit
  const [moPickerOverview, setMoPickerOverview] = useState(false);
  const [moPickerSection, setMoPickerSection] = useState({});

  // Modal thêm chi phí / ngân sách
  const [moModalExpense, setMoModalExpense] = useState(false);
  const [tenExpense, setTenExpense] = useState("");
  const [soTienExpense, setSoTienExpense] = useState("");
  const [_nganSachMucTieu, setNganSachMucTieu] = useState(trip?.budget || 0);
  const [moModalBudget, setMoModalBudget] = useState(false);
  const [nganSachNhap, setNganSachNhap] = useState(trip?.budget || "");

  // Trạng thái ngày đang mở trong Itinerary
  const [expandedDays, setExpandedDays] = useState(() => {
    const init = {};
    cacNgay.forEach((d) => {
      init[d] = true; // Mở sẵn để cuộn mượt như w3, w4
    });
    return init;
  });

  const toggleDay = (ngay) => {
    setExpandedDays((prev) => ({
      ...prev,
      [ngay]: !prev[ngay],
    }));
  };

  // Ảnh bìa mặc định theo tỉnh thành hoặc cover_url
  const coverPhoto = useMemo(() => {
    if (trip?.cover_url) return trip.cover_url;
    return getProvinceImage(diemDen, trip?.name);
  }, [trip, diemDen]);

  // Danh sách các điểm thuộc Places to visit (mục đầu tiên hoặc chưa xếp lịch)
  const placesToVisitStops = useMemo(() => {
    const defaultSectionKey = sections[0]?.key;
    if (defaultSectionKey && theoMuc[defaultSectionKey]) {
      return theoMuc[defaultSectionKey];
    }
    return chuaXep;
  }, [sections, theoMuc, chuaXep]);

  // Tính tổng chi phí hiện tại từ stops
  const tongChiPhi = useMemo(() => {
    return stops.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);
  }, [stops]);

  const handleThemExpense = (e) => {
    e?.preventDefault();
    if (!tenExpense.trim() || !soTienExpense) return;
    const costNum = Number(soTienExpense) || 0;
    const newStop = {
      type: "expense",
      id: `exp_${Date.now()}`,
      role: "note",
      name: tenExpense.trim(),
      cost: costNum,
      day: null,
      section: sections[0]?.key || "muon-di",
    };
    onThemVaoMuc(newStop, sections[0]?.key || "muon-di");
    setTenExpense("");
    setSoTienExpense("");
    setMoModalExpense(false);
  };

  const handleLuuBudget = (e) => {
    e?.preventDefault();
    setNganSachMucTieu(Number(nganSachNhap) || 0);
    setMoModalBudget(false);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="planner-feed">
      {/* ====================================================================
          1. HERO & COVER PHOTO + FLOATING TRIP CARD (ảnh w1.png)
          ==================================================================== */}
      <section id="overview" className="planner-feed__hero-section">
        <div className="planner-feed__cover-wrap">
          <img
            src={coverPhoto}
            alt={trip?.name || "Ảnh bìa chuyến đi"}
            className="planner-feed__cover-img"
            loading="eager"
          />
          <div className="planner-feed__cover-gradient" />
          <button
            type="button"
            className="planner-feed__cover-edit-btn"
            title="Đổi ảnh bìa chuyến đi"
            onClick={() => {
              const url = window.prompt("Nhập link ảnh bìa mới:", coverPhoto);
              if (url && url !== coverPhoto && onCapNhatStop) {
                // Có thể cập nhật cover nếu API hỗ trợ
              }
            }}
          >
            <span className="material-symbols-outlined text-[17px]">edit</span>
          </button>
        </div>

        {/* Thẻ nổi thông tin chuyến đi (Floating Card) */}
        <div className="planner-feed__floating-card">
          <h1 className="planner-feed__trip-title">
            {trip?.name || "Trip to " + (diemDen || "Vietnam")}
          </h1>

          <div className="planner-feed__floating-meta-row">
            {/* Pill ngày 9/11 - 9/14 */}
            <span className="planner-feed__date-pill">
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              <span>{dinhDangKhoangNgay(trip?.start_date, trip?.duration_days)}</span>
            </span>

            {/* Avatar người dùng & nút add collaborator */}
            <div className="planner-feed__collaborators">
              <div className="planner-feed__avatar-circle" title="Người lên lịch">
                <span>{(trip?.destination || "S")[0].toUpperCase()}</span>
              </div>
              <button
                type="button"
                className="planner-feed__add-user-btn"
                title="Mời bạn đồng hành vào chuyến đi"
                onClick={() => {
                  navigator.clipboard?.writeText(window.location.href);
                  alert("Đã sao chép link chia sẻ chuyến đi vào bộ nhớ tạm!");
                }}
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ====================================================================
          2. EXPLORE SECTION (ảnh w1.png)
          ==================================================================== */}
      <section id="overview-explore" className="planner-feed__section planner-feed__explore">
        <div
          className="planner-feed__section-header"
          onClick={() => setOpenExplore(!openExplore)}
        >
          <div className="planner-feed__section-header-left">
            <span className="planner-feed__header-chevron">
              <i className={`fa-solid ${openExplore ? "fa-chevron-down" : "fa-chevron-right"}`} />
            </span>
            <h2 className="planner-feed__section-title">Explore</h2>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenExplore(true);
            }}
            className="planner-feed__browse-all-btn"
          >
            Browse all
          </button>
        </div>

        {openExplore && goiY && goiY.length > 0 && (
          <div className="planner-feed__explore-body">
            <div className="planner-feed__explore-carousel">
              {goiY.slice(0, 6).map((item) => (
                <div key={`${item.type}-${item.id}`} className="planner-feed__explore-card">
                  <div className="planner-feed__explore-card-img-wrap">
                    {item.hinh_anh ? (
                      <img
                        src={item.hinh_anh}
                        alt={item.name}
                        className="planner-feed__explore-card-img"
                      />
                    ) : (
                      <div className="planner-feed__explore-card-placeholder">
                        <span className="material-symbols-outlined">explore</span>
                      </div>
                    )}
                  </div>
                  <div className="planner-feed__explore-card-content">
                    <h4 className="planner-feed__explore-card-name" title={item.name}>
                      {item.name}
                    </h4>
                    <p className="planner-feed__explore-card-sub">{dongPhu(item)}</p>
                    <button
                      type="button"
                      onClick={() => onThemVaoMuc(item, sections[0]?.key || "muon-di")}
                      className="planner-feed__explore-card-add-btn"
                    >
                      <span className="material-symbols-outlined text-[15px]">add</span>
                      <span>Lưu địa điểm</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ====================================================================
          3. RESERVATIONS & ATTACHMENTS + BUDGETING ROW (ảnh w1.png)
          ==================================================================== */}
      <section id="overview-reservations" className="planner-feed__cards-row">
        {/* Card 1: Reservations and attachments */}
        <div className="planner-feed__res-card">
          <h3 className="planner-feed__res-card-title">Reservations and attachments</h3>
          <div className="planner-feed__res-icons-grid">
            <button
              type="button"
              className="planner-feed__res-icon-item"
              onClick={() => alert("Quản lý vé máy bay")}
            >
              <div className="planner-feed__res-circle">
                <span className="material-symbols-outlined text-[20px]">flight</span>
              </div>
              <span className="planner-feed__res-label">Flight</span>
            </button>

            <button
              type="button"
              className="planner-feed__res-icon-item"
              onClick={() => scrollToSection("day-1")}
            >
              <div className="planner-feed__res-circle">
                <span className="material-symbols-outlined text-[20px]">hotel</span>
              </div>
              <span className="planner-feed__res-label">Lodging</span>
            </button>

            <button
              type="button"
              className="planner-feed__res-icon-item"
              onClick={() => alert("Quản lý thuê xe")}
            >
              <div className="planner-feed__res-circle">
                <span className="material-symbols-outlined text-[20px]">directions_car</span>
              </div>
              <span className="planner-feed__res-label">Rental car</span>
            </button>

            <button
              type="button"
              className="planner-feed__res-icon-item"
              onClick={() => alert("Quản lý vé tàu hoả")}
            >
              <div className="planner-feed__res-circle">
                <span className="material-symbols-outlined text-[20px]">train</span>
              </div>
              <span className="planner-feed__res-label">Train</span>
            </button>

            <button
              type="button"
              className="planner-feed__res-icon-item"
              onClick={() => alert("Thêm tệp đính kèm mới")}
            >
              <div className="planner-feed__res-circle relative">
                <span className="material-symbols-outlined text-[20px]">attach_file</span>
                <span className="planner-feed__res-star-badge">★</span>
              </div>
              <span className="planner-feed__res-label">Attachment</span>
            </button>

            <button
              type="button"
              className="planner-feed__res-icon-item"
              onClick={() => alert("Các loại đặt chỗ khác")}
            >
              <div className="planner-feed__res-circle">
                <span className="material-symbols-outlined text-[20px]">more_horiz</span>
              </div>
              <span className="planner-feed__res-label">Other</span>
            </button>
          </div>
        </div>

        {/* Card 2: Budgeting Quick Card */}
        <div className="planner-feed__budget-quick-card">
          <h3 className="planner-feed__res-card-title">Budgeting</h3>
          <div className="planner-feed__budget-quick-body">
            <span className="planner-feed__budget-quick-val">
              {formatMoney(tongChiPhi)}
            </span>
            <button
              type="button"
              onClick={() => scrollToSection("budget-section")}
              className="planner-feed__budget-quick-link"
            >
              View details
            </button>
          </div>
        </div>
      </section>

      {/* ====================================================================
          4. PLACES TO VISIT (ảnh w1.png, w2.png)
          ==================================================================== */}
      <section id="overview-places" className="planner-feed__section planner-feed__places-to-visit">
        <div
          className="planner-feed__section-header"
          onClick={() => setOpenPlacesToVisit(!openPlacesToVisit)}
        >
          <div className="planner-feed__section-header-left">
            <span className="planner-feed__header-chevron">
              <i
                className={`fa-solid ${
                  openPlacesToVisit ? "fa-chevron-down" : "fa-chevron-right"
                }`}
              />
            </span>
            <h2 className="planner-feed__section-title">Places to visit</h2>
            <span className="planner-feed__section-badge">
              {placesToVisitStops.length}
            </span>
          </div>

          <div className="planner-feed__section-header-right">
            {onAutoAssign && placesToVisitStops.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAutoAssign();
                }}
                className="planner-feed__auto-assign-btn"
                title="Tự động chia đều các địa điểm vào các ngày"
              >
                <span className="material-symbols-outlined text-[15px]">auto_awesome</span>
                <span>Chia đều theo ngày</span>
              </button>
            )}
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="planner-feed__more-btn"
            >
              <i className="fa-solid fa-ellipsis" />
            </button>
          </div>
        </div>

        {openPlacesToVisit && (
          <div className="planner-feed__places-body">
            {/* Danh sách các địa điểm với blue teardrop pins 1, 2, 3, 4 (ảnh w1, w2) */}
            <div className="planner-feed__stops-list">
              {placesToVisitStops.map((stop, idx) => (
                <div
                  key={`${stop.type}-${stop.id}`}
                  className="planner-feed__stop-card"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      "application/json",
                      JSON.stringify({ type: stop.type, id: stop.id })
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }}
                >
                  <div className="planner-feed__stop-marker-col">
                    <span className="planner-feed__blue-pin">
                      {idx + 1}
                    </span>
                  </div>

                  <div className="planner-feed__stop-content">
                    <div className="planner-feed__stop-main">
                      <button
                        type="button"
                        onClick={() => onXem && onXem(stop)}
                        className="planner-feed__stop-name"
                      >
                        {stop.name}
                      </button>
                      {dongPhu(stop) && (
                        <p className="planner-feed__stop-sub">{dongPhu(stop)}</p>
                      )}
                    </div>

                    <div className="planner-feed__stop-actions">
                      {/* Chọn xếp vào ngày */}
                      <select
                        value=""
                        onChange={(e) => {
                          const dayVal = Number(e.target.value);
                          if (dayVal) onXep(stop, dayVal);
                        }}
                        className="planner-feed__stop-day-select"
                        title="Xếp vào ngày"
                      >
                        <option value="" disabled>
                          + Xếp vào ngày...
                        </option>
                        {cacNgay.map((d) => (
                          <option key={d} value={d}>
                            Ngày {d}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => onXoaDiem && onXoaDiem(stop)}
                        className="planner-feed__stop-del-btn"
                        title="Xoá khỏi danh sách"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ô tìm kiếm: Add a place (ảnh w2.png) */}
            <div className="planner-feed__add-place-box">
              {moPickerOverview ? (
                <div className="planner-feed__picker-container">
                  <PlannerPlacePicker
                    diemDen={diemDen}
                    nhan="Tìm địa điểm, quán ăn hoặc chỗ tham quan..."
                    moSan
                    onChon={(p) => {
                      onThemVaoMuc(p, sections[0]?.key || "muon-di");
                      setMoPickerOverview(false);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setMoPickerOverview(false)}
                    className="planner-feed__picker-close"
                  >
                    Đóng
                  </button>
                </div>
              ) : (
                <div
                  className="planner-feed__search-trigger-pill"
                  onClick={() => setMoPickerOverview(true)}
                >
                  <span className="material-symbols-outlined planner-feed__pin-icon">
                    location_on
                  </span>
                  <span className="planner-feed__search-placeholder">Add a place</span>
                  <div className="planner-feed__pill-actions">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoPickerOverview(true);
                      }}
                      className="planner-feed__pill-icon-btn"
                      title="Ghi chú"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        note_stack
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMoPickerOverview(true);
                      }}
                      className="planner-feed__pill-icon-btn"
                      title="Checklist"
                    >
                      <span className="material-symbols-outlined text-[17px]">
                        checklist
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Recommended places carousel (ảnh w2.png) */}
            {goiY && goiY.length > 0 && (
              <div className="planner-feed__recommended-wrap">
                <div className="planner-feed__rec-header">
                  <span className="material-symbols-outlined text-[16px] text-slate-400">
                    keyboard_arrow_down
                  </span>
                  <span className="planner-feed__rec-title">Recommended places</span>
                </div>

                <div className="planner-feed__rec-carousel">
                  {goiY.slice(0, 8).map((p) => (
                    <div key={`${p.type}-${p.id}`} className="planner-feed__rec-card">
                      <div className="planner-feed__rec-card-thumb">
                        {p.hinh_anh ? (
                          <img src={p.hinh_anh} alt={p.name} />
                        ) : (
                          <div className="planner-feed__rec-thumb-placeholder">
                            <span className="material-symbols-outlined text-[18px]">
                              photo_camera
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="planner-feed__rec-card-name" title={p.name}>
                        {p.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => onThemVaoMuc(p, sections[0]?.key || "muon-di")}
                        className="planner-feed__rec-add-btn"
                        title="Thêm vào danh sách"
                      >
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Đường gạch ngang kèm nút + ở giữa (ảnh w2.png) */}
            <div className="planner-feed__center-divider">
              <button
                type="button"
                onClick={() => setMoPickerOverview(true)}
                className="planner-feed__center-plus-btn"
                title="Thêm địa điểm"
              >
                <i className="fa-solid fa-plus" />
              </button>
            </div>
          </div>
        )}

        {/* Các danh sách tuỳ chọn thêm (ví dụ: Hotel, Nhà hàng...) */}
        {sections.slice(1).map((sec) => {
          const isSecOpen = openCustomSections[sec.key] !== false;
          const secStops = theoMuc[sec.key] || [];

          return (
            <div
              key={sec.key}
              id={`section-${sec.key}`}
              className="planner-feed__custom-section"
            >
              <div
                className="planner-feed__section-header"
                onClick={() =>
                  setOpenCustomSections((prev) => ({
                    ...prev,
                    [sec.key]: !isSecOpen,
                  }))
                }
              >
                <div className="planner-feed__section-header-left">
                  <span className="planner-feed__header-chevron">
                    <i
                      className={`fa-solid ${
                        isSecOpen ? "fa-chevron-down" : "fa-chevron-right"
                      }`}
                    />
                  </span>
                  <h3 className="planner-feed__section-title">{sec.name}</h3>
                  <span className="planner-feed__section-badge">
                    {secStops.length} places
                  </span>
                </div>
                <div className="planner-feed__section-header-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.confirm(`Xoá mục "${sec.name}"?`)) {
                        onXoaMuc(sec.key);
                      }
                    }}
                    className="planner-feed__more-btn text-rose-500 hover:text-rose-700"
                    title="Xoá mục này"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              {isSecOpen && (
                <div className="planner-feed__places-body">
                  <div className="planner-feed__stops-list">
                    {secStops.map((stop, idx) => (
                      <div
                        key={`${stop.type}-${stop.id}`}
                        className="planner-feed__stop-card"
                      >
                        <div className="planner-feed__stop-marker-col">
                          <span className="planner-feed__blue-pin">{idx + 1}</span>
                        </div>
                        <div className="planner-feed__stop-content">
                          <div className="planner-feed__stop-main">
                            <span className="planner-feed__stop-name">{stop.name}</span>
                            {dongPhu(stop) && (
                              <p className="planner-feed__stop-sub">{dongPhu(stop)}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onXoaDiem && onXoaDiem(stop)}
                            className="planner-feed__stop-del-btn"
                          >
                            <span className="material-symbols-outlined text-[16px]">
                              close
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="planner-feed__add-place-box">
                    {moPickerSection[sec.key] ? (
                      <div className="planner-feed__picker-container">
                        <PlannerPlacePicker
                          diemDen={diemDen}
                          nhan={`Thêm địa điểm vào ${sec.name}...`}
                          moSan
                          onChon={(p) => {
                            onThemVaoMuc(p, sec.key);
                            setMoPickerSection((prev) => ({ ...prev, [sec.key]: false }));
                          }}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setMoPickerSection((prev) => ({ ...prev, [sec.key]: false }))
                          }
                          className="planner-feed__picker-close"
                        >
                          Đóng
                        </button>
                      </div>
                    ) : (
                      <div
                        className="planner-feed__search-trigger-pill"
                        onClick={() =>
                          setMoPickerSection((prev) => ({ ...prev, [sec.key]: true }))
                        }
                      >
                        <span className="material-symbols-outlined planner-feed__pin-icon">
                          location_on
                        </span>
                        <span className="planner-feed__search-placeholder">
                          Add a place
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Nút + New list đỏ san hô (ảnh w2.png) */}
        <div className="planner-feed__new-list-row">
          {dangThemList ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (tenListMoi.trim()) {
                  onThemMuc(tenListMoi.trim());
                  setTenListMoi("");
                  setDangThemList(false);
                }
              }}
              className="planner-feed__new-list-form"
            >
              <input
                autoFocus
                type="text"
                value={tenListMoi}
                onChange={(e) => setTenListMoi(e.target.value)}
                placeholder="Tên danh sách mới (e.g., Restaurants, Hotel)..."
                className="planner-feed__new-list-input"
              />
              <button type="submit" className="planner-feed__new-list-submit">
                Thêm danh sách
              </button>
              <button
                type="button"
                onClick={() => setDangThemList(false)}
                className="planner-feed__new-list-cancel"
              >
                Huỷ
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setDangThemList(true)}
              className="planner-feed__new-list-btn"
            >
              <span className="material-symbols-outlined text-[17px]">add</span>
              <span>New list</span>
            </button>
          )}
        </div>
      </section>

      {/* ====================================================================
          5. ITINERARY SECTION (ảnh w3.png, w4.png)
          ==================================================================== */}
      <section id="itinerary-section" className="planner-feed__itinerary-section">
        {/* Header lớn của Itinerary kèm Date badge (ảnh w3) */}
        <div className="planner-feed__itinerary-big-header">
          <h2 className="planner-feed__itinerary-title">Itinerary</h2>
          <span className="planner-feed__itinerary-date-badge">
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            <span>{dinhDangKhoangNgay(trip?.start_date, trip?.duration_days)}</span>
          </span>
        </div>

        {/* Danh sách các ngày tuần tự Day 1..N */}
        <div className="planner-feed__days-container">
          {cacNgay.map((ngay) => (
            <div key={ngay} id={`day-${ngay}`} className="planner-feed__day-block">
              <PlannerDay
                ngay={ngay}
                startDate={trip?.start_date}
                diemDen={diemDen}
                ds={theoNgay[ngay] || []}
                choNgu={choNguTheoNgay[ngay]}
                chuaXep={chuaXep}
                isExpanded={Boolean(expandedDays[ngay])}
                onToggleExpand={() => toggleDay(ngay)}
                onHover={() => {}}
                onXep={onXep}
                onBoNgay={onBoNgay}
                onSapXepLai={onSapXepLai}
                onXem={onXem}
                onDatChoNgu={onDatChoNgu}
                onBoChoNgu={onBoChoNgu}
                onToiUu={() => onToiUu(ngay)}
                dangLuu={dangLuu}
                toiUu={toiUu?.day === ngay ? toiUu : null}
                duong={duongTheoNgay?.[ngay] || null}
                onCapNhatStop={onCapNhatStop}
                onThemNote={onThemNote}
                onThemChecklist={onThemChecklist}
                nav={nav}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ====================================================================
          6. BUDGETING SECTION (ảnh w4.png, w5.png)
          ==================================================================== */}
      <section id="budget-section" className="planner-feed__section planner-feed__budgeting-section">
        <div className="planner-feed__budget-head-row">
          <h2 className="planner-feed__section-title text-[28px] font-extrabold text-slate-900">
            Budgeting
          </h2>
          <button
            type="button"
            onClick={() => setMoModalExpense(true)}
            className="planner-feed__add-expense-btn"
          >
            <span className="material-symbols-outlined text-[17px]">add</span>
            <span>Add expense</span>
          </button>
        </div>

        {/* Khối card xám lớn tóm tắt ngân sách (ảnh w5.png) */}
        <div className="planner-feed__budget-summary-box">
          <div className="planner-feed__budget-sum-left">
            <span className="planner-feed__budget-sum-amount">
              {formatMoney(tongChiPhi)}
            </span>
            <div className="planner-feed__budget-sum-actions">
              <button
                type="button"
                onClick={() => setMoModalBudget(true)}
                className="planner-feed__budget-pill-action"
              >
                <span className="material-symbols-outlined text-[15px]">edit</span>
                <span>Set budget</span>
              </button>
              <button
                type="button"
                onClick={() => alert("Tính năng chia tiền nhóm (Group balances)")}
                className="planner-feed__budget-pill-action"
              >
                <span className="material-symbols-outlined text-[15px]">receipt_long</span>
                <span>Group balances</span>
              </button>
            </div>
          </div>

          <div className="planner-feed__budget-sum-right">
            <button
              type="button"
              onClick={() => alert("Báo cáo phân bổ chi tiêu")}
              className="planner-feed__budget-link-row"
            >
              <span className="material-symbols-outlined text-[18px]">table_chart</span>
              <span>View breakdown</span>
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                alert("Đã sao chép link mời bạn đồng hành!");
              }}
              className="planner-feed__budget-link-row"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              <span>Add tripmate</span>
            </button>
            <button
              type="button"
              onClick={() => alert("Cài đặt tiền tệ & ngân sách")}
              className="planner-feed__budget-link-row"
            >
              <span className="material-symbols-outlined text-[18px]">settings</span>
              <span>Settings</span>
            </button>
          </div>
        </div>

        {/* Phần danh sách chi phí Expenses (ảnh w5.png) */}
        <div className="planner-feed__expenses-block">
          <div
            className="planner-feed__expenses-header"
            onClick={() => setOpenExpenses(!openExpenses)}
          >
            <div className="planner-feed__section-header-left">
              <span className="planner-feed__header-chevron">
                <i
                  className={`fa-solid ${
                    openExpenses ? "fa-chevron-down" : "fa-chevron-right"
                  }`}
                />
              </span>
              <h3 className="planner-feed__expenses-title">Expenses</h3>
            </div>

            <div className="planner-feed__sort-wrap">
              <span className="planner-feed__sort-label">Sort: Date (newest first)</span>
              <i className="fa-solid fa-caret-down text-slate-400 text-xs" />
            </div>
          </div>

          {openExpenses && (
            <div className="planner-feed__expenses-body">
              {stops.filter((s) => s.cost > 0 || s.type === "expense").length === 0 ? (
                <p className="planner-feed__expenses-empty">
                  You haven’t added any expenses yet.
                </p>
              ) : (
                <div className="planner-feed__expenses-list">
                  {stops
                    .filter((s) => s.cost > 0 || s.type === "expense")
                    .map((s) => (
                      <div key={`${s.type}-${s.id}`} className="planner-feed__expense-item">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{s.name}</p>
                          <p className="text-xs text-slate-400">
                            {s.day ? `Ngày ${s.day}` : "Chưa xếp ngày"}
                          </p>
                        </div>
                        <span className="font-bold text-slate-900 text-sm">
                          {formatMoney(s.cost)}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* MODAL THÊM EXPENSE */}
      {moModalExpense && (
        <div className="planner-feed__modal-overlay">
          <div className="planner-feed__modal-box">
            <h3 className="text-base font-bold text-slate-800 mb-3">Thêm khoản chi tiêu</h3>
            <form onSubmit={handleThemExpense} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Nội dung chi tiêu
                </label>
                <input
                  autoFocus
                  type="text"
                  value={tenExpense}
                  onChange={(e) => setTenExpense(e.target.value)}
                  placeholder="Vé tham quan, Ăn trưa, Đi taxi..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Số tiền (VNĐ)
                </label>
                <input
                  type="number"
                  value={soTienExpense}
                  onChange={(e) => setSoTienExpense(e.target.value)}
                  placeholder="50000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setMoModalExpense(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#141a1f] hover:bg-[#232e36] rounded-lg shadow-sm"
                >
                  Lưu khoản chi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ĐẶT NGÂN SÁCH (SET BUDGET) */}
      {moModalBudget && (
        <div className="planner-feed__modal-overlay">
          <div className="planner-feed__modal-box">
            <h3 className="text-base font-bold text-slate-800 mb-3">Cài đặt ngân sách</h3>
            <form onSubmit={handleLuuBudget} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tổng ngân sách dự kiến (VNĐ)
                </label>
                <input
                  autoFocus
                  type="number"
                  value={nganSachNhap}
                  onChange={(e) => setNganSachNhap(e.target.value)}
                  placeholder="5000000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setMoModalBudget(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-[#141a1f] hover:bg-[#232e36] rounded-lg shadow-sm"
                >
                  Cập nhật ngân sách
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
