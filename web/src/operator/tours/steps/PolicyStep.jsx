import FieldError from "../components/FieldError";
import ListField from "../components/ListField";
import PolicyFields from "../components/PolicyFields";

/** Bước 5 — chính sách: giá đã bao gồm, chưa bao gồm, và bảng hoàn tiền khi khách huỷ. */
export default function PolicyStep({ form, setForm, loi = {}, hienLoi = false }) {
  const thieuMoc = hienLoi ? loi.cancellation_policy : "";

  return (
    <div className="op-fieldset">
      <ListField
        label="Giá đã bao gồm"
        values={form.included}
        onChange={(included) => setForm({ ...form, included })}
        placeholder="Khách sạn 3 sao"
      />
      <ListField
        label="Giá chưa bao gồm"
        values={form.excluded}
        onChange={(excluded) => setForm({ ...form, excluded })}
        placeholder="Vé máy bay"
      />
      <div className={thieuMoc ? "op-wizard__field--invalid" : ""}>
        <PolicyFields
          rows={form.cancellation_policy}
          onChange={(cancellation_policy) => setForm({ ...form, cancellation_policy })}
        />
      </div>
      <FieldError>{thieuMoc}</FieldError>
    </div>
  );
}
