import { useState } from "react";
import PlannerPlacePicker from "./PlannerPlacePicker";
import { dongPhu } from "./plannerUtils";
import "./PlannerGroup.css";

/**
 * Component hiển thị một khối danh mục địa điểm (KhoiMuc) trong phần Tổng quan
 */
export default function PlannerGroup({
  muc,
  ds,
  diemDen,
  coTheXoa,
  onThem,
  onXoa,
  onBoNgay,
  onXem,
  onDoiTen,
  onXoaMuc,
}) {
  const [doiTen, setDoiTen] = useState(false);
  const [ten, setTen] = useState(muc.name);

  return (
    <section className="planner-group">
      <div className="planner-group__header">
        {doiTen ? (
          <form
            className="planner-group__rename-form"
            onSubmit={(e) => {
              e.preventDefault();
              onDoiTen(ten);
              setDoiTen(false);
            }}
          >
            <input
              autoFocus
              value={ten}
              onChange={(e) => setTen(e.target.value)}
              className="planner-group__rename-input"
            />
            <button type="submit" className="planner-group__btn">
              Lưu
            </button>
            <button
              type="button"
              onClick={() => setDoiTen(false)}
              className="planner-group__btn"
            >
              Huỷ
            </button>
          </form>
        ) : (
          <>
            <div className="planner-group__title-wrap">
              <span className="planner-group__dot" />
              <h3 className="planner-group__title">{muc.name}</h3>
              <span className="planner-group__count">{ds.length} điểm</span>
            </div>

            <div className="planner-group__actions">
              <button
                type="button"
                onClick={() => {
                  setTen(muc.name);
                  setDoiTen(true);
                }}
                className="planner-group__btn"
              >
                Đổi tên
              </button>
              {coTheXoa && (
                <button
                  type="button"
                  onClick={onXoaMuc}
                  className="planner-group__btn planner-group__btn--danger"
                >
                  Xoá mục
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {ds.length === 0 ? (
        <p className="planner-group__empty">Chưa có địa điểm nào trong mục này.</p>
      ) : (
        <ul className="planner-group__list">
          {ds.map((s) => (
            <li
              key={`${s.type}-${s.id}`}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(
                  "application/json",
                  JSON.stringify({ type: s.type, id: s.id })
                );
                e.dataTransfer.effectAllowed = "move";
              }}
              className="planner-group__item"
            >
              <span className="planner-group__item-pin">
                <i className="fa-solid fa-location-dot" />
              </span>

              <button
                type="button"
                onClick={() => onXem(s)}
                className="planner-group__item-main"
                title="Xem trên bản đồ"
              >
                <span className="planner-group__item-name">{s.name}</span>
                {dongPhu(s) && (
                  <span className="planner-group__item-desc">{dongPhu(s)}</span>
                )}
              </button>

              <div className="planner-group__item-tools">
                {s.day ? (
                  <button
                    type="button"
                    onClick={() => onBoNgay(s)}
                    className="planner-group__item-badge"
                    title="Bỏ khỏi ngày, vẫn giữ trong mục"
                  >
                    Ngày {s.day}
                  </button>
                ) : (
                  <span className="planner-group__item-badge planner-group__item-badge--unassigned">
                    Chưa xếp
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => onXoa(s)}
                  aria-label={`Bỏ ${s.name}`}
                  className="planner-group__item-remove"
                  title="Xoá khỏi danh mục"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <PlannerPlacePicker
        diemDen={diemDen}
        nhan={`+ Thêm địa điểm vào "${muc.name}"`}
        onChon={onThem}
      />
    </section>
  );
}
