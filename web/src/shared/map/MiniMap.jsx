import { useEffect, useRef } from "react";
import "./TripMap.css";

export default function MiniMap({ lat, lon, lng, zoom = 14 }) {
  const mapRef = useRef(null);
  const leafletMap = useRef(null);
  const longitude = lng ?? lon;

  useEffect(() => {
    let active = true;
    const latitude = Number(lat);
    const longitudeValue = Number(longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitudeValue)) return undefined;

    const khoiTaoBanDo = () => {
      if (!active || !mapRef.current || !window.L) return;

      if (!leafletMap.current) {
        leafletMap.current = window.L.map(mapRef.current, {
          zoomControl: false,
          attributionControl: false,
        }).setView([latitude, longitudeValue], zoom);

        window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(leafletMap.current);

        window.L.marker([latitude, longitudeValue]).addTo(leafletMap.current);
      } else {
        leafletMap.current.setView([latitude, longitudeValue], zoom);
      }
    };

    if (window.L) {
      khoiTaoBanDo();
    } else {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!document.getElementById("leaflet-js")) {
        const script = document.createElement("script");
        script.id = "leaflet-js";
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = () => {
          if (active) khoiTaoBanDo();
        };
        document.head.appendChild(script);
      } else {
        const script = document.getElementById("leaflet-js");
        script.addEventListener("load", khoiTaoBanDo);
      }
    }

    return () => {
      active = false;
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [lat, longitude, zoom]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-xl overflow-hidden shadow-inner"
      style={{ minHeight: "220px", height: "100%", zIndex: 1 }}
    />
  );
}
