import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/client";
import { tenLoai } from "../../lib/loaiDiaDiem";
import MapOverlayImage from "./MapOverlayImage";
import "./TripMap.css";

const MAU_NGAY = Array(7).fill("#f15b4a");
const laToaDo = (s) => Number.isFinite(+s?.lon) && Number.isFinite(+s?.lat);

function veVungNhin(map, diem, opts) {
  const hopLe = (diem || []).filter(laToaDo);
  if (!hopLe.length || !map) return;
  const b = new window.maplibregl.LngLatBounds();
  hopLe.forEach((s) => b.extend([+s.lon, +s.lat]));
  if (!b.getSouthWest() || !b.getNorthEast()) return;
  map.fitBounds(b, opts);
}

export default function TripMap({ stops, focusDay, timThay, noiBat, onThem, duongThat, diemChon }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [localFocusDay, setLocalFocusDay] = useState(null);
  const [dayRoutes, setDayRoutes] = useState({});
  const [isRouting, setIsRouting] = useState(false);

  const abortControllerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const legCacheRef = useRef(new Map());
  const activeDayRouteLayersRef = useRef(new Set());

  const currentFocusDay = localFocusDay !== null ? localFocusDay : focusDay;

  // Danh sách các ngày có địa điểm đã lên lịch
  const danhSachNgay = useMemo(() => {
    const days = new Set();
    (stops || []).forEach((s) => {
      if (s.day) days.add(Number(s.day));
    });
    return Array.from(days).sort((a, b) => a - b);
  }, [stops]);

  const soDiemHopLe = useMemo(() => {
    return (stops || []).filter(laToaDo).length;
  }, [stops]);

  useEffect(() => {
    if (!diemChon) return;
    const map = mapRef.current;
    const cung = (a, b) => a.type === b.type && String(a.id) === String(b.id);
    const trongChuyen = (stops || []).find((s) => cung(s, diemChon)) || diemChon;
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
      activeDayRouteLayersRef.current.clear();
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
        el.style.cssText = `width:30px;height:30px;border-radius:50%;background:#f15b4a;
          color:#fff;font-size:14px;text-align:center;
          box-shadow:0 2px 6px rgba(0,0,0,.3);cursor:pointer;border:2px solid #fff;
          display:flex;align-items:center;justify-content:center;transition:transform .15s;`;
        el.innerHTML = '<i class="fa-solid fa-house"></i>';
        el.title = hotelStop.day
          ? `Chỗ ngủ ngày ${hotelStop.day}: ${hotelStop.name}`
          : `Chỗ ngủ: ${hotelStop.name}`;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedPlace(hotelStop);
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
        const mau = MAU_NGAY[(Number(ngay) - 1) % MAU_NGAY.length];
        const mo = isWishlist
          ? (currentFocusDay == null ? 0.8 : 0.2)
          : (currentFocusDay == null || Number(ngay) === currentFocusDay ? 1 : 0.25);

        ds.forEach((s, i) => {
          const el = document.createElement("div");
          el.style.cssText = `width:26px;height:26px;border-radius:50%;background:${mau};
            color:#fff;font:700 12px/26px system-ui;text-align:center;opacity:${mo};
            box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer;border:2px solid #fff;transition:transform .15s;`;
          el.textContent = isWishlist ? "•" : i + 1;
          el.title = isWishlist ? `Muốn đi: ${s.name}` : `Ngày ${ngay} (#${i + 1}): ${s.name}`;

          el.addEventListener("click", (e) => {
            e.stopPropagation();
            setSelectedPlace(s);
            map.flyTo({ center: [+s.lon, +s.lat], zoom: Math.max(map.getZoom(), 14), duration: 800 });
          });

          map._tripMarkers.push(
            new window.maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map)
          );
        });

        // Bỏ vẽ đường chim bay tuyen-${ngay}, xoá sạch layer/source cũ nếu tồn tại
        const oldId = `tuyen-${ngay}`;
        if (map.getLayer(oldId)) { map.removeLayer(oldId); map.removeSource(oldId); }
      });

      // Fit bounds theo ngày đang xem hoặc toàn bộ chuyến
      const diemCanFit = currentFocusDay
        ? hopLe.filter((s) => s.day === currentFocusDay)
        : hopLe;

      if (diemCanFit.length) {
        veVungNhin(map, diemCanFit, { padding: 60, maxZoom: 14, duration: 600 });
      }
    };

    if (map.isStyleLoaded()) ve();
    else map.once("load", ve);
  }, [stops, currentFocusDay]);

  // 1. Tự động tính đường bộ thực tế (pgRouting) theo từng ngày với debounce và AbortController
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const hopLe = (stops || []).filter(laToaDo);
    const cacChoNgu = hopLe.filter((s) => s.role === "lodging");
    const theoNgay = {};
    hopLe
      .filter((s) => s.role !== "lodging" && s.day && Number(s.day) > 0)
      .forEach((s) => {
        const d = Number(s.day);
        (theoNgay[d] ||= []).push(s);
      });

    // Chỉ tính cho các ngày có >= 2 điểm role !== "lodging" có toạ độ hợp lệ
    const daysToRoute = Object.keys(theoNgay)
      .map(Number)
      .filter((d) => (theoNgay[d] || []).length >= 2);

    if (daysToRoute.length === 0) {
      setDayRoutes({});
      setIsRouting(false);
      return;
    }

    setIsRouting(true);

    // Debounce 700ms để tránh gửi request dồn dập khi kéo thả / sắp xếp stops
    debounceTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const newDayRoutes = {};

      try {
        await Promise.all(
          daysToRoute.map(async (day) => {
            const ds = theoNgay[day] || [];
            const choNgu = cacChoNgu.find((h) => Number(h.day) === day);
            // Nếu có lodging thì tuyến khép kín: lodging -> điểm 1 -> ... -> điểm N -> lodging
            const chuoi = choNgu ? [choNgu, ...ds, choNgu] : ds;
            if (chuoi.length < 2) return;

            const dayFeatures = [];
            for (let i = 0; i < chuoi.length - 1; i++) {
              if (controller.signal.aborted) return;
              const start = chuoi[i];
              const end = chuoi[i + 1];
              const legKey = `${start.lon},${start.lat}->${end.lon},${end.lat}`;

              try {
                let features;
                if (legCacheRef.current.has(legKey)) {
                  features = legCacheRef.current.get(legKey);
                } else {
                  const res = await api.route(
                    {
                      start_lon: +start.lon,
                      start_lat: +start.lat,
                      end_lon: +end.lon,
                      end_lat: +end.lat,
                    },
                    { signal: controller.signal }
                  );
                  features = [];
                  if (Array.isArray(res?.path)) {
                    res.path.forEach((c) => {
                      if (c.geom) {
                        features.push({
                          type: "Feature",
                          properties: { name: c.street_name || "" },
                          geometry: c.geom,
                        });
                      }
                    });
                  }
                  legCacheRef.current.set(legKey, features);
                }
                dayFeatures.push(...features);
              } catch (err) {
                if (err.name === "AbortError" || controller.signal.aborted) {
                  return;
                }
                console.warn(
                  `[TripMap] Bỏ qua tuyến ngày ${day} (lỗi chặng ${i + 1}):`,
                  err.message
                );
                // Xử lý lỗi (snap quá xa / không tìm được đường): bỏ qua ngày đó, chỉ giữ marker
                return;
              }
            }

            if (!controller.signal.aborted && dayFeatures.length > 0) {
              newDayRoutes[day] = dayFeatures;
            }
          })
        );

        if (!controller.signal.aborted) {
          setDayRoutes(newDayRoutes);
        }
      } catch (err) {
        if (err.name !== "AbortError" && !controller.signal.aborted) {
          console.warn("[TripMap] Lỗi khi tính tuyến đường:", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsRouting(false);
        }
      }
    }, 700);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [stops]);

  // 2. Vẽ và cập nhật các layer tuyến đường bộ theo ngày lên MapLibre
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    const veTuyenDuong = () => {
      if (!map.isStyleLoaded()) return;

      const currentDayNumbers = Object.keys(dayRoutes).map(Number);
      const activeLayers = activeDayRouteLayersRef.current;

      // Xoá các layer tuyến ngày không còn dữ liệu hoặc không còn trong danh sách
      const layersToRemove = [];
      activeLayers.forEach((layerId) => {
        const dayMatch = layerId.match(/^route-day-(\d+)$/);
        if (dayMatch) {
          const day = Number(dayMatch[1]);
          if (!dayRoutes[day] || !dayRoutes[day].length) {
            layersToRemove.push(layerId);
          }
        }
      });

      layersToRemove.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id);
        if (map.getSource(id)) map.removeSource(id);
        activeLayers.delete(id);
      });

      // Thêm hoặc cập nhật layer đường cho từng ngày
      currentDayNumbers.forEach((day) => {
        const features = dayRoutes[day];
        if (!features || !features.length) return;

        const layerId = `route-day-${day}`;
        const mau = MAU_NGAY[(day - 1) % MAU_NGAY.length];
        const mo =
          currentFocusDay == null || Number(day) === currentFocusDay
            ? 0.85
            : 0.2;

        const sourceData = {
          type: "FeatureCollection",
          features,
        };

        const existingSource = map.getSource(layerId);
        if (existingSource) {
          existingSource.setData(sourceData);
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "line-opacity", mo);
          }
        } else {
          map.addSource(layerId, {
            type: "geojson",
            data: sourceData,
          });
          map.addLayer({
            id: layerId,
            type: "line",
            source: layerId,
            layout: {
              "line-join": "round",
              "line-cap": "round",
            },
            paint: {
              "line-color": mau,
              "line-width": 4.5,
              "line-opacity": mo,
            },
          });
          activeLayers.add(layerId);
        }
      });
    };

    if (map.isStyleLoaded()) veTuyenDuong();
    else map.once("load", veTuyenDuong);
  }, [dayRoutes, currentFocusDay]);

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
          font:700 11px/20px system-ui;cursor:pointer;transition:transform .12s;
          box-shadow:0 1px 4px rgba(0,0,0,.25)`;
        cham.textContent = i + 1;
        ngoai.appendChild(cham);
        map._chamTim[i] = cham;

        ngoai.addEventListener("click", (e) => {
          e.stopPropagation();
          setSelectedPlace(s);
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
        paint: { "line-color": MAU_NGAY[0], "line-width": 5, "line-opacity": 0.85 },
      });
    };

    map.isStyleLoaded() ? ve() : map.once("load", ve);
  }, [duongThat]);

  const handleSelectDayPill = (day) => {
    if (day === null) {
      setLocalFocusDay(null);
      veVungNhin(mapRef.current, stops, { padding: 60, maxZoom: 14, duration: 600 });
    } else {
      setLocalFocusDay(day);
      const dsNgay = (stops || []).filter((s) => s.day === day);
      if (dsNgay.length) {
        veVungNhin(mapRef.current, dsNgay, { padding: 60, maxZoom: 14, duration: 600 });
      }
    }
  };

  return (
    <div className="trip-map">
      <div ref={ref} className="trip-map__canvas" />

      {/* 1. Thanh chip lọc ngày trên đỉnh bản đồ */}
      {danhSachNgay.length > 0 && (
        <div className="trip-map__filter-bar">
          <button
            type="button"
            onClick={() => handleSelectDayPill(null)}
            className={`trip-map__filter-chip ${
              currentFocusDay == null ? "trip-map__filter-chip--active" : ""
            }`}
          >
            Tất cả ({soDiemHopLe})
          </button>
          {danhSachNgay.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleSelectDayPill(d)}
              className={`trip-map__filter-chip ${
                currentFocusDay === d ? "trip-map__filter-chip--active" : ""
              }`}
            >
              <span
                className="trip-map__filter-dot"
                style={{ backgroundColor: MAU_NGAY[(d - 1) % MAU_NGAY.length] }}
              />
              Ngày {d}
            </button>
          ))}
        </div>
      )}

      {/* Chỉ báo trạng thái tính tuyến đường bộ */}
      {isRouting && (
        <div className="trip-map__route-loading">
          <i className="fa-solid fa-route text-xs text-indigo-600 animate-pulse" />
          <span>Đang tính lộ trình...</span>
        </div>
      )}

      {/* 2. Cụm điều khiển zoom góc phải dưới */}
      <div className="trip-map__zoom-controls">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          className="trip-map__zoom-btn"
          title="Phóng to bản đồ"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          className="trip-map__zoom-btn"
          title="Thu nhỏ bản đồ"
        >
          −
        </button>
      </div>

      {/* 3. Legend và thông tin bản quyền góc trái dưới */}
      <div className="trip-map__legend">
        <span>Tỉ lệ: 1:50,000</span>
        <span>•</span>
        <span>Wanderlust Maps</span>
        <span>•</span>
        <span>OpenStreetMap</span>
      </div>

      {!(stops || []).some(laToaDo) && !(timThay || []).length && (
        <div className="trip-map__empty-notice">
          <p className="trip-map__empty-text">
            Thêm địa điểm để hiển thị trên bản đồ tương tác
          </p>
        </div>
      )}

      {selectedPlace && (
        <div className="trip-map__overlay">
          <div className="trip-map__header">
            {onThem && !stops?.some((st) => st.name === selectedPlace.name) && (
              <button
                type="button"
                onClick={() => onThem(selectedPlace)}
                className="trip-map__add-btn"
              >
                <i className="fa-solid fa-plus text-[10px]" />
                <span>Thêm vào chuyến</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedPlace(null)}
              className="trip-map__close-btn"
              title="Đóng"
            >
              <i className="fa-solid fa-xmark text-sm" />
            </button>
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
                  {selectedPlace.day && (
                    <span className="trip-map__tag">
                      Ngày {selectedPlace.day}
                    </span>
                  )}
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
