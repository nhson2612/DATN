import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import ErrorBoundary from "../components/common/ErrorBoundary";
import TripMap from "../components/map/TripMap";
import PlannerLichTrinh from "./planner/PlannerLichTrinh";
import PlannerRail from "./planner/PlannerRail";
import PlannerTongQuan from "./planner/PlannerTongQuan";
import PlannerAssistant from "./planner/PlannerAssistant";
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
  const [duongTheoNgay, setDuongTheoNgay] = useState({});
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
      luu(moiStops, ss);
    },
    [sections, luu]
  );

  // Payload kéo-thả chỉ có {type, id}: thiếu tên hoặc toạ độ thì tra chi tiết
  // trước khi thêm. KHÔNG bao giờ tạo stop thiếu dữ liệu — nó không lên được bản
  // đồ, không xếp được tuyến, và biến mất ở lần tải lại sau.
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

  // Phân bổ tuần tự các điểm chưa xếp vào ngày — cập nhật một lần để không mất điểm
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
        <div className="trip-planner__header-left">
          <button
            onClick={() => nav("/chuyen-di")}
            title="Về danh sách chuyến"
            aria-label="Về danh sách chuyến"
            className="trip-planner__back-btn"
          >
            <i className="fa-solid fa-arrow-left text-xs" />
          </button>
          <div className="trip-planner__info">
            <span className="trip-planner__eyebrow">Kế hoạch chuyến đi</span>
            <h1 className="trip-planner__title">{trip.name}</h1>
            <p className="trip-planner__subtitle">
              {diemDen && <>{diemDen.replace(/^(Thành phố|Tỉnh)\s+/i, "")} · </>}
              {soDiem} địa điểm · {trip.duration_days} ngày
            </p>
          </div>
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
          {dangLuu ? "Đang lưu thay đổi" : "Đã lưu tự động"}
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

        <section className="trip-planner__content">
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
              ngayChon={ngayChon}
              onHover={(d) => setNgayXem(d)}
              onXep={xepVaoNgay}
              onBoNgay={boKhoiNgay}
              onSapXepLai={sapXepLaiTrongNgay}
              onXem={setDiemChon}
              onDatChoNgu={datChoNgu}
              onBoChoNgu={boChoNgu}
              onToiUu={toiUuNgay}
              dangLuu={dangLuu}
              toiUu={toiUu}
              duongTheoNgay={duongTheoNgay}
              onResults={setTimThay}
              onThemChuaXep={(p) =>
                themVaoMuc(p, sections[0]?.key || MUC_MAC_DINH)
              }
              onXoaDiem={xoaHan}
              onAutoAssign={phanBoTuDong}
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
