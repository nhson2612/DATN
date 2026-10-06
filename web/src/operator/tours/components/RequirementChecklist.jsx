/** Danh sách việc cần đạt của bước đang mở, tính từ dữ liệu đã nhập. */
export default function RequirementChecklist({ tieuDe, muc }) {
  return (
    <div className="op-wizard__check">
      <span className="op-wizard__check-title">{tieuDe}</span>
      <ul className="op-wizard__check-list">
        {muc.map(({ nhan, dat }) => (
          <li className={`op-wizard__check-item    ${dat ? "op-wizard__check-item--done" : ""}`} key={nhan}>
            <span className="material-symbols-outlined">
              {dat ? "check_circle" : "radio_button_unchecked"}
            </span>
            <span>{nhan}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
