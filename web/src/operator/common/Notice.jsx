import Toast from "./Toast";

/** Dòng thông báo nổi dạng Toast chuẩn Shadcn UI. */
export default function Notice({ children, onClose }) {
  if (!children) return null;
  return <Toast message={children} onClose={onClose} />;
}

