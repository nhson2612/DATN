import { useState } from "react";
import { iconLoai, tenLoai } from "../../lib/loaiDiaDiem";
import PlannerGroup from "./PlannerGroup";
import PlannerPlacePicker from "./PlannerPlacePicker";
import { nhanNgay } from "./plannerUtils";
import "./PlannerTongQuan.css";

const MUC_MAC_DINH = "muon-di";

/**
 * Giao diện Tổng quan hành trình
 */
export default function PlannerTongQuan({
  trip,
  diemDen,
  sections,
  theoMuc,
  goiY,
  sectionRefs,
  onThemVaoMuc,
  onXoa,
  onBoNgay,
  onXem,
  onThemMuc,
  onDoiTenMuc,
  onXoaMuc,
}) {
  const [tenMucMoi, setTenMucMoi] = useState("");
  const [dangThemMuc, setDangThemMuc] = useState(false);
  const mucDau = sections[0]?.key || MUC_MAC_DINH;

  const ketThuc = trip.start_date
    ? nhanNgay(trip.start_date, trip.duration_days)
    : null;

  return (
    <div className="planner-overview">
      {/* Khối Hero */}
      <div className="planner-overview__hero">
        <h2 className="planner-overview__hero-title">{trip.name}</h2>
        <div className="planner-overview__hero-meta">
          {diemDen && (
            <span className="planner-overview__chip">
              <i className="fa-solid fa-location-dot" />
              <span>{diemDen.replace(/^(Thành phố|Tỉnh)\s+/i, "")}</span>
            </span>
          )}
          {trip.start_date && (
            <span className="planner-overview__chip">
              <i className="fa-regular fa-calendar" />
              <span>
                {nhanNgay(trip.start_date, 1)}
                {ketThuc ? ` tới ${ketThuc}` : ""}
              </span>
            </span>
          )}
          <span className="planner-overview__chip">
            <i className="fa-solid fa-clock" />
            <span>{trip.duration_days} ngày</span>
          </span>
        </div>

        <div className="planner-overview__hero-finder">
          <PlannerPlacePicker
            diemDen={diemDen}
            nhan="Tìm địa điểm, quán ăn hoặc chỗ nghỉ"
            moSan
            onChon={(p) => onThemVaoMuc(p, mucDau)}
          />
        </div>
      </div>

      {/* Gợi ý nổi bật */}
      {goiY && goiY.length > 0 && (
        <section className="planner-overview__suggestions">
          <h3 className="planner-overview__suggestions-title">
            Gợi ý nổi bật{diemDen ? ` tại ${diemDen.replace(/^(Thành phố|Tỉnh)\s+/i, "")}` : ""}
          </h3>
          <div className="planner-overview__suggestions-row">
            {goiY.map((p) => (
              <article key={`${p.type}-${p.id}`} className="planner-overview__sug-card">
                <div className="planner-overview__sug-icon-box">
                  <i className={`fa-solid ${iconLoai(p.category)}`} />
                </div>
                <p className="planner-overview__sug-name" title={p.name}>
                  {p.name}
                </p>
                <p className="planner-overview__sug-cat">
                  {tenLoai(p.category)}
                </p>
                <button
                  type="button"
                  onClick={() => onThemVaoMuc(p, mucDau)}
                  className="planner-overview__sug-add-btn"
                  title="Thêm vào danh sách muốn đi"
                >
                  <i className="fa-solid fa-plus" />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Danh sách các khối mục */}
      {sections.map((m) => (
        <div key={m.key} ref={(el) => (sectionRefs.current[m.key] = el)}>
          <PlannerGroup
            muc={m}
            ds={theoMuc[m.key] || []}
            diemDen={diemDen}
            coTheXoa={sections.length > 1}
            onThem={(p) => onThemVaoMuc(p, m.key)}
            onXoa={onXoa}
            onBoNgay={onBoNgay}
            onXem={onXem}
            onDoiTen={(ten) => onDoiTenMuc(m.key, ten)}
            onXoaMuc={() => onXoaMuc(m.key)}
          />
        </div>
      ))}

      {/* Form hoặc nút thêm mục mới */}
      {dangThemMuc ? (
        <form
          className="planner-overview__add-group-form"
          onSubmit={(e) => {
            e.preventDefault();
            onThemMuc(tenMucMoi);
            setTenMucMoi("");
            setDangThemMuc(false);
          }}
        >
          <input
            autoFocus
            value={tenMucMoi}
            onChange={(e) => setTenMucMoi(e.target.value)}
            placeholder="Tên mục mới, ví dụ: Nhà hàng, Quán ăn, Chỗ chụp ảnh..."
            className="planner-overview__add-group-input"
          />
          <button type="submit" className="planner-overview__add-group-submit">
            Thêm mục
          </button>
          <button
            type="button"
            onClick={() => setDangThemMuc(false)}
            className="planner-overview__add-group-cancel"
          >
            Huỷ
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setDangThemMuc(true)}
          className="planner-overview__add-group-btn"
        >
          <i className="fa-solid fa-plus text-[11px]" />
          <span>Thêm mục mới</span>
        </button>
      )}
    </div>
  );
}
