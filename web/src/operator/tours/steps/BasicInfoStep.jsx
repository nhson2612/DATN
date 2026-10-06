import { useState } from "react";

import FieldError from "../components/FieldError";
import ProvincePicker from "../components/ProvincePicker";
import RequirementChecklist from "../components/RequirementChecklist";
import "./BasicInfoStep.css";

const TOI_DA_TEN = 120;
const TOI_DA_MO_TA_NGAN = 250;
const TOI_THIEU_TEN = 15;
const TOI_THIEU_MO_TA = 10;
const PHUONG_TIEN = [
  "Xe du lịch",
  "Máy bay",
  "Tàu hỏa",
  "Tàu thủy / ca nô",
  "Cáp treo",
  "Xe máy",
  "Đi bộ",
];
const TOI_DA_TAG = 10;

/** Bước 1 — thông tin cơ bản của tour. */
export default function BasicInfoStep({ form, setForm, provinces, loi = {}, hienLoi = false }) {
  const [tagDangNhap, setTagDangNhap] = useState("");
  const loiO = (truong) => (hienLoi ? loi[truong] : "");
  const lop = (truong) => `op-wizard__field ${loiO(truong) ? "op-wizard__field--invalid" : ""}`;

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  // Số đêm suy ra từ số ngày, không lưu riêng.
  const soNgay = Number(form.duration_days) || 0;
  const soDem = Math.max(0, soNgay - 1);

  const doiSoNgay = (them) => {
    const moi = Math.max(1, soNgay + them);
    if (moi > form.soNgayToiDa) return;
    setForm({ ...form, duration_days: moi });
  };

  const doiDiemNhan = (danhSach) => setForm({ ...form, highlights: danhSach });

  const doiPhuongTien = (phuongTien) => {
    const daChon = form.transportation.includes(phuongTien);
    setForm({
      ...form,
      transportation: daChon
        ? form.transportation.filter((item) => item !== phuongTien)
        : [...form.transportation, phuongTien],
    });
  };

  const themTag = () => {
    const tag = tagDangNhap.trim().replace(/^#+/, "");
    const biTrung = form.tags.some((item) => item.toLocaleLowerCase("vi") === tag.toLocaleLowerCase("vi"));
    if (!tag || biTrung || form.tags.length >= TOI_DA_TAG) {
      setTagDangNhap("");
      return;
    }
    setForm({ ...form, tags: [...form.tags, tag] });
    setTagDangNhap("");
  };

  const mucYeuCau = [
    {
      nhan: `Tên tour tối thiểu ${TOI_THIEU_TEN} ký tự (đang ${form.name.trim().length})`,
      dat: form.name.trim().length >= TOI_THIEU_TEN,
    },
    {
      nhan: `Mô tả ngắn từ ${TOI_THIEU_MO_TA} tới ${TOI_DA_MO_TA_NGAN} ký tự (đang ${form.summary.trim().length})`,
      dat:
        form.summary.trim().length >= TOI_THIEU_MO_TA &&
        form.summary.length <= TOI_DA_MO_TA_NGAN,
    },
    { nhan: "Định vị khu vực hoặc tỉnh thành cốt lõi", dat: Boolean(form.province_id) },
    { nhan: "Số ngày hợp lệ, từ 1 ngày trở lên", dat: soNgay >= 1 },
    { nhan: "Có địa điểm khởi hành", dat: Boolean(form.departure_location.trim()) },
    { nhan: "Đã chọn phương tiện di chuyển", dat: form.transportation.length > 0 },
    { nhan: "Có ít nhất một tag phân loại", dat: form.tags.length > 0 },
  ];

  return (
    <div className="op-wizard__grid op-basic-step">
      <div className="op-wizard__main op-basic-step__main">
        {/* Định danh tour */}
        <section className="op-basic-step__section op-basic-step__section--identity">
          <div className="op-wizard__card-head">
            <h2 className="op-wizard__card-title">
              <span className="material-symbols-outlined">badge</span>
              Định danh tour
            </h2>
          </div>

          <div className={lop("name")}>
            <div className="op-wizard__field-head">
              <label className="op-wizard__label" htmlFor="tourTitle">
                Tên tour du lịch <span className="op-wizard__required">*</span>
              </label>
              <span className="op-wizard__counter">
                {form.name.length} / {TOI_DA_TEN} ký tự
              </span>
            </div>
            <div className="op-wizard__input-wrap">
              <span className="material-symbols-outlined op-wizard__input-icon">travel_explore</span>
              <input
                id="tourTitle"
                maxLength={TOI_DA_TEN}
                className="op-wizard__input op-wizard__input--with-icon"
                placeholder="Ví dụ: Khám phá Đà Nẵng - Hội An - Bà Nà Hills 3 ngày 2 đêm"
                value={form.name}
                onChange={set("name")}
              />
            </div>
            <FieldError>{loiO("name")}</FieldError>
          </div>

          <div className={lop("summary")}>
            <div className="op-wizard__field-head">
              <label className="op-wizard__label" htmlFor="tourSummary">
                Mô tả ngắn gọn <span className="op-wizard__required">*</span>
              </label>
              <span className="op-wizard__counter">
                {form.summary.length} / {TOI_DA_MO_TA_NGAN} ký tự
              </span>
            </div>
            <textarea
              id="tourSummary"
              rows={3}
              maxLength={TOI_DA_MO_TA_NGAN}
              className="op-wizard__textarea"
              placeholder="Trọn gói 3 ngày tại Đà Nẵng, ngắm bình minh trên Cầu Vàng, dạo phố cổ Hội An..."
              value={form.summary}
              onChange={set("summary")}
            />
            <FieldError>{loiO("summary")}</FieldError>
          </div>
        </section>

        {/* Mô tả đầy đủ và điểm nhấn */}
        <section className="op-basic-step__section">
          <div className="op-wizard__card-head">
            <h2 className="op-wizard__card-title">
              <span className="material-symbols-outlined">feed</span>
              Mô tả đầy đủ và điểm nhấn tour
            </h2>

          </div>

          <textarea
            rows={6}
            className="op-wizard__textarea op-basic-step__description"
            placeholder="Nhập tổng quan điểm đến, cảm hứng hành trình, trải nghiệm chỉ có trong chuyến đi này..."
            value={form.description}
            onChange={set("description")}
          />

          <div className="op-wizard__field op-basic-step__highlights-field">
            <label className="op-wizard__label">Điểm nhấn của tour</label>
            <div className="op-basic-step__highlights">
              {form.highlights.map((giaTri, index) => (
                <div className="op-basic-step__highlight-row" key={index}>
                  <input
                    className="op-basic-step__highlight-input"
                    placeholder="Ví dụ: Cầu Vàng trong mây sớm"
                    value={giaTri}
                    onChange={(event) =>
                      doiDiemNhan(
                        form.highlights.map((x, i) => (i === index ? event.target.value : x))
                      )
                    }
                  />
                  {form.highlights.length > 1 && (
                    <button
                      type="button"
                      className="op-basic-step__highlight-remove"
                      aria-label={`Xoá điểm nhấn ${index + 1}`}
                      title="Xoá điểm nhấn"
                      onClick={() => doiDiemNhan(form.highlights.filter((_, i) => i !== index))}
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="op-basic-step__highlight-add"
                onClick={() => doiDiemNhan([...form.highlights, ""])}
              >
                <span className="material-symbols-outlined">add</span>
                Thêm điểm nhấn
              </button>
            </div>
          </div>
        </section>

        {/* Thông số hành trình và mức giá */}
        <section className="op-basic-step__section op-basic-step__section--settings">
          <h2 className="op-wizard__card-title">
            <span className="material-symbols-outlined">tune</span>
            Thông số hành trình
          </h2>

          <div className="op-wizard__row">
            <div className={lop("province_id")}>
              <div className="op-wizard__field-head">
                <label className="op-wizard__label">
                  Điểm đến chính <span className="op-wizard__required">*</span>
                </label>
                <span className="op-wizard__counter">Tìm theo tỉnh thành hoặc danh thắng</span>
              </div>
              <ProvincePicker
                provinces={provinces}
                value={form.province_id}
                onChange={(val) => setForm({ ...form, province_id: val })}
                error={Boolean(loiO("province_id"))}
              />
              <FieldError>{loiO("province_id")}</FieldError>
            </div>

            <div className={lop("duration_days")}>
              <label className="op-wizard__label">
                Thời lượng tour <span className="op-wizard__required">*</span>
              </label>
              <div className="op-wizard__duration" id="tourDuration">
                <button
                  type="button"
                  aria-label="Giảm ngày"
                  className="op-wizard__duration-btn"
                  onClick={() => doiSoNgay(-1)}
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <span>
                  <span className="op-wizard__duration-value">{soNgay || "—"}</span>
                  <span className="op-wizard__duration-unit"> ngày / </span>
                  <span className="op-wizard__duration-value">{soDem}</span>
                  <span className="op-wizard__duration-unit"> đêm</span>
                </span>
                <button
                  type="button"
                  aria-label="Tăng ngày"
                  className="op-wizard__duration-btn"
                  onClick={() => doiSoNgay(1)}
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
              <FieldError>{loiO("duration_days")}</FieldError>
            </div>
          </div>
        </section>

        <section className="op-basic-step__section op-basic-step__section--operations">
          <h2 className="op-wizard__card-title">Vận hành và phân loại</h2>

          <div className={lop("departure_location")}>
            <label className="op-wizard__label" htmlFor="tourDepartureLocation">
              Địa điểm khởi hành <span className="op-wizard__required">*</span>
            </label>
            <input
              id="tourDepartureLocation"
              className="op-wizard__input"
              placeholder="Ví dụ: 01 Tràng Tiền, Hoàn Kiếm, Hà Nội"
              value={form.departure_location}
              onChange={set("departure_location")}
            />
            <FieldError>{loiO("departure_location")}</FieldError>
          </div>

          <div className={lop("transportation")} id="tourTransportation" tabIndex={-1}>
            <label className="op-wizard__label">
              Phương tiện di chuyển <span className="op-wizard__required">*</span>
            </label>
            <div className="op-wizard__quick-pick" aria-label="Chọn phương tiện di chuyển">
              {PHUONG_TIEN.map((phuongTien) => {
                const daChon = form.transportation.includes(phuongTien);
                return (
                  <button
                    type="button"
                    key={phuongTien}
                    className={`op-wizard__quick-item ${daChon ? "op-wizard__quick-item--active" : ""}`}
                    aria-pressed={daChon}
                    onClick={() => doiPhuongTien(phuongTien)}
                  >
                    {phuongTien}
                  </button>
                );
              })}
            </div>
            <FieldError>{loiO("transportation")}</FieldError>
          </div>

          <div className={lop("tags")}>
            <div className="op-wizard__field-head">
              <label className="op-wizard__label" htmlFor="tourTags">
                Tag tour <span className="op-wizard__required">*</span>
              </label>
              <span className="op-wizard__counter">{form.tags.length} / {TOI_DA_TAG} tag</span>
            </div>
            <div className="op-basic-step__tag-editor">
              {form.tags.map((tag) => (
                <span className="op-basic-step__tag" key={tag}>
                  {tag}
                  <button
                    type="button"
                    aria-label={`Xóa tag ${tag}`}
                    onClick={() => setForm({ ...form, tags: form.tags.filter((item) => item !== tag) })}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id="tourTags"
                value={tagDangNhap}
                maxLength={30}
                disabled={form.tags.length >= TOI_DA_TAG}
                placeholder={form.tags.length ? "Thêm tag khác" : "Nhập tag rồi nhấn Enter"}
                onChange={(event) => setTagDangNhap(event.target.value)}
                onBlur={themTag}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === ",") {
                    event.preventDefault();
                    themTag();
                  }
                }}
              />
            </div>
            <FieldError>{loiO("tags")}</FieldError>
          </div>
        </section>

      </div>

      <aside className="op-wizard__aside op-basic-step__aside">
        <RequirementChecklist tieuDe="Yêu cầu hoàn tất bước 1" muc={mucYeuCau} />
      </aside>
    </div>
  );
}
