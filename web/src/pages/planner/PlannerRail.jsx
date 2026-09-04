import { nhanNgay } from "./PlannerHelpers";

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
    <nav className="rail">
      <button
        onClick={onTongQuan}
        className={`rail__head ${muc === "tong-quan" ? "rail__head--active" : ""}`}
      >
        Tổng quan
      </button>
      {sections.map((m) => (
        <button
          key={m.key}
          onClick={() => onMuc(m.key)}
          className={`rail__item ${
            muc === "tong-quan" && mucChon === m.key ? "rail__item--active" : ""
          }`}
        >
          <span className="truncate">{m.name}</span>
          {(theoMuc[m.key] || []).length > 0 && (
            <span className="rail__count">{theoMuc[m.key].length}</span>
          )}
        </button>
      ))}

      <button
        onClick={() => onNgay(1)}
        className={`rail__head ${muc === "lich-trinh" ? "rail__head--active" : ""}`}
      >
        Lịch trình
      </button>
      {cacNgay.map((ngay) => (
        <button
          key={ngay}
          onClick={() => onNgay(ngay)}
          className={`rail__item ${
            muc === "lich-trinh" && ngayChon === ngay ? "rail__item--active" : ""
          }`}
        >
          <span className="truncate">{nhanNgay(startDate, ngay)}</span>
          {(theoNgay[ngay] || []).length > 0 && (
            <span className="rail__count">{theoNgay[ngay].length}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
