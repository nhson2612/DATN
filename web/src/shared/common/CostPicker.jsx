import { useEffect, useRef, useState } from "react";

function formatCost(cost) {
  if (!cost && cost !== 0) return "";
  const num = Number(cost);
  if (isNaN(num)) return String(cost);
  return `${num.toLocaleString("vi-VN")} ₫`;
}

/**
 * Bộ chọn chi phí (Cost Picker) đặt cạnh Add time trên stop-card chuẩn Wanderlog (ảnh nuo.png).
 */
export default function CostPicker({ cost = null, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempCost, setTempCost] = useState(cost || "");
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setTempCost(cost || "");
    }
  }, [isOpen, cost]);

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

  const handleSave = () => {
    const num = tempCost === "" ? null : Number(tempCost);
    onChange(num);
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempCost("");
    onChange(null);
    setIsOpen(false);
  };

  const hasCost = cost != null && cost !== "" && Number(cost) > 0;

  return (
    <div className="planner-day__cost-picker-wrapper" ref={containerRef}>
      {/* Nút bấm hiển thị trên thẻ địa điểm */}
      {hasCost ? (
        <div className="planner-day__cost-pill-group">
          <button
            type="button"
            className="planner-day__cost-pill"
            onClick={() => setIsOpen(!isOpen)}
            title="Chỉnh sửa chi phí"
          >
            <span className="material-symbols-outlined text-[14px]">payments</span>
            <span className="font-semibold text-[11px]">{formatCost(cost)}</span>
          </button>
          <button
            type="button"
            className="planner-day__cost-pill-clear"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            title="Xoá chi phí"
          >
            <span className="material-symbols-outlined text-[13px]">close</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="planner-day__add-cost-btn"
          onClick={() => setIsOpen(!isOpen)}
          title="Thêm chi phí cho địa điểm này"
        >
          <span className="material-symbols-outlined text-[15px]">attach_money</span>
          <span>Add cost</span>
        </button>
      )}

      {/* Popover Wanderlog Modal (ảnh nuo.png) */}
      {isOpen && (
        <div className="planner-day__cost-popover animate-in fade-in zoom-in-95 duration-150">
          <div className="planner-day__cost-popover-head">
            <span className="planner-day__cost-popover-title">Cost / Expense</span>
          </div>

          {/* Ô nhập số tiền */}
          <div className="planner-day__cost-input-wrap">
            <span className="planner-day__cost-currency">₫</span>
            <input
              autoFocus
              type="number"
              value={tempCost}
              onChange={(e) => setTempCost(e.target.value)}
              placeholder="0"
              className="planner-day__cost-input"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSave();
                }
              }}
            />
          </div>

          {/* Các mốc chi phí nhanh */}
          <div className="planner-day__cost-chips-row">
            {[20000, 50000, 100000, 200000, 500000].map((amt) => (
              <button
                key={amt}
                type="button"
                className="planner-day__cost-chip"
                onClick={() => setTempCost(String(amt))}
              >
                {amt >= 1000 ? `${amt / 1000}k` : amt}
              </button>
            ))}
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
