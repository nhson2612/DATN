import { useEffect, useRef } from "react";

/* Bản đồ của trip planner: hiện TẤT CẢ điểm trong chuyến cùng lúc, đánh số theo
 * thứ tự trong ngày, và nối chúng bằng một đường.
 *
 * Đây là điểm khác biệt của mô hình planner so với trang đặt tour: người dùng
 * cần nhìn thấy toàn bộ chuyến trên một khung để biết ngày nào đang đi lòng
 * vòng, chứ không phải xem từng địa điểm riêng lẻ. */
const MAU_NGAY = ["#059669", "#0f766e", "#4d7c0f", "#a16207", "#9a3412",
                  "#7c2d12", "#065f46"];

export default function TripMap({ stops, focusDay, timThay, noiBat, onThem, duongThat }) {
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

  /* Kết quả tìm kiếm — vòng tròn RỖNG, phân biệt hẳn với điểm đã xếp vào ngày
     (tròn ĐẶC, đánh số theo thứ tự đi). Người dùng phải thấy ngay cái nào đã
     nằm trong chuyến và cái nào mới chỉ đang xem. */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.maplibregl) return;

    const ve = () => {
      (map._timThay || []).forEach((m) => m.remove());
      map._timThay = [];
      map._chamTim = [];

      const hopLe = (timThay || []).filter((s) => s.lon != null);
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

        const nut = onThem
          ? `<button data-them="${i}" style="margin-top:6px;width:100%;border:0;
               background:${MAU_NGAY[0]};color:#fff;border-radius:999px;
               padding:4px 10px;font:600 11px system-ui;cursor:pointer">
               Thêm vào chuyến</button>`
          : "";
        const popup = new window.maplibregl.Popup({ offset: 16 }).setHTML(
          `<b>${s.name}</b><br><span style="color:#71717a">${
            (s.category || "").replace(/_/g, " ")}</span>${nut}`);
        popup.on("open", () => {
          popup.getElement()
            ?.querySelector("[data-them]")
            ?.addEventListener("click", () => { onThem(s); popup.remove(); });
        });

        map._timThay.push(
          new window.maplibregl.Marker({ element: ngoai })
            .setLngLat([s.lon, s.lat]).setPopup(popup).addTo(map));
      });

      if (hopLe.length) {
        const b = new window.maplibregl.LngLatBounds();
        hopLe.forEach((s) => b.extend([s.lon, s.lat]));
        map.fitBounds(b, { padding: 60, maxZoom: 15, duration: 600 });
      }
    };

    map.isStyleLoaded() ? ve() : map.once("load", ve);
    // Không phụ thuộc `noiBat`: dựng lại marker mỗi lần rê chuột sẽ đóng popup
    // đang mở và chạy lại fitBounds.
  }, [timThay, onThem]);

  // Phóng to điểm đang rê chuột ở danh sách. Đặt trên lớp TRONG vì MapLibre ghi
  // đè `transform` của phần tử marker mỗi khung hình để định vị.
  useEffect(() => {
    (mapRef.current?._chamTim || []).forEach((el, i) => {
      if (el) el.style.transform = noiBat === i ? "scale(1.35)" : "";
    });
  }, [noiBat, timThay]);

  /* Đường bộ THẬT do pgRouting tính, vẽ đè lên đường nối nét đứt.
     Nét đứt chỉ nối thẳng hai điểm — đủ để thấy ngày nào đi lòng vòng, nhưng
     không phải quãng đường phải đi thật. */
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

  return (
    <div className="relative h-full">
      <div ref={ref} className="w-full h-full rounded-card border border-zinc-200 dark:border-zinc-800" />
      {!(stops || []).some((s) => s.lon) && !(timThay || []).length && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-sm text-zinc-400 bg-white/90 dark:bg-zinc-900/90 px-4 py-2 rounded-full">
            Thêm địa điểm để thấy chúng trên bản đồ
          </p>
        </div>
      )}
    </div>
  );
}
