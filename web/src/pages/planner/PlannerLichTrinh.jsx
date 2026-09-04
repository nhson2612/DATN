import { useState } from "react";
import { ChonChoNgu, ChonDiaDiem, dongPhu, nhanNgay } from "./PlannerHelpers";

function KhoiNgay({
  ngay,
  startDate,
  diemDen,
  ds,
  choNgu,
  chuaXep,
  onHover,
  onXep,
  onBoNgay,
  onChuyen,
  onXem,
  onDatChoNgu,
  onBoChoNgu,
  onToiUu,
  dangLuu,
  toiUu,
  onVeDuong,
  dangVe,
  duong,
}) {
  const [keo, setKeo] = useState(false);
  const [moChon, setMoChon] = useState(false);

  return (
    <section
      onMouseEnter={() => onHover(ngay)}
      onMouseLeave={() => onHover(null)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setKeo(true);
      }}
      onDragLeave={() => setKeo(false)}
      onDrop={(e) => {
        e.preventDefault();
        setKeo(false);
        try {
          const d = JSON.parse(e.dataTransfer.getData("application/json"));
          onXep(d, ngay);
        } catch (err) {
          console.error(err);
        }
      }}
      className={`day ${keo ? "day--drag-over" : ""}`}
    >
      <div className="day__header">
        <h2 className="day__title">{nhanNgay(startDate, ngay)}</h2>
        <span className="day__count">{ds.length} điểm</span>
        <div className="day__actions">
          {ds.length >= 3 && (
            <button
              onClick={onToiUu}
              disabled={dangLuu}
              className="day__action"
              title="Sắp lại thứ tự cho đi ít đường nhất"
            >
              Tối ưu
            </button>
          )}
          {ds.length >= 2 && (
            <button
              onClick={onVeDuong}
              disabled={dangVe}
              className="day__action"
              title="Tính đường bộ thật bằng pgRouting"
            >
              {dangVe ? "Đang tính" : "Đường bộ"}
            </button>
          )}
        </div>
      </div>

      {toiUu && (
        <p className="day__note">
          Đã sắp lại: {(toiUu.truoc_m / 1000).toFixed(1)} km còn{" "}
          <b>{(toiUu.sau_m / 1000).toFixed(1)} km</b>{" "}
          <span className="day__note-dim">(chim bay)</span>
        </p>
      )}
      {duong && (
        <p className="day__note">
          Đường bộ thật: <b>{(duong.met / 1000).toFixed(1)} km</b>{" "}
          <span className="day__note-dim">
            ({duong.isClosed ? "khép kín qua chỗ ngủ" : `${ds.length - 1} chặng`})
          </span>
        </p>
      )}

      <ChonChoNgu
        ngay={ngay}
        ds={ds}
        choNgu={choNgu}
        diemDen={diemDen}
        onDat={onDatChoNgu}
        onBo={onBoChoNgu}
      />

      {ds.length === 0 ? (
        <p className="day__empty">Chưa có địa điểm nào cho ngày này.</p>
      ) : (
        <ol className="day__list">
          {ds.map((s, i) => (
            <li key={`${s.type}-${s.id}`} className="stop group">
              <span className="stop__index">{i + 1}</span>
              <button
                onClick={() => onXem(s)}
                className="stop__main"
                title="Xem thông tin trên bản đồ"
              >
                <span className="stop__name">{s.name}</span>
                {dongPhu(s) && <span className="stop__desc">{dongPhu(s)}</span>}
              </button>
              <div className="stop__tools">
                <div className="stop__reorder">
                  <button
                    onClick={() => onChuyen(s, -1)}
                    disabled={i === 0}
                    aria-label="Lên trước"
                    className="stop__reorder-btn"
                  >
                    <i className="fa-solid fa-caret-up" />
                  </button>
                  <button
                    onClick={() => onChuyen(s, 1)}
                    disabled={i === ds.length - 1}
                    aria-label="Xuống sau"
                    className="stop__reorder-btn"
                  >
                    <i className="fa-solid fa-caret-down" />
                  </button>
                </div>
                <button
                  onClick={() => onBoNgay(s)}
                  className="stop__remove"
                  aria-label={`Bỏ ${s.name} khỏi ngày này`}
                  title="Bỏ khỏi ngày, vẫn giữ trong mục"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}

      {moChon ? (
        <div className="chon-ngay">
          {chuaXep.length > 0 && (
            <>
              <p className="chon-ngay__nhan">Từ các mục đã lưu</p>
              <div className="chon-ngay__chips">
                {chuaXep.map((s) => (
                  <button
                    key={`${s.type}-${s.id}`}
                    onClick={() => {
                      onXep(s, ngay);
                      setMoChon(false);
                    }}
                    className="chon-ngay__chip"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            </>
          )}
          <ChonDiaDiem
            diemDen={diemDen}
            nhan="Hoặc tìm địa điểm khác"
            moSan
            onChon={(p) => {
              onXep(p, ngay);
              setMoChon(false);
            }}
          />
          <button onClick={() => setMoChon(false)} className="chon-ngay__dong">
            Đóng
          </button>
        </div>
      ) : (
        <button onClick={() => setMoChon(true)} className="itinerary__add-row mt-2">
          <i className="fa-solid fa-plus text-[11px]" /> Thêm địa điểm cho ngày này
        </button>
      )}
    </section>
  );
}

export default function PlannerLichTrinh({
  trip,
  cacNgay,
  theoNgay,
  choNguTheoNgay,
  chuaXep,
  diemDen,
  ngayRefs,
  onHover,
  onXep,
  onBoNgay,
  onChuyen,
  onXem,
  onDatChoNgu,
  onBoChoNgu,
  onToiUu,
  dangLuu,
  toiUu,
  onVeDuong,
  dangVe,
  duong,
}) {
  return (
    <>
      <h2 className="pane__title">Lịch trình</h2>
      <p className="pane__desc">
        Mỗi ngày chọn địa điểm từ các mục ở phần Tổng quan, hoặc tìm địa điểm khác.
        Chọn khác thì địa điểm đó tự được thêm vào mục đầu tiên.
      </p>

      <div className="pane__days">
        {cacNgay.map((ngay) => (
          <div key={ngay} ref={(el) => (ngayRefs.current[ngay] = el)}>
            <KhoiNgay
              ngay={ngay}
              startDate={trip.start_date}
              diemDen={diemDen}
              ds={theoNgay[ngay] || []}
              choNgu={choNguTheoNgay[ngay]}
              chuaXep={chuaXep}
              onHover={onHover}
              onXep={onXep}
              onBoNgay={onBoNgay}
              onChuyen={onChuyen}
              onXem={onXem}
              onDatChoNgu={onDatChoNgu}
              onBoChoNgu={onBoChoNgu}
              onToiUu={() => onToiUu(ngay)}
              dangLuu={dangLuu}
              toiUu={toiUu?.day === ngay ? toiUu : null}
              onVeDuong={() => onVeDuong(ngay)}
              dangVe={dangVe === ngay}
              duong={duong?.day === ngay ? duong : null}
            />
          </div>
        ))}
      </div>
    </>
  );
}
