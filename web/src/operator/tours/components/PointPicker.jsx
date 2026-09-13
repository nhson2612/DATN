import { useEffect, useState } from "react";

import { api } from "../../../shared/api";

const TOI_THIEU_KY_TU = 2;

/** Tìm điểm trong dữ liệu điểm của hệ thống (nguồn trong CSDL, không gọi ra ngoài)
 *  rồi trả về điểm đã chọn kèm mã để lưu vào lịch trình. */
export default function PointPicker({ onPick }) {
  const [tuKhoa, setTuKhoa] = useState("");
  const [ketQua, setKetQua] = useState([]);
  const [message, setMessage] = useState("");

  const duDai = tuKhoa.trim().length >= TOI_THIEU_KY_TU;

  useEffect(() => {
    if (!duDai) return undefined;

    let huy = false;
    const hen = setTimeout(() => {
      api
        .searchPlaces({ q: tuKhoa.trim(), place_type: "accommodation", page_size: 8 })
        .then((data) => {
          if (!huy) setKetQua(data.items || []);
        })
        .catch((error) => {
          if (!huy) setMessage(error.message);
        });
    }, 400);

    return () => {
      huy = true;
      clearTimeout(hen);
    };
  }, [tuKhoa, duDai]);

  return (
    <div className="op-picker">
      <input
        value={tuKhoa}
        placeholder="Gõ tên điểm từ 2 ký tự để tìm"
        onChange={(event) => setTuKhoa(event.target.value)}
      />

      {message && <p className="op-notice">{message}</p>}

      {ketQua.length > 0 && (
        <div className="op-scroll op-picker-results">
          {ketQua.map((diem) => (
            <button
              type="button"
              key={diem.id}
              className="op-picker-item"
              onClick={() => {
                onPick({ id: diem.id, name: diem.name });
                setTuKhoa("");
                setKetQua([]);
              }}
            >
              <b>{diem.name}</b>
              <span>
                {diem.dia_chi || diem.category} · mã {diem.id}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
