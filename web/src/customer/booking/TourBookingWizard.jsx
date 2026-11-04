import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api";
import "./TourBookingWizard.css";

/* Logo vector chính thức chuẩn e-commerce & payment gateways */
function StripeLogo({ className = "tour-checkout-logo-stripe" }) {
  return (
    <svg className={className} viewBox="54 36 360.02 149.84" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Stripe">
      <g fill="#635BFF" fillRule="evenodd" clipRule="evenodd">
        <path d="M414 113.4c0-25.6-12.4-45.8-36.1-45.8c-23.8 0-38.2 20.2-38.2 45.6c0 30.1 17 45.3 41.4 45.3 11.9 0 20.9-2.7 27.7-6.5v-20c-6.8 3.4-14.6 5.5-24.5 5.5c-9.7 0-18.3-3.4-19.4-15.2h48.9c.2-1.4.4-6.6.4-9zm-49.4-9.5c0-11.3 6.9-16 13.2-16c6.1 0 12.6 4.7 12.6 16h-25.8z" />
        <path d="M301.1 67.6c-9.8 0-16.1 4.6-19.6 7.8l-1.3-6.2h-22v116.6l25-5.3.1-28.3c3.6 2.6 8.9 6.3 17.7 6.3 17.9 0 34.2-14.4 34.2-46.1 0-28.7-16.5-44.5-34.1-44.5zm-6 68.9c-5.9 0-9.4-2.1-11.8-4.7l-.1-37.1c2.6-2.9 6.2-4.9 11.9-4.9 9.1 0 15.4 10.2 15.4 23.3 0 13.2-6.2 23.4-15.4 23.4z" />
        <polygon points="223.8 61.7 248.9 56.3 248.9 36 223.8 41.3" />
        <rect x="223.8" y="69.3" width="25.1" height="87.5" />
        <path d="M196.9 76.7l-1.6-7.4h-21.6v87.5h25V97.5c5.9-7.7 15.9-6.3 19-5.2v-23c-3.8-1.2-15.5-3.4-21.4 7.4z" />
        <path d="M146.9 47.6l-24.4 5.2-.1 80.1c0 14.8 11.1 25.7 25.9 25.7c8.2 0 14.2-1.5 17.5-3.3V135c-3.2 1.3-19 5.9-19-8.9V90.6h19V69.3h-19l.1-21.7z" />
        <path d="M79.3 94.7c0-3.9 3.2-5.4 8.5-5.4c7.6 0 17.2 2.3 24.8 6.4V72.2c-8.3-3.3-16.5-4.6-24.8-4.6C67.5 67.6 54 78.2 54 95.9c0 27.6 38 23.2 38 35.1 0 4.6-4 6.1-9.6 6.1-8.3 0-18.9-3.4-27.3-8v23.8c9.3 4 18.7 5.7 27.3 5.7 20.8 0 35.1-10.3 35.1-28.2 0-26.8-38.1-21.5-38.1-32.7z" />
      </g>
    </svg>
  );
}

function VisaBadge() {
  return (
    <span className="tour-checkout-card-pill" title="Thẻ Visa">
      <svg className="tour-checkout-logo-visa" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Visa">
        <path
          fill="#1434CB"
          d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
        />
      </svg>
    </span>
  );
}

function MastercardBadge() {
  return (
    <span className="tour-checkout-card-pill" title="Thẻ Mastercard">
      <svg className="tour-checkout-logo-mc" viewBox="0 0 32 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Mastercard">
        <circle cx="10" cy="10" r="10" fill="#EB001B" />
        <circle cx="22" cy="10" r="10" fill="#F79E1B" />
        <path
          fill="#FF5F00"
          d="M16 3.1a9.96 9.96 0 0 0-3.9 6.9 9.96 9.96 0 0 0 3.9 6.9 9.96 9.96 0 0 0 3.9-6.9A9.96 9.96 0 0 0 16 3.1z"
        />
      </svg>
    </span>
  );
}

function JCBBadge() {
  return (
    <span className="tour-checkout-card-pill" title="Thẻ JCB">
      <svg className="tour-checkout-logo-jcb" viewBox="0 0 28 18" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="JCB">
        <rect width="28" height="18" rx="3" fill="#ffffff" />
        <rect x="2.5" y="2" width="6.5" height="14" rx="2" fill="#0079C1" />
        <rect x="10.5" y="2" width="6.5" height="14" rx="2" fill="#C8102E" />
        <rect x="18.5" y="2" width="6.5" height="14" rx="2" fill="#00A651" />
        <text x="14" y="11.5" textAnchor="middle" fill="#ffffff" fontSize="6.5" fontWeight="900" fontFamily="sans-serif">JCB</text>
      </svg>
    </span>
  );
}

function StripeBrandBadge() {
  return (
    <span className="tour-checkout-stripe-badge" title="Cổng thanh toán quốc tế Stripe">
      <span className="tour-checkout-stripe-label">Cổng</span>
      <StripeLogo />
    </span>
  );
}

function VietQRBadge() {
  return (
    <div className="tour-checkout-vietqr-badge" title="VietQR Napas 24/7">
      <span className="tour-checkout-vietqr-viet">Viet</span>
      <span className="tour-checkout-vietqr-qr">QR</span>
      <span className="tour-checkout-vietqr-napas">NAPAS 247</span>
    </div>
  );
}

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

  // Kết quả sau khi book
  const [bookingResult, setBookingResult] = useState(null);

  // State thanh toán Stripe & payOS
  const [paymentMethod, setPaymentMethod] = useState("payos");
  const [checkoutError, setCheckoutError] = useState("");
  const [isCreatingStripe, setIsCreatingStripe] = useState(false);
  const [isCreatingPayos, setIsCreatingPayos] = useState(false);

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
    setShowIntroCheck(false);
    setCheckoutError("");
    setIsCreatingStripe(false);
    setIsCreatingPayos(false);
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

      // 4. Vào Bước 4 thanh toán qua Stripe
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
      setCheckoutError(err.message || "Không thể kết nối cổng Stripe. Vui lòng thử lại sau ít phút.");
    } finally {
      setIsCreatingStripe(false);
    }
  };

  const handlePayByPayos = async () => {
    if (!bookingResult?.id) return;
    setCheckoutError("");
    setIsCreatingPayos(true);
    try {
      const res = await api.checkoutPayosBooking(bookingResult.id, window.location.origin);
      if (res?.checkout_url) {
        window.location.assign(res.checkout_url);
      } else {
        setCheckoutError("Không nhận được liên kết thanh toán payOS.");
      }
    } catch (err) {
      setCheckoutError(err.message || "Không thể kết nối cổng thanh toán payOS. Vui lòng thử lại sau ít phút.");
    } finally {
      setIsCreatingPayos(false);
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
                  1. Chọn đợt khởi hành còn chỗ
                </label>

                {(!tour.departures || tour.departures.length === 0) ? (
                  <p className="tour-booking-wizard__empty-text">
                    Hiện chưa có lịch khởi hành mở bán cho tour này. Vui lòng liên hệ hotline 1900 6868.
                  </p>
                ) : (
                  <div className="tour-booking-wizard__departure-list" role="radiogroup" aria-label="Chọn đợt khởi hành">
                    {tour.departures.map((dep) => {
                      const isSoldOut = dep.seats_left <= 0;
                      const isSelected = selectedDeparture?.id === dep.id;
                      const effPrice = dep.effective_price || dep.price;
                      const lPrice = dep.list_price || dep.price;
                      const hasSale = lPrice > effPrice;
                      const depDateObj = new Date(dep.depart_date);

                      return (
                        <div
                          key={dep.id}
                          className={`tour-booking-wizard__dep-row ${
                            isSelected ? "tour-booking-wizard__dep-row--selected" : ""
                          } ${isSoldOut ? "tour-booking-wizard__dep-row--disabled" : ""}`}
                          role="radio"
                          aria-checked={isSelected}
                          tabIndex={isSoldOut ? -1 : 0}
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
                          onKeyDown={(e) => {
                            if (!isSoldOut && (e.key === "Enter" || e.key === " ")) {
                              setSelectedDeparture(dep);
                            }
                          }}
                        >
                          <div className="tour-booking-wizard__dep-row-left">
                            <div className={`tour-booking-wizard__dep-radio-circle ${isSelected ? "tour-booking-wizard__dep-radio-circle--active" : ""}`}>
                              {isSelected && <div className="tour-booking-wizard__dep-radio-dot" />}
                            </div>
                            <div className="tour-booking-wizard__dep-date-wrap">
                              <span className="tour-booking-wizard__dep-date-main">
                                {depDateObj.toLocaleDateString("vi-VN", {
                                  weekday: "long",
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                              </span>
                              <span className="tour-booking-wizard__dep-duration">
                                {tour?.duration_days ? `${tour.duration_days} ngày ${tour.duration_nights || tour.duration_days - 1} đêm` : "Khởi hành định kỳ"}
                              </span>
                            </div>
                          </div>

                          <div className="tour-booking-wizard__dep-row-right">
                            {isSoldOut ? (
                              <span className="tour-booking-wizard__badge tour-booking-wizard__badge--soldout">
                                Hết chỗ
                              </span>
                            ) : (
                              <span className="tour-booking-wizard__badge tour-booking-wizard__badge--available">
                                Còn {dep.seats_left} chỗ
                              </span>
                            )}

                            <div className="tour-booking-wizard__dep-row-pricing">
                              <span className="tour-booking-wizard__dep-price-current">
                                {effPrice.toLocaleString("vi-VN")}₫
                              </span>
                              {hasSale && (
                                <span className="tour-booking-wizard__dep-price-old">
                                  {lPrice.toLocaleString("vi-VN")}₫
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
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

              {/* Tạm tính chi phí - Dạng bảng dòng tinh tế, không đóng hộp xám */}
              <div className="tour-booking-wizard__calc-summary">
                <div className="tour-booking-wizard__calc-row">
                  <span className="tour-booking-wizard__calc-label">Đơn giá áp dụng:</span>
                  <span className="tour-booking-wizard__calc-val">{unitPrice.toLocaleString("vi-VN")}₫ / khách</span>
                </div>
                {isSale && (
                  <div className="tour-booking-wizard__calc-row tour-booking-wizard__calc-row--sale">
                    <span className="tour-booking-wizard__calc-label">Tiết kiệm ưu đãi:</span>
                    <span className="tour-booking-wizard__calc-val font-semibold">
                      -{((listPrice - unitPrice) * guests).toLocaleString("vi-VN")}₫
                    </span>
                  </div>
                )}
                <div className="tour-booking-wizard__calc-divider" />
                <div className="tour-booking-wizard__calc-row tour-booking-wizard__calc-row--total">
                  <span className="tour-booking-wizard__calc-total-label">Tổng tạm tính ({guests} khách):</span>
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
                  {/* Đồng hồ giữ chỗ to rõ ràng ở trên cùng - Không bọc trong card, không icon */}
                  <div className="tour-checkout-countdown-banner">
                    <span className="tour-checkout-countdown-label">Thời gian giữ chỗ còn lại</span>
                    <div className={`tour-checkout-countdown-digits font-mono ${timeLeft <= 300 ? "tour-checkout-countdown-digits--urgent" : ""}`}>
                      {timeLeft > 0 ? formatTime(timeLeft) : "00:00"}
                    </div>
                  </div>

                  {/* Tóm tắt đơn hàng thanh toán - Thiết kế kiểu receipt liền mạch, không hộp xám */}
                  <div className="tour-checkout-receipt">
                    <div className="tour-checkout-receipt-info">
                      <span className="tour-checkout-receipt-eyebrow">MÃ ĐƠN HÀNG</span>
                      <div className="tour-checkout-receipt-code-row">
                        <strong className="tour-checkout-receipt-code font-mono">
                          {bookingResult?.code || `TX-#${bookingResult?.id}`}
                        </strong>
                        <button
                          type="button"
                          className="tour-checkout-copy-btn"
                          onClick={() => handleCopy(bookingResult?.code || `TX-#${bookingResult?.id}`, "code")}
                          title="Sao chép mã đơn"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {copiedField === "code" ? "check" : "content_copy"}
                          </span>
                        </button>
                      </div>
                      <span className="tour-checkout-receipt-tour-title">{tour?.name}</span>
                    </div>

                    <div className="tour-checkout-receipt-side">
                      <div className="tour-checkout-receipt-total-block">
                        <span className="tour-checkout-receipt-total-label">Số tiền cần thanh toán</span>
                        <span className="tour-checkout-receipt-total-value">
                          {(bookingResult?.total_price || totalPrice).toLocaleString("vi-VN")} ₫
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Nhóm chọn phương thức thanh toán - Single Unified Container chuẩn Stripe/Shopify, không dùng các box vuông rời rạc */}
                  <div className="tour-checkout-section">
                    <div className="tour-checkout-section-header">
                      <h4 className="tour-checkout-section-title">Phương thức thanh toán</h4>
                      <span className="tour-checkout-section-sub">Lựa chọn 1 cổng thanh toán bảo mật</span>
                    </div>

                    <div className="tour-checkout-group" role="radiogroup" aria-label="Phương thức thanh toán">
                      {/* Lựa chọn 1: Chuyển khoản VietQR (payOS) */}
                      <div
                        className={`tour-checkout-row ${paymentMethod === "payos" ? "tour-checkout-row--selected tour-checkout-row--payos" : ""}`}
                        onClick={() => setPaymentMethod("payos")}
                        role="radio"
                        aria-checked={paymentMethod === "payos"}
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPaymentMethod("payos")}
                      >
                        <div className="tour-checkout-row-main">
                          <div className="tour-checkout-row-left">
                            <div className={`tour-checkout-radio-circle ${paymentMethod === "payos" ? "tour-checkout-radio-circle--active-payos" : ""}`}>
                              {paymentMethod === "payos" && <div className="tour-checkout-radio-dot tour-checkout-radio-dot--payos" />}
                            </div>
                            <div className="tour-checkout-row-text">
                              <div className="tour-checkout-row-title-line">
                                <span className="tour-checkout-row-name">Chuyển khoản VietQR (Napas 24/7)</span>
                                <span className="tour-checkout-badge-pill tour-checkout-badge-pill--green">
                                  Tự động 24/7 • Miễn phí
                                </span>
                              </div>
                              <p className="tour-checkout-row-hint">
                                Quét mã QR bằng App mọi ngân hàng để thanh toán tức thì. Đơn tự động xác nhận sau 3 giây.
                              </p>
                            </div>
                          </div>
                          <div className="tour-checkout-row-right">
                            <VietQRBadge />
                          </div>
                        </div>

                        {paymentMethod === "payos" && (
                          <div className="tour-checkout-row-detail">
                            <span className="tour-checkout-bank-support-text">
                              <b>Hỗ trợ 40+ ngân hàng:</b> TPBank, Techcombank, MB Bank, Vietcombank, BIDV, VPBank, ACB...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Hairline Divider */}
                      <div className="tour-checkout-group-divider" />

                      {/* Lựa chọn 2: Thẻ quốc tế Stripe */}
                      <div
                        className={`tour-checkout-row ${paymentMethod === "stripe" ? "tour-checkout-row--selected tour-checkout-row--stripe" : ""}`}
                        onClick={() => setPaymentMethod("stripe")}
                        role="radio"
                        aria-checked={paymentMethod === "stripe"}
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setPaymentMethod("stripe")}
                      >
                        <div className="tour-checkout-row-main">
                          <div className="tour-checkout-row-left">
                            <div className={`tour-checkout-radio-circle ${paymentMethod === "stripe" ? "tour-checkout-radio-circle--active-stripe" : ""}`}>
                              {paymentMethod === "stripe" && <div className="tour-checkout-radio-dot tour-checkout-radio-dot--stripe" />}
                            </div>
                            <div className="tour-checkout-row-text">
                              <div className="tour-checkout-row-title-line">
                                <span className="tour-checkout-row-name">Thẻ quốc tế (Visa / Mastercard / JCB)</span>
                                <span className="tour-checkout-badge-pill tour-checkout-badge-pill--purple">
                                  Cổng quốc tế Stripe
                                </span>
                              </div>
                              <p className="tour-checkout-row-hint">
                                Xử lý bảo mật PCI-DSS cấp 1 qua Stripe. Chấp nhận thẻ tín dụng/ghi nợ quốc tế, Apple Pay & Google Pay.
                              </p>
                            </div>
                          </div>
                          <div className="tour-checkout-row-right tour-checkout-row-right--stripe">
                            <VisaBadge />
                            <MastercardBadge />
                            <JCBBadge />
                            <span className="tour-checkout-logo-divider" />
                            <StripeBrandBadge />
                          </div>
                        </div>

                        {paymentMethod === "stripe" && (
                          <div className="tour-checkout-row-detail">
                            <span className="tour-checkout-stripe-support-text">
                              Bảo mật tuyệt đối PCI-DSS Cấp 1 toàn cầu bởi Stripe.
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Hiển thị lỗi nếu có */}
                    {checkoutError && (
                      <div className="tour-checkout-error-alert">
                        <span>{checkoutError}</span>
                      </div>
                    )}

                    {/* Dòng bảo mật dạng text tinh tế, KHÔNG đóng hộp xám */}
                    <div className="tour-checkout-trust-line">
                      <span>Thanh toán bảo mật mã hóa SSL 256-bit • Đơn hàng được giữ chỗ an toàn trong thời gian thanh toán</span>
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
                onClick={handleGoToMyBookings}
              >
                <span className="material-symbols-outlined">receipt_long</span>
                <span>Xem đơn của tôi</span>
              </button>
              <button
                type="button"
                className={`tour-booking-wizard__btn-primary tour-checkout-pay-btn ${
                  paymentMethod === "payos"
                    ? "tour-checkout-pay-btn--payos"
                    : "tour-checkout-pay-btn--stripe"
                }`}
                onClick={paymentMethod === "payos" ? handlePayByPayos : handlePayByStripe}
                disabled={isCreatingPayos || isCreatingStripe || timeLeft <= 0}
              >
                {isCreatingPayos ? (
                  <>
                    <span className="tour-booking-wizard__spinner" />
                    <span>Đang kết nối VietQR payOS...</span>
                  </>
                ) : isCreatingStripe ? (
                  <>
                    <span className="tour-booking-wizard__spinner" />
                    <span>Đang kết nối Stripe...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">lock</span>
                    <span>
                      {paymentMethod === "payos"
                        ? `Thanh toán VietQR • ${(bookingResult?.total_price || totalPrice).toLocaleString("vi-VN")} ₫`
                        : `Thanh toán qua Stripe • ${(bookingResult?.total_price || totalPrice).toLocaleString("vi-VN")} ₫`}
                    </span>
                    <span className="material-symbols-outlined">arrow_forward</span>
                  </>
                )}
              </button>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}
