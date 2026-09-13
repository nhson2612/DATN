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
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 active:scale-[0.98] text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>{actionLabel}</span>
        </button>
      )}
    </header>
  );
}
