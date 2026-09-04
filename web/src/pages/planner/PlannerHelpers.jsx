import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { tenLoai } from "../../lib/loaiDiaDiem";

export function dongPhu(s) {
  return [tenLoai(s.category), s.dia_chi || s.mo_ta].filter(Boolean).join(" · ");
}

export function nhanNgay(startDate, day) {
  const THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  if (!startDate) return `Ngày ${day}`;
  const d = new Date(startDate);
  d.setDate(d.getDate() + day - 1);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${THU[d.getDay()]}, ${dd}/${mm}`;
}

export function ChonChoNgu({ ngay, ds, choNgu, diemDen, onDat, onBo }) {
  const [mo, setMo] = useState(false);
  const [ganDay, setGanDay] = useState(null);
  const [dangTai, setDangTai] = useState(false);

  const tam = useMemo(() => {
    const co = ds.filter((s) => s.lon != null && s.lat != null);
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
    api.nearbyPlaces({
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
      <div className="chongu">
        <span className="chongu__icon">
          <i className="fa-solid fa-bed" />
        </span>
        <div className="chongu__info">
          <p className="chongu__name">{choNgu.name}</p>
          <p className="chongu__meta">{dongPhu(choNgu) || "Chỗ ngủ đêm này"}</p>
        </div>
        <button onClick={() => onBo(ngay)} className="chongu__bo">
          Bỏ chọn
        </button>
      </div>
    );
  }

  if (!mo) {
    return (
      <button onClick={() => setMo(true)} className="chongu__them">
        <i className="fa-solid fa-bed text-[11px]" /> Chọn chỗ ngủ đêm này
      </button>
    );
  }

  return (
    <div className="chongu__panel">
      <div className="chongu__panel-head">
        <span>Chỗ ngủ gần lịch trình ngày này</span>
        <button onClick={() => setMo(false)} className="chongu__dong">
          Đóng
        </button>
      </div>

      {!tam ? (
        <>
          <p className="chongu__trong">
            Thêm ít nhất một địa điểm cho ngày này để gợi ý chỗ ngủ ở gần. Hoặc tìm theo tên:
          </p>
          <ChonDiaDiem
            diemDen={diemDen}
            placeType="accommodation"
            moSan
            nhan="Tìm khách sạn, nhà nghỉ"
            onChon={(p) => {
              onDat(p, ngay);
              setMo(false);
            }}
          />
        </>
      ) : dangTai ? (
        <p className="chongu__trong">Đang tìm...</p>
      ) : !ganDay?.length ? (
        <p className="chongu__trong">Không có chỗ ngủ nào trong bán kính 4 km.</p>
      ) : (
        <ul className="chongu__list">
          {ganDay.map((h) => (
            <li key={`${h.type}-${h.id}`} className="chongu__item">
              <div className="chongu__item-info">
                <p className="chongu__item-name">{h.name}</p>
                <p className="chongu__item-meta">
                  {[tenLoai(h.category), h.met != null && `cách ${Math.round(h.met)} m`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                onClick={() => {
                  onDat(h, ngay);
                  setMo(false);
                }}
                className="chongu__chon"
              >
                Chọn
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ChonDiaDiem({
  diemDen,
  nhan = "Thêm địa điểm",
  placeType = "poi",
  moSan = false,
  onChon,
}) {
  const [mo, setMo] = useState(moSan);
  const [q, setQ] = useState("");
  const [ds, setDs] = useState(null);
  const [dangTim, setDangTim] = useState(false);

  async function tim(e) {
    e.preventDefault();
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
      <button onClick={() => setMo(true)} className="itinerary__add-row mt-2">
        <i className="fa-solid fa-plus text-[11px]" /> {nhan}
      </button>
    );
  }

  return (
    <div className="chondd">
      <form onSubmit={tim} className="chondd__form">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={nhan}
          className="ui-field flex-1"
        />
        <button
          type="submit"
          disabled={dangTim}
          className="btn-primary !py-2 !px-4 text-[13px]"
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
            className="chondd__huy"
          >
            Huỷ
          </button>
        )}
      </form>

      {ds &&
        (ds.length === 0 ? (
          <p className="chondd__trong">Không tìm thấy địa điểm nào khớp.</p>
        ) : (
          <ul className="chondd__list">
            {ds.map((p) => (
              <li key={`${p.type}-${p.id}`} className="chondd__item">
                <div className="chondd__info">
                  <p className="chondd__name">{p.name}</p>
                  <p className="chondd__meta">
                    {[tenLoai(p.category), p.dia_chi].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onChon(p);
                    setQ("");
                    setDs(null);
                  }}
                  className="chondd__them"
                >
                  Thêm
                </button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
