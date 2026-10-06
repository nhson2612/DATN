import { useEffect, useMemo, useState } from "react";

import { api } from "../../../shared/api";
import PointSearch from "./PointSearch";
import TimeRangePicker from "./TimeRangePicker";
import "./DayEditor.css";

const km = (m) => `${(m / 1000).toFixed(1).replace(".", ",")} km`;

// Danh sách gợi ý việc cần làm chuẩn trung tính cho nền sáng
const MAU_CONG_VIEC = [
  "Chuẩn bị CCCD / Hộ chiếu",
  "Tập trung trước giờ hẹn 15 phút",
  "Trang phục lịch sự, phù hợp điểm đến",
  "Mang theo sạc dự phòng & máy ảnh",
  "Chuẩn bị thuốc cá nhân & nón mũ",
];

/** Phân loại địa điểm để gắn tag icon trung tính, phù hợp nền sáng */
function layPhanLoaiDiaDiem(diem) {
  const chuoi = `${diem.category || ""} ${diem.name || ""} ${diem.dia_chi || ""}`.toLowerCase();
  if (
    chuoi.includes("chùa") ||
    chuoi.includes("đền") ||
    chuoi.includes("di tích") ||
    chuoi.includes("lăng") ||
    chuoi.includes("miếu") ||
    chuoi.includes("tháp")
  ) {
    return { nhan: "Di tích & Tâm linh", icon: "temple_buddhist" };
  }
  if (
    chuoi.includes("ăn") ||
    chuoi.includes("quán") ||
    chuoi.includes("ẩm thực") ||
    chuoi.includes("cafe") ||
    chuoi.includes("cà phê") ||
    chuoi.includes("nhà hàng") ||
    chuoi.includes("đặc sản")
  ) {
    return { nhan: "Ẩm thực & Cafe", icon: "restaurant" };
  }
  if (
    chuoi.includes("hồ") ||
    chuoi.includes("công viên") ||
    chuoi.includes("núi") ||
    chuoi.includes("thác") ||
    chuoi.includes("rừng") ||
    chuoi.includes("vườn") ||
    chuoi.includes("sinh thái")
  ) {
    return { nhan: "Thiên nhiên & Cảnh quan", icon: "park" };
  }
  if (
    chuoi.includes("bảo tàng") ||
    chuoi.includes("nhà hát") ||
    chuoi.includes("nghệ thuật") ||
    chuoi.includes("triển lãm") ||
    chuoi.includes("làng nghề")
  ) {
    return { nhan: "Văn hoá & Nghệ thuật", icon: "museum" };
  }
  if (
    chuoi.includes("biển") ||
    chuoi.includes("đảo") ||
    chuoi.includes("vịnh") ||
    chuoi.includes("bến") ||
    chuoi.includes("bãi tắm")
  ) {
    return { nhan: "Biển đảo & Sông nước", icon: "waves" };
  }
  return { nhan: diem.category || "Điểm tham quan", icon: "tour" };
}

// Cache danh sách gợi ý địa điểm theo tỉnh dùng chung cho toàn bộ các ngày trong tour
const cacheGoiYTheoTinh = new Map();

function DragHandle({ onDragStart, onDragEnd }) {
  return (
    <button
      type="button"
      className="op-wizard__drag-handle"
      title="Kéo để đổi vị trí"
      aria-label="Kéo để đổi vị trí"
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <span className="op-wizard__drag-dots" aria-hidden="true">
        {Array.from({ length: 6 }, (_, dotIndex) => <span key={dotIndex} />)}
      </span>
    </button>
  );
}

/**
 * Một ngày trong lịch trình — Thiết kế chuẩn nền sáng Wanderlog (ảnh 5.png)
 */
export default function DayEditor({ day, index, tinh, loi = "", onChange }) {
  const [khoangCach, setKhoangCach] = useState({});
  const [mo, setMo] = useState(true);
  const [goiY, setGoiY] = useState([]);
  const [hienGoiY, setHienGoiY] = useState(true);
  const [nhapChecklistTam, setNhapChecklistTam] = useState({});
  const [moPreMade, setMoPreMade] = useState({});
  const [dangKeoId, setDangKeoId] = useState(null);
  const [viTriTha, setViTriTha] = useState(null);

  // Khởi tạo timeline từ dữ liệu hiện có
  const timeline = useMemo(() => {
    if (day.timeline && Array.isArray(day.timeline) && day.timeline.length > 0) {
      return day.timeline;
    }
    const items = [];
    (day.places || []).forEach((p, pIdx) => {
      items.push({
        id: `place_${p.id || pIdx}_${pIdx}`,
        type: "place",
        place: p,
      });
    });
    if (day.description && day.description.trim()) {
      items.push({
        id: `note_init_${index}`,
        type: "note",
        text: day.description,
      });
    }
    if (day.checklist && day.checklist.length > 0) {
      items.push({
        id: `checklist_init_${index}`,
        type: "checklist",
        title: "Check list",
        items: day.checklist.map((c, cIdx) => ({
          id: `c_${cIdx}`,
          text: typeof c === "string" ? c : c.text,
          checked: false,
        })),
      });
    }
    return items;
  }, [day.timeline, day.places, day.description, day.checklist, index]);

  // Cập nhật timeline và đồng bộ ra `day.places`, `day.description`, `day.checklist`
  const capNhatTimeline = (moiTimeline) => {
    const places = moiTimeline
      .filter((it) => it.type === "place")
      .map((it) => it.place);

    const notes = moiTimeline
      .filter((it) => it.type === "note")
      .map((it) => it.text)
      .filter(Boolean);

    const checklists = moiTimeline
      .filter((it) => it.type === "checklist")
      .flatMap((it) => (it.items || []).map((sub) => (typeof sub === "string" ? sub : sub.text)))
      .filter(Boolean);

    onChange({
      ...day,
      timeline: moiTimeline,
      places,
      description: notes.join("\n\n"),
      checklist: checklists,
    });
  };

  const setField = (field, value) => onChange({ ...day, [field]: value });

  // Thêm địa điểm vào cuối stack (trên hàng add-place)
  const themDiem = (diem) => {
    if ((day.places || []).some((p) => String(p.id) === String(diem.id))) return;
    const newItem = {
      id: `place_${diem.id}_${Date.now()}`,
      type: "place",
      place: diem,
    };
    capNhatTimeline([...timeline, newItem]);
  };

  // Thêm ô ghi chú vào stack
  const themGhiChu = () => {
    const newItem = {
      id: `note_${Date.now()}`,
      type: "note",
      text: "",
    };
    capNhatTimeline([...timeline, newItem]);
  };

  // Thêm khối checklist vào stack
  const themChecklist = () => {
    const newItem = {
      id: `checklist_${Date.now()}`,
      type: "checklist",
      title: "Check list",
      items: [],
    };
    capNhatTimeline([...timeline, newItem]);
  };

  // Xoá một item bất kỳ khỏi timeline stack
  const xoaItem = (itemId) => {
    const moi = timeline.filter((it) => it.id !== itemId);
    capNhatTimeline(moi);
  };

  const batDauKeo = (event, itemId) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(itemId));
    const row = event.currentTarget.closest(".op-wizard__timeline-row");
    if (row && event.dataTransfer.setDragImage) {
      event.dataTransfer.setDragImage(row, 24, 18);
    }
    setDangKeoId(itemId);
  };

  const ketThucKeo = () => {
    setDangKeoId(null);
    setViTriTha(null);
  };

  const keoQuaItem = (event, itemId) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!dangKeoId || dangKeoId === itemId) {
      setViTriTha(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientY < rect.top + rect.height / 2 ? "before" : "after";
    setViTriTha((current) => (
      current?.itemId === itemId && current?.position === position
        ? current
        : { itemId, position }
    ));
  };

  const thaVaoItem = (event, targetId) => {
    event.preventDefault();
    const sourceId = dangKeoId || event.dataTransfer.getData("text/plain");
    const position = viTriTha?.itemId === targetId ? viTriTha.position : "before";
    if (!sourceId || sourceId === targetId) {
      ketThucKeo();
      return;
    }

    const sourceItem = timeline.find((it) => String(it.id) === String(sourceId));
    if (!sourceItem) {
      ketThucKeo();
      return;
    }
    const withoutSource = timeline.filter((it) => String(it.id) !== String(sourceId));
    const targetIndex = withoutSource.findIndex((it) => String(it.id) === String(targetId));
    if (targetIndex < 0) {
      ketThucKeo();
      return;
    }
    const insertIndex = targetIndex + (position === "after" ? 1 : 0);
    const reordered = [...withoutSource];
    reordered.splice(insertIndex, 0, sourceItem);
    capNhatTimeline(reordered);
    ketThucKeo();
  };

  const classNameHangKeo = (itemId) => [
    "op-wizard__timeline-row",
    dangKeoId === itemId ? "op-wizard__timeline-row--dragging" : "",
    viTriTha?.itemId === itemId ? `op-wizard__timeline-row--drop-${viTriTha.position}` : "",
  ].filter(Boolean).join(" ");

  // Sửa nội dung ghi chú
  const suaGhiChu = (itemId, text) => {
    const moi = timeline.map((it) => (it.id === itemId ? { ...it, text } : it));
    capNhatTimeline(moi);
  };

  // Cập nhật khung giờ của địa điểm (Time Range)
  const suaThoiGianDiem = (itemId, timeStart, timeEnd) => {
    const moi = timeline.map((it) => {
      if (it.id !== itemId) return it;
      const time_range =
        timeStart && timeEnd
          ? `${timeStart} - ${timeEnd}`
          : timeStart || timeEnd || "";
      return {
        ...it,
        place: {
          ...it.place,
          time_start: timeStart,
          time_end: timeEnd,
          time_range,
        },
      };
    });
    capNhatTimeline(moi);
  };

  // Cập nhật ghi chú của địa điểm
  const suaGhiChuDiem = (itemId, note) => {
    const moi = timeline.map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        place: {
          ...it.place,
          note,
        },
      };
    });
    capNhatTimeline(moi);
  };

  // Tiêu đề checklist nằm ngay trên item timeline để giữ đúng thứ tự và được
  // lưu cùng checklist. Cho phép xoá tạm khi đang gõ, nhưng không lưu title rỗng.
  const suaTieuDeChecklist = (itemId, title) => {
    const moi = timeline.map((it) => (it.id === itemId ? { ...it, title } : it));
    capNhatTimeline(moi);
  };

  const chuanHoaTieuDeChecklist = (itemId, title) => {
    if (title.trim()) return;
    suaTieuDeChecklist(itemId, "Check list");
  };

  // Đánh dấu đã ghé thăm
  const toggleVisitedDiem = (itemId) => {
    const moi = timeline.map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        place: {
          ...it.place,
          visited: !it.place?.visited,
        },
      };
    });
    capNhatTimeline(moi);
  };

  // Thêm mục việc vào khối checklist
  const themMucChecklist = (itemId) => {
    const text = (nhapChecklistTam[itemId] || "").trim();
    if (!text) return;
    const moi = timeline.map((it) => {
      if (it.id !== itemId) return it;
      const subItems = it.items || [];
      return {
        ...it,
        items: [...subItems, { id: `sub_${Date.now()}`, text, checked: false }],
      };
    });
    capNhatTimeline(moi);
    setNhapChecklistTam((prev) => ({ ...prev, [itemId]: "" }));
  };

  // Thêm mục từ gợi ý có sẵn vào checklist
  const themTuGoiY = (itemId, text) => {
    const moi = timeline.map((it) => {
      if (it.id !== itemId) return it;
      const subItems = it.items || [];
      if (subItems.some((s) => s.text === text)) return it;
      return {
        ...it,
        items: [...subItems, { id: `sub_${Date.now()}`, text, checked: false }],
      };
    });
    capNhatTimeline(moi);
  };

  // Toggle tick việc trong checklist
  const toggleMucChecklist = (itemId, subId) => {
    const moi = timeline.map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        items: (it.items || []).map((sub) =>
          sub.id === subId ? { ...sub, checked: !sub.checked } : sub
        ),
      };
    });
    capNhatTimeline(moi);
  };

  // Xoá 1 việc trong checklist
  const xoaMucChecklist = (itemId, subId) => {
    const moi = timeline.map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        items: (it.items || []).filter((sub) => sub.id !== subId),
      };
    });
    capNhatTimeline(moi);
  };

  // Tải danh sách gợi ý địa điểm theo tỉnh (dùng chung cache để không gọi API nhiều lần)
  useEffect(() => {
    if (!tinh) {
      setGoiY([]);
      return undefined;
    }

    if (cacheGoiYTheoTinh.has(tinh)) {
      setGoiY(cacheGoiYTheoTinh.get(tinh));
      return undefined;
    }

    let huy = false;
    api
      .searchPlaces({ destination: tinh, place_type: "poi", page_size: 6 })
      .then((data) => {
        if (!huy && data.items) {
          cacheGoiYTheoTinh.set(tinh, data.items);
          setGoiY(data.items);
        }
      })
      .catch(() => {});
    return () => {
      huy = true;
    };
  }, [tinh]);

  // Lọc các địa điểm gợi ý chưa được chọn
  const goiYChuaChon = useMemo(() => {
    const daChonIds = new Set((day.places || []).map((p) => String(p.id)));
    return (goiY || []).filter((g) => !daChonIds.has(String(g.id)));
  }, [goiY, day.places]);

  // Tính khoảng cách giữa các điểm tham quan liên tiếp
  const places = useMemo(() => {
    return timeline.filter((it) => it.type === "place").map((it) => it.place);
  }, [timeline]);

  const khoaCap = places.map((p) => `${p.lon},${p.lat}`).join("|");

  useEffect(() => {
    if (!mo) return undefined;
    const coToaDo = places.filter((p) => p.lon != null && p.lat != null);
    if (coToaDo.length < 2) {
      setKhoangCach({});
      return undefined;
    }
    let huy = false;
    (async () => {
      const ketQua = {};
      for (let i = 0; i < places.length - 1; i += 1) {
        const a = places[i];
        const b = places[i + 1];
        if (a.lon == null || b.lon == null) continue;
        try {
          const duong = await api.route({
            start_lon: a.lon,
            start_lat: a.lat,
            end_lon: b.lon,
            end_lat: b.lat,
          });
          if (duong && duong.total_distance_meters != null) {
            ketQua[i] = duong.total_distance_meters;
          }
        } catch {
          // Bỏ qua nếu không tính được đường đi
        }
      }
      if (!huy) setKhoangCach(ketQua);
    })();
    return () => {
      huy = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoaCap, mo]);

  // Bộ đếm số thứ tự cho các điểm tham quan
  let demDiem = 0;

  return (
    <section className={`op-wizard__day    ${loi ? "op-wizard__day--invalid" : ""}`}>
      {/* Header ngày: mũi tên thu gọn + Tiêu đề ngày; bên dưới là tiêu đề phụ (ảnh 5.png) */}
      <header className="op-wizard__day-head">
        <div className="op-wizard__day-title-row">
          <button
            type="button"
            className="op-wizard__day-toggle-btn"
            title={mo ? "Thu gọn ngày" : "Mở rộng ngày"}
            onClick={() => setMo(!mo)}
          >
            <span className="material-symbols-outlined">
              {mo ? "keyboard_arrow_down" : "chevron_right"}
            </span>
          </button>
          <h4 className="op-wizard__day-title">Ngày {index + 1}</h4>
          {loi && (
            <span className="op-wizard__error op-wizard__day-title-error">
              <span className="material-symbols-outlined op-wizard__error-icon">error</span>
              <span>{loi.replace(/^Ngày\s+\d+\s*[:-]?\s*/i, "")}</span>
            </span>
          )}
        </div>

        <div className="op-wizard__day-sub-wrap">
          <input
            className={`op-wizard__day-sub    ${loi ? "op-wizard__day-sub--invalid" : ""}`}
            placeholder="Thêm tiêu đề phụ (ví dụ: Khám phá phố cổ và văn hoá ẩm thực)"
            value={day.title || ""}
            onChange={(event) => setField("title", event.target.value)}
          />
        </div>
      </header>

      {mo && (
        <div className="op-wizard__day-content">
          {/* Timeline Stack dọc: Place, Note, Checklist */}
          {timeline.length > 0 && (
            <div className="op-wizard__timeline">
              {timeline.map((item, idx) => {
                const laItemCuoi = idx === timeline.length - 1;

                if (item.type === "place") {
                  demDiem += 1;
                  const sttHienTai = demDiem;
                  const pIdx = sttHienTai - 1;
                  const diem = item.place;
                  const phanLoai = layPhanLoaiDiaDiem(diem);

                  return (
                    <div
                      key={item.id}
                      className={classNameHangKeo(item.id)}
                      onDragOver={(event) => keoQuaItem(event, item.id)}
                      onDrop={(event) => thaVaoItem(event, item.id)}
                    >
                      {/* Cột marker bên trái: Huy hiệu số tròn màu xanh ngọc (cyan) */}
                      <div className="op-wizard__marker-col">
                        <span className="op-wizard__place-badge">{sttHienTai}</span>
                        {!laItemCuoi && <div className="op-wizard__connector-line" />}
                      </div>

                      {/* Thẻ địa điểm nền xám nhạt trung tính (ảnh 5.png) */}
                      <div className="op-wizard__timeline-body">
                        <div className="op-wizard__place-card">
                          <div className="op-wizard__place-card-top">
                            <DragHandle
                              onDragStart={(event) => batDauKeo(event, item.id)}
                              onDragEnd={ketThucKeo}
                            />
                            <div className="op-wizard__place-card-info">
                              <div className="op-wizard__place-card-head-row">
                                <span className="op-wizard__place-card-name">{diem.name}</span>
                                <span className="op-wizard__place-cat-tag">
                                  <span className="material-symbols-outlined">{phanLoai.icon}</span>
                                  <span>{phanLoai.nhan}</span>
                                </span>
                              </div>
                              {diem.dia_chi && (
                                <span className="op-wizard__place-card-addr">{diem.dia_chi}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              className="op-wizard__item-delete-btn"
                              title="Xoá điểm này"
                              onClick={() => xoaItem(item.id)}
                            >
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </div>

                          {/* Dòng nhập ghi chú địa điểm phong cách Wanderlog */}
                          <input
                            type="text"
                            className="op-wizard__place-card-note-input"
                            placeholder="Add notes, links, etc. here..."
                            value={diem.note || ""}
                            onChange={(e) => suaGhiChuDiem(item.id, e.target.value)}
                          />

                          {/* Hàng nút hành động chuẩn Wanderlog: Mark as visited, Time Range Picker */}
                          <div className="op-wizard__place-actions-row">
                            <button
                              type="button"
                              className={`op-wizard__place-action-btn    ${
                                diem.visited ? "op-wizard__place-action-btn--active" : ""
                              }`}
                              onClick={() => toggleVisitedDiem(item.id)}
                              title={diem.visited ? "Đã đánh dấu ghé thăm" : "Đánh dấu đã ghé thăm"}
                            >
                              <span className="material-symbols-outlined op-day-editor__span-1">
                                {diem.visited ? "check_circle" : "check"}
                              </span>
                              <span>Mark as visited</span>
                            </button>

                            {/* Bộ chọn khung giờ Wanderlog (ảnh nuo.png) */}
                            <TimeRangePicker
                              timeStart={diem.time_start}
                              timeEnd={diem.time_end}
                              onChange={(start, end) => suaThoiGianDiem(item.id, start, end)}
                            />
                          </div>
                        </div>

                        {/* Khoảng cách di chuyển đến điểm tiếp theo */}
                        {pIdx < places.length - 1 && khoangCach[pIdx] != null && (
                          <div className="op-wizard__distance-tag">
                            <span className="material-symbols-outlined">directions_walk</span>
                            <span>Khoảng cách: {km(khoangCach[pIdx])}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }

                if (item.type === "note") {
                  return (
                    <div
                      key={item.id}
                      className={classNameHangKeo(item.id)}
                      onDragOver={(event) => keoQuaItem(event, item.id)}
                      onDrop={(event) => thaVaoItem(event, item.id)}
                    >
                      {/* Cột marker bên trái: Huy hiệu xám trung tính (ảnh 5.png) */}
                      <div className="op-wizard__marker-col">
                        <span className="op-wizard__note-badge">
                          <span className="material-symbols-outlined">sticky_note_2</span>
                        </span>
                        {!laItemCuoi && <div className="op-wizard__connector-line" />}
                      </div>

                      {/* Thẻ ô nhập ghi chú nền sáng xám nhạt trung tính */}
                      <div className="op-wizard__timeline-body">
                        <div className="op-wizard__note-card">
                          <DragHandle
                            onDragStart={(event) => batDauKeo(event, item.id)}
                            onDragEnd={ketThucKeo}
                          />
                          <span className="material-symbols-outlined op-wizard__note-card-icon">
                            edit_note
                          </span>
                          <input
                            className="op-wizard__note-input"
                            placeholder="Ghi chú cho ngày này..."
                            value={item.text || ""}
                            onChange={(e) => suaGhiChu(item.id, e.target.value)}
                            autoFocus={!item.text}
                          />
                          <button
                            type="button"
                            className="op-wizard__item-delete-btn"
                            title="Xoá ghi chú này"
                            onClick={() => xoaItem(item.id)}
                          >
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (item.type === "checklist") {
                  const subItems = item.items || [];
                  const moSuggestions = !!moPreMade[item.id];

                  return (
                    <div
                      key={item.id}
                      className={classNameHangKeo(item.id)}
                      onDragOver={(event) => keoQuaItem(event, item.id)}
                      onDrop={(event) => thaVaoItem(event, item.id)}
                    >
                      {/* Cột marker bên trái: Huy hiệu xám trung tính */}
                      <div className="op-wizard__marker-col">
                        <span className="op-wizard__checklist-badge">
                          <span className="material-symbols-outlined">checklist</span>
                        </span>
                        {!laItemCuoi && <div className="op-wizard__connector-line" />}
                      </div>

                      {/* Khối checklist card nền sáng trung tính (ảnh 5.png) */}
                      <div className="op-wizard__timeline-body">
                        <div className="op-wizard__checklist-card">
                          <div className="op-wizard__checklist-head">
                            <div className="op-wizard__checklist-head-title">
                              <DragHandle
                                onDragStart={(event) => batDauKeo(event, item.id)}
                                onDragEnd={ketThucKeo}
                              />
                              <span className="material-symbols-outlined">task_alt</span>
                              <input
                                type="text"
                                className="op-wizard__checklist-title"
                                aria-label="Tiêu đề checklist"
                                title="Nhấp để sửa tiêu đề"
                                value={item.title ?? "Check list"}
                                onChange={(e) => suaTieuDeChecklist(item.id, e.target.value)}
                                onBlur={(e) => chuanHoaTieuDeChecklist(item.id, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    e.currentTarget.blur();
                                  }
                                }}
                              />
                              <span className="op-wizard__checklist-count-badge">
                                {subItems.filter((s) => s.checked).length}/{subItems.length}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="op-wizard__item-delete-btn"
                              title="Xoá danh sách này"
                              onClick={() => xoaItem(item.id)}
                            >
                              <span className="material-symbols-outlined">close</span>
                            </button>
                          </div>

                          {/* Danh sách các việc đã tạo với checkbox tròn ◯ */}
                          {subItems.length > 0 && (
                            <div className="op-wizard__checklist-list">
                              {subItems.map((sub) => (
                                <div
                                  key={sub.id}
                                  className={`op-wizard__checklist-row    ${
                                    sub.checked ? "op-wizard__checklist-row--checked" : ""
                                  }`}
                                >
                                  <button
                                    type="button"
                                    className={`op-wizard__circle-check    ${
                                      sub.checked ? "op-wizard__circle-check--active" : ""
                                    }`}
                                    onClick={() => toggleMucChecklist(item.id, sub.id)}
                                  >
                                    {sub.checked && (
                                      <span className="material-symbols-outlined">check</span>
                                    )}
                                  </button>
                                  <span
                                    className="op-wizard__checklist-text"
                                    onClick={() => toggleMucChecklist(item.id, sub.id)}
                                  >
                                    {sub.text}
                                  </span>
                                  <button
                                    type="button"
                                    className="op-wizard__checklist-item-del"
                                    title="Xoá mục này"
                                    onClick={() => xoaMucChecklist(item.id, sub.id)}
                                  >
                                    <span className="material-symbols-outlined">close</span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Dòng nhập thêm việc mới (◯ Add some items) */}
                          <div className="op-wizard__checklist-add-row">
                            <span className="op-wizard__circle-check-ghost" />
                            <input
                              className="op-wizard__checklist-add-input"
                              placeholder="Thêm việc cần làm... (nhấn Enter)"
                              value={nhapChecklistTam[item.id] || ""}
                              onChange={(e) =>
                                setNhapChecklistTam((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  themMucChecklist(item.id);
                                }
                              }}
                            />
                            {(nhapChecklistTam[item.id] || "").trim() && (
                              <button
                                type="button"
                                className="op-wizard__checklist-add-btn"
                                onClick={() => themMucChecklist(item.id)}
                              >
                                Thêm
                              </button>
                            )}
                          </div>

                          {/* Gợi ý việc làm có sẵn (Pre-made lists) */}
                          <div className="op-wizard__premade-wrap">
                            <button
                              type="button"
                              className="op-wizard__premade-trigger"
                              onClick={() =>
                                setMoPreMade((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
                              }
                            >
                              <span className="material-symbols-outlined">work_outline</span>
                              <span>Gợi ý việc cần làm (Pre-made lists)</span>
                              <span className="material-symbols-outlined">
                                {moSuggestions ? "expand_less" : "expand_more"}
                              </span>
                            </button>

                            {moSuggestions && (
                              <div className="op-wizard__premade-options">
                                {MAU_CONG_VIEC.map((viec, vIdx) => (
                                  <button
                                    type="button"
                                    key={vIdx}
                                    className="op-wizard__premade-chip"
                                    onClick={() => themTuGoiY(item.id, viec)}
                                  >
                                    <span className="material-symbols-outlined">add</span>
                                    <span>{viec}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

          {/* Hàng thêm điểm: LUÔN NẰM Ở CUỐI CÙNG theo yêu cầu (ảnh 5.png) */}
          <PointSearch
            tinh={tinh}
            onPick={themDiem}
            onThemGhiChu={themGhiChu}
            onThemDanhSach={themChecklist}
          />

          {/* Khu vực gợi ý địa điểm (Recommended places theo ảnh 5.png) */}
          {goiYChuaChon.length > 0 && (
            <div className="op-wizard__recommended-section">
              <button
                type="button"
                className="op-wizard__recommended-toggle"
                onClick={() => setHienGoiY(!hienGoiY)}
              >
                <span className="material-symbols-outlined">
                  {hienGoiY ? "keyboard_arrow_down" : "chevron_right"}
                </span>
                <span>Địa điểm gợi ý ({goiYChuaChon.length})</span>
              </button>

              {hienGoiY && (
                <div className="op-scroll op-wizard__recommended-carousel">
                  {goiYChuaChon.map((diem) => {
                    const phanLoai = layPhanLoaiDiaDiem(diem);

                    return (
                      <div key={diem.id} className="op-wizard__recommended-card">
                        <div className="op-wizard__recommended-img-wrap">
                          <img
                            src={
                              diem.anh ||
                              "/assets/images/tour-danang.jpg"
                            }
                            alt={diem.name}
                            className="op-wizard__recommended-img"
                          />
                        </div>
                        <div className="op-wizard__recommended-info">
                          <span className="op-wizard__recommended-name" title={diem.name}>
                            {diem.name}
                          </span>
                          <span className="op-wizard__recommended-cat">
                            {phanLoai.nhan}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="op-wizard__recommended-add-btn"
                          title={`Thêm ${diem.name} vào ngày`}
                          onClick={() => themDiem(diem)}
                        >
                          <span className="material-symbols-outlined">add</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
