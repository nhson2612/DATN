import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import ErrorBoundary from "../components/common/ErrorBoundary";
import TripMap from "../components/map/TripMap";
import PlannerLichTrinh from "./planner/PlannerLichTrinh";
import PlannerRail from "./planner/PlannerRail";
import PlannerTongQuan from "./planner/PlannerTongQuan";
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
  const [muc, setMuc] = useState("tong-quan");
  const [ngayChon, setNgayChon] = useState(null);
  const [mucChon, setMucChon] = useState(null);

  const [ngayXem, setNgayXem] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [timThay, setTimThay] = useState([]);
  const [noiBat, setNoiBat] = useState(null);
  const [diemChon, setDiemChon] = useState(null);
  const [goiYNoiBat, setGoiYNoiBat] = useState([]);
  const [viTri, setViTri] = useState(null);
  const [toiUu, setToiUu] = useState(null);
  const [duong, setDuong] = useState(null);
  const [dangVe, setDangVe] = useState(null);
  const [loi, setLoi] = useState("");

  const [sidebarWidth, setSidebarWidth] = useState(600);
  const [isResizing, setIsResizing] = useState(false);

  const ngayRefs = useRef({});
  const sectionRefs = useRef({});

  const startResize = useCallback(
    (e) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startW = sidebarWidth;
      const onMove = (ev) =>
        setSidebarWidth(Math.max(380, Math.min(900, startW + ev.clientX - startX)));
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
            : [{ key: MUC_MAC_DINH, name: "Địa điểm muốn đi" }]
        );
      })
      .catch((e) => setLoi(e.message));
  }, [id, user]);

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
      setDuong(null);
      luu(moiStops, ss);
    },
    [sections, luu]
  );

  function themVaoMuc(p, sectionKey) {
    const cu = stops.find((s) => cungDiem(s, p) && s.role !== "lodging");
    if (cu) {
      if (cu.section === sectionKey) return;
      return capNhat(
        stops.map((s) => (s === cu ? { ...s, section: sectionKey } : s))
      );
    }
    capNhat([
      ...stops,
      {
        type: p.type,
        id: p.id,
        name: p.name,
        lon: p.lon,
        lat: p.lat,
        category: p.category,
        dia_chi: p.dia_chi,
        mo_ta: p.mo_ta,
        section: sectionKey,
        day: null,
        role: "place",
      },
    ]);
  }

  function xepVaoNgay(p, day) {
    const cu = stops.find((s) => cungDiem(s, p) && s.role !== "lodging");
    if (cu) return capNhat(stops.map((s) => (s === cu ? { ...s, day } : s)));
    capNhat([
      ...stops,
      {
        type: p.type,
        id: p.id,
        name: p.name,
        lon: p.lon,
        lat: p.lat,
        category: p.category,
        dia_chi: p.dia_chi,
        mo_ta: p.mo_ta,
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

  function chuyen(s, huong) {
    const cungNgay = stops.filter(
      (x) => x.day === s.day && x.role !== "lodging"
    );
    const i = cungNgay.indexOf(s);
    const j = i + huong;
    if (j < 0 || j >= cungNgay.length) return;
    const a = stops.indexOf(cungNgay[i]);
    const b = stops.indexOf(cungNgay[j]);
    const moi = [...stops];
    [moi[a], moi[b]] = [moi[b], moi[a]];
    capNhat(moi);
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

  async function toiUuNgay(ngay) {
    setDangLuu(true);
    setLoi("");
    try {
      const d = await api.optimizeItinerary(id, ngay);
      setStops(d.stops_details || []);
      setToiUu(d.thong_ke?.[0] || null);
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangLuu(false);
    }
  }

  async function veDuongThat(ngay) {
    const ds = stops.filter(
      (s) => s.day === ngay && s.role !== "lodging" && s.lon != null
    );
    const choNgu = stops.find((s) => s.day === ngay && s.role === "lodging");
    const chuoi = choNgu ? [choNgu, ...ds, choNgu] : ds;
    if (chuoi.length < 2) return;
    setDangVe(ngay);
    setLoi("");
    const doan = [];
    let met = 0;
    try {
      for (let i = 0; i < chuoi.length - 1; i++) {
        const d = await api.route({
          start_lon: chuoi[i].lon,
          start_lat: chuoi[i].lat,
          end_lon: chuoi[i + 1].lon,
          end_lat: chuoi[i + 1].lat,
        });
        met += d.total_distance_meters || 0;
        d.path.forEach((c) =>
          doan.push({
            type: "Feature",
            properties: { name: c.street_name },
            geometry: c.geom,
          })
        );
      }
      setDuong({ day: ngay, doan, met, isClosed: !!choNgu });
    } catch (e) {
      setLoi(`Không tính được đường cho ngày ${ngay}: ${e.message}`);
    } finally {
      setDangVe(null);
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

  if (!user)
    return (
      <main className="max-w-6xl mx-auto px-4 py-10 text-sm text-zinc-500">
        Đăng nhập để mở chuyến đi.
      </main>
    );
  if (!trip)
    return (
      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="skeleton h-96 rounded-card" />
      </main>
    );

  const soDiem = stops.filter((s) => s.role !== "lodging").length;

  function toiMuc(key) {
    setMuc("tong-quan");
    setMucChon(key);
    setNgayChon(null);
    requestAnimationFrame(() =>
      sectionRefs.current[key]?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      })
    );
  }

  function toiNgay(ngay) {
    setMuc("lich-trinh");
    setNgayChon(ngay);
    setMucChon(null);
    requestAnimationFrame(() =>
      ngayRefs.current[ngay]?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      })
    );
  }

  return (
    <main className="trip-planner">
      <header className="trip-planner__header">
        <button
          onClick={() => nav("/chuyen-di")}
          title="Về danh sách chuyến"
          className="trip-planner__back-btn"
        >
          <i className="fa-solid fa-arrow-left text-xs" />
        </button>
        <div className="trip-planner__info">
          <h1 className="trip-planner__title">{trip.name}</h1>
          <p className="trip-planner__subtitle">
            {diemDen && <>{diemDen.replace(/^(Thành phố|Tỉnh)\s+/i, "")} · </>}
            {soDiem} địa điểm · {trip.duration_days} ngày
          </p>
        </div>
        <span
          className={`trip-planner__save ${
            dangLuu ? "trip-planner__save--busy" : ""
          }`}
        >
          <i
            className={`fa-solid ${
              dangLuu ? "fa-arrows-rotate" : "fa-cloud-arrow-up"
            }`}
          />
          {dangLuu ? "Đang lưu" : "Đã lưu"}
        </span>
      </header>

      {loi && (
        <p className="trip-planner__alert">
          <span>{loi}</span>
          <button onClick={() => setLoi("")} className="trip-planner__alert-close">
            <i className="fa-solid fa-xmark" />
          </button>
        </p>
      )}

      <div
        className={`trip-planner__body ${isResizing ? "select-none" : ""}`}
        style={{ gridTemplateColumns: `210px ${sidebarWidth}px 12px 1fr` }}
      >
        <PlannerRail
          sections={sections}
          theoMuc={theoMuc}
          cacNgay={cacNgay}
          theoNgay={theoNgay}
          startDate={trip.start_date}
          muc={muc}
          mucChon={mucChon}
          ngayChon={ngayChon}
          onMuc={toiMuc}
          onNgay={toiNgay}
          onTongQuan={() => {
            setMuc("tong-quan");
            setMucChon(null);
            setNgayChon(null);
          }}
        />

        <section className="pane">
          {muc === "tong-quan" ? (
            <PlannerTongQuan
              trip={trip}
              diemDen={diemDen}
              viTri={viTri}
              sections={sections}
              theoMuc={theoMuc}
              goiY={goiYNoiBat}
              sectionRefs={sectionRefs}
              onResults={setTimThay}
              onPick={setNoiBat}
              onThemVaoMuc={themVaoMuc}
              onXoa={xoaHan}
              onBoNgay={boKhoiNgay}
              onXem={setDiemChon}
              onThemMuc={themMuc}
              onDoiTenMuc={doiTenMuc}
              onXoaMuc={xoaMuc}
              nav={nav}
            />
          ) : (
            <PlannerLichTrinh
              trip={trip}
              cacNgay={cacNgay}
              theoNgay={theoNgay}
              choNguTheoNgay={choNguTheoNgay}
              chuaXep={chuaXep}
              diemDen={diemDen}
              ngayRefs={ngayRefs}
              onHover={(d) => setNgayXem(d)}
              onXep={xepVaoNgay}
              onBoNgay={boKhoiNgay}
              onChuyen={chuyen}
              onXem={setDiemChon}
              onDatChoNgu={datChoNgu}
              onBoChoNgu={boChoNgu}
              onToiUu={toiUuNgay}
              dangLuu={dangLuu}
              toiUu={toiUu}
              onVeDuong={veDuongThat}
              dangVe={dangVe}
              duong={duong}
              onResults={setTimThay}
              nav={nav}
            />
          )}
        </section>

        <div
          onMouseDown={startResize}
          className={`trip-planner__resizer group ${
            isResizing ? "trip-planner__resizer--dragging" : ""
          }`}
          title="Kéo để đổi độ rộng"
        >
          <div className="trip-planner__resizer-line" />
        </div>

        <section className="trip-planner__map-container">
          <ErrorBoundary ten="Bản đồ">
            <TripMap
              stops={stops}
              focusDay={duong ? duong.day : ngayXem}
              timThay={timThay}
              noiBat={noiBat}
              diemChon={diemChon}
              onThem={(p) => themVaoMuc(p, sections[0]?.key || MUC_MAC_DINH)}
              duongThat={duong?.doan}
            />
          </ErrorBoundary>
        </section>
      </div>
    </main>
  );
}
