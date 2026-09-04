import { useEffect, useRef } from "react";
import "./TripMap.css";

export default function MiniMap({ lat, lng, zoom = 14 }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);

  useEffect(() => {
    if (!mapRef.current || !window.L || !lat || !lng) return;

    if (!leafletMap.current) {
      leafletMap.current = window.L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([lat, lng], zoom);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        leafletMap.current
      );

      window.L.marker([lat, lng]).addTo(leafletMap.current);
    } else {
      leafletMap.current.setView([lat, lng], zoom);
    }
  }, [lat, lng, zoom]);

  return <div ref={mapRef} className="w-full h-full min-h-[160px] rounded-2xl overflow-hidden" />;
}
