/** Nhập một danh sách dòng chữ: điểm nhấn, giá đã bao gồm, chưa bao gồm, ảnh, chính sách huỷ. */
export default function ListField({ label, values, onChange, placeholder }) {
  const setAt = (index, value) => onChange(values.map((item, i) => (i === index ? value : item)));
  const removeAt = (index) => onChange(values.filter((_, i) => i !== index));

  return (
    <div className="op-field">
      <label>{label}</label>
      {/* Khung cuộn cố định: thêm bao nhiêu dòng thì trang cũng không dài thêm. */}
      <div className="op-scroll">
        {values.map((value, index) => (
          <span className="op-inline-row" key={index}>
            <input
              value={value}
              placeholder={placeholder}
              onChange={(event) => setAt(index, event.target.value)}
            />
            <button type="button" className="op-link" onClick={() => removeAt(index)}>
              Bỏ
            </button>
          </span>
        ))}
      </div>
      <button type="button" className="op-link" onClick={() => onChange([...values, ""])}>
        + Thêm dòng
      </button>
    </div>
  );
}
