import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../../../shared/api";
import ErrorBoundary from "../../../shared/common/ErrorBoundary";
import TripMap from "../../../shared/map/TripMap";
import PlannerContentFeed from "./PlannerContentFeed";
import PlannerRail from "./PlannerRail";
import PlannerAssistant from "../assistant/PlannerAssistant";
import "./TripPlanner.css";

const MUC_MAC_DINH = "muon-di";

function locGoiY(items) {
  const dem = {};
  const ra = [];
  for (const p of items) {
    const ten = (p.name || "").trim();
    if (!ten || /^[0-9]/.test(ten)) continue;
    const loai = p.category || "khac";
    if ((dem[loai] || 0) >= 2) continue;
    dem[loai] = (dem[loai] || 0) + 1;
    ra.push(p);
    if (ra.length >= 8) break;
  }
  return ra;
}

const cungDiem = (a, b) => a.type === b.type && String(a.id) === String(b.id);

function khoaMuc(ten) {
  const co = ten
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${co || "muc"}-${Date.now().toString(36)}`;
}

export default function TripPlanner({ user, onNeedAuth }) {
  const { id } = useParams();
  const nav = useNavigate();

  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [sections, setSections] = useState([]);

  const [activeSection, setActiveSection] = useState("overview");
  const [isRailCollapsed, setIsRailCollapsed] = useState(false);
  const [openAssistantModal, setOpenAssistantModal] = useState(false);

  const [ngayXem, setNgayXem] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [timThay, setTimThay] = useState([]);
  const [noiBat, setNoiBat] = useState(null);
  const [diemChon, setDiemChon] = useState(null);
  const [goiYNoiBat, setGoiYNoiBat] = useState([]);
  const [viTri, setViTri] = useState(null);
  const [toiUu, setToiUu] = useState(null);
  const [duongTheoNgay, setDuongTheoNgay] = useState({});
  const [loi, setLoi] = useState("");

  const [sidebarWidth, setSidebarWidth] = useState(620);
  const [isResizing, setIsResizing] = useState(false);

  const contentScrollRef = useRef(null);

  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startW = sidebarWidth;
      const onMove = (ev) =>
        setSidebarWidth(Math.max(420, Math.min(960, startW + ev.clientX - startX)));
      const onUp = () => {
        setIsResizing(false);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [sidebarWidth]
  );

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setViTri({ lon: p.coords.longitude, lat: p.coords.latitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    if (!user) {
      onNeedAuth();
      return;
    }
    api
      .itineraries()
      .then((d) => {
        const t = d.itineraries.find((x) => String(x.id) === String(id));
        if (!t) return nav("/chuyen-di");
        setTrip(t);
        setStops(t.stops_details || []);
        setSections(
          t.sections?.length
            ? t.sections
            : [{ key: MUC_MAC_DINH, name: "Places to visit" }]
        );
      })
      .catch((e) => setLoi(e.message));
  }, [id, user, onNeedAuth, nav]);

  const diemDen =
    trip?.destination ||
    (trip?.description || "").replace(/^Điểm đến:\s*/, "").trim();

  useEffect(() => {
    if (!diemDen) return;
    let huy = false;
    api
      .searchPlaces({ destination: diemDen, nhom: "tham_quan", page_size: 60 })
      .then((d) => !huy && setGoiYNoiBat(locGoiY(d.items || [])))
      .catch(() => {});
    return () => {
      huy = true;
    };
  }, [diemDen]);

  const luu = useCallback(
    async (moiStops, moiSections) => {
      if (!trip) return;
      setDangLuu(true);
      try {
        await api.updateItinerary(id, {
          name: trip.name,
          description: trip.description,
          duration_days: trip.duration_days,
          destination: trip.destination || null,
          start_date: trip.start_date || null,
          sections: moiSections,
          stops: moiStops.map((s) => ({
            day: s.day ?? null,
            type: s.type,
            id: s.id,
            section: s.section ?? null,
            role: s.role || "place",
            name: s.name || null,
            time_range: s.time_range || null,
            note: s.note || null,
            visited: Boolean(s.visited),
            cost: s.cost || null,
            reaction: s.reaction || null,
            text: s.text || null,
            items: s.items || null,
            title: s.title || null,
          })),
        });
      } catch (e) {
        setLoi(e.message);
      } finally {
        setDangLuu(false);
      }
    },
    [id, trip]
  );

  const capNhat = useCallback(
    (moiStops, moiSections) => {
      const ss = moiSections ?? sections;
      setStops(moiStops);
      if (moiSections) setSections(moiSections);
      setToiUu(null);
      luu(moiStops, ss);
    },
    [sections, luu]
  );

  async function boSungChiTiet(p) {
    const thieuDuLieu =
      !p?.name ||
      (typeof p.name === "string" && !p.name.trim()) ||
      p.lon == null ||
      p.lat == null;
    if (!thieuDuLieu) return p;

    try {
      const res = await api.place(p.type, p.id);
      const chiTiet = res?.place || res;
      if (!chiTiet?.name || chiTiet.lon == null || chiTiet.lat == null) {
        setLoi("Không tải được thông tin địa điểm này.");
        return null;
      }
      return { ...p, ...chiTiet };
    } catch {
      setLoi("Không tải được thông tin địa điểm này.");
      return null;
    }
  }

  async function themVaoMuc(p, sectionKey) {
    const cu = stops.find((s) => cungDiem(s, p) && s.role !== "lodging");
    if (cu) {
      if (cu.section === sectionKey) return;
      return capNhat(
        stops.map((s) => (s === cu ? { ...s, section: sectionKey } : s))
      );
    }
    const diem = await boSungChiTiet(p);
    if (!diem) return;
    capNhat([
      ...stops,
      {
        type: diem.type,
        id: diem.id,
        name: diem.name,
        lon: diem.lon,
        lat: diem.lat,
        category: diem.category,
        dia_chi: diem.dia_chi,
        mo_ta: diem.mo_ta,
        section: sectionKey,
        day: null,
        role: "place",
      },
    ]);
  }

  async function xepVaoNgay(p, day) {
    const cu = stops.find((s) => cungDiem(s, p) && s.role !== "lodging");
    if (cu) return capNhat(stops.map((s) => (s === cu ? { ...s, day } : s)));

    const diem = await boSungChiTiet(p);
    if (!diem) return;
    capNhat([
      ...stops,
      {
        type: diem.type,
        id: diem.id,
        name: diem.name,
        lon: diem.lon,
        lat: diem.lat,
        category: diem.category,
        dia_chi: diem.dia_chi,
        mo_ta: diem.mo_ta,
        section: sections[0]?.key || MUC_MAC_DINH,
        day,
        role: "place",
      },
    ]);
  }

  const boKhoiNgay = (s) =>
    capNhat(stops.map((x) => (x === s ? { ...x, day: null } : x)));
  const xoaHan = (s) => capNhat(stops.filter((x) => x !== s));

  function datChoNgu(p, day) {
    const con = stops.filter((s) => !(s.day === day && s.role === "lodging"));
    capNhat([
      ...con,
      {
        type: p.type,
        id: p.id,
        name: p.name,
        lon: p.lon,
        lat: p.lat,
        category: p.category,
        dia_chi: p.dia_chi,
        section: null,
        day,
        role: "lodging",
      },
    ]);
  }

  const boChoNgu = (day) =>
    capNhat(stops.filter((s) => !(s.day === day && s.role === "lodging")));

  function sapXepLaiTrongNgay(s, viTriMoi) {
    if (!s || s.day == null) return;
    const cungNgay = stops.filter(
      (x) => x.day === s.day && x.role !== "lodging"
    );
    const cuIdx = cungNgay.findIndex(
      (x) => cungDiem(x, s) || x === s
    );
    const targetIdx =
      typeof viTriMoi === "number"
        ? viTriMoi
        : cungNgay.findIndex((x) => cungDiem(x, viTriMoi) || x === viTriMoi);

    if (
      cuIdx < 0 ||
      targetIdx < 0 ||
      targetIdx >= cungNgay.length ||
      cuIdx === targetIdx
    ) {
      return;
    }

    const moiCungNgay = [...cungNgay];
    const [diemKeo] = moiCungNgay.splice(cuIdx, 1);
    moiCungNgay.splice(targetIdx, 0, diemKeo);

    let k = 0;
    const moiStops = stops.map((item) => {
      if (item.day === s.day && item.role !== "lodging") {
        const thay = moiCungNgay[k];
        k++;
        return thay;
      }
      return item;
    });

    capNhat(moiStops);
  }

  function themMuc(ten) {
    const t = ten.trim();
    if (!t) return;
    capNhat(stops, [...sections, { key: khoaMuc(t), name: t }]);
  }

  function doiTenMuc(key, ten) {
    const t = ten.trim();
    if (!t) return;
    capNhat(
      stops,
      sections.map((m) => (m.key === key ? { ...m, name: t } : m))
    );
  }

  function xoaMuc(key) {
    const moiStops = stops.flatMap((s) =>
      s.section !== key ? [s] : s.day ? [{ ...s, section: null }] : []
    );
    capNhat(moiStops, sections.filter((m) => m.key !== key));
  }

  function capNhatStop(stop, updates) {
    const moi = stops.map((s) => (cungDiem(s, stop) ? { ...s, ...updates } : s));
    capNhat(moi, sections);
  }

  function themNoteVaoNgay(ngay) {
    const newStop = {
      type: "note",
      id: `note_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      role: "note",
      day: ngay,
      text: "",
    };
    capNhat([...stops, newStop], sections);
  }

  function themChecklistVaoNgay(ngay) {
    const newStop = {
      type: "checklist",
      id: `chk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      role: "checklist",
      day: ngay,
      title: "Check list",
      items: [
        { id: `i_${Date.now()}_1`, text: "Item 1", checked: false },
        { id: `i_${Date.now()}_2`, text: "Item 2", checked: false },
      ],
    };
    capNhat([...stops, newStop], sections);
  }

  async function toiUuNgay(ngay) {
    setDangLuu(true);
    setLoi("");
    try {
      const d = await api.optimizeItinerary(id, ngay);
      setStops(d.stops_details || []);
      const thongKeNgay = (d.thong_ke || []).find((item) => item.day === ngay);
      setToiUu(thongKeNgay || null);
      if (!thongKeNgay) {
        setLoi("Cần ít nhất 3 địa điểm có toạ độ để sắp tuyến cho ngày này.");
      }
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangLuu(false);
    }
  }

  const cacNgay = useMemo(
    () => Array.from({ length: trip?.duration_days || 1 }, (_, k) => k + 1),
    [trip]
  );

  const theoNgay = useMemo(() => {
    const g = {};
    for (const d of cacNgay) g[d] = [];
    stops
      .filter((s) => s.role !== "lodging" && s.day)
      .forEach((s) => (g[s.day] ||= []).push(s));
    return g;
  }, [stops, cacNgay]);

  const choNguTheoNgay = useMemo(() => {
    const g = {};
    stops
      .filter((s) => s.role === "lodging" && s.day)
      .forEach((s) => (g[s.day] = s));
    return g;
  }, [stops]);

  const theoMuc = useMemo(() => {
    const g = {};
    for (const m of sections) g[m.key] = [];
    stops
      .filter((s) => s.role !== "lodging" && s.section)
      .forEach((s) => (g[s.section] ||= []).push(s));
    return g;
  }, [stops, sections]);

  const chuaXep = useMemo(
    () => stops.filter((s) => s.role !== "lodging" && !s.day),
    [stops]
  );

  function phanBoTuDong() {
    if (!chuaXep.length || !cacNgay.length) return;
    const moi = [...stops];
    chuaXep.forEach((s, idx) => {
      const ngayDich = cacNgay[idx % cacNgay.length];
      const j = moi.findIndex((x) => cungDiem(x, s) && x.role !== "lodging");
      if (j >= 0) moi[j] = { ...moi[j], day: ngayDich };
    });
    capNhat(moi, sections);
  }

  // =========================================================================
  // SCROLLSPY: Tự động cập nhật activeSection trên PlannerRail khi người dùng cuộn
  // =========================================================================
  useEffect(() => {
    const el = contentScrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const scrollPos = el.scrollTop;
      const sectionIds = [
        "overview",
        "overview-explore",
        "overview-reservations",
        "overview-places",
        ...sections.slice(1).map((s) => `section-${s.key}`),
        "itinerary-section",
        ...cacNgay.map((d) => `day-${d}`),
        "budget-section",
      ];

      let current = "overview";
      for (const sId of sectionIds) {
        const secEl = document.getElementById(sId);
        if (secEl) {
          const topOffset = secEl.offsetTop - el.offsetTop;
          if (scrollPos >= topOffset - 140) {
            current = sId;
          }
        }
      }
      setActiveSection(current);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [sections, cacNgay]);

  // Cuộn mượt khi click vào mục trên PlannerRail
  const handleRailNavigate = (targetId) => {
    setActiveSection(targetId);
    const targetEl = document.getElementById(targetId);
    if (targetEl && contentScrollRef.current) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  if (!user) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-10 text-sm text-zinc-500">
        Đăng nhập để mở chuyến đi.
      </main>
    );
  }

  if (!trip) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-400 gap-2">
        <i className="fa-solid fa-circle-notch fa-spin text-lg" />
        <span>Đang mở chuyến đi...</span>
      </div>
    );
  }

  return (
    <main className="trip-planner">
      {/* ====================================================================
          TOP NAVBAR CHUẨN WANDERLOG (ảnh w1.png - w5.png)
          ==================================================================== */}
      <header className="trip-planner__header">
        <div className="trip-planner__header-left">
          {/* Logo Wanderlog / Nút quay lại */}
          <button
            onClick={() => nav("/chuyen-di")}
            aria-label="Về danh sách chuyến"
            className="trip-planner__logo-btn"
            title="Quay lại danh sách chuyến đi"
          >
            <div className="trip-planner__logo-mark">
              <span className="material-symbols-outlined text-[20px] text-[#ff5a36]">
                all_inclusive
              </span>
            </div>
          </button>

          {/* Trạng thái SAVED */}
          <div className="trip-planner__saved-badge">
            <span>SAVED</span>
          </div>

          {/* Nút Undo / Redo */}
          <div className="trip-planner__history-actions">
            <button
              type="button"
              className="trip-planner__history-btn"
              title="Hoàn tác (Undo)"
              onClick={() => {}}
            >
              <span className="material-symbols-outlined text-[18px]">undo</span>
              <span>Undo</span>
            </button>
            <button
              type="button"
              className="trip-planner__history-btn"
              title="Làm lại (Redo)"
              onClick={() => {}}
            >
              <span className="material-symbols-outlined text-[18px]">redo</span>
              <span>Redo</span>
            </button>
          </div>
        </div>

        <div className="trip-planner__header-right">
          {/* Nút Trip plan ▾ */}
          <button
            type="button"
            className="trip-planner__plan-menu-btn"
            onClick={() => {}}
          >
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            <span>Trip plan</span>
            <span className="material-symbols-outlined text-[16px]">arrow_drop_down</span>
          </button>

          {/* Nút Share đen bo tròn */}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              alert("Đã sao chép đường dẫn chuyến đi!");
            }}
            className="trip-planner__share-btn"
          >
            <span className="material-symbols-outlined text-[18px]">reply</span>
            <span>Share</span>
          </button>

          {/* Các nút view icons (ảnh, danh sách, menu) */}
          <button
            type="button"
            className="trip-planner__header-icon-btn"
            title="Bộ sưu tập ảnh"
          >
            <span className="material-symbols-outlined text-[19px]">photo_library</span>
          </button>
          <button
            type="button"
            className="trip-planner__header-icon-btn"
            title="Dạng danh sách"
          >
            <span className="material-symbols-outlined text-[19px]">format_list_bulleted</span>
          </button>
          <button
            type="button"
            className="trip-planner__header-icon-btn"
            title="Thao tác khác"
          >
            <span className="material-symbols-outlined text-[19px]">more_horiz</span>
          </button>
        </div>
      </header>

      {loi && (
        <p className="trip-planner__alert">
          <span>{loi}</span>
          <button onClick={() => setLoi("")} className="trip-planner__alert-close">
            <i className="fa-solid fa-xmark" />
          </button>
        </p>
      )}

      {/* ====================================================================
          THÂN WORKSPACE: PlannerRail (Cột 1) | 1 Dải Content (Cột 2) | Map (Cột 4)
          ==================================================================== */}
      <div
        className={`trip-planner__body ${isResizing ? "select-none" : ""}`}
        style={{
          gridTemplateColumns: isRailCollapsed
            ? `0px ${sidebarWidth}px 12px 1fr`
            : `210px ${sidebarWidth}px 12px 1fr`,
        }}
      >
        {/* 1. PLANNER RAIL: Sidebar điều hướng Wanderlog */}
        <PlannerRail
          sections={sections}
          theoMuc={theoMuc}
          cacNgay={cacNgay}
          theoNgay={theoNgay}
          startDate={trip.start_date}
          activeSection={activeSection}
          onNavigate={handleRailNavigate}
          onOpenAssistant={() => setOpenAssistantModal(true)}
          onToggleSidebar={() => setIsRailCollapsed(!isRailCollapsed)}
          isCollapsed={isRailCollapsed}
        />

        {/* 2. DẢI NỘI DUNG DÀI (Continuous Feed) */}
        <section
          className="trip-planner__content"
          ref={contentScrollRef}
        >
          <PlannerContentFeed
            trip={trip}
            stops={stops}
            sections={sections}
            theoMuc={theoMuc}
            cacNgay={cacNgay}
            theoNgay={theoNgay}
            choNguTheoNgay={choNguTheoNgay}
            chuaXep={chuaXep}
            diemDen={diemDen}
            goiY={goiYNoiBat}
            dangLuu={dangLuu}
            toiUu={toiUu}
            duongTheoNgay={duongTheoNgay}
            ngayChon={null}
            onXep={xepVaoNgay}
            onBoNgay={boKhoiNgay}
            onXoaDiem={xoaHan}
            onThemVaoMuc={themVaoMuc}
            onThemMuc={themMuc}
            onDoiTenMuc={doiTenMuc}
            onXoaMuc={xoaMuc}
            onDatChoNgu={datChoNgu}
            onBoChoNgu={boChoNgu}
            onSapXepLai={sapXepLaiTrongNgay}
            onToiUu={toiUuNgay}
            onCapNhatStop={capNhatStop}
            onThemNote={themNoteVaoNgay}
            onThemChecklist={themChecklistVaoNgay}
            onAutoAssign={phanBoTuDong}
            onXem={setDiemChon}
            onPick={setNoiBat}
            onResults={setTimThay}
            nav={nav}
          />
        </section>

        {/* 3. RESIZER CHIA ĐỘ RỘNG GIỮA CONTENT VÀ BẢN ĐỒ */}
        <div
          onMouseDown={startResize}
          className={`trip-planner__resizer group ${
            isResizing ? "trip-planner__resizer--dragging" : ""
          }`}
          title="Kéo để đổi độ rộng"
        >
          <div className="trip-planner__resizer-line" />
        </div>

        {/* 4. CỘT BẢN ĐỒ & TRỢ LÝ AI */}
        <section className="trip-planner__map-container">
          <ErrorBoundary ten="Bản đồ">
            <TripMap
              stops={stops}
              focusDay={ngayXem}
              timThay={timThay}
              noiBat={noiBat}
              diemChon={diemChon}
              onThem={(place) => themVaoMuc(place, sections[0]?.key || MUC_MAC_DINH)}
              onXemChiTiet={(place) => nav(`/dia-diem/${place.type}/${place.id}`)}
              onDayRoutes={setDuongTheoNgay}
            />
          </ErrorBoundary>
          <PlannerAssistant
            destination={diemDen}
            location={viTri}
            onResults={setTimThay}
            onFocus={setDiemChon}
            onAdd={(place) => themVaoMuc(place, sections[0]?.key || MUC_MAC_DINH)}
          />
        </section>
      </div>
    </main>
  );
}
