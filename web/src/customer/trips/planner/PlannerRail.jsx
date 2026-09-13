import { useState } from "react";
import "./PlannerRail.css";

function nhanNgayRail(startDate, dayIndex) {
  if (!startDate) return `Day ${dayIndex}`;
  try {
    const d = new Date(startDate);
    d.setDate(d.getDate() + (dayIndex - 1));
    const daysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const wd = daysEn[d.getDay()];
    const m = d.getMonth() + 1;
    const date = d.getDate();
    return `${wd} ${m}/${date}`;
  } catch {
    return `Day ${dayIndex}`;
  }
}

function layTieuDeDiem(stops = []) {
  const places = stops.filter(
    (s) => s.role !== "lodging" && s.role !== "note" && s.role !== "checklist"
  );
  if (!places.length) return "";
  const names = places.slice(0, 2).map((p) => p.name || "Địa điểm");
  let str = names.join(" • ");
  if (str.length > 22) str = str.slice(0, 20) + "...";
  return str;
}

/**
 * Thanh rail điều hướng danh mục & các ngày của chuyến đi chuẩn Wanderlog (ảnh w1 - w5)
 */
export default function PlannerRail({
  sections = [],
  theoMuc = {},
  cacNgay = [],
  theoNgay = {},
  startDate,
  activeSection = "overview",
  onNavigate,
  onOpenAssistant,
  onToggleSidebar,
  isCollapsed = false,
}) {
  const [openOverview, setOpenOverview] = useState(true);
  const [openItinerary, setOpenItinerary] = useState(true);
  const [openBudget, setOpenBudget] = useState(true);

  const handleNav = (targetId) => {
    if (onNavigate) {
      onNavigate(targetId);
    } else {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  const isOverviewActive =
    activeSection === "overview" ||
    activeSection === "overview-explore" ||
    activeSection === "overview-places" ||
    activeSection.startsWith("section-");

  return (
    <aside className={`planner-rail ${isCollapsed ? "planner-rail--collapsed" : ""}`}>
      {/* 1. Nút AI Assistant Gradient ở đỉnh (w1 - w5) */}
      <div className="planner-rail__ai-wrap">
        <button
          type="button"
          onClick={onOpenAssistant}
          className="planner-rail__ai-btn"
          title="Trợ lý du lịch AI"
        >
          <span className="planner-rail__ai-sparkle">
            <i className="fa-solid fa-wand-magic-sparkles" />
          </span>
          <span className="planner-rail__ai-label">AI Assistant</span>
        </button>
      </div>

      {/* 2. Danh mục cuộn điều hướng */}
      <div className="planner-rail__scroll-tree">
        {/* NHÓM 1: OVERVIEW */}
        <div className="planner-rail__group">
          <div
            className={`planner-rail__group-header ${
              activeSection === "overview" ? "planner-rail__group-header--active-pill" : ""
            }`}
            onClick={() => {
              setOpenOverview(!openOverview);
              handleNav("overview");
            }}
          >
            <div className="planner-rail__group-title-left">
              <span className="planner-rail__chevron">
                <i className={`fa-solid ${openOverview ? "fa-chevron-down" : "fa-chevron-right"}`} />
              </span>
              <span className="planner-rail__group-name">Overview</span>
            </div>
          </div>

          {openOverview && (
            <div className="planner-rail__sub-items">
              <button
                type="button"
                onClick={() => handleNav("overview-explore")}
                className={`planner-rail__sub-item ${
                  activeSection === "overview-explore" ? "planner-rail__sub-item--active" : ""
                }`}
              >
                <span className="planner-rail__sub-text">Explore</span>
              </button>

              <button
                type="button"
                onClick={() => handleNav("overview-places")}
                className={`planner-rail__sub-item ${
                  activeSection === "overview-places" ? "planner-rail__sub-item--active" : ""
                }`}
              >
                <span className="planner-rail__sub-text">Places to visit</span>
                {(theoMuc[sections[0]?.key] || []).length > 0 && (
                  <span className="planner-rail__sub-count">
                    {theoMuc[sections[0]?.key].length}
                  </span>
                )}
              </button>

              {/* Các danh mục tuỳ chọn thêm (ví dụ: Hotel, Nhà hàng...) */}
              {sections.slice(1).map((m) => {
                const isActive = activeSection === `section-${m.key}`;
                const count = (theoMuc[m.key] || []).length;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => handleNav(`section-${m.key}`)}
                    className={`planner-rail__sub-item ${
                      isActive ? "planner-rail__sub-item--active" : ""
                    }`}
                  >
                    <span className="planner-rail__sub-text">{m.name}</span>
                    {count > 0 && (
                      <span className="planner-rail__sub-count">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* NHÓM 2: ITINERARY */}
        <div className="planner-rail__group">
          <div
            className="planner-rail__group-header"
            onClick={() => {
              setOpenItinerary(!openItinerary);
              handleNav("itinerary-section");
            }}
          >
            <div className="planner-rail__group-title-left">
              <span className="planner-rail__chevron">
                <i className={`fa-solid ${openItinerary ? "fa-chevron-down" : "fa-chevron-right"}`} />
              </span>
              <span className="planner-rail__group-name">Itinerary</span>
            </div>
          </div>

          {openItinerary && (
            <div className="planner-rail__sub-items">
              {cacNgay.map((ngay) => {
                const isActive = activeSection === `day-${ngay}`;
                const stopsInDay = theoNgay[ngay] || [];
                const subtitle = layTieuDeDiem(stopsInDay);

                return (
                  <button
                    key={ngay}
                    type="button"
                    onClick={() => handleNav(`day-${ngay}`)}
                    className={`planner-rail__day-item ${
                      isActive ? "planner-rail__day-item--active" : ""
                    }`}
                  >
                    <div className="planner-rail__day-info">
                      <span className="planner-rail__day-title">
                        {nhanNgayRail(startDate, ngay)}
                      </span>
                      {subtitle ? (
                        <span className="planner-rail__day-sub" title={subtitle}>
                          {subtitle}
                        </span>
                      ) : null}
                    </div>
                    {stopsInDay.length > 0 && (
                      <span className="planner-rail__sub-count">
                        {stopsInDay.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* NHÓM 3: BUDGET */}
        <div className="planner-rail__group">
          <div
            className="planner-rail__group-header"
            onClick={() => {
              setOpenBudget(!openBudget);
              handleNav("budget-section");
            }}
          >
            <div className="planner-rail__group-title-left">
              <span className="planner-rail__chevron">
                <i className={`fa-solid ${openBudget ? "fa-chevron-down" : "fa-chevron-right"}`} />
              </span>
              <span className="planner-rail__group-name">Budget</span>
            </div>
          </div>

          {openBudget && (
            <div className="planner-rail__sub-items">
              <button
                type="button"
                onClick={() => handleNav("budget-section")}
                className={`planner-rail__sub-item ${
                  activeSection === "budget-section" || activeSection === "budget-view"
                    ? "planner-rail__sub-item--active"
                    : ""
                }`}
              >
                <span className="planner-rail__sub-text">View</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. Phần dưới chân thanh rail: Support & Hide sidebar (ảnh w1 - w5) */}
      <div className="planner-rail__footer">
        <button
          type="button"
          onClick={() => window.open("mailto:support@wanderlog.vn", "_blank")}
          className="planner-rail__footer-btn"
        >
          <span className="material-symbols-outlined text-[18px]">support_agent</span>
          <span>Support</span>
        </button>

        <button
          type="button"
          onClick={onToggleSidebar}
          className="planner-rail__footer-btn"
        >
          <span className="material-symbols-outlined text-[18px]">
            keyboard_double_arrow_left
          </span>
          <span>Hide sidebar</span>
        </button>
      </div>
    </aside>
  );
}
