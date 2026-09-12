import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { tenLoai } from "../../lib/loaiDiaDiem";
import { dongPhu } from "./plannerUtils";
import PlannerPlacePicker from "./PlannerPlacePicker";
import "./PlannerLodgingPicker.css";

/**
 * Component quản lý nơi nghỉ đêm (khách sạn, homestay) cho từng ngày
 */
export default function PlannerLodgingPicker({
  ngay,
  ds,
  choNgu,
  diemDen,
  onDat,
  onBo,
}) {
  const [mo, setMo] = useState(false);
  const [ganDay, setGanDay] = useState(null);
  const [dangTai, setDangTai] = useState(false);

  // Tính tọa độ trung tâm của các địa điểm trong ngày để tìm khách sạn lân cận
  const tam = useMemo(() => {
    const co = (ds || []).filter((s) => s.lon != null && s.lat != null);
    if (!co.length) return null;
    return {
      lon: co.reduce((t, s) => t + Number(s.lon), 0) / co.length,
      lat: co.reduce((t, s) => t + Number(s.lat), 0) / co.length,
    };
  }, [ds]);

  useEffect(() => {
    if (!mo || !tam) return;
    let huy = false;
    setDangTai(true);
    api
      .nearbyPlaces({
        lon: tam.lon,
        lat: tam.lat,
        place_type: "accommodation",
        meters: 4000,
        limit: 10,
      })
      .then((d) => !huy && setGanDay(d.items || []))
      .catch(() => !huy && setGanDay([]))
      .finally(() => !huy && setDangTai(false));
    return () => {
      huy = true;
    };
  }, [mo, tam]);

  if (choNgu) {
    return (
      <div className="planner-lodging-picker">
        <div className="planner-lodging-picker__card">
          <div className="planner-lodging-picker__icon">
            <i className="fa-solid fa-bed" />
          </div>
          <div className="planner-lodging-picker__info">
            <span className="planner-lodging-picker__badge">
              Nơi Nghỉ Đêm (Đã Xác Nhận)
            </span>
            <h4 className="planner-lodging-picker__name">{choNgu.name}</h4>
            <p className="planner-lodging-picker__meta">
              {dongPhu(choNgu) || "Chỗ nghỉ đêm này"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onBo(ngay)}
            className="planner-lodging-picker__remove-btn"
            title="Bỏ chỗ nghỉ đêm này"
          >
            Bỏ chọn
          </button>
        </div>
      </div>
    );
  }

  if (!mo) {
    return (
      <div className="planner-lodging-picker">
        <button
          type="button"
          onClick={() => setMo(true)}
          className="planner-lodging-picker__trigger"
        >
          <i className="fa-solid fa-bed text-[11px]" />
          <span>+ Chọn nơi nghỉ đêm cho Ngày {ngay}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="planner-lodging-picker">
      <div className="planner-lodging-picker__panel">
        <div className="planner-lodging-picker__panel-head">
          <h5 className="planner-lodging-picker__panel-title">
            Chỗ nghỉ gần hành trình Ngày {ngay}
          </h5>
          <button
            type="button"
            onClick={() => setMo(false)}
            className="planner-lodging-picker__close-btn"
          >
            Đóng
          </button>
        </div>

        {!tam ? (
          <>
            <p className="planner-lodging-picker__empty">
              Thêm ít nhất một địa điểm cho ngày này để gợi ý chỗ nghỉ ở gần. Hoặc tìm theo tên:
            </p>
            <PlannerPlacePicker
              diemDen={diemDen}
              placeType="accommodation"
              moSan
              nhan="Tìm khách sạn, resort..."
              placeholder="Nhập tên khách sạn, homestay..."
              onChon={(p) => {
                onDat(p, ngay);
                setMo(false);
              }}
            />
          </>
        ) : dangTai ? (
          <p className="planner-lodging-picker__empty">Đang tìm chỗ nghỉ gần đó...</p>
        ) : !ganDay?.length ? (
          <>
            <p className="planner-lodging-picker__empty">
              Không có chỗ nghỉ nào trong bán kính 4 km. Thử tìm kiếm theo tên:
            </p>
            <PlannerPlacePicker
              diemDen={diemDen}
              placeType="accommodation"
              moSan
              nhan="Tìm khách sạn, homestay..."
              onChon={(p) => {
                onDat(p, ngay);
                setMo(false);
              }}
            />
          </>
        ) : (
          <ul className="planner-lodging-picker__list">
            {ganDay.map((h) => (
              <li key={`${h.type}-${h.id}`} className="planner-lodging-picker__item">
                <div className="planner-lodging-picker__item-info">
                  <p className="planner-lodging-picker__item-name">{h.name}</p>
                  <p className="planner-lodging-picker__item-meta">
                    {[
                      tenLoai(h.category || h.amenity || h.tourism),
                      h.met != null && `cách ~${Math.round(h.met)} m`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onDat(h, ngay);
                    setMo(false);
                  }}
                  className="planner-lodging-picker__select-btn"
                >
                  Chọn
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
