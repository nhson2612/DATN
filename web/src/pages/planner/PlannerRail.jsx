import { mauTheoNgay, nhanNgay } from "./plannerUtils";
import "./PlannerRail.css";

/**
 * Thanh rail điều hướng danh mục & các ngày của chuyến đi
 */
export default function PlannerRail({
  sections,
  theoMuc,
  cacNgay,
  theoNgay,
  startDate,
  muc,
  mucChon,
  ngayChon,
  onMuc,
  onNgay,
  onTongQuan,
}) {
  return (
    <nav className="planner-rail" aria-label="Điều hướng chuyến đi">
      {/* Nhóm: TỔNG QUAN HÀNH TRÌNH */}
      <div className="planner-rail__section-title">
        <span>Tổng quan</span>
      </div>

      <button
        type="button"
        onClick={onTongQuan}
        className={`planner-rail__item ${
          muc === "tong-quan" && !mucChon ? "planner-rail__item--active" : ""
        }`}
      >
        <span className="planner-rail__item-text">
          <span
            className="planner-rail__dot"
            style={{ backgroundColor: "#f15b4a" }}
          />
          <span className="planner-rail__item-title">Tổng quan chuyến đi</span>
        </span>
      </button>

      {sections.map((m, idx) => (
        <button
          key={m.key}
          type="button"
          onClick={() => onMuc(m.key)}
          className={`planner-rail__item ${
            muc === "tong-quan" && mucChon === m.key
              ? "planner-rail__item--active"
              : ""
          }`}
        >
          <span className="planner-rail__item-text">
            <span
              className="planner-rail__dot"
              style={{ backgroundColor: idx === 0 ? "#f15b4a" : "#c5c8c5" }}
            />
            <span className="planner-rail__item-title">{m.name}</span>
          </span>
          {(theoMuc[m.key] || []).length > 0 && (
            <span className="planner-rail__count">
              {theoMuc[m.key].length}
            </span>
          )}
        </button>
      ))}

      {/* Nhóm: LỊCH TRÌNH THEO NGÀY */}
      <div className="planner-rail__section-title">
        <span>Lịch trình chi tiết</span>
      </div>

      {cacNgay.map((ngay) => {
        const isActive = muc === "lich-trinh" && ngayChon === ngay;
        const color = mauTheoNgay(ngay);
        const count = (theoNgay[ngay] || []).length;

        return (
          <button
            key={ngay}
            type="button"
            onClick={() => onNgay(ngay)}
            className={`planner-rail__item ${
              isActive ? "planner-rail__item--active" : ""
            }`}
          >
            <span className="planner-rail__item-text">
              <span
                className="planner-rail__dot"
                style={{ backgroundColor: color }}
              />
              <span className="planner-rail__item-title">
                {nhanNgay(startDate, ngay)}
              </span>
            </span>
            {count > 0 && (
              <span className="planner-rail__count">{count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
