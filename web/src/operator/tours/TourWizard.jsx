import { useState } from "react";

import { api } from "../../shared/api";
import { conThieuDeGuiDuyet, kiemTraBuoc, truongLoiDauTien } from "./steps/validate";
import PreviewDialog from "./components/PreviewDialog";
import StepProgress from "./components/StepProgress";
import { MOC_MAC_DINH } from "./components/policyDefaults";
import BasicInfoStep from "./steps/BasicInfoStep";
import ImagesStep from "./steps/ImagesStep";
import ItineraryStep from "./steps/ItineraryStep";
import PolicyStep from "./steps/PolicyStep";
import ReviewStep from "./steps/ReviewStep";
import "./TourWizard.css";

/** Các bước tạo tour. Mỗi bước là một màn, chỉ bước đang mở được dựng ra,
 *  nên thêm bước mới không làm trang dài thêm. */
const BUOC = [
  { key: "basic", nhan: "Thông tin cơ bản", phuDe: "Thông số cơ bản và định danh gói trải nghiệm", Screen: BasicInfoStep },
  { key: "itinerary", nhan: "Lịch trình ngày", phuDe: "Chi tiết từng buổi", Screen: ItineraryStep },
  { key: "images", nhan: "Ảnh và media", phuDe: "Ảnh bìa và thư viện ảnh", Screen: ImagesStep },
  { key: "policy", nhan: "Chính sách", phuDe: "Bao gồm và hủy đổi", Screen: PolicyStep },
  { key: "review", nhan: "Xem lại và lưu", phuDe: "Kiểm tra lần cuối trước khi lưu", Screen: ReviewStep },
];

const SO_NGAY_TOI_DA = 60;

const ngayRong = () => ({
  title: "",
  places: [],
  timeline: [],
  place_notes: {},
  checklist: [],
  description: "",
});

const rong = () => ({
  name: "",
  summary: "",
  description: "",
  province_id: "",
  duration_days: "",
  cover_url: "",
  images: [""],
  highlights: [""],
  transportation: [],
  departure_location: "",
  tags: [],
  included: [""],
  excluded: [""],
  cancellation_policy: MOC_MAC_DINH.map((moc) => ({ ...moc })),
  itinerary: [],
  soNgayToiDa: SO_NGAY_TOI_DA,
});

const tuTour = (tour) => ({
  ...rong(),
  name: tour.name || "",
  summary: tour.summary || "",
  description: tour.description || "",
  province_id: tour.province_id ? String(tour.province_id) : "",
  duration_days: tour.duration_days || 1,
  cover_url: tour.cover_url || "",
  images: tour.images?.length ? tour.images : [""],
  highlights: tour.highlights?.length ? tour.highlights : [""],
  transportation: Array.isArray(tour.transportation) ? tour.transportation : [],
  departure_location: tour.departure_location || "",
  tags: Array.isArray(tour.tags) ? tour.tags : [],
  included: tour.included?.length ? tour.included : [""],
  excluded: tour.excluded?.length ? tour.excluded : [""],
  cancellation_policy: tour.cancellation_policy?.length
    ? tour.cancellation_policy.map((moc) => ({
        days_before: moc.days_before ?? "",
        refund_percent: moc.refund_percent ?? "",
      }))
    : MOC_MAC_DINH.map((moc) => ({ ...moc })),
  // Điểm của mỗi ngày đọc từ mã đã lưu; máy chủ trả kèm tên và toạ độ trong places.
  itinerary: (tour.itinerary?.length ? tour.itinerary : [{}]).map((day) => {
    const places = (day.places || []).map((p) => ({
      id: p.id,
      name: p.name,
      dia_chi: p.dia_chi,
      lon: p.lon,
      lat: p.lat,
    }));
    return {
      title: day.title || "",
      places,
      timeline: day.timeline?.length
        ? day.timeline
        : [
            ...places.map((place) => ({ id: crypto.randomUUID(), type: "place", place })),
            ...(day.description ? [{ id: crypto.randomUUID(), type: "note", text: day.description }] : []),
            ...(day.checklist?.length ? [{ id: crypto.randomUUID(), type: "checklist", items: day.checklist }] : []),
          ],
      place_notes: day.place_notes || {},
      checklist: day.checklist || [],
      description: day.description || "",
    };
  }),
});

const gon = (danhSach) => danhSach.map((x) => x.trim()).filter(Boolean);

/** Màn tạo và sửa tour, chia bước. */
export default function TourWizard({ tour, provinces, onSaved, onCancel }) {
  const [buocDang, setBuocDang] = useState(0);
  const [form, setForm] = useState(() => (tour ? tuTour(tour) : rong()));
  const [loiForm, setLoiForm] = useState("");
  const [loi, setLoi] = useState({});
  const [hienLoi, setHienLoi] = useState(false);
  const [dangLuu, setDangLuu] = useState(false);
  const [moXemTruoc, setMoXemTruoc] = useState(false);

  const Screen = BUOC[buocDang].Screen;
  const tenTinh = provinces.find((p) => String(p.id) === String(form.province_id))?.name || "";
  const laBuocCuoi = buocDang === BUOC.length - 1;

  // Số ngày đổi thì lịch trình co giãn theo, giữ các ngày đã nhập (BR-T1).
  const setFormChan = (moi) => {
    const nhap = String(moi.duration_days).trim();
    if (nhap === "") {
      setForm({ ...moi, duration_days: "" });
      return;
    }
    const soNgay = Math.max(1, Number(nhap) || 1);
    if (soNgay > SO_NGAY_TOI_DA) {
      setLoi({ duration_days: `Tour dài hơn ${SO_NGAY_TOI_DA} ngày chưa hỗ trợ nhập trên màn này.` });
      setHienLoi(true);
      return;
    }
    const itinerary = Array.from({ length: soNgay }, (_, i) => moi.itinerary[i] || ngayRong());
    setForm({ ...moi, duration_days: soNgay, itinerary });
  };

  const ID_THEO_TRUONG = {
    name: "tourTitle",
    summary: "tourSummary",
    province_id: "tourProvince",
    duration_days: "tourDuration",
    departure_location: "tourDepartureLocation",
    transportation: "tourTransportation",
    tags: "tourTags",
    cover_url: "tourCover",
  };

  // Đi tiếp chỉ khi bước đang mở đã đủ dữ liệu; thiếu thì báo ngay ở ô nhập đó.
  const sangBuocSau = () => {
    const loiBuoc = kiemTraBuoc(BUOC[buocDang].key, form);
    setLoi(loiBuoc);
    setHienLoi(true);
    setLoiForm("");

    if (Object.keys(loiBuoc).length > 0) {
      const truong = truongLoiDauTien(loiBuoc);
      requestAnimationFrame(() => {
        const o = document.getElementById(ID_THEO_TRUONG[truong]);
        if (o) {
          o.focus();
          o.scrollIntoView({ block: "center", behavior: "smooth" });
        } else {
          document.querySelector(".op-wizard__error")?.scrollIntoView({ block: "center" });
        }
      });
      return;
    }

    setLoi({});
    setHienLoi(false);
    setBuocDang(buocDang + 1);
  };

  // Chỉ quay lại bước đã đi qua. Đi tới bước sau luôn phải qua validation của bước hiện tại,
  // nếu không itinerary chưa được khởi tạo sẽ tạo ra một màn lịch trình rỗng.
  const chonBuoc = (index) => {
    if (index <= buocDang) {
      setLoi({});
      setHienLoi(false);
      setLoiForm("");
      setBuocDang(index);
      return;
    }
    sangBuocSau();
  };

  const luu = async () => {
    const loiTatCa = kiemTraBuoc("review", form);
    if (Object.keys(loiTatCa).length > 0) {
      setBuocDang(0);
      setLoi(loiTatCa);
      setHienLoi(true);
      return;
    }
    setDangLuu(true);
    setLoiForm("");

    const payload = {
      name: form.name.trim(),
      summary: form.summary.trim(),
      description: form.description.trim(),
      province_id: form.province_id ? Number(form.province_id) : null,
      duration_days: Number(form.duration_days),
      cover_url: form.cover_url.trim() || null,
      images: gon(form.images),
      highlights: gon(form.highlights),
      transportation: gon(form.transportation),
      departure_location: form.departure_location.trim(),
      tags: gon(form.tags),
      included: gon(form.included),
      excluded: gon(form.excluded),
      cancellation_policy: form.cancellation_policy
        .filter((moc) => moc.days_before !== "" && moc.refund_percent !== "")
        .map((moc) => ({
          days_before: Number(moc.days_before),
          refund_percent: Number(moc.refund_percent),
        })),
      // Mỗi ngày mang danh sách mã điểm, đúng quan hệ Tour với Place trong tài liệu.
      itinerary: form.itinerary.map((day, index) => ({
        day: index + 1,
        title: day.title.trim(),
        description: day.description.trim(),
        place_ids: day.places.map((p) => p.id),
        // Ghi chú riêng của từng điểm, khoá theo mã điểm; kèm danh sách việc của ngày.
        place_notes: day.place_notes || {},
        checklist: day.checklist || [],
        timeline: day.timeline || [],
      })),
      status: "DRAFT",
    };

    try {
      if (tour) {
        await api.updateOperatorTour(tour.id, payload);
      } else {
        await api.createOperatorTour(payload);
      }
      onSaved();
    } catch (error) {
      setLoiForm(error.message);
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <div className="op-wizard">
      <StepProgress steps={BUOC} current={buocDang} onGo={chonBuoc} />

      {loiForm && (
        <p className="op-wizard__form-error">
          <span className="material-symbols-outlined op-wizard__error-icon">error</span>
          {loiForm}
        </p>
      )}

      <Screen
        form={form}
        setForm={setFormChan}
        provinces={provinces}
        loi={loi}
        hienLoi={hienLoi}
        conThieu={conThieuDeGuiDuyet(form)}
        onGoStep={chonBuoc}
      />

      <footer className="op-wizard__footer">
        <div className="op-wizard__footer-side">
          <button
            type="button"
            className="op-wizard__btn op-wizard__btn--back"
            disabled={buocDang === 0}
            onClick={() => {
              setLoi({});
              setHienLoi(false);
              setLoiForm("");
              setBuocDang(buocDang - 1);
            }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Quay lại
          </button>

          <button
            type="button"
            className="op-wizard__btn op-wizard__btn--plain"
            onClick={() => setMoXemTruoc(true)}
          >
            <span className="material-symbols-outlined">visibility</span>
            Xem thẻ tour
          </button>

          <button
            type="button"
            className="op-wizard__btn op-wizard__btn--plain"
            onClick={luu}
            disabled={dangLuu}
          >
            <span className="material-symbols-outlined">save</span>
            {dangLuu ? "Đang lưu..." : "Lưu nháp tạm thời"}
          </button>
        </div>

        <div className="op-wizard__footer-side">
          <button type="button" className="op-wizard__btn op-wizard__btn--exit" onClick={onCancel}>
            Thoát không lưu
          </button>

          {!laBuocCuoi && (
            <button type="button" className="op-wizard__btn op-wizard__btn--primary" onClick={sangBuocSau}>
              <span>Tiếp: {BUOC[buocDang + 1].nhan}</span>
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
          )}

          {laBuocCuoi && (
            <button
              type="button"
              className="op-wizard__btn op-wizard__btn--primary"
              onClick={luu}
              disabled={dangLuu}
            >
              <span className="material-symbols-outlined">cloud_upload</span>
              <span>{dangLuu ? "Đang lưu..." : "Lưu bản nháp"}</span>
            </button>
          )}
        </div>
      </footer>

      {moXemTruoc && (
        <PreviewDialog form={form} tenTinh={tenTinh} onClose={() => setMoXemTruoc(false)} />
      )}
    </div>
  );
}
