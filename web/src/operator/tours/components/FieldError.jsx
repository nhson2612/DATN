/** Câu báo lỗi hiện ngay dưới ô nhập đang sai. Không có lỗi thì không hiện gì. */
export default function FieldError({ children }) {
  if (!children) return null;
  return (
    <p className="op-wizard__error">
      <span className="material-symbols-outlined op-wizard__error-icon">error</span>
      {children}
    </p>
  );
}
