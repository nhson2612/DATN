import DayEditor from "./DayEditor";
import FieldError from "./FieldError";
import "./ItineraryFields.css";

/** Lịch trình theo ngày: hiện hết các ngày, mỗi ngày thu gọn được.
 *  Điểm đến gắn thẳng vào từng ngày. */
export default function ItineraryFields({ itinerary, tinh, loi = {}, hienLoi = false, onChange }) {
  const suaNgay = (index, day) => onChange(itinerary.map((item, i) => (i === index ? day : item)));

  return (
    <div className="op-wizard__itinerary">
      <FieldError>{hienLoi ? loi.itinerary : ""}</FieldError>

      {itinerary.map((day, index) => (
        <div key={index} className="op-wizard__day-item">
          <DayEditor
            day={day}
            index={index}
            tinh={tinh}
            loi={hienLoi ? loi[`ngay-${index}`] : ""}
            onChange={(moi) => suaNgay(index, moi)}
          />
        </div>
      ))}
    </div>
  );
}
