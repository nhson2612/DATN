import { useEffect, useState } from "react";

/**
 * Toast thông báo dạng nổi chuẩn thiết kế Shadcn UI.
 * - Vị trí: Cố định góc dưới bên phải (bottom-5 right-5)
 * - Tự động biến mất sau 4 giây
 * - Hỗ trợ nút đóng thủ công và hiệu ứng trượt/mờ dần
 * - Phân biệt biểu tượng thành công (xanh ngọc) hoặc lỗi (đỏ)
 */
export default function Toast({ message, type, duration = 4000, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);

    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) {
        setTimeout(onClose, 250);
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const isError =
    type === "error" ||
    (typeof message === "string" &&
      (message.toLowerCase().includes("lỗi") ||
        message.toLowerCase().includes("thất bại") ||
        message.toLowerCase().includes("bị từ chối")));

  return (
    <div
      className={`op-toast__div-3 op-toast__div-1  ${
        visible ? "op-toast__div-1--variant-1" : "op-toast__div-2--variant-2"
      }`}
      role="alert"
    >
      <div className="op-toast__div-4">
        <span
          className={`material-symbols-outlined op-toast__span-7 op-toast__span-2  ${
            isError ? "op-toast__span-5--variant-1" : "op-toast__span-6--variant-2"
          }`}
        >
          {isError ? "error" : "check_circle"}
        </span>
        <span className="op-toast__span-8">
          {message}
        </span>
      </div>
      <button
        type="button"
        className="op-toast__button-9 op-toast__button-3"
        onClick={() => {
          setVisible(false);
          if (onClose) {
            setTimeout(onClose, 250);
          }
        }}
        title="Đóng"
      >
        <span className="material-symbols-outlined op-toast__span-10">close</span>
      </button>
    </div>
  );
}
