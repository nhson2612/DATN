/** Chính sách huỷ: các mốc "huỷ trước ít nhất N ngày thì hoàn bao nhiêu phần trăm". */
export default function PolicyFields({ rows, onChange }) {
  const setField = (index, field, value) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removeAt = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <section className="op-policy-card">
      <header className="op-policy-card__head">
        <div className="op-policy-card__title-wrap">
          <span className="op-policy-card__icon op-policy-card__icon--cancel">
            <span className="material-symbols-outlined">event_busy</span>
          </span>
          <div>
            <h3 className="op-policy-card__title">Chính sách hoàn hủy tour</h3>
            <p className="op-policy-card__sub">
              Thiết lập tỷ lệ hoàn tiền theo số ngày khách báo hủy trước ngày khởi hành
            </p>
          </div>
        </div>
        <span className="op-policy-card__badge">{rows.length} mốc hoàn tiền</span>
      </header>

      <div className="op-cancel-table">
        {rows.map((row, index) => (
          <div className="op-cancel-row" key={index}>
            <div className="op-cancel-cell">
              <span className="op-cancel-cell__label">
                <span className="material-symbols-outlined">schedule</span>
                <span>Huỷ trước ít nhất</span>
              </span>
              <div className="op-cancel-input-group">
                <input
                  type="number"
                  min="0"
                  className="op-cancel-input"
                  placeholder="0"
                  value={row.days_before}
                  onChange={(event) => setField(index, "days_before", event.target.value)}
                />
                <span className="op-cancel-unit">ngày</span>
              </div>
            </div>

            <div className="op-cancel-cell">
              <span className="op-cancel-cell__label">
                <span className="material-symbols-outlined">payments</span>
                <span>Mức hoàn trả</span>
              </span>
              <div className="op-cancel-input-group">
                <input
                  type="number"
                  min="0"
                  max="100"
                  className="op-cancel-input"
                  placeholder="0"
                  value={row.refund_percent}
                  onChange={(event) => setField(index, "refund_percent", event.target.value)}
                />
                <span className="op-cancel-unit">% giá tour</span>
              </div>
            </div>

            <button
              type="button"
              className="op-policy-list__remove"
              title="Xoá mốc này"
              aria-label={`Xoá mốc hoàn tiền ${index + 1}`}
              onClick={() => removeAt(index)}
            >
              <span className="material-symbols-outlined">delete</span>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="op-policy-list__add"
        onClick={() => onChange([...rows, { days_before: "", refund_percent: "" }])}
      >
        <span className="material-symbols-outlined">add</span>
        <span>Thêm mốc hoàn tiền</span>
      </button>
    </section>
  );
}
