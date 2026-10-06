import { useEffect, useId, useRef, useState } from "react";
import "./Dropdown.css";

/**
 * Component Dropdown tùy chỉnh cao cấp dùng chung cho toàn dự án.
 * Thay thế hoàn toàn thẻ select mặc định của trình duyệt.
 *
 * Props:
 * - value: Giá trị hiện tại
 * - onChange: Callback khi chọn (value) => void
 * - options: Mảng các lựa chọn [ { value, label, icon?, sublabel? } ] hoặc [ string ]
 * - placeholder: Chữ hiển thị mặc định
 * - label: Nhãn phía trên (cho variant="searchfield")
 * - variant: "searchfield" | "minimal" | "default"
 * - prefixIcon: Icon hiển thị trước giá trị
 * - align: "left" | "right"
 * - disabled: Vô hiệu hóa
 * - className: Class tùy biến cho wrapper
 */
export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = "Chọn...",
  label = null,
  variant = "default",
  prefixIcon = null,
  align = "left",
  disabled = false,
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dropdownId = useId();

  // Chuẩn hóa options thành dạng { value, label, icon, sublabel }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === "object" && opt !== null) {
      return {
        value: String(opt.value ?? ""),
        label: opt.label ?? String(opt.value ?? ""),
        icon: opt.icon,
        sublabel: opt.sublabel,
      };
    }
    return {
      value: String(opt),
      label: String(opt),
    };
  });

  // Tìm option đang được chọn
  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  // Hiển thị text của lựa chọn hiện tại
  const displayText = selectedOption ? selectedOption.label : placeholder;
  const isSelected = selectedOption && selectedOption.value !== "";

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
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

    const handleOtherDropdownOpened = (e) => {
      if (e.detail?.id !== dropdownId) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("dropdown-opened", handleOtherDropdownOpened);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("dropdown-opened", handleOtherDropdownOpened);
    };
  }, [isOpen, dropdownId]);

  const handleSelect = (val) => {
    if (disabled) return;
    onChange?.(val);
    setIsOpen(false);
  };

  const toggleOpen = () => {
    if (!disabled) {
      setIsOpen((prev) => {
        const next = !prev;
        if (next) {
          window.dispatchEvent(
            new CustomEvent("dropdown-opened", { detail: { id: dropdownId } })
          );
        }
        return next;
      });
    }
  };

  // 1. Variant: "searchfield" (Dành cho Searchbar lớn trên đầu)
  if (variant === "searchfield") {
    return (
      <div
        ref={containerRef}
        className={`custom-dropdown custom-dropdown--searchfield ${
          isOpen ? "custom-dropdown--open" : ""
        } ${disabled ? "custom-dropdown--disabled" : ""} ${className}`}
      >
        <button
          type="button"
          className="custom-dropdown-trigger custom-dropdown-trigger--searchfield"
          onClick={toggleOpen}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
        >
          {label && <span className="custom-dropdown-label">{label}</span>}
          <div className="custom-dropdown-value-wrap">
            {prefixIcon && (
              <span className="custom-dropdown-prefix">{prefixIcon}</span>
            )}
            <span
              className={`custom-dropdown-value ${
                !isSelected ? "custom-dropdown-value--placeholder" : ""
              }`}
            >
              {displayText}
            </span>
            <span
              className={`custom-dropdown-arrow ${
                isOpen ? "custom-dropdown-arrow--up" : ""
              }`}
            >
              ▾
            </span>
          </div>
        </button>

        {isOpen && (
          <div
            className={`custom-dropdown-menu custom-dropdown-menu--${align}`}
            role="listbox"
            id={dropdownId}
          >
            <div className="custom-dropdown-menu-inner">
              {normalizedOptions.map((opt) => {
                const active = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`custom-dropdown-item ${
                      active ? "custom-dropdown-item--active" : ""
                    }`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    {opt.icon && (
                      <span className="custom-dropdown-item-icon">
                        {opt.icon}
                      </span>
                    )}
                    <span className="custom-dropdown-item-text">
                      <span className="custom-dropdown-item-label">
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span className="custom-dropdown-item-sublabel">
                          {opt.sublabel}
                        </span>
                      )}
                    </span>
                    {active && (
                      <span className="custom-dropdown-check">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Variant: "minimal" (Dành cho Filterbar tối giản typography)
  if (variant === "minimal") {
    return (
      <div
        ref={containerRef}
        className={`custom-dropdown custom-dropdown--minimal ${
          isOpen ? "custom-dropdown--open" : ""
        } ${isSelected ? "custom-dropdown--active" : ""} ${className}`}
      >
        <button
          type="button"
          className="custom-dropdown-trigger custom-dropdown-trigger--minimal"
          onClick={toggleOpen}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          disabled={disabled}
        >
          <span className="custom-dropdown-minimal-label">{displayText}</span>
          <span
            className={`custom-dropdown-arrow ${
              isOpen ? "custom-dropdown-arrow--up" : ""
            }`}
          >
            ▾
          </span>
        </button>

        {isOpen && (
          <div
            className={`custom-dropdown-menu custom-dropdown-menu--minimal custom-dropdown-menu--${align}`}
            role="listbox"
            id={dropdownId}
          >
            <div className="custom-dropdown-menu-inner">
              {normalizedOptions.map((opt) => {
                const active = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`custom-dropdown-item ${
                      active ? "custom-dropdown-item--active" : ""
                    }`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <span className="custom-dropdown-item-label">
                      {opt.label}
                    </span>
                    {active && (
                      <span className="custom-dropdown-check">✓</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Variant: "default" (Chuẩn form cho toàn dự án)
  return (
    <div
      ref={containerRef}
      className={`custom-dropdown custom-dropdown--default ${
        isOpen ? "custom-dropdown--open" : ""
      } ${disabled ? "custom-dropdown--disabled" : ""} ${className}`}
    >
      {label && <label className="custom-dropdown-top-label">{label}</label>}
      <button
        type="button"
        className="custom-dropdown-trigger custom-dropdown-trigger--default"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
      >
        <div className="custom-dropdown-value-wrap">
          {prefixIcon && (
            <span className="custom-dropdown-prefix">{prefixIcon}</span>
          )}
          <span
            className={`custom-dropdown-value ${
              !isSelected ? "custom-dropdown-value--placeholder" : ""
            }`}
          >
            {displayText}
          </span>
        </div>
        <span
          className={`custom-dropdown-arrow ${
            isOpen ? "custom-dropdown-arrow--up" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {isOpen && (
        <div
          className={`custom-dropdown-menu custom-dropdown-menu--${align}`}
          role="listbox"
          id={dropdownId}
        >
          <div className="custom-dropdown-menu-inner">
            {normalizedOptions.map((opt) => {
              const active = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`custom-dropdown-item ${
                    active ? "custom-dropdown-item--active" : ""
                  }`}
                  onClick={() => handleSelect(opt.value)}
                >
                  {opt.icon && (
                    <span className="custom-dropdown-item-icon">
                      {opt.icon}
                    </span>
                  )}
                  <span className="custom-dropdown-item-label">{opt.label}</span>
                  {active && <span className="custom-dropdown-check">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
