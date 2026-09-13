/** Chính sách huỷ: các mốc "huỷ trước ít nhất N ngày thì hoàn bao nhiêu phần trăm". */
export default function PolicyFields({ rows, onChange }) {
  const setField = (index, field, value) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  const removeAt = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="op-field">
      <label>Chính sách huỷ</label>
      {rows.map((row, index) => (
        <span className="op-policy-row" key={index}>
          <span>Huỷ trước ít nhất</span>
          <input
            type="number"
            min="0"
            value={row.days_before}
            onChange={(event) => setField(index, "days_before", event.target.value)}
          />
          <span>ngày, hoàn</span>
          <input
            type="number"
            min="0"
            max="100"
            value={row.refund_percent}
            onChange={(event) => setField(index, "refund_percent", event.target.value)}
          />
          <span>%</span>
          <button type="button" className="op-link" onClick={() => removeAt(index)}>
            Bỏ
          </button>
        </span>
      ))}
      <button
        type="button"
        className="op-link"
        onClick={() => onChange([...rows, { days_before: "", refund_percent: "" }])}
      >
        + Thêm mốc
      </button>
    </div>
  );
}
