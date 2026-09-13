import ItineraryFields from "../components/ItineraryFields";
import "./ItineraryStep.css";

/** Bước 3 — lịch trình theo ngày: mỗi ngày tự chọn điểm, đặt tiêu đề và ghi chú. */
export default function ItineraryStep({ form, setForm, provinces = [], loi = {}, hienLoi = false }) {
  return (
    <section className="op-itinerary-step">
      <ItineraryFields
        itinerary={form.itinerary}
        tinh={form.province_id}
        loi={loi}
        hienLoi={hienLoi}
        onChange={(itinerary) => setForm({ ...form, itinerary })}
      />
    </section>
  );
}
