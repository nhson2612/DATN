import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api";
import "./TourBookingWizard.css";

// Cấu hình tài khoản ngân hàng đọc từ biến môi trường (nếu có), tuyệt đối KHÔNG hardcode giả
const BANK_NAME = import.meta.env.VITE_BANK_NAME || "";
const BANK_ACCOUNT_NO = import.meta.env.VITE_BANK_ACCOUNT_NO || "";
const BANK_ACCOUNT_NAME = import.meta.env.VITE_BANK_ACCOUNT_NAME || "";

export default function TourBookingWizard({
  open,
  onClose,
  tour,
  initialDeparture,
  initialGuests = 2,
  user,
  onNeedAuth,
}) {
  const navigate = useNavigate();

  // State các bước: 1: Chọn đợt & khách | 2: Thông tin liên hệ | 3: Review & Xác nhận | 4: Thanh toán
  const [step, setStep] = useState(1);

  // Đợt khởi hành và số khách
  const [selectedDeparture, setSelectedDeparture] = useState(null);
  const [guests, setGuests] = useState(initialGuests || 1);
  const [passengers, setPassengers] = useState([]);

  // Thông tin liên hệ
  const [contact, setContact] = useState({
    full_name: "",
    phone: "",
    email: "",
    note: "",
  });

  // Trạng thái kiểm soát
  const [pendingAuthAdvance, setPendingAuthAdvance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSoldOutError, setIsSoldOutError] = useState(false);

  // Cảnh báo thay đổi giá (Edge Case A3/E12)
  const [priceAlert, setPriceAlert] = useState(null);

  // Kết quả sau khi book và pay
  const [bookingResult, setBookingResult] = useState(null);
  const [paymentResult, setPaymentResult] = useState(null);

  // State thanh toán Stripe / chuyển khoản
  const [checkoutError, setCheckoutError] = useState("");
  const [isCreatingStripe, setIsCreatingStripe] = useState(false);
  const [isCreatingManual, setIsCreatingManual] = useState(false);

  // Countdown giữ chỗ 30 phút ở Bước 4
  const [timeLeft, setTimeLeft] = useState(1800); // 30 phút = 1800s
  const [copiedField, setCopiedField] = useState("");

  // Khởi tạo state khi mở modal
  useEffect(() => {
    if (!open || !tour) return;

    setStep(1);
    setPassengers(Array.from({ length: Math.max(1, Number(initialGuests) || 1) }, () => ({ full_name: "", phone: "", email: "" })));
    setErrorMessage("");
    setIsSoldOutError(false);
    setPriceAlert(null);
    setBookingResult(null);
    setPaymentResult(null);
    setCheckoutError("");
    setIsCreatingStripe(false);
    setIsCreatingManual(false);
    setPendingAuthAdvance(false);

    // Chọn departure phù hợp: ưu tiên initialDeparture nếu còn chỗ
    const deps = tour.departures || [];
    const validInitial =
      initialDeparture &&
      deps.find((d) => d.id === initialDeparture.id && d.seats_left > 0);

    const fallbackDep = validInitial || deps.find((d) => d.seats_left > 0) || deps[0] || null;
    setSelectedDeparture(fallbackDep);

    const maxSeats = fallbackDep ? Math.max(fallbackDep.seats_left, 1) : 20;
    const initialG = Math.min(Math.max(Number(initialGuests) || 1, 1), maxSeats);
    setGuests(initialG);

    // Điền trước thông tin user nếu có
    setContact((prev) => ({
      full_name: user?.full_name || prev.full_name || "",
      phone: user?.phone || prev.phone || "",
      email: user?.email || prev.email || "",
      note: prev.note || "",
    }));
  }, [open, tour, initialDeparture, initialGuests, user]);

  // Tự động chuyển sang Bước 3 khi Guest vừa đăng nhập thành công
  useEffect(() => {
    if (pendingAuthAdvance && user) {
      setPendingAuthAdvance(false);
      // Pre-fill thêm thông tin nếu form còn trống
      setContact((prev) => ({
        full_name: prev.full_name || user.full_name || "",
        phone: prev.phone || user.phone || "",
        email: prev.email || user.email || "",
        note: prev.note || "",
      }));
      setStep(3);
    }
  }, [pendingAuthAdvance, user]);

  // Đồng hồ đếm ngược giữ chỗ ở Bước 4
  useEffect(() => {
    if (step !== 4 || !bookingResult) return;

    // Tính thời gian còn lại dựa trên hold_expires_at
    const calcRemaining = () => {
      if (bookingResult.hold_expires_at) {
        const expires = new Date(bookingResult.hold_expires_at).getTime();
        const now = Date.now();
        const diffSeconds = Math.max(0, Math.floor((expires - now) / 1000));
        return diffSeconds;
      }
      return 1800;
    };

    setTimeLeft(calcRemaining());

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step, bookingResult]);

  // Tính toán đơn giá hiệu lực và tổng tiền
  const { unitPrice, listPrice, isSale, totalPrice } = useMemo(() => {
    if (!selectedDeparture) {
      const p = tour?.price_from || 0;
      return { unitPrice: p, listPrice: p, isSale: false, totalPrice: p * guests };
    }
    const eff = selectedDeparture.effective_price || selectedDeparture.price || 0;
    const list = selectedDeparture.list_price || selectedDeparture.price || eff;
    const sale = list > eff;
    return {
      unitPrice: eff,
      listPrice: list,
      isSale: sale,
      totalPrice: eff * guests,
    };
  }, [selectedDeparture, tour, guests]);

  if (!open || !tour) return null;

  // Xử lý thay đổi số khách
  const handleGuestsChange = (delta) => {
    const max = selectedDeparture ? selectedDeparture.seats_left : 20;
    const next = Math.max(1, Math.min(max, guests + delta));
    setGuests(next);
    setPassengers((prev) => Array.from({ length: next }, (_, index) => prev[index] || ({ full_name: "", phone: "", email: "" })));
  };

  const handleInputChange = (field) => (e) => {
    setContact((prev) => ({ ...prev, [field]: e.target.value }));
  };

  // Bước 1 -> Bước 2
  const handleNextToContact = () => {
    if (!selectedDeparture) {
      setErrorMessage("Vui lòng chọn một đợt khởi hành.");
      return;
    }
    if (selectedDeparture.seats_left <= 0) {
      setErrorMessage("Đợt khởi hành này đã hết chỗ, vui lòng chọn ngày khác.");
      return;
    }
    setErrorMessage("");
    setIsSoldOutError(false);
    setStep(2);
  };

  // Bước 2 -> Bước 3
  const handleNextToReview = () => {
    if (!contact.full_name.trim()) {
      setErrorMessage("Vui lòng nhập họ và tên người liên hệ.");
      return;
    }
    const cleanPhone = contact.phone.trim();
    if (!cleanPhone) {
      setErrorMessage("Vui lòng nhập số điện thoại để nhận xác nhận.");
      return;
    }
    if (!/^[0-9+\s\-()]{8,15}$/.test(cleanPhone)) {
      setErrorMessage("Số điện thoại không hợp lệ, vui lòng kiểm tra lại.");
      return;
    }
    if (passengers.length !== guests || passengers.some((p) => !p.full_name.trim())) {
      setErrorMessage("Vui lòng nhập họ tên cho từng hành khách.");
      return;
    }

    setErrorMessage("");
    setIsSoldOutError(false);

    // Nếu chưa đăng nhập: mở AuthModal, giữ form, chờ đăng nhập xong tự nhảy sang bước 3
    if (!user) {
      setPendingAuthAdvance(true);
      if (typeof onNeedAuth === "function") {
        onNeedAuth();
      }
      return;
    }

    setStep(3);
  };

  // Bước 3: Xác nhận đặt tour và gọi thanh toán
  const handleConfirmBooking = async () => {
    setErrorMessage("");
    setIsSoldOutError(false);
    setIsSubmitting(true);

    try {
      // 1. Kiểm tra lệch giá hiệu lực mới nhất (A3 / E12)
      try {
        const freshRes = await api.tour(tour.slug);
        const freshTour = freshRes?.tour || freshRes;
        const freshDep = freshTour?.departures?.find((d) => d.id === selectedDeparture?.id);

        if (freshDep) {
          const freshPrice = freshDep.effective_price || freshDep.price || 0;
          if (freshPrice !== unitPrice && !priceAlert) {
            setPriceAlert({
              oldPrice: unitPrice,
              newPrice: freshPrice,
              newDeparture: freshDep,
            });
            setIsSubmitting(false);
            return;
          }
        }
      } catch (err) {
        // Nếu lỗi kiểm tra giá nền nhẹ thì tiếp tục flow
        console.warn("Không thể kiểm tra giá mới nhất:", err);
      }

      // 2. Gọi API đặt tour
      const bookData = {
        tour_id: tour.id,
        departure_id: selectedDeparture?.id || null,
        full_name: contact.full_name.trim(),
        phone: contact.phone.trim(),
        email: contact.email?.trim() || null,
        guests: Number(guests) || 1,
        passengers: passengers.map((p) => ({ ...p, full_name: p.full_name.trim(), phone: p.phone.trim() || null, email: p.email.trim() || null })),
        note: contact.note?.trim() || null,
      };

      const bookRes = await api.bookTour(bookData);
      setBookingResult(bookRes);
      setPaymentResult(null);

      // 3. Vào Bước 4 chọn phương thức thanh toán
      setStep(4);
    } catch (err) {
      // Bắt lỗi 409 (E1: hết chỗ / tranh chấp chỗ cuối)
      if (err.status === 409 || err.message?.includes("hết chỗ") || err.message?.includes("chỗ")) {
        setIsSoldOutError(true);
        setErrorMessage(
          err.message ||
            "Rất tiếc! Đợt khởi hành này vừa hết chỗ hoặc không đủ số chỗ quý khách yêu cầu. Vui lòng quay lại Bước 1 để chọn ngày khác."
        );
      } else {
        setErrorMessage(err.message || "Đã xảy ra lỗi khi tạo đơn đặt tour. Vui lòng thử lại.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayByStripe = async () => {
    if (!bookingResult?.id) return;
    setCheckoutError("");
    setIsCreatingStripe(true);
    try {
      const res = await api.checkoutTourBooking(bookingResult.id, window.location.origin);
      if (res?.checkout_url) {
        window.location.assign(res.checkout_url);
      } else {
        setCheckoutError("Không nhận được liên kết thanh toán Stripe.");
      }
    } catch (err) {
      setCheckoutError(err.message || "Không thể kết nối Stripe. Vui lòng thử lại hoặc chọn chuyển khoản.");
    } finally {
      setIsCreatingStripe(false);
    }
  };

  // Xử lý thanh toán chuyển khoản ngân hàng thủ công
  const handlePayByBankTransfer = async () => {
    if (!bookingResult?.id) return;
    setIsCreatingManual(true);
    setCheckoutError("");
    try {
      const payRes = await api.payTourBooking(bookingResult.id, {
        method: "CHUYEN_KHOAN",
      });
      setPaymentResult(payRes);
    } catch (payErr) {
      console.warn("Không thể tự tạo thanh toán ngay:", payErr);
      setPaymentResult(null);
      setCheckoutError(payErr.message || "Không thể tạo thông tin chuyển khoản lúc này.");
    } finally {
      setIsCreatingManual(false);
    }
  };

  // Khách chấp nhận giá mới khi có priceAlert
  const handleAcceptNewPrice = () => {
    if (priceAlert?.newDeparture) {
      setSelectedDeparture(priceAlert.newDeparture);
    }
    setPriceAlert(null);
  };

  // Sao chép văn bản
  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(""), 2000);
  };

  // Định dạng mm:ss
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Điều hướng sang trang Đơn của tôi
  const handleGoToMyBookings = () => {
    onClose();
    navigate("/tour/don-cua-toi");
  };

  return (
    <div
      className="voyage-drawer-overlay tour-booking-wizard__backdrop"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div className="voyage-drawer tour-booking-wizard">
        {/* Header Wizard */}
        <header className="tour-booking-wizard__header">
          <div className="tour-booking-wizard__header-main">
            <div className="tour-booking-wizard__header-text">
              <h2 id="wizard-title" className="tour-booking-wizard__title">
                {step === 4 ? "Đặt tour thành công" : "Đặt tour du lịch"}
              </h2>
              <p className="tour-booking-wizard__tour-name">{tour.name}</p>
            </div>
          </div>
          <button
            type="button"
            className="voyage-drawer-close tour-booking-wizard__close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ đặt tour"
          >
            ×
          </button>
        </header>

        {/* Thanh tiến trình 4 bước */}
        <nav className="tour-booking-wizard__steps-nav" aria-label="Các bước đặt tour">
          <div
            className={`tour-booking-wizard__step-item ${
              step === 1
                ? "tour-booking-wizard__step-item--active"
                : step > 1
                ? "tour-booking-wizard__step-item--completed"
                : ""
            }`}
          >
            <span className="tour-booking-wizard__step-badge">1</span>
            <span className="tour-booking-wizard__step-label">Đợt & Khách</span>
          </div>

          <div
            className={`tour-booking-wizard__step-item ${
              step === 2
                ? "tour-booking-wizard__step-item--active"
                : step > 2
                ? "tour-booking-wizard__step-item--completed"
                : ""
            }`}
          >
            <span className="tour-booking-wizard__step-badge">2</span>
            <span className="tour-booking-wizard__step-label">Thông tin</span>
          </div>

          <div
            className={`tour-booking-wizard__step-item ${
              step === 3
                ? "tour-booking-wizard__step-item--active"
                : step > 3
                ? "tour-booking-wizard__step-item--completed"
                : ""
            }`}
          >
            <span className="tour-booking-wizard__step-badge">3</span>
            <span className="tour-booking-wizard__step-label">Xác nhận</span>
          </div>

          <div
            className={`tour-booking-wizard__step-item ${
              step === 4 ? "tour-booking-wizard__step-item--active" : ""
            }`}
          >
            <span className="tour-booking-wizard__step-badge">4</span>
            <span className="tour-booking-wizard__step-label">Thanh toán</span>
          </div>
        </nav>

        {/* Thân Wizard theo từng bước */}
        <div className="tour-booking-wizard__body">
          {/* ════════════════════ BƯỚC 1 ════════════════════ */}
          {step === 1 && (
            <div className="tour-booking-wizard__step-content tour-booking-wizard__step-departure">
              <div className="tour-booking-wizard__section">
                <label className="tour-booking-wizard__section-label">
                  <span className="material-symbols-outlined">calendar_month</span>
                  1. Chọn đợt khởi hành còn chỗ
                </label>

                {(!tour.departures || tour.departures.length === 0) ? (
                  <p className="tour-booking-wizard__empty-text">
                    Hiện chưa có lịch khởi hành mở bán cho tour này. Vui lòng liên hệ hotline 1900 6868.
                  </p>
                ) : (
                  <div className="tour-booking-wizard__departure-grid">
                    {tour.departures.map((dep) => {
                      const isSoldOut = dep.seats_left <= 0;
                      const isSelected = selectedDeparture?.id === dep.id;
                      const effPrice = dep.effective_price || dep.price;
                      const lPrice = dep.list_price || dep.price;
                      const hasSale = lPrice > effPrice;

                      return (
                        <button
                          type="button"
                          key={dep.id}
                          className={`tour-booking-wizard__dep-card ${
                            isSelected ? "tour-booking-wizard__dep-card--selected" : ""
                          } ${isSoldOut ? "tour-booking-wizard__dep-card--disabled" : ""}`}
                          aria-pressed={isSelected}
                          disabled={isSoldOut}
                          onClick={() => {
                            if (!isSoldOut) {
                              setSelectedDeparture(dep);
                              if (guests > dep.seats_left) {
                                setGuests(Math.max(1, dep.seats_left));
                              }
                            }
                          }}
                        >
                          <div className="tour-booking-wizard__dep-card-header">
                            <span className="tour-booking-wizard__dep-date">
                              {new Date(dep.depart_date).toLocaleDateString("vi-VN", {
                                weekday: "short",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </span>
                            {isSoldOut ? (
                              <span className="tour-booking-wizard__badge tour-booking-wizard__badge--soldout">
                                Hết chỗ
                              </span>
                            ) : (
                              <span className="tour-booking-wizard__badge tour-booking-wizard__badge--available">
                                Còn {dep.seats_left} chỗ
                              </span>
                            )}
                          </div>

                          <div className="tour-booking-wizard__dep-card-price">
                            <span className="tour-booking-wizard__dep-price-current">
                              {effPrice.toLocaleString("vi-VN")}₫
                            </span>
                            {hasSale && (
                              <span className="tour-booking-wizard__dep-price-old">
                                {lPrice.toLocaleString("vi-VN")}₫
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bộ chọn số lượng khách */}
              <div className="tour-booking-wizard__section">
                <label className="tour-booking-wizard__section-label">
                  <span className="material-symbols-outlined">group</span>
                  2. Số lượng khách tham gia
                </label>

                <div className="tour-booking-wizard__guests-control">
                  <div className="tour-booking-wizard__guests-stepper">
                    <button
                      type="button"
                      className="tour-booking-wizard__stepper-btn"
                      onClick={() => handleGuestsChange(-1)}
                      disabled={guests <= 1}
                      aria-label="Giảm 1 khách"
                    >
                      −
                    </button>
                    <span className="tour-booking-wizard__stepper-value">{guests}</span>
                    <button
                      type="button"
                      className="tour-booking-wizard__stepper-btn"
                      onClick={() => handleGuestsChange(1)}
                      disabled={!selectedDeparture || guests >= selectedDeparture.seats_left}
                      aria-label="Tăng 1 khách"
                    >
                      +
                    </button>
                  </div>
                  <div className="tour-booking-wizard__guests-note">
                    {selectedDeparture ? (
                      <span>Tối đa {selectedDeparture.seats_left} khách cho đợt khởi hành này</span>
                    ) : (
                      <span>Vui lòng chọn đợt khởi hành</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tạm tính chi phí */}
              <div className="tour-booking-wizard__calc-summary">
                <div className="tour-booking-wizard__calc-row">
                  <span>Đơn giá áp dụng:</span>
                  <b>{unitPrice.toLocaleString("vi-VN")}₫ / khách</b>
                </div>
                {isSale && (
                  <div className="tour-booking-wizard__calc-row tour-booking-wizard__calc-row--sale">
                    <span>Tiết kiệm:</span>
                    <b>{((listPrice - unitPrice) * guests).toLocaleString("vi-VN")}₫</b>
                  </div>
                )}
                <div className="tour-booking-wizard__calc-row tour-booking-wizard__calc-row--total">
                  <span>Tạm tính ({guests} khách):</span>
                  <span className="tour-booking-wizard__total-amount">
                    {totalPrice.toLocaleString("vi-VN")}₫
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="tour-booking-wizard__alert tour-booking-wizard__alert--error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ BƯỚC 2 ════════════════════ */}
          {step === 2 && (
            <div className="tour-booking-wizard__step-content tour-booking-wizard__step-contact">
              {!user && (
                <div className="tour-booking-wizard__alert tour-booking-wizard__alert--info">
                  <span className="material-symbols-outlined">info</span>
                  <span>
                    Quý khách có thể điền thông tin ngay. Hệ thống sẽ yêu cầu đăng nhập ở bước tiếp theo để lưu mã đơn và theo dõi thanh toán.
                  </span>
                </div>
              )}

              <div className="tour-booking-wizard__form-grid">
                <div className="tour-booking-wizard__field">
                  <label className="tour-booking-wizard__label">
                    Họ và tên người đặt <span className="tour-booking-wizard__required">*</span>
                  </label>
                  <input
                    type="text"
                    className="tour-booking-wizard__input"
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={contact.full_name}
                    onChange={handleInputChange("full_name")}
                    required
                  />
                </div>

                <div className="tour-booking-wizard__field">
                  <label className="tour-booking-wizard__label">
                    Số điện thoại liên hệ <span className="tour-booking-wizard__required">*</span>
                  </label>
                  <input
                    type="tel"
                    className="tour-booking-wizard__input"
                    placeholder="Ví dụ: 0912345678"
                    value={contact.phone}
                    onChange={handleInputChange("phone")}
                    required
                  />
                </div>

                <div className="tour-booking-wizard__field tour-booking-wizard__field--full">
                  <label className="tour-booking-wizard__label">Email nhận xác nhận</label>
                  <input
                    type="email"
                    className="tour-booking-wizard__input"
                    placeholder="email@example.com (không bắt buộc)"
                    value={contact.email}
                    onChange={handleInputChange("email")}
                  />
                </div>

                <div className="tour-booking-wizard__field tour-booking-wizard__field--full">
                  <label className="tour-booking-wizard__label">Danh sách hành khách</label>
                  {passengers.map((passenger, index) => (
                    <div className="tour-booking-wizard__form-grid" key={index}>
                      <input className="tour-booking-wizard__input" placeholder={`Họ tên khách ${index + 1}`} value={passenger.full_name} onChange={(e) => setPassengers((prev) => prev.map((p, i) => i === index ? { ...p, full_name: e.target.value } : p))} />
                      <input className="tour-booking-wizard__input" placeholder="Số điện thoại (nếu có)" value={passenger.phone} onChange={(e) => setPassengers((prev) => prev.map((p, i) => i === index ? { ...p, phone: e.target.value } : p))} />
                    </div>
                  ))}
                </div>

                <div className="tour-booking-wizard__field tour-booking-wizard__field--full">
                  <label className="tour-booking-wizard__label">
                    Ghi chú / Yêu cầu đặc biệt
                  </label>
                  <textarea
                    className="tour-booking-wizard__textarea"
                    rows={3}
                    placeholder="Ví dụ: Đón tại điểm hẹn trung tâm, yêu cầu ăn chay, có trẻ nhỏ đi cùng..."
                    value={contact.note}
                    onChange={handleInputChange("note")}
                  />
                </div>
              </div>

              {errorMessage && (
                <div className="tour-booking-wizard__alert tour-booking-wizard__alert--error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ BƯỚC 3 ════════════════════ */}
          {step === 3 && (
            <div className="tour-booking-wizard__step-content tour-booking-wizard__step-review">
              {/* Cảnh báo lệch giá A3 / E12 nếu phát hiện */}
              {priceAlert && (
                <div className="tour-booking-wizard__alert tour-booking-wizard__alert--warning">
                  <span className="material-symbols-outlined">notification_important</span>
                  <div className="tour-booking-wizard__alert-body">
                    <strong>Thông báo điều chỉnh giá:</strong>
                    <p>
                      Đơn giá đợt khởi hành vừa được cập nhật từ{" "}
                      <b>{priceAlert.oldPrice.toLocaleString("vi-VN")}₫</b> sang{" "}
                      <b>{priceAlert.newPrice.toLocaleString("vi-VN")}₫</b>.
                    </p>
                    <button
                      type="button"
                      className="tour-booking-wizard__btn-accept-price"
                      onClick={handleAcceptNewPrice}
                    >
                      Xác nhận mức giá mới ({priceAlert.newPrice.toLocaleString("vi-VN")}₫)
                    </button>
                  </div>
                </div>
              )}

              {/* Cảnh báo hết chỗ 409 (E1) */}
              {isSoldOutError && (
                <div className="tour-booking-wizard__alert tour-booking-wizard__alert--error">
                  <span className="material-symbols-outlined">event_busy</span>
                  <div className="tour-booking-wizard__alert-body">
                    <strong>Đợt khởi hành đã hết chỗ:</strong>
                    <p>{errorMessage}</p>
                    <button
                      type="button"
                      className="tour-booking-wizard__btn-change-dep"
                      onClick={() => setStep(1)}
                    >
                      Quay lại chọn đợt khởi hành khác
                    </button>
                  </div>
                </div>
              )}

              {/* Bảng tóm tắt thông tin đơn */}
              <div className="tour-booking-wizard__review-card">
                <h4 className="tour-booking-wizard__review-title">Tóm tắt đơn đặt tour</h4>

                <div className="tour-booking-wizard__review-grid">
                  <div className="tour-booking-wizard__review-item">
                    <span className="tour-booking-wizard__review-label">Tour:</span>
                    <span className="tour-booking-wizard__review-val">{tour.name}</span>
                  </div>

                  <div className="tour-booking-wizard__review-item">
                    <span className="tour-booking-wizard__review-label">Khởi hành:</span>
                    <span className="tour-booking-wizard__review-val font-semibold">
                      {selectedDeparture
                        ? new Date(selectedDeparture.depart_date).toLocaleDateString("vi-VN", {
                            weekday: "long",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          })
                        : "Chưa chọn"}
                    </span>
                  </div>

                  <div className="tour-booking-wizard__review-item">
                    <span className="tour-booking-wizard__review-label">Số khách:</span>
                    <span className="tour-booking-wizard__review-val">{guests} người lớn / khách</span>
                  </div>

                  <div className="tour-booking-wizard__review-item">
                    <span className="tour-booking-wizard__review-label">Người đặt:</span>
                    <span className="tour-booking-wizard__review-val">
                      {contact.full_name} ({contact.phone})
                    </span>
                  </div>

                  {contact.email && (
                    <div className="tour-booking-wizard__review-item">
                      <span className="tour-booking-wizard__review-label">Email:</span>
                      <span className="tour-booking-wizard__review-val">{contact.email}</span>
                    </div>
                  )}

                  {contact.note && (
                    <div className="tour-booking-wizard__review-item tour-booking-wizard__review-item--full">
                      <span className="tour-booking-wizard__review-label">Ghi chú:</span>
                      <span className="tour-booking-wizard__review-val">{contact.note}</span>
                    </div>
                  )}
                </div>

                <div className="tour-booking-wizard__divider" />

                <div className="tour-booking-wizard__review-pricing">
                  <div className="tour-booking-wizard__price-row">
                    <span>Đơn giá:</span>
                    <span>{unitPrice.toLocaleString("vi-VN")}₫ × {guests}</span>
                  </div>
                  {isSale && (
                    <div className="tour-booking-wizard__price-row tour-booking-wizard__price-row--savings">
                      <span>Khuyến mãi tiết kiệm:</span>
                      <span>- {((listPrice - unitPrice) * guests).toLocaleString("vi-VN")}₫</span>
                    </div>
                  )}
                  <div className="tour-booking-wizard__price-row tour-booking-wizard__price-row--total">
                    <span>Tổng thanh toán:</span>
                    <span className="tour-booking-wizard__total-amount">
                      {totalPrice.toLocaleString("vi-VN")}₫
                    </span>
                  </div>
                </div>
              </div>

              {/* Thông báo thời hạn giữ chỗ 30 phút chuẩn quy định */}
              <div className="tour-booking-wizard__hold-notice">
                <span className="material-symbols-outlined tour-booking-wizard__hold-icon">
                  timer
                </span>
                <div className="tour-booking-wizard__hold-text">
                  <strong>Giữ chỗ đảm bảo trong 30 phút:</strong>
                  <p>
                    Sau khi bấm xác nhận, hệ thống sẽ tạm giữ chỗ của quý khách trong 30 phút để quý khách thực hiện thanh toán chuyển khoản.
                  </p>
                </div>
              </div>

              {errorMessage && !isSoldOutError && (
                <div className="tour-booking-wizard__alert tour-booking-wizard__alert--error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ BƯỚC 4 ════════════════════ */}
          {step === 4 && (
            <div className="tour-booking-wizard__step-content tour-booking-wizard__step-payment">
              <div className="tour-booking-wizard__success-banner">
                <span className="material-symbols-outlined tour-booking-wizard__success-icon">
                  check_circle
                </span>
                <div className="tour-booking-wizard__success-text">
                  <h3 className="tour-booking-wizard__success-title">Đặt chỗ thành công!</h3>
                  <p className="tour-booking-wizard__success-sub">
                    Chỗ ngồi của quý khách đã được giữ trong hệ thống.
                  </p>
                </div>
              </div>

              {/* Đồng hồ đếm ngược giữ chỗ 30 phút */}
              <div
                className={`tour-booking-wizard__countdown-card ${
                  timeLeft <= 300 ? "tour-booking-wizard__countdown-card--urgent" : ""
                }`}
              >
                <div className="tour-booking-wizard__countdown-label">
                  <span className="material-symbols-outlined">schedule</span>
                  <span>Thời hạn giữ chỗ còn lại:</span>
                </div>
                <div className="tour-booking-wizard__countdown-time">
                  {timeLeft > 0 ? formatTime(timeLeft) : "00:00 (Hết hạn)"}
                </div>
                <p className="tour-booking-wizard__countdown-hint">
                  {timeLeft > 0
                    ? "Vui lòng chuyển khoản trước khi hết hạn để tránh mất chỗ tự động."
                    : "Hạn giữ chỗ 30 phút đã kết thúc. Chỗ có thể đã được hoàn về hệ thống."}
                </p>
              </div>

              {/* Chọn phương thức thanh toán khi chưa có paymentResult */}
              {!paymentResult ? (
                <div className="tour-booking-wizard__pay-methods">
                  <h4 className="tour-booking-wizard__payment-heading">
                    <span className="material-symbols-outlined">payments</span>
                    <span>Chọn phương thức thanh toán</span>
                  </h4>
                  <p className="tour-booking-wizard__pay-methods-desc">
                    Đơn hàng của quý khách đang chờ thanh toán. Vui lòng chọn phương thức phù hợp:
                  </p>

                  <div className="tour-booking-wizard__pay-methods-actions">
                    <button
                      type="button"
                      className="tour-booking-wizard__btn-stripe"
                      onClick={handlePayByStripe}
                      disabled={isCreatingStripe || isCreatingManual}
                    >
                      {isCreatingStripe ? (
                        <>
                          <span className="tour-booking-wizard__spinner" />
                          <span>Đang chuyển hướng...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">account_balance_wallet</span>
                          <span>Thanh toán qua Stripe</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="tour-booking-wizard__btn-manual"
                      onClick={handlePayByBankTransfer}
                      disabled={isCreatingStripe || isCreatingManual}
                    >
                      {isCreatingManual ? (
                        <>
                          <span className="tour-booking-wizard__spinner tour-booking-wizard__spinner--dark" />
                          <span>Đang tạo thông tin...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">account_balance</span>
                          <span>Chuyển khoản thủ công</span>
                        </>
                      )}
                    </button>
                  </div>

                  {isCreatingStripe && (
                    <div className="tour-booking-wizard__checkout-loading">
                      <span className="tour-booking-wizard__spinner tour-booking-wizard__spinner--dark" />
                      <span>Đang kết nối cổng thanh toán...</span>
                    </div>
                  )}

                  {checkoutError && (
                    <div className="tour-booking-wizard__checkout-error">
                      <span className="material-symbols-outlined">error</span>
                      <span>{checkoutError}</span>
                    </div>
                  )}
                </div>
              ) : (
                /* Chi tiết thanh toán an toàn (Tuân thủ HIỆU CHỈNH 1-3: KHÔNG fake bank, KHÔNG fake QR) */
                <div className="tour-booking-wizard__payment-box">
                  <div className="tour-booking-wizard__payment-box-header">
                    <h4 className="tour-booking-wizard__payment-heading">
                      Thông tin chuyển khoản thanh toán
                    </h4>
                    <button
                      type="button"
                      className="tour-booking-wizard__btn-change-method"
                      onClick={() => setPaymentResult(null)}
                      title="Chọn lại phương thức thanh toán"
                    >
                      <span className="material-symbols-outlined">swap_horiz</span>
                      <span>Đổi phương thức</span>
                    </button>
                  </div>

                  <div className="tour-booking-wizard__payment-details">
                    <div className="tour-booking-wizard__pay-row">
                      <span className="tour-booking-wizard__pay-label">Mã đơn đặt tour:</span>
                      <div className="tour-booking-wizard__pay-val-wrap">
                        <b className="tour-booking-wizard__pay-code">
                          {bookingResult?.code || `TX-#${bookingResult?.id}`}
                        </b>
                        <button
                          type="button"
                          className="tour-booking-wizard__copy-btn"
                          onClick={() =>
                            handleCopy(
                              bookingResult?.code || `TX-#${bookingResult?.id}`,
                              "code"
                            )
                          }
                        >
                          {copiedField === "code" ? "Đã chép" : "Sao chép"}
                        </button>
                      </div>
                    </div>

                    {paymentResult?.txn_ref && (
                      <div className="tour-booking-wizard__pay-row tour-booking-wizard__pay-row--highlight">
                        <span className="tour-booking-wizard__pay-label">Mã giao dịch:</span>
                        <div className="tour-booking-wizard__pay-val-wrap">
                          <b className="tour-booking-wizard__pay-code text-primary font-mono">
                            {paymentResult.txn_ref}
                          </b>
                          <button
                            type="button"
                            className="tour-booking-wizard__copy-btn"
                            onClick={() => handleCopy(paymentResult.txn_ref, "pm")}
                          >
                            {copiedField === "pm" ? "Đã chép" : "Sao chép"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="tour-booking-wizard__pay-row">
                      <span className="tour-booking-wizard__pay-label">Số tiền cần chuyển:</span>
                      <div className="tour-booking-wizard__pay-val-wrap">
                        <b className="tour-booking-wizard__pay-amount">
                          {(paymentResult?.amount || bookingResult?.total_price || totalPrice).toLocaleString(
                            "vi-VN"
                          )}
                          ₫
                        </b>
                        <button
                          type="button"
                          className="tour-booking-wizard__copy-btn"
                          onClick={() =>
                            handleCopy(
                              String(paymentResult?.amount || bookingResult?.total_price || totalPrice),
                              "amount"
                            )
                          }
                        >
                          {copiedField === "amount" ? "Đã chép" : "Sao chép"}
                        </button>
                      </div>
                    </div>

                    {/* Hiển thị thông tin ngân hàng thật nếu có cấu hình từ .env; nếu không thì hiển thị an toàn */}
                    {BANK_NAME && BANK_ACCOUNT_NO ? (
                      <>
                        <div className="tour-booking-wizard__pay-row">
                          <span className="tour-booking-wizard__pay-label">Ngân hàng:</span>
                          <span className="tour-booking-wizard__pay-val">{BANK_NAME}</span>
                        </div>
                        <div className="tour-booking-wizard__pay-row">
                          <span className="tour-booking-wizard__pay-label">Số tài khoản:</span>
                          <div className="tour-booking-wizard__pay-val-wrap">
                            <b className="tour-booking-wizard__pay-val font-mono">{BANK_ACCOUNT_NO}</b>
                            <button
                              type="button"
                              className="tour-booking-wizard__copy-btn"
                              onClick={() => handleCopy(BANK_ACCOUNT_NO, "acc")}
                            >
                              {copiedField === "acc" ? "Đã chép" : "Sao chép"}
                            </button>
                          </div>
                        </div>
                        {BANK_ACCOUNT_NAME && (
                          <div className="tour-booking-wizard__pay-row">
                            <span className="tour-booking-wizard__pay-label">Chủ tài khoản:</span>
                            <span className="tour-booking-wizard__pay-val uppercase font-semibold">
                              {BANK_ACCOUNT_NAME}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="tour-booking-wizard__safe-instruction">
                        <p className="tour-booking-wizard__safe-text">
                          Vui lòng chuyển khoản theo mã giao dịch{" "}
                          <b>{paymentResult?.txn_ref || bookingResult?.code}</b> và chờ xác nhận.
                        </p>
                        <p className="tour-booking-wizard__safe-sub">
                          Nhân viên phụ trách sẽ liên hệ hotline hoặc đối soát tự động ngay khi nhận được thanh toán.
                        </p>
                      </div>
                    )}

                    <div className="tour-booking-wizard__pay-row tour-booking-wizard__pay-row--note">
                      <span className="tour-booking-wizard__pay-label">Nội dung chuyển khoản:</span>
                      <div className="tour-booking-wizard__pay-val-wrap">
                        <code className="tour-booking-wizard__pay-content">
                          {paymentResult?.txn_ref || bookingResult?.code}
                        </code>
                        <button
                          type="button"
                          className="tour-booking-wizard__copy-btn"
                          onClick={() =>
                            handleCopy(
                              paymentResult?.txn_ref || bookingResult?.code,
                              "content"
                            )
                          }
                        >
                          {copiedField === "content" ? "Đã chép" : "Sao chép"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Wizard với các nút điều hướng */}
        <footer className="tour-booking-wizard__footer">
          {step === 1 && (
            <>
              <button
                type="button"
                className="tour-booking-wizard__btn-secondary"
                onClick={onClose}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="tour-booking-wizard__btn-primary"
                onClick={handleNextToContact}
                disabled={!selectedDeparture || selectedDeparture.seats_left <= 0}
              >
                <span>Tiếp tục: Nhập thông tin</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                className="tour-booking-wizard__btn-secondary"
                onClick={() => setStep(1)}
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span>Quay lại</span>
              </button>
              <button
                type="button"
                className="tour-booking-wizard__btn-primary"
                onClick={handleNextToReview}
              >
                <span>{user ? "Tiếp tục: Xác nhận đơn" : "Đăng nhập & Tiếp tục"}</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </>
          )}

          {step === 3 && (
            <>
              <button
                type="button"
                className="tour-booking-wizard__btn-secondary"
                onClick={() => setStep(2)}
                disabled={isSubmitting}
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span>Quay lại</span>
              </button>
              <button
                type="button"
                className="tour-booking-wizard__btn-primary tour-booking-wizard__btn-primary--confirm"
                onClick={handleConfirmBooking}
                disabled={isSubmitting || !!priceAlert || isSoldOutError}
              >
                {isSubmitting ? (
                  <>
                    <span className="tour-booking-wizard__spinner" />
                    <span>Đang giữ chỗ & tạo mã...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">lock_clock</span>
                    <span>Xác nhận đặt tour (Giữ chỗ 30 phút)</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 4 && (
            <>
              <button
                type="button"
                className="tour-booking-wizard__btn-secondary"
                onClick={onClose}
              >
                Đóng
              </button>
              <button
                type="button"
                className="tour-booking-wizard__btn-primary"
                onClick={handleGoToMyBookings}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                <span>Xem đơn của tôi</span>
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}
