import FieldError from "../components/FieldError";
import ListField from "../components/ListField";
import PolicyFields from "../components/PolicyFields";

/** Bước 4 — chính sách: giá đã bao gồm, chưa bao gồm, và bảng hoàn tiền khi khách huỷ. */
export default function PolicyStep({ form, setForm, loi = {}, hienLoi = false }) {
  const thieuMoc = hienLoi ? loi.cancellation_policy : "";

  return (
    <div className="op-policy-step">
      <div className="op-policy-step__grid">
        <ListField
          label="Giá đã bao gồm"
          subtitle="Các dịch vụ, vé tham quan, bữa ăn và bảo hiểm có sẵn trong giá tour"
          icon="check_circle"
          variant="included"
          values={form.included}
          onChange={(included) => setForm({ ...form, included })}
          placeholder="Ví dụ: Khách sạn 3 sao (2 khách/phòng)"
          addLabel="Thêm dịch vụ bao gồm"
        />
        <ListField
          label="Giá chưa bao gồm"
          subtitle="Chi phí cá nhân, phụ thu phòng đơn, thuế VAT hoặc dịch vụ tự túc"
          icon="cancel"
          variant="excluded"
          values={form.excluded}
          onChange={(excluded) => setForm({ ...form, excluded })}
          placeholder="Ví dụ: Phụ thu phòng đơn, đồ uống gọi thêm"
          addLabel="Thêm khoản chưa bao gồm"
        />
      </div>

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
