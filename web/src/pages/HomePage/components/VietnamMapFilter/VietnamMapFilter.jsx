import React, { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import vietnamOutline from "../../../../data/vietnam-outline.geo.json";
import "./VietnamMapFilter.css";

const VIEWBOX_W = 240;
const VIEWBOX_H = 380;

/** Toạ độ đô thị thật (lon, lat) — chiếu bằng cùng projection với bản đồ. */
const DESTINATIONS = [
  {
    id: "hagiang",
    region: "bac",
    coords: [104.9784, 22.8233],
    title: "Ha Giang",
    desc: "18 Buckwheat Flower Tours",
    tone: "amber",
    ping: true,
  },
  {
    id: "hanoi",
    region: "bac",
    coords: [105.8342, 21.0278],
    title: "Hanoi Capital",
    desc: "35 Cultural & Food Tours",
    tone: "emerald",
    ping: true,
  },
  {
    id: "halong",
    region: "bac",
    coords: [107.0448, 20.9101],
    title: "Ninh Binh & Ha Long",
    desc: "42 Heritage Cruise Tours",
    tone: "amber",
  },
  {
    id: "danang",
    region: "trung",
    coords: [108.2208, 16.0544],
    title: "Da Nang - Hoi An",
    desc: "29 Beach & Ancient Town Tours",
    tone: "sky",
  },
  {
    id: "hcm",
    region: "nam",
    coords: [106.6297, 10.8231],
    title: "Ho Chi Minh City",
    desc: "26 Dynamic & Mekong Delta Tours",
    tone: "purple",
  },
];

const REGIONS = [
  { id: "bac", label: "North" },
  { id: "trung", label: "Central" },
  { id: "nam", label: "South" },
];

export default function VietnamMapFilter() {
  const [activeRegion, setActiveRegion] = useState("bac");

  // Chiếu ranh giới thật vào viewBox; projection dùng chung cho cả marker.
  const { outlinePath, project } = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [
        [16, 12],
        [VIEWBOX_W - 52, VIEWBOX_H - 12],
      ],
      vietnamOutline
    );
    return {
      outlinePath: geoPath(projection)(vietnamOutline),
      project: projection,
    };
  }, []);

  const spots = useMemo(
    () =>
      DESTINATIONS.map((d) => {
        const [x, y] = project(d.coords);
        return { ...d, left: (x / VIEWBOX_W) * 100, top: (y / VIEWBOX_H) * 100 };
      }),
    [project]
  );

  const visibleSpots = spots.filter((s) => s.region === activeRegion);

  return (
    <div className="wl-vmap">
      {/* Region Filter Tabs */}
      <div className="wl-vmap__tabs-container">
        <div className="wl-vmap__tabs">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveRegion(r.id)}
              className={`wl-vmap__tab ${
                activeRegion === r.id ? "wl-vmap__tab--active" : ""
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Vietnam Map (real PostGIS boundary) */}
      <div className="wl-vmap__body">
        <div className="wl-vmap__banner">
          <span className="wl-vmap__hint">
            <span className="wl-vmap__ping"></span> Click destination to view tours
          </span>
          <span className="wl-vmap__count">{visibleSpots.length} Destinations</span>
        </div>

        <div className="wl-vmap__map-box">
          <svg
            className="wl-vmap__svg"
            viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
            role="img"
            aria-label="Map of Vietnam"
          >
            <path
              className="wl-vmap__territory"
              d={outlinePath}
              fill="#e0f2fe"
              stroke="#38bdf8"
              strokeLinejoin="round"
              strokeWidth="1"
            />

            {/* Hoang Sa */}
            <circle cx="196" cy="150" fill="#0284c7" opacity="0.8" r="2.5" />
            <circle cx="201" cy="155" fill="#0284c7" opacity="0.6" r="1.8" />
            <text fill="#94a3b8" fontSize="6.5" fontWeight="600" x="168" y="143">
              Hoang Sa Islands
            </text>

            {/* Truong Sa */}
            <circle cx="205" cy="268" fill="#0284c7" opacity="0.8" r="2.5" />
            <circle cx="211" cy="275" fill="#0284c7" opacity="0.6" r="2" />
            <text fill="#94a3b8" fontSize="6.5" fontWeight="600" x="176" y="261">
              Truong Sa Islands
            </text>
          </svg>

          {/* Interactive Floating City Hotspots */}
          {visibleSpots.map((s) => (
            <div
              key={s.id}
              className={`wl-vmap__spot wl-vmap__spot--${s.id}`}
              style={{ top: `${s.top}%`, left: `${s.left}%` }}
            >
              <span className="wl-vmap__spot-ping">
                {s.ping && (
                  <span
                    className={`wl-vmap__spot-wave wl-vmap__spot-wave--${
                      s.tone === "amber" ? "orange" : s.tone
                    }`}
                  ></span>
                )}
                <svg
                  viewBox="0 0 384 512"
                  className={`wl-vmap__pin-icon wl-vmap__pin-icon--${s.tone}`}
                  role="img"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M192 0C86 0 0 84.4 0 188.6 0 307.9 120.2 450.9 170.4 505.4 182.2 518.2 201.8 518.2 213.6 505.4 263.8 450.9 384 307.9 384 188.6 384 84.4 298 0 192 0z"
                  ></path>
                </svg>
              </span>
              <div className="wl-vmap__tooltip">
                <span className={`wl-vmap__tooltip-title wl-vmap__tooltip-title--${s.tone}`}>
                  {s.title}
                </span>
                <span className="wl-vmap__tooltip-desc">{s.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
