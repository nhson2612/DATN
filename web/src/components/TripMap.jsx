import { useEffect, useRef } from "react";

/* Bản đồ của trip planner: hiện TẤT CẢ điểm trong chuyến cùng lúc, đánh số theo
 * thứ tự trong ngày, và nối chúng bằng một đường.
 *
 * Đây là điểm khác biệt của mô hình planner so với trang đặt tour: người dùng
 * cần nhìn thấy toàn bộ chuyến trên một khung để biết ngày nào đang đi lòng
 * vòng, chứ không phải xem từng địa điểm riêng lẻ. */
const MAU_NGAY = ["#059669", "#0f766e", "#4d7c0f", "#a16207", "#9a3412",
                  "#7c2d12", "#065f46"];

export default function TripMap({ stops, focusDay }) {
  const ref = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let huy = false;

    const dung = () => {
      if (huy || !ref.current || mapRef.current) return;
      mapRef.current = new window.maplibregl.Map({
        container: ref.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [108.2, 16.05],
        zoom: 5,
      });
    };

    if (window.maplibregl) dung();
    else {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js";
      js.onload = dung;
      document.head.appendChild(js);
    }
    return () => { huy = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Vẽ lại mỗi khi danh sách điểm đổi.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    const ve = () => {
      // Xoá marker cũ trước khi vẽ lại, nếu không chúng chồng lên nhau.
      (map._tripMarkers || []).forEach((m) => m.remove());
      map._tripMarkers = [];

      const hopLe = (stops || []).filter((s) => s.lon && s.lat);
      if (!hopLe.length) return;

      const theoNgay = {};
      hopLe.forEach((s) => (theoNgay[s.day] ||= []).push(s));

      Object.entries(theoNgay).forEach(([ngay, ds]) => {
        const mau = MAU_NGAY[(Number(ngay) - 1) % MAU_NGAY.length];
        const mo = focusDay == null || Number(ngay) === focusDay ? 1 : 0.25;

        ds.forEach((s, i) => {
          const el = document.createElement("div");
          el.style.cssText = `width:26px;height:26px;border-radius:50%;background:${mau};
            color:#fff;font:600 12px/26px system-ui;text-align:center;opacity:${mo};
            box-shadow:0 1px 4px rgba(0,0,0,.3);cursor:pointer`;
          el.textContent = i + 1;
          el.title = `Ngày ${ngay}: ${s.name}`;
          map._tripMarkers.push(
            new window.maplibregl.Marker({ element: el }).setLngLat([s.lon, s.lat]).addTo(map)
          );
        });

        // Đường nối các điểm trong ngày — đủ để thấy ngày nào đi lòng vòng.
        const id = `tuyen-${ngay}`;
        if (map.getLayer(id)) { map.removeLayer(id); map.removeSource(id); }
        if (ds.length > 1) {
          map.addSource(id, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "LineString", coordinates: ds.map((s) => [s.lon, s.lat]) },
            },
          });
          map.addLayer({
            id, type: "line", source: id,
            paint: { "line-color": mau, "line-width": 2, "line-opacity": mo * 0.7,
                     "line-dasharray": [2, 1] },
          });
        }
      });

      const b = new window.maplibregl.LngLatBounds();
      hopLe.forEach((s) => b.extend([s.lon, s.lat]));
      map.fitBounds(b, { padding: 60, maxZoom: 14, duration: 600 });
    };

    if (map.isStyleLoaded()) ve();
    else map.once("load", ve);
  }, [stops, focusDay]);

  return (
    <div className="relative h-full">
      <div ref={ref} className="w-full h-full rounded-card border border-zinc-200 dark:border-zinc-800" />
      {!(stops || []).some((s) => s.lon) && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-zinc-400 bg-white/90 dark:bg-zinc-900/90 px-4 py-2 rounded-full">
            Thêm địa điểm để thấy chúng trên bản đồ
          </p>
        </div>
      )}
    </div>
  );
}
