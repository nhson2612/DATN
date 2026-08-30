import { useEffect, useRef } from "react";

/* Bản đồ của trang trợ lý: vẽ kết quả hỏi đáp và tuyến đường pgRouting.
 *
 * Khác TripMap (vẽ lịch trình đã lên, đánh số theo ngày): ở đây các điểm là kết
 * quả của MỘT câu hỏi, chưa có thứ tự, nên đánh số theo thứ hạng gần-xa để đối
 * chiếu được với danh sách bên trái.
 */
const MAU = "#059669";      // accent-600 — cả trang chỉ một màu nhấn
const MAU_MOC = "#047857";  // accent-700 cho mốc vị trí

function nap(sau) {
  if (window.maplibregl) return sau();
  // MapLibre chỉ nạp khi thật sự mở trang có bản đồ, không gói vào bundle.
  if (!document.getElementById("maplibre-css")) {
    const css = document.createElement("link");
    css.id = "maplibre-css";
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css";
    document.head.appendChild(css);
  }
  let js = document.getElementById("maplibre-js");
  if (js) return js.addEventListener("load", sau);
  js = document.createElement("script");
  js.id = "maplibre-js";
  js.src = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js";
  js.onload = sau;
  document.head.appendChild(js);
}

export default function SearchMap({
  results, anchor, highlight, route, routePoints, onMapClick, onPick,
}) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  useEffect(() => {
    let huy = false;
    nap(() => {
      if (huy || !ref.current || mapRef.current) return;
      const map = new window.maplibregl.Map({
        container: ref.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [108.2, 16.05],
        zoom: 5,
      });
      map.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new window.maplibregl.GeolocateControl({ trackUserLocation: false }), "bottom-right");
      // Gọi qua ref: handler đổi mỗi lần bật/tắt chế độ chỉ đường, mà bản đồ
      // thì chỉ dựng một lần.
      map.on("click", (e) => clickRef.current?.(e.lngLat));
      mapRef.current = map;
    });
    return () => { huy = true; mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  // Con trỏ hình chữ thập khi đang chọn điểm chỉ đường — dấu hiệu duy nhất cho
  // biết bấm vào bản đồ lúc này có tác dụng.
  useEffect(() => {
    const map = mapRef.current;
    if (map) map.getCanvas().style.cursor = onMapClick ? "crosshair" : "";
  }, [onMapClick]);

  // ── Kết quả hỏi đáp ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    const ve = () => {
      (map._ketQua || []).forEach((m) => m.remove());
      map._ketQua = [];

      if (anchor?.lon != null) {
        const el = document.createElement("div");
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${MAU_MOC};
          border:3px solid #fff;box-shadow:0 0 0 3px rgba(4,120,87,.25)`;
        el.title = `Mốc: ${anchor.name}`;
        map._ketQua.push(
          new window.maplibregl.Marker({ element: el })
            .setLngLat([anchor.lon, anchor.lat])
            .setPopup(new window.maplibregl.Popup({ offset: 12 })
              .setText(`Tính từ: ${anchor.name}`))
            .addTo(map)
        );
      }

      map._chamKetQua = [];
      (results || []).forEach((r, i) => {
        if (r.lon == null) return;
        // Hai lớp: MapLibre ghi đè `transform` của phần tử marker mỗi khung hình
        // để định vị, nên hiệu ứng phóng to phải đặt ở lớp trong — đặt ở lớp
        // ngoài thì marker văng khỏi toạ độ.
        const el = document.createElement("div");
        const cham = document.createElement("div");
        cham.style.cssText = `width:24px;height:24px;border-radius:50%;background:${MAU};
          color:#fff;font:600 11px/24px system-ui;text-align:center;border:2px solid #fff;
          cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.3);transition:transform .12s`;
        cham.textContent = i + 1;
        el.appendChild(cham);
        el.addEventListener("click", (e) => { e.stopPropagation(); onPick?.(i); });
        map._chamKetQua[i] = cham;
        map._ketQua.push(
          new window.maplibregl.Marker({ element: el })
            .setLngLat([r.lon, r.lat])
            .setPopup(new window.maplibregl.Popup({ offset: 16 }).setHTML(
              `<b>${r.name}</b><br><span style="color:#71717a">${r.category || ""}</span>`))
            .addTo(map)
        );
      });

      const diem = (results || []).filter((r) => r.lon != null);
      if (diem.length) {
        const b = new window.maplibregl.LngLatBounds();
        diem.forEach((r) => b.extend([r.lon, r.lat]));
        if (anchor?.lon != null) b.extend([anchor.lon, anchor.lat]);
        map.fitBounds(b, { padding: 70, maxZoom: 15, duration: 700 });
      }
    };

    map.isStyleLoaded() ? ve() : map.once("load", ve);
    // KHÔNG phụ thuộc `highlight`: dựng lại marker mỗi lần rê chuột qua danh
    // sách sẽ đóng popup đang mở và chạy lại fitBounds, làm bản đồ giật liên tục.
  }, [results, anchor, onPick]);

  // Nhấn mạnh điểm đang rê chuột bằng cách phóng to chính phần tử đã dựng.
  useEffect(() => {
    const ds = mapRef.current?._chamKetQua || [];
    ds.forEach((el, i) => {
      if (el) el.style.transform = highlight === i ? "scale(1.35)" : "";
    });
  }, [highlight, results]);

  // ── Tuyến đường ────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    const ve = () => {
      if (map.getLayer("tuyen")) { map.removeLayer("tuyen"); map.removeSource("tuyen"); }
      (map._diemTuyen || []).forEach((m) => m.remove());
      map._diemTuyen = [];

      (routePoints || []).forEach((p, i) => {
        const el = document.createElement("div");
        el.style.cssText = `width:22px;height:22px;border-radius:50%;background:#fff;
          border:3px solid ${MAU_MOC};font:700 11px/16px system-ui;text-align:center;color:${MAU_MOC}`;
        el.textContent = i === 0 ? "A" : "B";
        map._diemTuyen.push(
          new window.maplibregl.Marker({ element: el }).setLngLat(p).addTo(map));
      });

      if (!route?.length) return;
      map.addSource("tuyen", {
        type: "geojson",
        data: { type: "FeatureCollection", features: route },
      });
      map.addLayer({
        id: "tuyen", type: "line", source: "tuyen",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": MAU, "line-width": 5, "line-opacity": 0.85 },
      });

      const b = new window.maplibregl.LngLatBounds();
      route.forEach((f) => f.geometry.coordinates.forEach((c) => b.extend(c)));
      map.fitBounds(b, { padding: 70, duration: 700 });
    };

    map.isStyleLoaded() ? ve() : map.once("load", ve);
  }, [route, routePoints]);

  return <div ref={ref} className="w-full h-full rounded-card border border-zinc-200 dark:border-zinc-800 overflow-hidden" />;
}
