import { useEffect, useState } from "react";

/**
 * Toast thông báo nổi chuẩn thiết kế Shadcn UI.
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
      className={`fixed bottom-5 right-5 z-50 max-w-md min-w-[320px] flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border shadow-2xl transition-all duration-250 ease-out bg-zinc-950/95 backdrop-blur text-white border-zinc-800 ${
        visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95 pointer-events-none"
      }`}
      role="alert"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className={`material-symbols-outlined text-xl shrink-0 ${
            isError ? "text-rose-400" : "text-emerald-400"
          }`}
        >
          {isError ? "error" : "check_circle"}
        </span>
        <span className="text-sm font-medium text-zinc-100 leading-snug break-words">
          {message}
        </span>
      </div>
      <button
        type="button"
        className="text-zinc-400 hover:text-white transition-colors cursor-pointer p-1 rounded-md hover:bg-zinc-800/80 shrink-0"
        onClick={() => {
          setVisible(false);
          if (onClose) {
            setTimeout(onClose, 250);
          }
        }}
        title="Đóng"
      >
        <span className="material-symbols-outlined text-base">close</span>
      </button>
    </div>
  );
}
