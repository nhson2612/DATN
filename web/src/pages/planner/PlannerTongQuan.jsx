import { useState } from "react";
import PlaceFinder from "../../components/finder/PlaceFinder";
import { iconLoai, tenLoai } from "../../lib/loaiDiaDiem";
import { ChonDiaDiem, dongPhu, nhanNgay } from "./PlannerHelpers";

const MUC_MAC_DINH = "muon-di";

function KhoiMuc({
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
    <section className="day">
      <div className="day__header">
        {doiTen ? (
          <form
            className="flex-1 flex gap-2"
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
              className="ui-field flex-1 !py-1 text-[13px]"
            />
            <button type="submit" className="day__action">
              Lưu
            </button>
          </form>
        ) : (
          <>
            <h2 className="day__title">{muc.name}</h2>
            <span className="day__count">{ds.length} điểm</span>
            <div className="day__actions">
              <button
                onClick={() => {
                  setTen(muc.name);
                  setDoiTen(true);
                }}
                className="day__action"
              >
                Đổi tên
              </button>
              {coTheXoa && (
                <button onClick={onXoaMuc} className="day__action day__action--nguy">
                  Xoá mục
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {ds.length === 0 ? (
        <p className="day__empty">Chưa có địa điểm nào trong mục này.</p>
      ) : (
        <ul className="day__list">
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
              className="stop group"
            >
              <span className="stop__index stop__index--plain">
                <i className="fa-solid fa-location-dot text-[10px]" />
              </span>
              <button
                onClick={() => onXem(s)}
                className="stop__main"
                title="Xem thông tin trên bản đồ"
              >
                <span className="stop__name">{s.name}</span>
                {dongPhu(s) && <span className="stop__desc">{dongPhu(s)}</span>}
              </button>
              <div className="stop__tools">
                {s.day ? (
                  <button
                    onClick={() => onBoNgay(s)}
                    className="stop__badge"
                    title="Bỏ khỏi ngày, vẫn giữ trong mục"
                  >
                    Ngày {s.day}
                  </button>
                ) : (
                  <span className="stop__badge stop__badge--mo">Chưa xếp</span>
                )}
                <button
                  onClick={() => onXoa(s)}
                  aria-label={`Bỏ ${s.name}`}
                  className="stop__remove"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ChonDiaDiem diemDen={diemDen} nhan="Thêm địa điểm vào mục này" onChon={onThem} />
    </section>
  );
}

export default function PlannerTongQuan({
  trip,
  diemDen,
  viTri,
  sections,
  theoMuc,
  goiY,
  sectionRefs,
  onResults,
  onPick,
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
    <>
      <div className="hero">
        <h2 className="hero__title">{trip.name}</h2>
        <p className="hero__meta">
          {diemDen && (
            <span className="hero__chip">
              <i className="fa-solid fa-location-dot text-[10px]" />
              {diemDen.replace(/^(Thành phố|Tỉnh)\s+/i, "")}
            </span>
          )}
          {trip.start_date && (
            <span className="hero__chip">
              <i className="fa-regular fa-calendar text-[10px]" />
              {nhanNgay(trip.start_date, 1)}
              {ketThuc ? ` tới ${ketThuc}` : ""}
            </span>
          )}
        </p>

        <div className="hero__finder">
          <PlaceFinder
            viTri={viTri}
            onResults={onResults}
            onPick={onPick}
            hanhDong={(p) => onThemVaoMuc(p, mucDau)}
            nhanHanhDong="Thêm vào chuyến"
          />
        </div>
      </div>

      {goiY.length > 0 && (
        <section className="noibat">
          <h3 className="noibat__title">
            Gợi ý{diemDen ? ` ở ${diemDen.replace(/^(Thành phố|Tỉnh)\s+/i, "")}` : ""}
          </h3>
          <div className="noibat__row">
            {goiY.map((p) => (
              <article key={`${p.type}-${p.id}`} className="noibat__card">
                <div className="noibat__thumb">
                  <i className={`fa-solid ${iconLoai(p.category)} noibat__icon`} />
                </div>
                <p className="noibat__name">{p.name}</p>
                <p className="noibat__cat">{tenLoai(p.category)}</p>
                <button
                  onClick={() => onThemVaoMuc(p, mucDau)}
                  className="noibat__add"
                  title="Thêm vào chuyến"
                >
                  <i className="fa-solid fa-plus text-[11px]" />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {sections.map((m) => (
        <div key={m.key} ref={(el) => (sectionRefs.current[m.key] = el)}>
          <KhoiMuc
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

      {dangThemMuc ? (
        <form
          className="muc-moi"
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
            placeholder="Tên mục, ví dụ: Nhà hàng, Quán cà phê, Chỗ ngủ"
            className="ui-field flex-1"
          />
          <button type="submit" className="btn-primary !py-2 !px-4 text-[13px]">
            Thêm
          </button>
          <button
            type="button"
            onClick={() => setDangThemMuc(false)}
            className="muc-moi__huy"
          >
            Huỷ
          </button>
        </form>
      ) : (
        <button onClick={() => setDangThemMuc(true)} className="itinerary__add-row">
          <i className="fa-solid fa-plus text-[11px]" /> Thêm mục mới
        </button>
      )}
    </>
  );
}
