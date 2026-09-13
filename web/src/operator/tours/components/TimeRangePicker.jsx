import { useEffect, useRef, useState } from "react";

// Tạo 48 mốc thời gian cách nhau 30 phút theo chuẩn Wanderlog 12h AM/PM
const TIME_SLOTS = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    const minuteStr = m === 0 ? "00" : "30";
    TIME_SLOTS.push(`${hour12}:${minuteStr} ${ampm}`);
  }
}

/**
 * Bộ chọn khung giờ (Time Range Picker) mô phỏng chính xác giao diện Wanderlog (ảnh nuo.png).
 * Gồm: 2 ô Start time / End time, danh sách cuộn các mốc giờ 30 phút, nút Clear và Save.
 */
export default function TimeRangePicker({
  timeStart = "",
  timeEnd = "",
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeField, setActiveField] = useState("start"); // 'start' | 'end'
  const [tempStart, setTempStart] = useState(timeStart);
  const [tempEnd, setTempEnd] = useState(timeEnd);

  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Đồng bộ props vào state khi mở popover
  useEffect(() => {
    if (isOpen) {
      setTempStart(timeStart || "");
      setTempEnd(timeEnd || "");
      setActiveField("start");
    }
  }, [isOpen, timeStart, timeEnd]);

  // Click outside & phím Escape để đóng popover
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Cuộn danh sách đến mốc thời gian phù hợp khi mở
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const currentVal = activeField === "start" ? tempStart : tempEnd;
    const targetVal = currentVal || "08:00 AM";
    const targetIdx = TIME_SLOTS.indexOf(targetVal);
    if (targetIdx >= 0) {
      const itemHeight = 33; // chiều cao ước tính mỗi dòng
      listRef.current.scrollTop = Math.max(0, targetIdx * itemHeight - 60);
    }
  }, [isOpen, activeField, tempStart, tempEnd]);

  const handleSelectSlot = (slot) => {
    if (activeField === "start") {
      setTempStart(slot);
      // Nếu chưa có End time hoặc End time trước Start time, tự động đề xuất +1 tiếng
      if (!tempEnd) {
        const idx = TIME_SLOTS.indexOf(slot);
        if (idx >= 0 && idx + 2 < TIME_SLOTS.length) {
          setTempEnd(TIME_SLOTS[idx + 2]);
        }
      }
      // Tự động chuyển tiêu điểm sang ô End time giống Wanderlog
      setActiveField("end");
    } else {
      setTempEnd(slot);
    }
  };

  const handleSave = () => {
    onChange(tempStart, tempEnd);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempStart("");
    setTempEnd("");
    onChange("", "");
    setIsOpen(false);
  };

  const hasTime = Boolean(timeStart || timeEnd);
  const displayRange =
    timeStart && timeEnd
      ? `${timeStart} - ${timeEnd}`
      : timeStart || timeEnd;

  return (
    <div className="op-wizard__time-picker-wrapper" ref={containerRef}>
      {/* Nút bấm hiển thị trên thẻ địa điểm */}
      {hasTime ? (
        <div className="op-wizard__time-pill-group">
          <button
            type="button"
            className="op-wizard__time-pill"
            onClick={() => setIsOpen(!isOpen)}
            title="Chỉnh sửa khung giờ"
          >
            <span className="material-symbols-outlined text-[14px]">schedule</span>
            <span className="font-semibold text-[11px]">{displayRange}</span>
          </button>
          <button
            type="button"
            className="op-wizard__time-pill-clear"
            onClick={(e) => {
              e.stopPropagation();
              onChange("", "");
            }}
            title="Xoá thời gian"
          >
            <span className="material-symbols-outlined text-[13px]">close</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="op-wizard__add-time-btn"
          onClick={() => setIsOpen(!isOpen)}
          title="Thêm khung giờ tham quan"
        >
          <span className="material-symbols-outlined text-[15px]">schedule</span>
          <span>Add time</span>
        </button>
      )}

      {/* Popover Wanderlog Modal (ảnh nuo.png) */}
      {isOpen && (
        <div className="op-wizard__wander-popover animate-in fade-in zoom-in-95 duration-150">
          {/* Hàng 2 ô Start time — End time */}
          <div className="op-wizard__wander-inputs-row">
            <div
              className={`op-wizard__wander-time-box ${
                activeField === "start" ? "op-wizard__wander-time-box--active" : ""
              }`}
              onClick={() => setActiveField("start")}
            >
              <span className="op-wizard__wander-box-label">Start time</span>
              <div className="op-wizard__wander-box-val">
                {tempStart || <span className="text-zinc-400">--:--</span>}
              </div>
            </div>

            <span className="op-wizard__wander-dash">—</span>

            <div
              className={`op-wizard__wander-time-box ${
                activeField === "end" ? "op-wizard__wander-time-box--active" : ""
              }`}
              onClick={() => setActiveField("end")}
            >
              <span className="op-wizard__wander-box-label">End time</span>
              <div className="op-wizard__wander-box-val">
                {tempEnd || <span className="text-zinc-400">--:--</span>}
              </div>
            </div>
          </div>

          {/* Danh sách cuộn các mốc thời gian */}
          <div className="op-wizard__wander-slots-list" ref={listRef}>
            {TIME_SLOTS.map((slot) => {
              const isSelected =
                (activeField === "start" && tempStart === slot) ||
                (activeField === "end" && tempEnd === slot);

              return (
                <div
                  key={slot}
                  className={`op-wizard__wander-slot-item ${
                    isSelected ? "op-wizard__wander-slot-item--selected" : ""
                  }`}
                  onClick={() => handleSelectSlot(slot)}
                >
                  {slot}
                </div>
              );
            })}
          </div>

          {/* Hai nút hành động: Clear & Save */}
          <div className="op-wizard__wander-actions-row">
            <button
              type="button"
              className="op-wizard__wander-btn-clear"
              onClick={handleClear}
            >
              Clear
            </button>
            <button
              type="button"
              className="op-wizard__wander-btn-save"
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
