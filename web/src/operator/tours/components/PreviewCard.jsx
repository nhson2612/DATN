
/** Thẻ xem trước tức thì: đúng những gì khách sẽ thấy trên thẻ tour. */
export default function PreviewCard({ form, tenTinh }) {
  const soNgay = Number(form.duration_days) || 0;
  const soDem = Math.max(0, soNgay - 1);

  return (
    <div className="op-wizard__preview">
      <span className="op-wizard__preview-label">
        <span className="op-wizard__preview-dot" />
        Thẻ xem trước tức thì
      </span>

      <div className="op-wizard__preview-card">
        <div className="op-wizard__preview-media">
          {form.cover_url ? (
            <img className="op-wizard__preview-img" src={form.cover_url} alt="Ảnh bìa tour" />
          ) : (
            <span>Chưa có ảnh bìa</span>
          )}

          <div className="op-wizard__preview-tags">
            <span className="op-wizard__preview-place">
              <span className="material-symbols-outlined">location_on</span>
              {tenTinh || "Chưa chọn điểm đến"}
            </span>
            {soNgay > 0 && (
              <span className="op-wizard__preview-duration">
                {soNgay}N{soDem}Đ
              </span>
            )}
          </div>
        </div>

        <div className="op-wizard__preview-body">
          <h3 className="op-wizard__preview-name">{form.name || "Chưa đặt tên tour"}</h3>
          <p className="op-wizard__preview-desc">
            {form.summary || "Mô tả ngắn của tour sẽ hiển thị ở đây."}
          </p>

          <div className="op-wizard__preview-price">
            <span className="op-wizard__preview-cta">Xem ngay</span>
          </div>
        </div>
      </div>
    </div>
  );
}
