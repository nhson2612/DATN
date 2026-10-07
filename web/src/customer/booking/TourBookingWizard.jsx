import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api";
import "./TourBookingWizard.css";

// Cấu hình tài khoản ngân hàng đọc từ biến môi trường (hoặc fallback mặc định)
const BANK_NAME = import.meta.env.VITE_BANK_NAME || "MB Bank (Ngân hàng Quân Đội)";
const BANK_ACCOUNT_NO = import.meta.env.VITE_BANK_ACCOUNT_NO || "0987654321";
const BANK_ACCOUNT_NAME = import.meta.env.VITE_BANK_ACCOUNT_NAME || "VOYAGE TRAVEL VIETNAM";

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
  const [fieldErrors, setFieldErrors] = useState({});
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

  // Hiệu ứng checkmark Apple xuất hiện rồi ẩn đi ở Bước 4
  const [showIntroCheck, setShowIntroCheck] = useState(false);

  // Countdown giữ chỗ 30 phút ở Bước 4
  const [timeLeft, setTimeLeft] = useState(1800); // 30 phút = 1800s
  const [copiedField, setCopiedField] = useState("");

  // Khởi tạo state khi mở modal
  useEffect(() => {
    if (!open || !tour) return;

    setStep(1);
    setPassengers(Array.from({ length: Math.max(1, Number(initialGuests) || 1) }, () => ({ full_name: "", phone: "", email: "" })));
    setErrorMessage("");
    setFieldErrors({});
    setIsSoldOutError(false);
    setPriceAlert(null);
    setBookingResult(null);
    setPaymentResult(null);
    setShowIntroCheck(false);
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

  // Quản lý animation splash xác nhận kiểu Apple ở Bước 4: xuất hiện rồi tự ẩn đi hiện nội dung thanh toán
  useEffect(() => {
    if (step === 4) {
      setShowIntroCheck(true);
      const timer = setTimeout(() => {
        setShowIntroCheck(false);
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setShowIntroCheck(false);
    }
  }, [step]);

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
    setPassengers((prev) => {
      const nextList = [];
      nextList[0] = {
        full_name: contact.full_name,
        phone: contact.phone,
        email: contact.email,
      };
      for (let i = 1; i < next; i++) {
        nextList[i] = prev[i] || { full_name: "", phone: "", email: "" };
      }
      return nextList;
    });
  };

  const handleInputChange = (field) => (e) => {
    setContact((prev) => ({ ...prev, [field]: e.target.value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  // Bước 1 -> Bước 2
  const handleNextToContact = () => {
    if (!selectedDeparture) {
      setFieldErrors({ departure: "Vui lòng chọn một đợt khởi hành để tiếp tục." });
      return;
    }
    if (selectedDeparture.seats_left <= 0) {
      setFieldErrors({ departure: "Đợt khởi hành này đã hết chỗ, vui lòng chọn ngày khác." });
      return;
    }
    setFieldErrors({});
    setErrorMessage("");
    setIsSoldOutError(false);
    setStep(2);
  };

  // Bước 2 -> Bước 3
  const handleNextToReview = () => {
    const errs = {};
    if (!contact.full_name.trim()) {
      errs.full_name = "Vui lòng nhập họ và tên của bạn.";
    }
    const cleanPhone = contact.phone.trim();
    if (!cleanPhone) {
      errs.phone = "Vui lòng nhập số điện thoại để nhận thông tin đặt tour.";
    } else if (!/^[0-9+\s\-()]{8,15}$/.test(cleanPhone)) {
      errs.phone = "Số điện thoại không hợp lệ, vui lòng kiểm tra lại.";
    }

    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setFieldErrors({});
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

      // 2. Chuẩn bị danh sách hành khách: Khách số 1 luôn là người đặt
      const bookerName = contact.full_name.trim();
      const finalPassengers = [
        {
          full_name: bookerName,
          phone: contact.phone.trim() || null,
          email: contact.email?.trim() || null,
        },
      ];
      // Nếu đặt cho nhiều người, bổ sung người đi cùng (nếu chưa nhập tên thì tự động điền)
      for (let i = 1; i < guests; i++) {
        const p = passengers[i];
        const companionName = (p?.full_name || "").trim() || `Khách đi cùng ${i + 1} (${bookerName})`;
        finalPassengers.push({
          full_name: companionName,
          phone: (p?.phone || "").trim() || null,
          email: (p?.email || "").trim() || null,
        });
      }

      // 3. Gọi API đặt tour
      const bookData = {
        tour_id: tour.id,
        departure_id: selectedDeparture?.id || null,
        full_name: bookerName,
        phone: contact.phone.trim(),
        email: contact.email?.trim() || null,
        guests: Number(guests) || 1,
        passengers: finalPassengers,
        note: contact.note?.trim() || null,
      };

      const bookRes = await api.bookTour(bookData);
      setBookingResult(bookRes);
      setPaymentResult(null);

      // 4. Vào Bước 4 chọn phương thức thanh toán
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
    navigate("/tai-khoan?tab=tours");
  };

  return (
    <div
      className="aura-drawer__overlay tour-wizard__overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <aside className="aura-drawer__panel tour-wizard__panel" onClick={(e) => e.stopPropagation()}>
        {/* Header Wizard chuẩn Aura Drawer */}
        <header className="tour-wizard__header">
          <div className="tour-wizard__header-main">
            <span className="tour-wizard__header-tag">Aura Tour Booking</span>
            <h2 id="wizard-title" className="tour-wizard__title">
              {step === 4 ? "Đặt tour thành công" : "Đặt tour du lịch"}
            </h2>
            <p className="tour-wizard__tour-name">{tour.name}</p>
          </div>
          <button
            type="button"
            className="aura-drawer__close"
            onClick={onClose}
            aria-label="Đóng cửa sổ đặt tour"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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
                              setFieldErrors((prev) => {
                                const next = { ...prev };
                                delete next.departure;
                                return next;
                              });
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
                {fieldErrors.departure && (
                  <span className="tour-booking-wizard__field-error" style={{ marginTop: "6px" }}>
                    {fieldErrors.departure}
                  </span>
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
            </div>
          )}

          {/* ════════════════════ BƯỚC 2 ════════════════════ */}
          {step === 2 && (
            <div className="tour-booking-wizard__step-content tour-booking-wizard__step-contact">
              {!user && (
                <div className="tour-booking-wizard__inline-hint">
                  <span className="tour-booking-wizard__hint-dot" />
                  <span>
                    Quý khách có thể điền thông tin ngay. Hệ thống sẽ kết nối đăng nhập ở bước tiếp theo để lưu mã đơn và theo dõi thanh toán.
                  </span>
                </div>
              )}

              <div className="tour-booking-wizard__form-grid">
                <div className="tour-booking-wizard__field">
                  <label className="tour-booking-wizard__label">
                    Họ và tên <span className="tour-booking-wizard__required">*</span>
                  </label>
                  <input
                    type="text"
                    className={`tour-booking-wizard__input ${
                      fieldErrors.full_name ? "tour-booking-wizard__input--error" : ""
                    }`}
                    placeholder="Ví dụ: Nguyễn Văn A"
                    value={contact.full_name}
                    onChange={handleInputChange("full_name")}
                    required
                  />
                  {fieldErrors.full_name && (
                    <span className="tour-booking-wizard__field-error">
                      {fieldErrors.full_name}
                    </span>
                  )}
                </div>

                <div className="tour-booking-wizard__field">
                  <label className="tour-booking-wizard__label">
                    Số điện thoại liên hệ <span className="tour-booking-wizard__required">*</span>
                  </label>
                  <input
                    type="tel"
                    className={`tour-booking-wizard__input ${
                      fieldErrors.phone ? "tour-booking-wizard__input--error" : ""
                    }`}
                    placeholder="Ví dụ: 0912345678"
                    value={contact.phone}
                    onChange={handleInputChange("phone")}
                    required
                  />
                  {fieldErrors.phone && (
                    <span className="tour-booking-wizard__field-error">
                      {fieldErrors.phone}
                    </span>
                  )}
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

                {/* Khi đặt từ 2 người trở lên: hiển thị ô nhập người đi cùng (khách 1 đã là người đặt) */}
                {guests > 1 && (
                  <div className="tour-booking-wizard__field tour-booking-wizard__field--full tour-booking-wizard__companions-box">
                    <div className="tour-booking-wizard__companions-header">
                      <label className="tour-booking-wizard__label" style={{ marginBottom: 0 }}>
                        Thông tin người đi cùng ({guests - 1} khách)
                      </label>
                      <span className="tour-booking-wizard__companions-hint">
                        (Tùy chọn - Khách 1 đã là {contact.full_name.trim() || "quý khách"})
                      </span>
                    </div>

                    <div className="tour-booking-wizard__companions-list">
                      {Array.from({ length: guests - 1 }).map((_, idx) => {
                        const pIdx = idx + 1;
                        const p = passengers[pIdx] || { full_name: "", phone: "" };
                        return (
                          <div className="tour-booking-wizard__companion-row" key={pIdx}>
                            <span className="tour-booking-wizard__companion-badge">
                              Khách {pIdx + 1}
                            </span>
                            <input
                              type="text"
                              className="tour-booking-wizard__input"
                              placeholder={`Họ và tên khách ${pIdx + 1}`}
                              value={p.full_name || ""}
                              onChange={(e) =>
                                setPassengers((prev) => {
                                  const copy = [...prev];
                                  copy[pIdx] = { ...(copy[pIdx] || {}), full_name: e.target.value };
                                  return copy;
                                })
                              }
                            />
                            <input
                              type="tel"
                              className="tour-booking-wizard__input"
                              placeholder="SĐT (nếu có)"
                              value={p.phone || ""}
                              onChange={(e) =>
                                setPassengers((prev) => {
                                  const copy = [...prev];
                                  copy[pIdx] = { ...(copy[pIdx] || {}), phone: e.target.value };
                                  return copy;
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
                    <span className="tour-booking-wizard__review-val">{guests} khách</span>
                  </div>

                  <div className="tour-booking-wizard__review-item">
                    <span className="tour-booking-wizard__review-label">
                      {guests === 1 ? "Khách hàng:" : "Người đặt tour:"}
                    </span>
                    <span className="tour-booking-wizard__review-val">
                      {contact.full_name} ({contact.phone})
                    </span>
                  </div>

                  {guests > 1 && (
                    <div className="tour-booking-wizard__review-item tour-booking-wizard__review-item--full">
                      <span className="tour-booking-wizard__review-label">Danh sách khách:</span>
                      <span className="tour-booking-wizard__review-val">
                        1. {contact.full_name} (người đặt)
                        {passengers.slice(1).map((p, idx) => (
                          <span key={idx}> • {idx + 2}. {p.full_name?.trim() || `Khách đi cùng ${idx + 2}`}</span>
                        ))}
                      </span>
                    </div>
                  )}

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

              {/* Lưu ý giữ chỗ 30 phút dạng footnote tinh gọn - text thuần túy không icon */}
              <p className="tour-booking-wizard__hold-footnote">
                Chỗ ngồi được đảm bảo giữ trong 30 phút sau khi xác nhận để quý khách thanh toán.
              </p>

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
              {showIntroCheck ? (
                /* Splash xác nhận chuẩn Apple: Icon check vẽ ra + text xuất hiện, sau đó tự ẩn đi */
                <div className="tour-booking-wizard__apple-splash">
                  <div className="tour-booking-wizard__apple-check-wrap">
                    <svg className="tour-booking-wizard__apple-check-svg" viewBox="0 0 52 52">
                      <circle className="tour-booking-wizard__apple-check-circle" cx="26" cy="26" r="24" fill="none" />
                      <path className="tour-booking-wizard__apple-check-path" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                    </svg>
                  </div>
                  <h3 className="tour-booking-wizard__apple-splash-title">Đặt chỗ thành công</h3>
                  <p className="tour-booking-wizard__apple-splash-sub">
                    Mã đơn: {bookingResult?.code || `TX-#${bookingResult?.id}`}
                  </p>
                </div>
              ) : (
                /* Nội dung thanh toán xuất hiện mượt mà sau splash */
                <div className="tour-booking-wizard__payment-reveal">
                  <div className="tour-booking-wizard__payment-meta-bar">
                    <span className="tour-booking-wizard__payment-meta-code">
                      Mã đơn: <strong className="font-mono">{bookingResult?.code || `TX-#${bookingResult?.id}`}</strong>
                    </span>
                    <span className="tour-booking-wizard__payment-meta-sep">•</span>
                    <span className="tour-booking-wizard__payment-meta-timer">
                      Thời hạn giữ chỗ:{" "}
                      <strong className={`font-mono ${timeLeft <= 300 ? "text-danger" : ""}`}>
                        {timeLeft > 0 ? formatTime(timeLeft) : "00:00 (Hết hạn)"}
                      </strong>
                    </span>
                  </div>

                  {/* Chọn phương thức thanh toán khi chưa có paymentResult */}
                  {!paymentResult ? (
                    <div className="tour-booking-wizard__pay-methods">
                      <div className="tour-booking-wizard__pay-methods-header">
                        <h4 className="tour-booking-wizard__payment-heading">
                          Phương thức thanh toán
                        </h4>
                        <p className="tour-booking-wizard__pay-methods-desc">
                          Chọn hình thức phù hợp để hoàn tất việc giữ chỗ cho chuyến đi của bạn.
                        </p>
                      </div>

                      <div className="tour-booking-wizard__pay-method-options">
                        <button
                          type="button"
                          className="tour-booking-wizard__method-card"
                          onClick={handlePayByBankTransfer}
                          disabled={isCreatingStripe || isCreatingManual}
                        >
                          <div className="tour-booking-wizard__method-info">
                            <div className="tour-booking-wizard__method-title">
                              Chuyển khoản VietQR
                              <span className="tour-booking-wizard__method-pill">Nhanh nhất</span>
                            </div>
                            <div className="tour-booking-wizard__method-desc">
                              Quét mã QR từ app ngân hàng (MB, Vietcombank, Techcombank, Momo...)
                            </div>
                          </div>
                          <span className="tour-booking-wizard__method-arrow">→</span>
                        </button>

                        <button
                          type="button"
                          className="tour-booking-wizard__method-card"
                          onClick={handlePayByStripe}
                          disabled={isCreatingStripe || isCreatingManual}
                        >
                          <div className="tour-booking-wizard__method-info">
                            <div className="tour-booking-wizard__method-title">
                              Thẻ quốc tế & Ví điện tử
                              <span className="tour-booking-wizard__method-tag">Stripe</span>
                            </div>
                            <div className="tour-booking-wizard__method-desc">
                              Hỗ trợ Visa, Mastercard, Apple Pay, Google Pay an toàn toàn cầu
                            </div>
                          </div>
                          <span className="tour-booking-wizard__method-arrow">→</span>
                        </button>
                      </div>

                      {isCreatingStripe && (
                        <div className="tour-booking-wizard__checkout-loading">
                          <span className="tour-booking-wizard__spinner tour-booking-wizard__spinner--dark" />
                          <span>Đang kết nối cổng thanh toán quốc tế...</span>
                        </div>
                      )}

                      {isCreatingManual && (
                        <div className="tour-booking-wizard__checkout-loading">
                          <span className="tour-booking-wizard__spinner tour-booking-wizard__spinner--dark" />
                          <span>Đang tạo thông tin mã VietQR...</span>
                        </div>
                      )}

                      {checkoutError && (
                        <div className="tour-booking-wizard__checkout-error">
                          <span>{checkoutError}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Chi tiết thanh toán VietQR & thông tin tài khoản */
                    <div className="tour-booking-wizard__payment-box">
                      <div className="tour-booking-wizard__payment-box-header">
                        <div>
                          <h4 className="tour-booking-wizard__payment-heading">
                            Chuyển khoản thanh toán (VietQR)
                          </h4>
                          <p className="tour-booking-wizard__payment-sub">
                            Mở ứng dụng ngân hàng và quét mã để thanh toán tự động
                          </p>
                        </div>
                        <button
                          type="button"
                          className="tour-booking-wizard__btn-change-method"
                          onClick={() => setPaymentResult(null)}
                          title="Chọn lại phương thức thanh toán"
                        >
                          Đổi phương thức
                        </button>
                      </div>

                      {/* Khung VietQR code */}
                      <div className="tour-booking-wizard__qr-container">
                        <div className="tour-booking-wizard__qr-image-wrap">
                          <img
                            src={`https://img.vietqr.io/image/970422-${BANK_ACCOUNT_NO}-compact2.png?amount=${
                              paymentResult?.amount || bookingResult?.total_price || totalPrice
                            }&addInfo=VOYAGE%20${
                              paymentResult?.txn_ref || bookingResult?.code || `BK${bookingResult?.id}`
                            }&accountName=${encodeURIComponent(BANK_ACCOUNT_NAME)}`}
                            alt="Mã QR Chuyển khoản"
                            className="tour-booking-wizard__qr-img"
                          />
                        </div>
                        <div className="tour-booking-wizard__qr-meta">
                          <div className="tour-booking-wizard__qr-meta-item">
                            <span className="tour-booking-wizard__qr-label">Số tiền cần chuyển</span>
                            <div className="tour-booking-wizard__qr-amount-row">
                              <span className="tour-booking-wizard__qr-amount">
                                {(paymentResult?.amount || bookingResult?.total_price || totalPrice).toLocaleString(
                                  "vi-VN"
                                )} ₫
                              </span>
                              <button
                                type="button"
                                className="tour-booking-wizard__mini-copy"
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

                          <div className="tour-booking-wizard__qr-meta-item">
                            <span className="tour-booking-wizard__qr-label">Nội dung chuyển khoản (Bắt buộc)</span>
                            <div className="tour-booking-wizard__qr-content-row">
                              <code className="tour-booking-wizard__qr-code">
                                VOYAGE {paymentResult?.txn_ref || bookingResult?.code || `BK${bookingResult?.id}`}
                              </code>
                              <button
                                type="button"
                                className="tour-booking-wizard__mini-copy"
                                onClick={() =>
                                  handleCopy(
                                    `VOYAGE ${paymentResult?.txn_ref || bookingResult?.code || `BK${bookingResult?.id}`}`,
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

                      {/* Chi tiết tài khoản ngân hàng */}
                      <div className="tour-booking-wizard__payment-details">
                        <div className="tour-booking-wizard__pay-row">
                          <span className="tour-booking-wizard__pay-label">Ngân hàng thụ hưởng:</span>
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
                        <div className="tour-booking-wizard__pay-row">
                          <span className="tour-booking-wizard__pay-label">Chủ tài khoản:</span>
                          <span className="tour-booking-wizard__pay-val uppercase font-semibold">
                            {BANK_ACCOUNT_NAME}
                          </span>
                        </div>
                        <div className="tour-booking-wizard__pay-row">
                          <span className="tour-booking-wizard__pay-label">Mã đơn đặt tour:</span>
                          <div className="tour-booking-wizard__pay-val-wrap">
                            <span className="font-mono text-zinc-900 font-semibold">
                              {bookingResult?.code || `TX-#${bookingResult?.id}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="tour-booking-wizard__safe-instruction">
                        <p className="tour-booking-wizard__safe-text">
                          Hệ thống sẽ tự động xác nhận đơn ngay khi nhận được tín hiệu ngân hàng. Quý khách cũng có thể truy cập <b>Tài khoản › Quản lý tour</b> để kiểm tra trạng thái bất kỳ lúc nào.
                        </p>
                      </div>
                    </div>
                  )}
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
      </aside>
    </div>
  );
}
