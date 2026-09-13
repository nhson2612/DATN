import { useMemo } from "react";
import "./ReviewStep.css";

/**
 * Bước 5 — Xem lại toàn bộ nội dung tour trước khi lưu hoặc gửi duyệt.
 * Trình bày chi tiết dữ liệu của cả 4 bước trước:
 *  1. Thông tin cơ bản & điểm nhấn
 *  2. Lịch trình chi tiết từng ngày & điểm tham quan
 *  3. Ảnh bìa & thư viện ảnh
 *  4. Dịch vụ bao gồm/chưa bao gồm & chính sách hủy đổi
 */
export default function ReviewStep({ form = {}, provinces = [], conThieu = [], onGoStep }) {
  const tinh = useMemo(() => {
    return (provinces || []).find((p) => String(p?.id) === String(form?.province_id));
  }, [provinces, form?.province_id]);

  const itinerary = form?.itinerary || [];
  const tongDiem = itinerary.reduce((tong, day) => tong + (day?.places || []).length, 0);
  const cancellationPolicy = form?.cancellation_policy || [];
  const included = (form?.included || []).filter(Boolean);
  const excluded = (form?.excluded || []).filter(Boolean);
  const highlights = (form?.highlights || []).filter(Boolean);
  const images = (form?.images || []).filter(Boolean);

  const daDuDieuKien = conThieu.length === 0;

  return (
    <div className="op-wizard__grid op-review-step">
      <div className="op-wizard__main">
        {/* ==================== 1. THÔNG TIN CƠ BẢN ==================== */}
        <section className="op-review-step__card">
          <div className="op-review-step__card-head">
            <h3 className="op-review-step__card-title">
              <span className="material-symbols-outlined">badge</span>
              1. Thông tin cơ bản & Định danh
            </h3>
            {typeof onGoStep === "function" && (
              <button
                type="button"
                className="op-review-step__edit-link"
                onClick={() => onGoStep(0)}
              >
                Chỉnh sửa
              </button>
            )}
          </div>

          <div className="op-review-step__main-info">
            <div className="op-review-step__title-row">
              <h4 className="op-review-step__tour-name">{form?.name || "(Chưa đặt tên tour)"}</h4>
            </div>

            <p className="op-review-step__tour-summary">
              {form?.summary || "(Chưa nhập mô tả ngắn)"}
            </p>

            <div className="op-review-step__meta-bar">
              <div className="op-review-step__meta-item">
                <span className="material-symbols-outlined">location_on</span>
                <div>
                  <small>Điểm đến chính</small>
                  <strong>{tinh?.name || "(Chưa chọn)"}</strong>
                </div>
              </div>

              <div className="op-review-step__meta-item">
                <span className="material-symbols-outlined">calendar_month</span>
                <div>
                  <small>Thời lượng tour</small>
                  <strong>{form?.duration_days ? `${form.duration_days} ngày` : "(Chưa nhập)"}</strong>
                </div>
              </div>

              <div className="op-review-step__meta-item">
                <span className="material-symbols-outlined">tour</span>
                <div>
                  <small>Điểm tham quan</small>
                  <strong>{tongDiem} điểm</strong>
                </div>
              </div>
            </div>

            {form?.description?.trim() && (
              <div className="op-review-step__desc-box">
                <span className="op-review-step__sublabel">Mô tả chi tiết hành trình:</span>
                <p className="op-review-step__desc-text">{form.description}</p>
              </div>
            )}

            {highlights.length > 0 && (
              <div className="op-review-step__highlights-box">
                <span className="op-review-step__sublabel">Điểm nhấn nổi bật:</span>
                <div className="op-review-step__tags">
                  {highlights.map((item, idx) => (
                    <span key={idx} className="op-review-step__tag">
                      <span className="material-symbols-outlined">star</span>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ==================== 2. LỊCH TRÌNH CHI TIẾT ==================== */}
        <section className="op-review-step__card">
          <div className="op-review-step__card-head">
            <h3 className="op-review-step__card-title">
              <span className="material-symbols-outlined">route</span>
              2. Lịch trình chi tiết ({itinerary.length} ngày - {tongDiem} điểm tham quan)
            </h3>
            {typeof onGoStep === "function" && (
              <button
                type="button"
                className="op-review-step__edit-link"
                onClick={() => onGoStep(1)}
              >
                Chỉnh sửa
              </button>
            )}
          </div>

          {itinerary.length === 0 ? (
            <p className="op-review-step__empty-text">Chưa cấu hình lịch trình ngày.</p>
          ) : (
            <div className="op-review-step__itinerary-list">
              {itinerary.map((day, idx) => {
                const places = day?.places || [];
                const checklist = day?.checklist || [];
                const placeNotes = day?.place_notes || {};

                return (
                  <div key={idx} className="op-review-step__day-block">
                    <div className="op-review-step__day-header">
                      <span className="op-review-step__day-num">Ngày {idx + 1}</span>
                      <h5 className="op-review-step__day-title-text">
                        {day?.title || `Lịch trình ngày ${idx + 1}`}
                      </h5>
                    </div>

                    {day?.description?.trim() && (
                      <p className="op-review-step__day-desc">{day.description}</p>
                    )}

                    {/* Render timeline chi tiết đầy đủ thông tin nếu có */}
                    {Array.isArray(day?.timeline) && day.timeline.length > 0 ? (
                      <div className="op-review-step__day-places">
                        {(() => {
                          let pCounter = 0;
                          return day.timeline.map((item, itIdx) => {
                            if (item.type === "place") {
                              pCounter += 1;
                              const place = item.place || {};
                              return (
                                <div key={item.id || itIdx} className="op-review-step__place-item">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <strong>
                                        {pCounter}. {place?.name || "Điểm tham quan"}
                                      </strong>
                                      {place?.time_range && (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full">
                                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                                          {place.time_range}
                                        </span>
                                      )}
                                    </div>
                                    {place?.dia_chi && <small>{place.dia_chi}</small>}
                                    {place?.note && (
                                      <small className="op-review-step__place-note">
                                        Ghi chú: {place.note}
                                      </small>
                                    )}
                                  </div>
                                  {place?.anh && (
                                    <img
                                      src={place.anh}
                                      alt={place.name}
                                      className="w-16 h-16 rounded-md object-cover border border-zinc-200 shrink-0"
                                      loading="lazy"
                                    />
                                  )}
                                </div>
                              );
                            }

                            if (item.type === "note" && item.text?.trim()) {
                              return (
                                <div
                                  key={item.id || itIdx}
                                  className="flex items-start gap-2 p-2.5 bg-amber-50/80 border border-amber-200/80 rounded-md text-xs text-amber-900"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-amber-700 shrink-0 mt-0.5">
                                    edit_note
                                  </span>
                                  <span>{item.text}</span>
                                </div>
                              );
                            }

                            if (item.type === "checklist") {
                              const subItems = item.items || [];
                              if (subItems.length === 0) return null;
                              return (
                                <div
                                  key={item.id || itIdx}
                                  className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-md flex flex-col gap-1.5"
                                >
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-zinc-900">
                                    <span className="material-symbols-outlined text-[15px] text-emerald-600">
                                      fact_check
                                    </span>
                                    <span>{item.title || "Check list"}</span>
                                  </div>
                                  <ul className="flex flex-col gap-1 m-0 p-0 list-none">
                                    {subItems.map((sub, sIdx) => (
                                      <li key={sub.id || sIdx} className="flex items-center gap-1.5 text-xs text-zinc-700">
                                        <span className="material-symbols-outlined text-[14px] text-emerald-600">
                                          check_circle
                                        </span>
                                        <span>{typeof sub === "string" ? sub : sub.text}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              );
                            }

                            return null;
                          });
                        })()}
                      </div>
                    ) : places.length > 0 ? (
                      <div className="op-review-step__day-places">
                        {places.map((place, pIdx) => {
                          const note = placeNotes[place?.id];
                          return (
                            <div key={place?.id || pIdx} className="op-review-step__place-item">
                              <span className="material-symbols-outlined">location_on</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <strong>
                                    {pIdx + 1}. {place?.name || "Điểm tham quan"}
                                  </strong>
                                  {place?.time_range && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded-full">
                                      <span className="material-symbols-outlined text-[13px]">schedule</span>
                                      {place.time_range}
                                    </span>
                                  )}
                                </div>
                                {place?.dia_chi && <small>{place.dia_chi}</small>}
                                {(place?.note || note) && (
                                  <small className="op-review-step__place-note">
                                    Ghi chú: {place?.note || note}
                                  </small>
                                )}
                              </div>
                              {place?.anh && (
                                <img
                                  src={place.anh}
                                  alt={place.name}
                                  className="w-16 h-16 rounded-md object-cover border border-zinc-200 shrink-0"
                                  loading="lazy"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="op-review-step__missing-inline">
                        Chưa gắn địa điểm tham quan nào cho ngày này.
                      </p>
                    )}

                    {!Array.isArray(day?.timeline) && checklist.length > 0 && (
                      <div className="op-review-step__day-checklist">
                        {checklist.map((task, cIdx) => (
                          <div key={cIdx} className="op-review-step__check-row">
                            <span className="material-symbols-outlined">check_circle</span>
                            <span>{task}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ==================== 3. HÌNH ẢNH & MEDIA ==================== */}
        <section className="op-review-step__card">
          <div className="op-review-step__card-head">
            <h3 className="op-review-step__card-title">
              <span className="material-symbols-outlined">photo_library</span>
              3. Hình ảnh & Media
            </h3>
            {typeof onGoStep === "function" && (
              <button
                type="button"
                className="op-review-step__edit-link"
                onClick={() => onGoStep(2)}
              >
                Chỉnh sửa
              </button>
            )}
          </div>

          <div className="op-review-step__media-section">
            <div>
              <span className="op-review-step__sublabel">Ảnh bìa tour:</span>
              {form?.cover_url ? (
                <div className="op-review-step__cover-preview">
                  <img
                    src={form.cover_url}
                    alt="Ảnh bìa tour"
                    className="op-review-step__cover-img"
                  />
                  <span className="op-review-step__cover-tag">Ảnh bìa chính</span>
                </div>
              ) : (
                <div className="op-review-step__cover-empty">
                  <span className="material-symbols-outlined">add_photo_alternate</span>
                  <span>Chưa chọn ảnh bìa</span>
                </div>
              )}
            </div>

            <div className="op-review-step__gallery-box">
              <span className="op-review-step__sublabel">
                Thư viện ảnh tour ({images.length} ảnh):
              </span>
              {images.length > 0 ? (
                <div className="op-review-step__gallery-grid">
                  {images.map((imgUrl, imgIdx) => (
                    <div key={imgIdx} className="op-review-step__gallery-tile">
                      <img src={imgUrl} alt={`Ảnh tour ${imgIdx + 1}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="op-review-step__empty-text">Chưa thêm ảnh nào vào thư viện.</p>
              )}
            </div>
          </div>
        </section>

        {/* ==================== 4. DỊCH VỤ & CHÍNH SÁCH ==================== */}
        <section className="op-review-step__card">
          <div className="op-review-step__card-head">
            <h3 className="op-review-step__card-title">
              <span className="material-symbols-outlined">policy</span>
              4. Dịch vụ & Chính sách hủy
            </h3>
            {typeof onGoStep === "function" && (
              <button
                type="button"
                className="op-review-step__edit-link"
                onClick={() => onGoStep(3)}
              >
                Chỉnh sửa
              </button>
            )}
          </div>

          <div className="op-review-step__policy-grid">
            <div className="op-review-step__service-box">
              <span className="op-review-step__sublabel op-review-step__sublabel--inc">
                <span className="material-symbols-outlined">check_circle</span> Giá đã bao gồm (
                {included.length})
              </span>
              {included.length > 0 ? (
                <ul className="op-review-step__service-list">
                  {included.map((item, idx) => (
                    <li
                      key={idx}
                      className="op-review-step__service-item op-review-step__service-item--inc"
                    >
                      <span className="material-symbols-outlined">check</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="op-review-step__empty-text">(Chưa nhập danh mục đã bao gồm)</p>
              )}
            </div>

            <div className="op-review-step__service-box">
              <span className="op-review-step__sublabel op-review-step__sublabel--exc">
                <span className="material-symbols-outlined">cancel</span> Giá chưa bao gồm (
                {excluded.length})
              </span>
              {excluded.length > 0 ? (
                <ul className="op-review-step__service-list">
                  {excluded.map((item, idx) => (
                    <li
                      key={idx}
                      className="op-review-step__service-item op-review-step__service-item--exc"
                    >
                      <span className="material-symbols-outlined">close</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="op-review-step__empty-text">(Chưa nhập danh mục chưa bao gồm)</p>
              )}
            </div>
          </div>

          <div className="op-review-step__refund-box">
            <span className="op-review-step__sublabel">
              Chính sách hoàn tiền khi hủy tour ({cancellationPolicy.length} mốc):
            </span>
            {cancellationPolicy.length > 0 ? (
              <table className="op-review-step__refund-table">
                <thead>
                  <tr>
                    <th>Hủy trước khởi hành</th>
                    <th>Tỷ lệ hoàn tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {cancellationPolicy.map((moc, idx) => (
                    <tr key={idx}>
                      <td>Từ {moc?.days_before} ngày trở lên</td>
                      <td>
                        <strong>{moc?.refund_percent}%</strong> giá tour
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="op-review-step__empty-text">Chưa cấu hình mốc hoàn tiền.</p>
            )}
          </div>
        </section>
      </div>

      {/* ==================== CỘT PHỤ: ĐIỀU KIỆN DUYỆT ==================== */}
      <aside className="op-wizard__aside">
        <div className="op-wizard__check">
          <div className="op-wizard__card-head">
            <span className="op-wizard__check-title">Điều kiện gửi duyệt</span>
            <span
              className={`op-review-step__status-pill ${
                daDuDieuKien
                  ? "op-review-step__status-pill--success"
                  : "op-review-step__status-pill--warn"
              }`}
            >
              {daDuDieuKien ? "Đủ điều kiện" : "Còn thiếu"}
            </span>
          </div>

          <ul className="op-wizard__check-list">
            <li
              className={`op-wizard__check-item ${
                form?.name?.trim().length >= 15 ? "op-wizard__check-item--done" : ""
              }`}
            >
              <span className="material-symbols-outlined">
                {form?.name?.trim().length >= 15 ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>Tên tour (từ 15 ký tự)</span>
            </li>
            <li
              className={`op-wizard__check-item ${
                form?.summary?.trim() ? "op-wizard__check-item--done" : ""
              }`}
            >
              <span className="material-symbols-outlined">
                {form?.summary?.trim() ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>Mô tả ngắn</span>
            </li>
            <li
              className={`op-wizard__check-item ${
                form?.description?.trim() ? "op-wizard__check-item--done" : ""
              }`}
            >
              <span className="material-symbols-outlined">
                {form?.description?.trim() ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>Mô tả chi tiết</span>
            </li>
            <li
              className={`op-wizard__check-item ${
                form?.province_id ? "op-wizard__check-item--done" : ""
              }`}
            >
              <span className="material-symbols-outlined">
                {form?.province_id ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>Điểm đến chính</span>
            </li>
            <li
              className={`op-wizard__check-item ${
                itinerary.length > 0 && itinerary.every((d) => (d?.places || []).length > 0)
                  ? "op-wizard__check-item--done"
                  : ""
              }`}
            >
              <span className="material-symbols-outlined">
                {itinerary.length > 0 && itinerary.every((d) => (d?.places || []).length > 0)
                  ? "check_circle"
                  : "radio_button_unchecked"}
              </span>
              <span>Lịch trình & các điểm đến</span>
            </li>
            <li
              className={`op-wizard__check-item ${
                form?.cover_url?.trim() ? "op-wizard__check-item--done" : ""
              }`}
            >
              <span className="material-symbols-outlined">
                {form?.cover_url?.trim() ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>Ảnh bìa tour</span>
            </li>
            <li
              className={`op-wizard__check-item ${
                cancellationPolicy.length > 0 ? "op-wizard__check-item--done" : ""
              }`}
            >
              <span className="material-symbols-outlined">
                {cancellationPolicy.length > 0 ? "check_circle" : "radio_button_unchecked"}
              </span>
              <span>Chính sách huỷ đổi</span>
            </li>
          </ul>

          {conThieu.length > 0 && (
            <div className="op-review-step__missing-box">
              <span className="material-symbols-outlined">warning</span>
              <div>
                <strong>Cần hoàn thiện trước khi gửi duyệt:</strong>
                <p>{conThieu.join(", ")}.</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
