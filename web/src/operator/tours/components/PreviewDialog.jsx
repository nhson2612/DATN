import { useEffect, useRef } from "react";

import PreviewCard from "./PreviewCard";

/** Khung xem thẻ tour dùng thẻ hộp thoại của trình duyệt: Esc để đóng, nền bị khoá,
 *  bàn phím không tab ra sau được. Bấm ra ngoài khung cũng đóng. */
export default function PreviewDialog({ form, tenTinh, onClose }) {
  const the = useRef(null);

  useEffect(() => {
    const el = the.current;
    if (!el) return undefined;
    if (!el.open) el.showModal();
    return () => {
      if (el.open) el.close();
    };
  }, []);

  return (
    <dialog
      ref={the}
      className="op-wizard__dialog"
      aria-label="Thẻ tour xem trước"
      onClose={onClose}
      onClick={(event) => {
        // Bấm ra ngoài khung thì sự kiện rơi vào chính thẻ hộp thoại.
        if (event.target === the.current) onClose();
      }}
    >
      <div className="op-wizard__dialog-panel">
        <div className="op-wizard__dialog-head">
          <span className="op-wizard__dialog-title">Thẻ tour khách sẽ thấy</span>
          <button type="button" className="op-wizard__dialog-close" onClick={onClose} aria-label="Đóng">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <PreviewCard form={form} tenTinh={tenTinh} />
      </div>
    </dialog>
  );
}
