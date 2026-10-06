import { useEffect, useRef, useState } from "react";

import { api } from "../../../shared/api";
import "./PointSearch.css";

const TOI_THIEU_KY_TU = 2;

// Cache lưu trữ kết quả tìm kiếm trong phiên để không tốn chi phí gọi Serper trùng lặp
const cacheTimKiem = new Map();

export default function PointSearch({
  tinh,
  onPick,
  onThemGhiChu,
  onThemDanhSach,
}) {
  const [tuKhoa, setTuKhoa] = useState("");
  const [ketQua, setKetQua] = useState([]);
  const [dangTim, setDangTim] = useState(false);
  const [loi, setLoi] = useState("");
  const [daTim, setDaTim] = useState(false);
  const [moDropdown, setMoDropdown] = useState(false);
  const [mucDangChon, setMucDangChon] = useState(-1);

  const wrapperRef = useRef(null);
  const abortRef = useRef(null);
  const tuVuaTimRef = useRef("");

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setMoDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const thucHienTim = async (tu, batBuoc = false) => {
    if (!tinh) {
      setLoi("Vui lòng chọn điểm đến chính ở bước 1 trước.");
      return;
    }
    if (tu.length < TOI_THIEU_KY_TU) {
      setLoi(`Gõ từ ${TOI_THIEU_KY_TU} ký tự để tìm kiếm.`);
      return;
    }

    const cacheKey = `${tinh}:${tu.toLowerCase()}`;
    if (cacheTimKiem.has(cacheKey)) {
      const items = cacheTimKiem.get(cacheKey);
      setKetQua(items);
      setDaTim(true);
      setMoDropdown(true);
      setDangTim(false);
      setMucDangChon(items.length > 0 ? 0 : -1);
      tuVuaTimRef.current = tu;
      return;
    }

    if (!batBuoc && tu === tuVuaTimRef.current) {
      return;
    }
    tuVuaTimRef.current = tu;

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setLoi("");
    setDangTim(true);
    try {
      const data = await api.searchPlaces(
        {
          q: tu,
          place_type: "poi",
          destination: tinh,
          page_size: 8,
        },
        { signal: controller.signal }
      );
      const items = data.items || [];
      cacheTimKiem.set(cacheKey, items);
      setKetQua(items);
      setDaTim(true);
      setMoDropdown(true);
      setMucDangChon(items.length > 0 ? 0 : -1);
    } catch (error) {
      if (error.name === "AbortError") return;
      setLoi(error.message);
    } finally {
      setDangTim(false);
    }
  };

  // Tìm kiếm tức thì khi người dùng gõ phím (đã bỏ debounce)
  useEffect(() => {
    const tu = tuKhoa.trim();

    if (tu.length < TOI_THIEU_KY_TU) {
      setKetQua([]);
      setDaTim(false);
      setLoi("");
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    if (!tinh) {
      setLoi("Vui lòng chọn điểm đến chính ở bước 1 trước.");
      return;
    }

    thucHienTim(tu);
  }, [tuKhoa, tinh]);

  const chon = (diem) => {
    if (abortRef.current) abortRef.current.abort();
    onPick({
      id: diem.id,
      name: diem.name,
      dia_chi: diem.dia_chi || diem.category,
      lon: diem.lon,
      lat: diem.lat,
      anh: diem.anh,
    });
    setTuKhoa("");
    setKetQua([]);
    setDaTim(false);
    setMoDropdown(false);
    setMucDangChon(-1);
    tuVuaTimRef.current = "";
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      if (moDropdown && mucDangChon >= 0 && mucDangChon < ketQua.length) {
        chon(ketQua[mucDangChon]);
      } else {
        const tu = tuKhoa.trim();
        if (tu.length >= TOI_THIEU_KY_TU) {
          thucHienTim(tu, true);
        }
      }
      return;
    }

    if (!moDropdown || ketQua.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMucDangChon((prev) => (prev + 1) % ketQua.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setMucDangChon((prev) => (prev - 1 + ketQua.length) % ketQua.length);
    } else if (event.key === "Escape") {
      setMoDropdown(false);
    }
  };

  return (
    <div className="op-wizard__add-place" ref={wrapperRef}>
      <div className="op-wizard__add-place-row">
        <div className="op-wizard__search-input-wrap">
          <span className="material-symbols-outlined op-wizard__search-input-icon">
            location_on
          </span>
          <input
            className="op-wizard__search-input"
            placeholder="Thêm địa điểm..."
            value={tuKhoa}
            onChange={(event) => {
              setTuKhoa(event.target.value);
              if (!moDropdown) setMoDropdown(true);
            }}
            onFocus={() => {
              if (ketQua.length > 0) setMoDropdown(true);
            }}
            onKeyDown={handleKeyDown}
          />
          {dangTim && (
            <span className="op-wizard__search-spinner material-symbols-outlined">
              progress_activity
            </span>
          )}
          {tuKhoa && !dangTim && (
            <button
              type="button"
              className="op-wizard__search-clear-btn"
              title="Xoá từ khoá"
              onClick={() => {
                setTuKhoa("");
                setKetQua([]);
                setMoDropdown(false);
              }}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        {/* Nút tròn thêm Ghi chú (theo ảnh 5.png) */}
        {onThemGhiChu && (
          <button
            type="button"
            className="op-wizard__round-btn"
            title="Thêm ghi chú vào lịch trình"
            onClick={onThemGhiChu}
          >
            <span className="material-symbols-outlined">sticky_note_2</span>
          </button>
        )}

        {/* Nút tròn thêm Checklist (theo ảnh 5.png) */}
        {onThemDanhSach && (
          <button
            type="button"
            className="op-wizard__round-btn"
            title="Thêm danh sách việc cần làm (Checklist)"
            onClick={onThemDanhSach}
          >
            <span className="material-symbols-outlined">format_list_bulleted</span>
          </button>
        )}
      </div>

      {loi && (
        <p className="op-wizard__error">
          <span className="material-symbols-outlined op-wizard__error-icon">error</span>
          {loi}
        </p>
      )}

      {/* Modal / Dropdown kết quả tìm kiếm nổi bật */}
      {moDropdown && (
        <div className="op-wizard__search-results-modal">
          {dangTim && (
            <div className="op-wizard__search-loading-row">
              <span className="material-symbols-outlined">search</span>
              <span>Đang tìm kiếm địa điểm...</span>
            </div>
          )}

          {!dangTim && daTim && ketQua.length === 0 && (
            <div className="op-wizard__search-empty-row">
              <span className="material-symbols-outlined">location_off</span>
              <span>Không tìm thấy địa điểm nào phù hợp.</span>
            </div>
          )}

          {!dangTim && ketQua.length > 0 && (
            <div className="op-scroll op-wizard__search-results-list">
              <div className="op-wizard__search-results-header">
                <span>Kết quả tìm kiếm ({ketQua.length})</span>
                <small>Bấm vào để thêm vào lịch trình</small>
              </div>
              {ketQua.map((diem, index) => (
                <button
                  type="button"
                  key={diem.id || index}
                  className={`op-wizard__search-item    ${
                    index === mucDangChon ? "op-wizard__search-item--active" : ""
                  }`}
                  onPointerEnter={() => setMucDangChon(index)}
                  onClick={() => chon(diem)}
                >
                  <span className="op-wizard__search-item-pin">
                    <span className="material-symbols-outlined">location_on</span>
                  </span>
                  <div className="op-wizard__search-item-info">
                    <span className="op-wizard__search-item-name">{diem.name}</span>
                    <span className="op-wizard__search-item-addr">
                      {diem.dia_chi || diem.category || "Địa điểm tham quan"}
                    </span>
                  </div>
                  <span className="material-symbols-outlined op-wizard__search-item-add-icon">
                    add_circle
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
