/** Nhập một danh sách dòng chữ: giá đã bao gồm, chưa bao gồm. */
export default function ListField({
  label,
  subtitle,
  icon = "check_circle",
  variant = "included",
  values = [],
  onChange,
  placeholder,
  addLabel = "Thêm dòng",
}) {
  const setAt = (index, value) => onChange(values.map((item, i) => (i === index ? value : item)));
  const removeAt = (index) => {
    const next = values.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [""]);
  };
  const count = values.filter((v) => v && v.trim()).length;

  return (
    <section className="op-policy-card">
      <header className="op-policy-card__head">
        <div className="op-policy-card__title-wrap">
          <span className={`op-policy-card__icon op-policy-card__icon--${variant}`}>
            <span className="material-symbols-outlined">{icon}</span>
          </span>
          <div>
            <h3 className="op-policy-card__title">{label}</h3>
            {subtitle && <p className="op-policy-card__sub">{subtitle}</p>}
          </div>
        </div>
        <span className="op-policy-card__badge">{count} mục</span>
      </header>

      <div className="op-policy-list">
        {values.map((value, index) => (
          <div className="op-policy-list__row" key={index}>
            <div className="op-policy-list__input-wrap">
              <span
                className={`material-symbols-outlined op-policy-list__bullet op-policy-list__bullet--${variant}`}
              >
                {variant === "excluded" ? "remove" : "check"}
              </span>
              <input
                className="op-policy-list__input"
                value={value}
                placeholder={placeholder}
                onChange={(event) => setAt(index, event.target.value)}
              />
            </div>
            <button
              type="button"
              className="op-policy-list__remove"
              title="Xoá dòng này"
              aria-label={`Xoá mục ${index + 1}`}
              onClick={() => removeAt(index)}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="op-policy-list__add"
        onClick={() => onChange([...values, ""])}
      >
        <span className="material-symbols-outlined">add</span>
        <span>{addLabel}</span>
      </button>
    </section>
  );
}
