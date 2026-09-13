import { useState } from "react";
import { api } from "../../../shared/api";
import { tenLoai } from "../../../shared/lib/loaiDiaDiem";
import "./PlannerPlacePicker.css";

/**
 * Component tìm kiếm và chọn địa điểm thêm vào mục hoặc ngày
 */
export default function PlannerPlacePicker({
  diemDen,
  nhan = "Thêm địa điểm",
  placeholder,
  placeType = "poi",
  moSan = false,
  onChon,
}) {
  const [mo, setMo] = useState(moSan);
  const [q, setQ] = useState("");
  const [ds, setDs] = useState(null);
  const [dangTim, setDangTim] = useState(false);

  async function tim(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    setDangTim(true);
    try {
      const d = await api.searchPlaces({
        q: q.trim(),
        destination: diemDen || "",
        place_type: placeType,
        page_size: 8,
      });
      setDs(d.items || []);
    } catch {
      setDs([]);
    } finally {
      setDangTim(false);
    }
  }

  if (!mo) {
    return (
      <button
        type="button"
        onClick={() => setMo(true)}
        className="planner-place-picker__trigger"
      >
        <i className="fa-solid fa-plus text-[11px]" />
        <span>{nhan}</span>
      </button>
    );
  }

  return (
    <div className="planner-place-picker">
      <form onSubmit={tim} className="planner-place-picker__form">
        <div className="planner-place-picker__input-wrap">
          <i className="fa-solid fa-magnifying-glass planner-place-picker__icon" />
          <input
            autoFocus
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder || nhan}
            className="planner-place-picker__input"
          />
        </div>
        <button
          type="submit"
          disabled={dangTim}
          className="planner-place-picker__submit-btn"
        >
          {dangTim ? "..." : "Tìm"}
        </button>
        {!moSan && (
          <button
            type="button"
            onClick={() => {
              setMo(false);
              setDs(null);
            }}
            className="planner-place-picker__cancel-btn"
          >
            Huỷ
          </button>
        )}
      </form>

      {ds && (
        ds.length === 0 ? (
          <p className="planner-place-picker__status">Không tìm thấy địa điểm nào khớp.</p>
        ) : (
          <ul className="planner-place-picker__list">
            {ds.map((p) => (
              <li key={`${p.type}-${p.id}`} className="planner-place-picker__item">
                <div className="planner-place-picker__item-info">
                  <p className="planner-place-picker__item-name">{p.name}</p>
                  <p className="planner-place-picker__item-meta">
                    {[tenLoai(p.category || p.amenity || p.tourism), p.dia_chi].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onChon(p);
                    setQ("");
                    setDs(null);
                  }}
                  className="planner-place-picker__item-btn"
                >
                  + Thêm
                </button>
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
