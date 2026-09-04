import { useState } from "react";
import { api } from "../../api/client";
import "./TourBookingForm.css";

export default function TourBookingForm({ open, onClose, tour, departure }) {
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    guests: 2,
    note: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [successResult, setSuccessResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleInputChange = (fieldName) => (e) => {
    setFormData((prev) => ({ ...prev, [fieldName]: e.target.value }));
  };

  const unitPrice = departure?.price || tour.price_from || 0;
  const totalPrice = unitPrice * (Number(formData.guests) || 1);

  async function handleSubmitBooking() {
    setErrorMessage("");
    if (!formData.full_name.trim() || !formData.phone.trim()) {
      return setErrorMessage("Vui lòng nhập họ tên và số điện thoại.");
    }

    setIsSubmitting(true);
    try {
      const response = await api.bookTour({
        tour_id: tour.id,
        departure_id: departure?.id || null,
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || null,
        guests: Number(formData.guests) || 1,
        note: formData.note || null,
      });
      setSuccessResult(response);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="tour-booking-form"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="tour-booking-form__card">
        <div className="tour-booking-form__header">
          <h3 className="tour-booking-form__title">Đặt tour</h3>
          <button onClick={onClose} className="tour-booking-form__close-btn">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <p className="tour-booking-form__tour-name">{tour.name}</p>

        {successResult ? (
          <div className="tour-booking-form__success">
            <i className="fa-solid fa-circle-check tour-booking-form__success-icon" />
            <p className="tour-booking-form__success-text">
              {successResult.message}
            </p>
            {successResult.total_price && (
              <p className="tour-booking-form__success-total">
                Tạm tính:{" "}
                <b className="tour-booking-form__success-price">
                  {successResult.total_price.toLocaleString("vi-VN")} đ
                </b>
              </p>
            )}
            <button
              onClick={onClose}
              className="tour-booking-form__success-close-btn"
            >
              Đóng
            </button>
          </div>
        ) : (
          <>
            {departure && (
              <div className="tour-booking-form__departure-info">
                <div className="tour-booking-form__info-row">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Khởi hành
                  </span>
                  <b>
                    {new Date(departure.depart_date).toLocaleDateString(
                      "vi-VN"
                    )}
                  </b>
                </div>
                <div className="tour-booking-form__info-row">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Giá / khách
                  </span>
                  <b>{departure.price?.toLocaleString("vi-VN")} đ</b>
                </div>
                <div className="tour-booking-form__info-row--total">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Tạm tính {formData.guests} khách
                  </span>
                  <b className="tour-booking-form__success-price">
                    {totalPrice.toLocaleString("vi-VN")} đ
                  </b>
                </div>
              </div>
            )}

            <div className="tour-booking-form__fields">
              <input
                value={formData.full_name}
                onChange={handleInputChange("full_name")}
                placeholder="Họ và tên *"
                className="tour-booking-form__field"
              />
              <input
                value={formData.phone}
                onChange={handleInputChange("phone")}
                placeholder="Số điện thoại *"
                className="tour-booking-form__field"
              />
              <input
                value={formData.email}
                onChange={handleInputChange("email")}
                type="email"
                placeholder="Email (không bắt buộc)"
                className="tour-booking-form__field"
              />
              <label className="tour-booking-form__label">
                Số khách
                <input
                  value={formData.guests}
                  onChange={handleInputChange("guests")}
                  type="number"
                  min="1"
                  max={departure?.seats_left || 20}
                  className="tour-booking-form__field mt-1"
                />
              </label>
              <textarea
                value={formData.note}
                onChange={handleInputChange("note")}
                rows="2"
                placeholder="Ghi chú (ăn chay, trẻ em, đón tại...)"
                className="tour-booking-form__field"
              />
            </div>

            {errorMessage && (
              <p className="tour-booking-form__error">{errorMessage}</p>
            )}

            <button
              onClick={handleSubmitBooking}
              disabled={isSubmitting}
              className="tour-booking-form__submit-btn"
            >
              {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu đặt tour"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
