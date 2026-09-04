import { useState } from "react";
import { api } from "../../api/client";
import "./BookingForm.css";

export default function BookingForm({ open, onClose, placeType, placeId, placeName }) {
  const [formData, setFormData] = useState({
    full_name: "",
    phone: "",
    email: "",
    check_in: "",
    check_out: "",
    guests: 2,
    note: "",
  });
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleInputChange = (fieldName) => (e) => {
    setFormData((prev) => ({ ...prev, [fieldName]: e.target.value }));
  };

  async function handleSubmitBooking() {
    setErrorMessage("");
    if (!formData.full_name.trim() || !formData.phone.trim()) {
      return setErrorMessage("Vui lòng nhập họ tên và số điện thoại.");
    }

    setIsSubmitting(true);
    try {
      const response = await api.createBooking({
        place_type: placeType,
        place_id: placeId,
        full_name: formData.full_name,
        phone: formData.phone,
        email: formData.email || null,
        check_in: formData.check_in || null,
        check_out: formData.check_out || null,
        guests: Number(formData.guests) || 1,
        note: formData.note || null,
      });
      setSuccessMessage(response.message);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="booking-form"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="booking-form__card">
        <div className="booking-form__header">
          <h3 className="booking-form__title">Yêu cầu đặt chỗ</h3>
          <button onClick={onClose} className="booking-form__close-btn">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <p className="booking-form__place-name">{placeName}</p>

        {successMessage ? (
          <div className="booking-form__success">
            <i className="fa-solid fa-circle-check booking-form__success-icon" />
            <p className="booking-form__success-text">{successMessage}</p>
            <button
              onClick={onClose}
              className="booking-form__success-close-btn"
            >
              Đóng
            </button>
          </div>
        ) : (
          <>
            <div className="booking-form__fields">
              <input
                value={formData.full_name}
                onChange={handleInputChange("full_name")}
                placeholder="Họ và tên *"
                className="booking-form__field"
              />
              <input
                value={formData.phone}
                onChange={handleInputChange("phone")}
                placeholder="Số điện thoại *"
                className="booking-form__field"
              />
              <input
                value={formData.email}
                onChange={handleInputChange("email")}
                type="email"
                placeholder="Email (không bắt buộc)"
                className="booking-form__field"
              />
              <div className="booking-form__grid">
                <label className="booking-form__label">
                  Ngày nhận
                  <input
                    value={formData.check_in}
                    onChange={handleInputChange("check_in")}
                    type="date"
                    className="booking-form__field mt-1"
                  />
                </label>
                <label className="booking-form__label">
                  Ngày trả
                  <input
                    value={formData.check_out}
                    onChange={handleInputChange("check_out")}
                    type="date"
                    className="booking-form__field mt-1"
                  />
                </label>
              </div>
              <label className="booking-form__label">
                Số khách
                <input
                  value={formData.guests}
                  onChange={handleInputChange("guests")}
                  type="number"
                  min="1"
                  className="booking-form__field mt-1"
                />
              </label>
              <textarea
                value={formData.note}
                onChange={handleInputChange("note")}
                rows="2"
                placeholder="Ghi chú (loại phòng, giờ đến...)"
                className="booking-form__field"
              />
            </div>

            {errorMessage && (
              <p className="booking-form__error">{errorMessage}</p>
            )}

            <p className="booking-form__disclaimer">
              Đây là yêu cầu liên hệ, không phải đặt phòng có thanh toán. Chúng tôi sẽ gọi lại để xác nhận.
            </p>
            <button
              onClick={handleSubmitBooking}
              disabled={isSubmitting}
              className="booking-form__submit-btn"
            >
              {isSubmitting ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
