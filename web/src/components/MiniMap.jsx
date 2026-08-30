import { useEffect, useRef } from "react";

/* Bản đồ nhỏ ở trang chi tiết.
 *
 * Baymard: 57% trang du lịch thiếu bản đồ ở trang chi tiết, trong khi người dùng
 * cần biết địa điểm nằm đâu so với chỗ họ ở. Đây là chỗ DUY NHẤT trang này dùng
 * bản đồ · trang chủ và danh sách không cần, nên MapLibre chỉ được nạp khi mở
 * trang chi tiết chứ không gói vào bundle.
 */
export default function MiniMap({ lon, lat }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!lon || !lat) return;
    let map;

    const ve = () => {
      if (!ref.current) return;
      map = new window.maplibregl.Map({
        container: ref.current,
        style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
        center: [lon, lat],
        zoom: 15,
      });
      new window.maplibregl.Marker({ color: "#2563eb" }).setLngLat([lon, lat]).addTo(map);
    };

    if (window.maplibregl) { ve(); }
    else {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js";
      js.onload = ve;
      document.head.appendChild(js);
    }
    return () => map?.remove();
  }, [lon, lat]);

  return <div ref={ref} className="w-full h-64 rounded-card border border-zinc-200" />;
}
