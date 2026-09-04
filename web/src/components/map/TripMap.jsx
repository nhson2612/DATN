import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import { tenLoai } from "../../lib/loaiDiaDiem";
import MapOverlayImage from "./MapOverlayImage";
import "./TripMap.css";

const MAU_NGAY = ["#059669", "#0f766e", "#4d7c0f", "#a16207", "#9a3412", "#7c2d12", "#065f46"];
const laToaDo = (s) => Number.isFinite(+s?.lon) && Number.isFinite(+s?.lat);

function veVungNhin(map, diem, opts) {
  const hopLe = (diem || []).filter(laToaDo);
  if (!hopLe.length) return;
  const b = new window.maplibregl.LngLatBounds();
  hopLe.forEach((s) => b.extend([+s.lon, +s.lat]));
  if (!b.getSouthWest() || !b.getNorthEast()) return;
  map.fitBounds(b, opts);
}

function linkGoogleMaps(p) {
  const phan = [p?.name, p?.dia_chi, p?.thanh_pho].filter(Boolean);
  if (phan.length >= 2) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(phan.join(", "))}`;
  }
  const lat = Number(p?.lat), lon = Number(p?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p?.name || "")}`;
}

export default function TripMap({ stops, focusDay, timThay, noiBat, onThem, duongThat, diemChon }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeList, setActiveList] = useState([]);
  const [aiSummary, setAiSummary] = useState(null);
  const [showAiSummary, setShowAiSummary] = useState(false);

  useEffect(() => {
    setShowAiSummary(false);
    setAiSummary(null);
  }, [selectedPlace?.name]);

  useEffect(() => {
    if (!diemChon) return;
    const map = mapRef.current;
    const cung = (a, b) => a.type === b.type && String(a.id) === String(b.id);
    const trongChuyen = (stops || []).find((s) => cung(s, diemChon)) || diemChon;
    const ds = (stops || []).filter(
      (s) => s.role !== "lodging" && s.day === trongChuyen.day && laToaDo(s)
    );
    setActiveList(ds.length ? ds : [trongChuyen]);
    setSelectedIndex(Math.max(0, ds.findIndex((s) => cung(s, trongChuyen))));
    setSelectedPlace(trongChuyen);
    if (map && laToaDo(trongChuyen)) {
      map.flyTo({ center: [+trongChuyen.lon, +trongChuyen.lat], zoom: Math.max(map.getZoom(), 14), duration: 800 });
    }
  }, [diemChon]);

  useEffect(() => {
    let huy = false;

    const dung = () => {
      if (huy || !ref.current || mapRef.current) return;
      const map = new window.maplibregl.Map({
        container: ref.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [108.2, 16.05],
        zoom: 5,
      });

      map.on("click", (e) => {
        const isMarkerClick = e.originalEvent?.target?.closest(".maplibregl-marker");
        if (!isMarkerClick) {
          setSelectedPlace(null);
        }
      });

      mapRef.current = map;
      const ro = new ResizeObserver(() => map.resize());
      ro.observe(ref.current);
      map._roDoiKichThuoc = ro;
    };

    if (window.maplibregl) dung();
    else {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.crossOrigin = "anonymous";
      js.src = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js";
      js.onload = dung;
      document.head.appendChild(js);
    }
    return () => {
      huy = true;
      mapRef.current?._roDoiKichThuoc?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    const ve = () => {
      (map._tripMarkers || []).forEach((m) => m.remove());
      map._tripMarkers = [];

      const hopLe = (stops || []).filter(laToaDo);
      if (!hopLe.length) return;

      const cacChoNgu = hopLe.filter((s) => s.role === "lodging");

      for (const hotelStop of cacChoNgu) {
        const el = document.createElement("div");
        el.style.cssText = `width:30px;height:30px;border-radius:50%;background:#ef4444;
          color:#fff;font-size:14px;text-align:center;
          box-shadow:0 2px 6px rgba(0,0,0,.4);cursor:pointer;border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;transition:transform .15s;`;
        el.innerHTML = '<i class="fa-solid fa-house"></i>';
        el.title = hotelStop.day
          ? `Chỗ ngủ ngày ${hotelStop.day}: ${hotelStop.name}`
          : `Chỗ ngủ: ${hotelStop.name}`;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedPlace(hotelStop);
          setSelectedIndex(0);
          setActiveList([hotelStop]);
          map.flyTo({ center: [+hotelStop.lon, +hotelStop.lat], zoom: Math.max(map.getZoom(), 14), duration: 800 });
        });

        map._tripMarkers.push(
          new window.maplibregl.Marker({ element: el }).setLngLat([hotelStop.lon, hotelStop.lat]).addTo(map)
        );
      }

      const theoNgay = {};
      hopLe.filter((s) => s.role !== "lodging")
           .forEach((s) => (theoNgay[s.day ?? 0] ||= []).push(s));

      Object.entries(theoNgay).forEach(([ngay, ds]) => {
        const isWishlist = Number(ngay) === 0;
        const mau = isWishlist ? "#9ca3af" : MAU_NGAY[(Number(ngay) - 1) % MAU_NGAY.length];
        const mo = isWishlist
          ? (focusDay == null ? 0.6 : 0.15)
          : (focusDay == null || Number(ngay) === focusDay ? 1 : 0.25);

        ds.forEach((s, i) => {
          const el = document.createElement("div");
          el.style.cssText = `width:26px;height:26px;border-radius:50%;background:${mau};
            color:#fff;font:600 12px/26px system-ui;text-align:center;opacity:${mo};
            box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;transition:transform .15s;`;
          el.textContent = isWishlist ? "•" : i + 1;
          el.title = isWishlist ? `Wishlist: ${s.name}` : `Ngày ${ngay}: ${s.name}`;

          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedPlace(s);
            setSelectedIndex(i);
            setActiveList(ds);
            map.flyTo({ center: [+s.lon, +s.lat], zoom: Math.max(map.getZoom(), 14), duration: 800 });
          });

          map._tripMarkers.push(
            new window.maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map)
          );
        });

        const id = `tuyen-${ngay}`;
        if (map.getLayer(id)) { map.removeLayer(id); map.removeSource(id); }

        if (!isWishlist && ds.length > 0) {
          const hotelStop = cacChoNgu.find((h) => h.day === Number(ngay));
          const coordinates = hotelStop
            ? [[hotelStop.lon, hotelStop.lat], ...ds.map((s) => [s.lon, s.lat]), [hotelStop.lon, hotelStop.lat]]
            : ds.map((s) => [s.lon, s.lat]);

          if (coordinates.length > 1) {
            map.addSource(id, {
              type: "geojson",
              data: {
                type: "Feature",
                geometry: { type: "LineString", coordinates },
              },
            });
            map.addLayer({
              id, type: "line", source: id,
              paint: {
                "line-color": mau, "line-width": 2, "line-opacity": mo * 0.7,
                "line-dasharray": [2, 1]
              },
            });
          }
        }
      });

      veVungNhin(map, hopLe, { padding: 60, maxZoom: 14, duration: 600 });
    };

    if (map.isStyleLoaded()) ve();
    else map.once("load", ve);
  }, [stops, focusDay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    const ve = () => {
      (map._timThay || []).forEach((m) => m.remove());
      map._timThay = [];
      map._chamTim = [];

      const hopLe = (timThay || []).filter(laToaDo);
      hopLe.forEach((s, i) => {
        const ngoai = document.createElement("div");
        const cham = document.createElement("div");
        cham.style.cssText = `width:24px;height:24px;border-radius:50%;background:#fff;
          border:2px solid ${MAU_NGAY[0]};color:${MAU_NGAY[0]};text-align:center;
          font:600 11px/20px system-ui;cursor:pointer;transition:transform .12s;
          box-shadow:0 1px 4px rgba(0,0,0,.25)`;
        cham.textContent = i + 1;
        ngoai.appendChild(cham);
        map._chamTim[i] = cham;

        ngoai.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedPlace(s);
          setSelectedIndex(i);
          setActiveList(hopLe);
          map.flyTo({ center: [+s.lon, +s.lat], zoom: Math.max(map.getZoom(), 14), duration: 800 });
        });

        map._timThay.push(
          new window.maplibregl.Marker({ element: ngoai })
            .setLngLat([s.lon, s.lat]).addTo(map)
        );
      });

      veVungNhin(map, hopLe, { padding: 60, maxZoom: 15, duration: 600 });
    };

    map.isStyleLoaded() ? ve() : map.once("load", ve);
  }, [timThay]);

  useEffect(() => {
    (mapRef.current?._chamTim || []).forEach((el, i) => {
      if (el) el.style.transform = noiBat === i ? "scale(1.35)" : "";
    });
  }, [noiBat, timThay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    const ve = () => {
      if (map.getLayer("duong-that")) {
        map.removeLayer("duong-that");
        map.removeSource("duong-that");
      }
      if (!duongThat?.length) return;
      map.addSource("duong-that", {
        type: "geojson",
        data: { type: "FeatureCollection", features: duongThat },
      });
      map.addLayer({
        id: "duong-that", type: "line", source: "duong-that",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": MAU_NGAY[0], "line-width": 5, "line-opacity": 0.8 },
      });
    };

    map.isStyleLoaded() ? ve() : map.once("load", ve);
  }, [duongThat]);

  const handleAskAiAboutReviews = async () => {
    setShowAiSummary(true);
    if (aiSummary?.text && !aiSummary?.loading) return;

    const reviews = selectedPlace?.cached_details?.reviews || selectedPlace?.reviews || [];
    if (!reviews.length) return;

    setAiSummary({ loading: true, text: "" });

    const reviewTexts = reviews
      .map((r, idx) => `${idx + 1}. ${r.rating ? `[${r.rating}⭐] ` : ""}${r.text}`)
      .join("\n");

    const prompt = `Hãy tóm tắt ngắn gọn (3-4 dòng) các đánh giá thực tế của du khách về địa điểm "${selectedPlace.name}".
Danh sách nhận xét của du khách:
${reviewTexts}`;

    try {
      const res = await api.chat({ question: prompt });
      setAiSummary({
        loading: false,
        text: res.explanation || res.answer || "Đã phân tích xong các nhận xét.",
      });
    } catch (err) {
      setAiSummary({
        loading: false,
        text: "",
        error: "Không thể kết nối với AI. Vui lòng thử lại sau.",
      });
    }
  };

  const currentReviews = selectedPlace?.cached_details?.reviews || selectedPlace?.reviews || [];
  const hasReviews = Array.isArray(currentReviews) && currentReviews.length > 0;

  return (
    <div className="trip-map">
      <div ref={ref} className="trip-map__canvas" />

      {!(stops || []).some(laToaDo) && !(timThay || []).length && (
        <div className="trip-map__empty-notice">
          <p className="trip-map__empty-text">
            Thêm địa điểm để thấy chúng trên bản đồ
          </p>
        </div>
      )}

      {selectedPlace && (
        <div className="trip-map__overlay">
          <div className="trip-map__header">
            <div className="trip-map__header-actions">
              {onThem && !stops?.some((st) => st.name === selectedPlace.name) && (
                <button
                  onClick={() => onThem(selectedPlace)}
                  className="trip-map__add-btn"
                >
                  <i className="fa-solid fa-plus text-[10px]" />
                  Thêm vào chuyến
                </button>
              )}
              <button
                onClick={() => setSelectedPlace(null)}
                className="trip-map__close-btn"
                title="Đóng"
              >
                <i className="fa-solid fa-xmark text-sm" />
              </button>
            </div>
          </div>

          <div className="trip-map__body">
            <div className="trip-map__main-info">
              <div className="trip-map__info">
                <h3 className="trip-map__title" title={selectedPlace.name}>
                  {selectedPlace.name}
                </h3>
                <div className="trip-map__tags">
                  <span className="trip-map__tag trip-map__tag--category">
                    {tenLoai(selectedPlace.category || selectedPlace.amenity || selectedPlace.tourism) || "Địa điểm"}
                  </span>
                </div>
              </div>

              <div className="trip-map__thumb">
                <MapOverlayImage place={selectedPlace} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
