import { useEffect, useRef } from "react";
import "./TripMap.css";

export default function MiniMap({ lat, lon, lng, zoom = 14 }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const longitude = lng ?? lon;

  useEffect(() => {
    const latitude = Number(lat);
    const longitudeValue = Number(longitude);
    if (
      !mapRef.current ||
      !window.L ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitudeValue)
    ) return;

    if (!leafletMap.current) {
      leafletMap.current = window.L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).setView([latitude, longitudeValue], zoom);

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        leafletMap.current
      );

      window.L.marker([latitude, longitudeValue]).addTo(leafletMap.current);
    } else {
      leafletMap.current.setView([latitude, longitudeValue], zoom);
    }
  }, [lat, longitude, zoom]);

  return <div ref={mapRef} className="w-full h-full min-h-[160px] rounded-2xl overflow-hidden" />;
}
