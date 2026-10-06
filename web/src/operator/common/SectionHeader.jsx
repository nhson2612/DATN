/** Tiêu đề mục kèm một nút hành động chính. */
export default function SectionHeader({ title, action, actionLabel }) {
  return (
    <header className="op-section-head">
      <div>
        <h1>{title}</h1>
        <p>Quản lý dữ liệu thuộc tài khoản nhà điều hành của bạn.</p>
      </div>
      {action && (
        <button
          type="button"
          onClick={action}
          className="op-section-header__button-1"
        >
          <span className="material-symbols-outlined op-section-header__span-2">add</span>
          <span>{actionLabel}</span>
        </button>
      )}
    </header>
  );
}
