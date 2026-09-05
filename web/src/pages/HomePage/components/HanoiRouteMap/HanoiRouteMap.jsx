import React, { useMemo } from "react";
import { geoMercator, geoPath } from "d3-geo";
import wards from "../../../../data/hanoi-wards.geo.json";
import mainRoads from "../../../../data/hanoi-roads.geo.json";
import routeLegs from "../../../../data/hanoi-route.geo.json";
import "./HanoiRouteMap.css";

const VIEWBOX_W = 280;
const VIEWBOX_H = 340;

/** Điểm dừng thật (lon, lat) — khớp với tuyến pgRouting trong hanoi-route.geo.json. */
const STOPS = [
  {
    n: 1,
    coords: [105.85166, 21.03198],
    tone: "orange",
    title: "Stop 1: Hoan Kiem Lake",
    desc: "Ngoc Son Temple & Turtle Tower",
  },
  {
    n: 2,
    coords: [105.84999, 21.03517],
    tone: "amber",
    title: "Stop 2: Old Quarter 36 Streets",
    desc: "Ta Hien Nightlife & Food",
  },
  {
    n: 3,
    coords: [105.8402, 21.0345],
    tone: "emerald",
    title: "Stop 3: Imperial Citadel",
    desc: "UNESCO World Heritage",
    tooltipLeft: true,
  },
  {
    n: 4,
    coords: [105.83519, 21.02767],
    tone: "sky",
    title: "Stop 4: Temple of Literature",
    desc: "First Imperial Academy",
  },
];

const LEG_COLORS = { 1: "#f97316", 2: "#10b981", 3: "#0ea5e9" };

const fmtKm = (m) => `${(m / 1000).toFixed(1)} km`;

export default function HanoiRouteMap() {
  const { path, project, legs } = useMemo(() => {
    // Fit theo tuyến đường để 4 điểm dừng luôn nằm gọn trong khung.
    const projection = geoMercator().fitExtent(
      [
        [46, 34],
        [VIEWBOX_W - 34, VIEWBOX_H - 34],
      ],
      routeLegs
    );
    const pathGen = geoPath(projection);
    return {
      path: pathGen,
      project: projection,
      legs: routeLegs.features
        .slice()
        .sort((a, b) => a.properties.leg - b.properties.leg),
    };
  }, []);

  const pins = useMemo(
    () =>
      STOPS.map((s) => {
        const [x, y] = project(s.coords);
        return { ...s, left: (x / VIEWBOX_W) * 100, top: (y / VIEWBOX_H) * 100 };
      }),
    [project]
  );

  return (
    <div className="wl-hmap">
      {/* Bản đồ dựng từ dữ liệu OSM/PostGIS thật: ranh giới phường, đường chính, tuyến pgRouting */}
      <div className="wl-hmap__body">
        <svg
          className="wl-hmap__svg"
          viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
          role="img"
          aria-label="Hanoi walking route map"
        >
          {/* Ranh giới phường */}
          <g className="wl-hmap__wards">
            {wards.features.map((f, i) => (
              <path
                key={`w-${i}`}
                d={path(f)}
                fill="#e2e8f0"
                fillOpacity="0.45"
                stroke="#cbd5e1"
                strokeWidth="0.5"
              />
            ))}
          </g>

          {/* Trục đường chính */}
          <g className="wl-hmap__roads">
            {mainRoads.features.map((f, i) => (
              <path
                key={`r-${i}`}
                d={path(f)}
                fill="none"
                stroke="#94a3b8"
                strokeOpacity="0.55"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* Tuyến đi bộ thật, tách theo từng chặng */}
          <g className="wl-hmap__route">
            {legs.map((f) => (
              <path
                key={`leg-${f.properties.leg}`}
                className="animate-route-dash"
                d={path(f)}
                fill="none"
                stroke={LEG_COLORS[f.properties.leg]}
                strokeDasharray="6,6"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.6"
              />
            ))}
          </g>
        </svg>

        {/* Pin tương tác đặt theo toạ độ thật */}
        {pins.map((p) => (
          <div
            key={p.n}
            className={`wl-hmap__pin-wrapper wl-hmap__pin-wrapper--${p.n}`}
            style={{ top: `${p.top}%`, left: `${p.left}%` }}
          >
            <div className={`wl-hmap__pin wl-hmap__pin--${p.tone}`}>{p.n}</div>
            <div
              className={`wl-hmap__tooltip ${p.tooltipLeft ? "wl-hmap__tooltip--left" : ""}`}
            >
              <span className={`wl-hmap__tooltip-title wl-hmap__tooltip-title--${p.tone}`}>
                {p.title}
              </span>
              <span className="wl-hmap__tooltip-desc">{p.desc}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
