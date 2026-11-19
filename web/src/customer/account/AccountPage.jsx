import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api";
import AppNavbar from "../../shared/layout/AppNavbar";
import { getProvinceImage } from "../trips/trips/provinceImages";
import "./AccountPage.css";
import "../booking/TourBookingWizard.css";

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

// Dữ liệu mẫu trải nghiệm cho Guest mode
const DEMO_BOOKINGS = [
  {
    id: 101,
    booking_code: "BK-8902",
    tour_id: 1,
    tour_title: "Hành Trình Di Sản Miền Trung: Đà Nẵng – Bà Nà Hills – Phố Cổ Hội An",
    tour_slug: "tour-da-nang-hoi-an-ba-na",
    tour_cover_url: "/images/tour-danang.jpg",
    departure_date: "15/11/2026",
    depart_date: "2026-11-15",
    num_passengers: 2,
    guests: 2,
    total_price: 9780000,
    status: "pending",
    payment_status: "pending",
    hold_expires_at: new Date(Date.now() + 24 * 60 * 1000).toISOString(),
  },
  {
    id: 102,
    booking_code: "BK-8419",
    tour_id: 2,
    tour_title: "Du Thuyền 5 Sao Khám Phá Vịnh Hạ Long & Lan Hạ 3N2Đ",
    tour_slug: "tour-ha-long-lan-ha",
    tour_cover_url: "/images/tour-halong.jpg",
    departure_date: "02/10/2026",
    depart_date: "2026-10-02",
    num_passengers: 4,
    guests: 4,
    total_price: 18400000,
    status: "confirmed",
    payment_status: "paid",
  },
];

const DEMO_ITINERARIES = [
  {
    id: "sample-ha-long",
    name: "Khám Phá Vịnh Hạ Long & Lan Hạ Độc Bản",
    destination: "Quảng Ninh",
    duration_days: 3,
    stops_details: [{ name: "Cảng Tuần Châu" }, { name: "Hang Sáng Tối" }, { name: "Ba Trái Đào" }],
    description: "Hành trình nghỉ dưỡng trên du thuyền 5 sao, chèo kayak và ngắm hoàng hôn vịnh biển.",
    created_at: "2026-10-20",
  },
  {
    id: "sample-da-nang",
    name: "Đà Nẵng – Cầu Vàng – Hội An Thả Đèn Hoa Đăng",
    destination: "Đà Nẵng",
    duration_days: 4,
    stops_details: [{ name: "Bãi biển Mỹ Khê" }, { name: "Bà Nà Hills" }, { name: "Phố cổ Hội An" }],
    description: "Trải nghiệm văn hóa di sản, ẩm thực phố Hội và check-in Cầu Vàng hùng vĩ.",
    created_at: "2026-10-18",
  },
];

// Bộ đếm ngược thời gian giữ chỗ
function CountdownTimer({ holdExpiresAt, onExpired }) {
  const [seconds, setSeconds] = useState(() => {
    if (!holdExpiresAt) return 0;
    const diff = Math.floor((new Date(holdExpiresAt).getTime() - Date.now()) / 1000);
    return Math.max(0, diff);
  });

  useEffect(() => {
    if (seconds <= 0) {
      if (typeof onExpired === "function") onExpired();
      return;
    }
    const timer = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (typeof onExpired === "function") onExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds, onExpired]);

  if (seconds <= 0) {
    return <span className="voyage-acc-badge voyage-acc-badge--expired">Hết hạn giữ chỗ</span>;
  }

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span className={`voyage-acc-countdown ${seconds <= 300 ? "voyage-acc-countdown--urgent" : ""}`}>
      Giữ chỗ còn {m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
    </span>
  );
}

export default function AccountPage({ user, onLogout, onNeedAuth }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab: overview | profile | tours | itineraries
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    ["overview", "profile", "tours", "itineraries"].includes(tabParam) ? tabParam : "overview"
  );

  const [toastMessage, setToastMessage] = useState("");

  // Dữ liệu đặt tour
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [bookingFilter, setBookingFilter] = useState("all");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [payingBookingId, setPayingBookingId] = useState(null);
  const [modalPaymentMethod, setModalPaymentMethod] = useState("payos");
  const [checkingPaymentId, setCheckingPaymentId] = useState(null);

  const handleCheckPayment = async (bookingId) => {
    setCheckingPaymentId(bookingId);
    try {
      const res = await api.tourBookingStatus(bookingId);
      if (res.status === "PAID" || res.status === "CONFIRMED" || res.payment_status === "SUCCESS") {
        showToast("Thanh toán thành công! Đơn hàng đã được xác nhận.");
      } else {
        showToast(res.message || "Đơn hàng vẫn đang chờ thanh toán.");
      }
      await fetchBookings();
    } catch (err) {
      showToast("Không thể kiểm tra trạng thái: " + (err.message || "Lỗi kết nối"));
    } finally {
      setCheckingPaymentId(null);
    }
  };

  // Dữ liệu lịch trình
  const [itineraries, setItineraries] = useState([]);
  const [loadingItineraries, setLoadingItineraries] = useState(false);
  const [deletingItinerary, setDeletingItinerary] = useState(null);
  const [submittingDeleteItinerary, setSubmittingDeleteItinerary] = useState(false);

  // Form Thông tin cá nhân
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [city, setCity] = useState(user?.city || "Hà Nội, Việt Nam");
  const [savingProfile, setSavingProfile] = useState(false);

  // Form Đổi mật khẩu
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Modal xác nhận đăng xuất
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Xác định người dùng hoạt động (user thực hoặc demo guest)
  const isGuest = !user;
  const activeUser = useMemo(() => {
    if (user) return user;
    return {
      full_name: "Quý Khách",
      email: "khach.trainghiem@auravoyage.vn",
      phone: "0912 345 678",
      city: "Hà Nội, Việt Nam",
    };
  }, [user]);

  // Tên hiển thị chào mừng
  const greetingName = useMemo(() => {
    if (!activeUser?.full_name) return "Quý Khách";
    const parts = activeUser.full_name.trim().split(" ");
    return parts[parts.length - 1] || parts[0];
  }, [activeUser]);

  // % Hoàn thiện hồ sơ
  const profileCompletionPercent = useMemo(() => {
    let score = 0;
    if (activeUser?.email) score += 25;
    if (activeUser?.full_name) score += 25;
    if (activeUser?.phone || phone) score += 25;
    if (activeUser?.city || city) score += 25;
    return score;
  }, [activeUser, phone, city]);

  // Chuyển tab
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Tải danh sách đơn đặt tour
  const fetchBookings = useCallback(async () => {
    if (!user) {
      setBookings(DEMO_BOOKINGS);
      setLoadingBookings(false);
      return;
    }
    setLoadingBookings(true);
    try {
      const res = await api.myTourBookings(100);
      const list = Array.isArray(res) ? res : res.bookings || [];
      setBookings(list);
    } catch (err) {
      console.error("Lỗi tải đơn tour:", err);
      setBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  }, [user]);

  // Tải danh sách lịch trình
  const fetchItineraries = useCallback(async () => {
    if (!user) {
      setItineraries(DEMO_ITINERARIES);
      setLoadingItineraries(false);
      return;
    }
    setLoadingItineraries(true);
    try {
      const res = await api.itineraries();
      const list = Array.isArray(res) ? res : res.itineraries || [];
      setItineraries(list);
    } catch (err) {
      console.error("Lỗi tải lịch trình:", err);
      setItineraries([]);
    } finally {
      setLoadingItineraries(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBookings();
    fetchItineraries();
    if (user) {
      setFullName(user.full_name || "");
      setPhone(user.phone || "");
    }
  }, [user, fetchBookings, fetchItineraries]);

  // Kiểm tra callback thanh toán Stripe hoặc payOS từ URL
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    const bid = searchParams.get("booking_id");
    if (checkout === "success") {
      showToast("Đang kiểm tra kết quả thanh toán...");
      if (bid) {
        api.tourBookingStatus(bid)
          .then(() => fetchBookings())
          .catch(() => fetchBookings());
      } else {
        fetchBookings();
      }
    } else if (checkout === "cancelled") {
      showToast("Giao dịch thanh toán đã bị hủy.");
    }
  }, [searchParams, fetchBookings]);

  // Lọc tour theo trạng thái
  const filteredBookings = useMemo(() => {
    if (bookingFilter === "all") return bookings;
    if (bookingFilter === "pending") {
      return bookings.filter((b) => {
        const isExpired = b.is_hold_expired || b.status === "EXPIRED" || b.status === "expired";
        const isCancelled = b.status?.startsWith("CANCEL") || b.status === "cancelled";
        const isPaid =
          b.payment_status === "paid" ||
          b.payment_status === "SUCCESS" ||
          b.status === "confirmed" ||
          b.status === "PAID" ||
          b.status === "paid";
        return !isExpired && !isCancelled && !isPaid;
      });
    }
    if (bookingFilter === "paid") {
      return bookings.filter(
        (b) =>
          b.payment_status === "paid" ||
          b.payment_status === "SUCCESS" ||
          b.status === "confirmed" ||
          b.status === "PAID" ||
          b.status === "paid"
      );
    }
    if (bookingFilter === "cancelled") {
      return bookings.filter(
        (b) =>
          b.status === "cancelled" ||
          b.status === "expired" ||
          b.status === "EXPIRED" ||
          b.is_hold_expired ||
          b.status?.startsWith("CANCEL")
      );
    }
    return bookings;
  }, [bookings, bookingFilter]);

  // Xử lý hủy đơn tour
  const handleConfirmCancelBooking = async () => {
    if (!cancellingBooking) return;
    if (isGuest) {
      setBookings((cu) =>
        cu.map((b) => (b.id === cancellingBooking.id ? { ...b, status: "cancelled" } : b))
      );
      showToast("Đã hủy đơn đặt tour thành công.");
      setCancellingBooking(null);
      setCancelReason("");
      return;
    }
    setSubmittingCancel(true);
    try {
      await api.cancelMyTourBooking(cancellingBooking.id, cancelReason);
      showToast("Đã hủy đơn đặt tour thành công.");
      setCancellingBooking(null);
      setCancelReason("");
      fetchBookings();
    } catch (err) {
      showToast(err.message || "Không thể hủy đơn đặt tour.");
    } finally {
      setSubmittingCancel(false);
    }
  };

  // Thanh toán VietQR qua payOS
  const handlePayPayos = async (bookingId) => {
    if (isGuest) {
      onNeedAuth?.();
      return;
    }
    setPayingBookingId(bookingId);
    try {
      const res = await api.checkoutPayosBooking(
        bookingId,
        window.location.origin + "/tai-khoan?tab=tours"
      );
      if (res?.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        showToast("Không tạo được liên kết thanh toán payOS.");
      }
    } catch (err) {
      showToast(err.message || "Lỗi khởi tạo thanh toán payOS.");
    } finally {
      setPayingBookingId(null);
    }
  };

  // Thanh toán thẻ quốc tế qua Stripe
  const handlePayStripe = async (bookingId) => {
    if (isGuest) {
      onNeedAuth?.();
      return;
    }
    setPayingBookingId(bookingId);
    try {
      const res = await api.checkoutTourBooking(
        bookingId,
        window.location.origin + "/tai-khoan?tab=tours"
      );
      if (res.checkout_url) {
        window.location.href = res.checkout_url;
      } else {
        showToast("Không tạo được cổng thanh toán Stripe.");
      }
    } catch (err) {
      showToast(err.message || "Lỗi khởi tạo thanh toán Stripe.");
    } finally {
      setPayingBookingId(null);
    }
  };

  // Xóa lịch trình
  const handleConfirmDeleteItinerary = async () => {
    if (!deletingItinerary) return;
    if (isGuest) {
      setItineraries((cu) => cu.filter((it) => it.id !== deletingItinerary.id));
      showToast("Đã xóa lịch trình thành công.");
      setDeletingItinerary(null);
      return;
    }
    setSubmittingDeleteItinerary(true);
    try {
      await api.deleteItinerary(deletingItinerary.id);
      showToast("Đã xóa lịch trình thành công.");
      setDeletingItinerary(null);
      fetchItineraries();
    } catch (err) {
      showToast(err.message || "Không thể xóa lịch trình.");
    } finally {
      setSubmittingDeleteItinerary(false);
    }
  };

  // Cập nhật thông tin cá nhân
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (isGuest) {
      onNeedAuth?.();
      return;
    }
    if (!fullName.trim()) {
      showToast("Vui lòng nhập họ và tên.");
      return;
    }
    setSavingProfile(true);
    setTimeout(() => {
      const updatedUser = { ...user, full_name: fullName.trim(), phone: phone.trim(), city };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      showToast("Cập nhật thông tin tài khoản thành công!");
      setSavingProfile(false);
    }, 400);
  };

  // Đổi mật khẩu
  const handleChangePassword = (e) => {
    e.preventDefault();
    if (isGuest) {
      onNeedAuth?.();
      return;
    }
    setPasswordError("");
    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Xác nhận mật khẩu mới không khớp.");
      return;
    }
    setSavingPassword(true);
    setTimeout(() => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Đổi mật khẩu thành công!");
      setSavingPassword(false);
    }, 450);
  };

  return (
    <div className={`sky-page voyage-acc-screen ${activeTab === "overview" ? "voyage-acc-screen--overview" : ""}`}>
      {/* 1. TOP NAVBAR TOÀN CỤC */}
      <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />

      {/* TOAST THÔNG BÁO */}
      {toastMessage && (
        <div className="voyage-acc-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}

      {/* BANNER THÔNG BÁO NẾU ĐANG Ở CHẾ ĐỘ GUEST */}
      {isGuest && (
        <div className="voyage-acc-guest-strip">
          <div className="voyage-acc-container voyage-acc-guest-strip-inner">
            <span>
              Bạn đang xem giao diện ở chế độ Trải Nghiệm Khách. Đăng nhập để đồng bộ các đơn tour và lịch trình thực tế.
            </span>
            <button
              type="button"
              className="voyage-acc-guest-btn-login"
              onClick={onNeedAuth}
            >
              Đăng nhập ngay →
            </button>
          </div>
        </div>
      )}

      {/* 2. BỐ CỤC 2 CỘT CHUẨN MINIMALIST EDITORIAL */}
      <main className="voyage-acc-main">
        <div className="voyage-acc-container">
          <div className="voyage-acc-layout">
            {/* CỘT TRÁI: SIDEBAR ĐIỀU HƯỚNG TỐI GIẢN */}
            <aside className="voyage-acc-sidebar">
              <h3 className="voyage-acc-sidebar-heading">Menu Tài Khoản</h3>
              <nav className="voyage-acc-sidebar-nav" aria-label="Account Submenu">
                <button
                  type="button"
                  className={`voyage-acc-sidebar-link ${activeTab === "overview" ? "is-active" : ""}`}
                  onClick={() => handleTabChange("overview")}
                >
                  Tổng quan
                </button>
                <button
                  type="button"
                  className={`voyage-acc-sidebar-link ${activeTab === "profile" ? "is-active" : ""}`}
                  onClick={() => handleTabChange("profile")}
                >
                  Hồ sơ cá nhân
                </button>
                <button
                  type="button"
                  className={`voyage-acc-sidebar-link ${activeTab === "tours" ? "is-active" : ""}`}
                  onClick={() => handleTabChange("tours")}
                >
                  Tour của tôi ({bookings.length})
                </button>
                <button
                  type="button"
                  className={`voyage-acc-sidebar-link ${activeTab === "itineraries" ? "is-active" : ""}`}
                  onClick={() => handleTabChange("itineraries")}
                >
                  Lịch trình đã lưu ({itineraries.length})
                </button>
                <button
                  type="button"
                  className="voyage-acc-sidebar-link voyage-acc-sidebar-link--logout"
                  onClick={() => {
                    if (isGuest) {
                      onNeedAuth?.();
                    } else {
                      setShowLogoutConfirm(true);
                    }
                  }}
                >
                  {isGuest ? "Đăng nhập tài khoản" : "Đăng xuất"}
                </button>
              </nav>
            </aside>

            {/* CỘT PHẢI: CANVAS NỘI DUNG CHÍNH */}
            <div className="voyage-acc-content">
              {/* Header: Xin chào [Tên] & Đăng nhập với: [email] */}
              <div className="voyage-acc-welcome-row">
                <h1 className="voyage-acc-welcome-title">
                  Xin chào {greetingName}
                </h1>
                <div className="voyage-acc-signed-in">
                  Đăng nhập với: <strong className="voyage-acc-signed-email">{activeUser.email}</strong>
                </div>
              </div>

              <div className="voyage-acc-divider" />

              {/* =======================================================
                  TAB 0: TỔNG QUAN (OVERVIEW - 100VH VIEWPORT LOCK)
                  ======================================================= */}
              {activeTab === "overview" && (
                <div className="voyage-acc-overview-pane">
                  {/* Hàng 3 chỉ số KPI phẳng, số lớn ấn tượng */}
                  <div className="voyage-acc-stats-row">
                    <div className="voyage-acc-stat-card" onClick={() => handleTabChange("profile")}>
                      <span className="voyage-acc-stat-title">Hồ sơ cá nhân</span>
                      <div className="voyage-acc-stat-value-group">
                        <span className="voyage-acc-stat-num">{profileCompletionPercent}%</span>
                        <span className="voyage-acc-stat-unit">Hoàn thiện</span>
                      </div>
                    </div>

                    <div className="voyage-acc-stat-card" onClick={() => handleTabChange("tours")}>
                      <span className="voyage-acc-stat-title">Tour của tôi</span>
                      <div className="voyage-acc-stat-value-group">
                        <span className="voyage-acc-stat-num">{bookings.length}</span>
                        <span className="voyage-acc-stat-unit">Đã đặt</span>
                      </div>
                    </div>

                    <div className="voyage-acc-stat-card" onClick={() => handleTabChange("itineraries")}>
                      <span className="voyage-acc-stat-title">Lịch trình</span>
                      <div className="voyage-acc-stat-value-group">
                        <span className="voyage-acc-stat-num">{itineraries.length}</span>
                        <span className="voyage-acc-stat-unit">Đã lưu</span>
                      </div>
                    </div>
                  </div>

                  {/* Banner hành động khẩn cấp nếu có đơn chờ thanh toán */}
                  {bookings.some(
                    (b) =>
                      (b.payment_status === "pending" || b.status === "pending") &&
                      b.status !== "cancelled" &&
                      b.status !== "expired"
                  ) && (
                    <div className="voyage-acc-pending-banner">
                      <div className="voyage-acc-pending-banner-text">
                        <strong>Đơn tour đang trong thời gian giữ chỗ</strong>
                        <p>
                          Vui lòng hoàn tất thanh toán trước khi hết hạn giữ chỗ để đảm bảo quyền lợi vé khởi hành.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="voyage-acc-cta-action"
                        onClick={() => {
                          const firstPending = bookings.find(
                            (b) =>
                              (b.payment_status === "pending" || b.status === "pending") &&
                              b.status !== "cancelled"
                          );
                          if (firstPending) setSelectedBooking(firstPending);
                        }}
                      >
                        Thanh toán giữ chỗ ngay →
                      </button>
                    </div>
                  )}

                  {/* Danh sách đơn đặt gần nhất (Flat list phẳng 1px border-bottom) */}
                  <section className="voyage-acc-overview-section">
                    <div className="voyage-acc-overview-section-header">
                      <h2 className="voyage-acc-section-subtitle">Đơn đặt tour gần đây</h2>
                      {bookings.length > 0 && (
                        <button
                          type="button"
                          className="voyage-acc-text-link"
                          onClick={() => handleTabChange("tours")}
                        >
                          Xem tất cả ({bookings.length}) →
                        </button>
                      )}
                    </div>

                    {bookings.length === 0 ? (
                      <p className="voyage-acc-no-recent">Chưa có đơn tour nào gần đây.</p>
                    ) : (
                      <div className="voyage-acc-recent-orders-list">
                        {bookings.slice(0, 2).map((b) => {
                          const isPending =
                            (b.payment_status === "pending" ||
                              b.payment_status === "PENDING" ||
                              b.status === "pending" ||
                              b.status === "PENDING_PAYMENT") &&
                            b.status !== "cancelled" &&
                            !b.status?.startsWith("CANCEL") &&
                            b.status !== "expired" &&
                            b.status !== "EXPIRED" &&
                            !b.is_hold_expired;
                          const isPaid =
                            b.payment_status === "paid" ||
                            b.payment_status === "SUCCESS" ||
                            b.status === "confirmed" ||
                            b.status === "PAID" ||
                            b.status === "paid";
                          const bookingCode = b.booking_code || b.code || `#BK-${b.id}`;

                          return (
                            <div key={b.id} className="voyage-acc-recent-order-item">
                              <div className="voyage-acc-recent-order-info">
                                <span className="voyage-acc-recent-code">{bookingCode}</span>
                                <h4 className="voyage-acc-recent-title">
                                  {b.tour_title || b.tour_name || `Tour #${b.tour_id}`}
                                </h4>
                                <div className="voyage-acc-recent-meta">
                                  <span>
                                    Khởi hành:{" "}
                                    {b.depart_date
                                      ? new Date(b.depart_date).toLocaleDateString("vi-VN")
                                      : b.departure_date || "Đang cập nhật"}
                                  </span>
                                  <span>•</span>
                                  <span>{b.num_passengers || b.guests || 1} khách</span>
                                  <span>•</span>
                                  <strong className="text-zinc-900">
                                    {Number(b.total_price || 0).toLocaleString("vi-VN")} ₫
                                  </strong>
                                </div>
                              </div>

                              <div className="voyage-acc-recent-order-right">
                                {isPending ? (
                                  <button
                                    type="button"
                                    className="voyage-acc-cta-action"
                                    onClick={() => setSelectedBooking(b)}
                                  >
                                    Thanh toán ngay →
                                  </button>
                                ) : (
                                  <span
                                    className={`voyage-acc-badge ${
                                      isPaid ? "voyage-acc-badge--success" : "voyage-acc-badge--danger"
                                    }`}
                                  >
                                    {isPaid ? "Đã xác nhận" : "Đã hủy"}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="voyage-acc-btn-sm"
                                  onClick={() => setSelectedBooking(b)}
                                >
                                  Chi tiết
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  {/* Footer thông tin trợ giúp ngắn gọn ở đáy */}
                  <div className="voyage-acc-help-footer">
                    <div className="voyage-acc-help-text">
                      <h4 className="voyage-acc-help-title">Bạn cần hỗ trợ thêm?</h4>
                      <p className="voyage-acc-help-desc">
                        Tổng đài chăm sóc khách hàng Aura Voyage 24/7 luôn sẵn sàng hỗ trợ lịch trình và thanh toán.
                      </p>
                    </div>
                    <a
                      href="#support"
                      className="voyage-acc-help-link"
                      onClick={(e) => {
                        e.preventDefault();
                        showToast("Hotline CSKH: 1900 6868 · Email: support@auravoyage.vn");
                      }}
                    >
                      Trung tâm hỗ trợ ↗
                    </a>
                  </div>
                </div>
              )}

              {/* =======================================================
                  TAB 1: THÔNG TIN CÁ NHÂN & BẢO MẬT (PROFILE)
                  ======================================================= */}
              {activeTab === "profile" && (
                <section className="voyage-acc-section" aria-label="Account profile">
                  <div className="voyage-acc-grid-2col">
                    {/* Cột 1: Thông tin cá nhân */}
                    <div className="voyage-acc-form-panel">
                      <h3 className="voyage-acc-panel-title">Thông tin tài khoản</h3>
                      <p className="voyage-acc-panel-desc">
                        Thông tin hiển thị khi đặt chỗ và liên hệ hỗ trợ đoàn khởi hành.
                      </p>

                      <form onSubmit={handleSaveProfile} className="voyage-acc-form">
                        <div className="voyage-acc-field">
                          <label htmlFor="prof-name">Họ và tên</label>
                          <input
                            id="prof-name"
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Ví dụ: Nguyễn Văn A"
                            required
                          />
                        </div>

                        <div className="voyage-acc-field">
                          <label htmlFor="prof-email">Email đăng nhập</label>
                          <input
                            id="prof-email"
                            type="email"
                            value={activeUser.email || ""}
                            disabled
                            className="voyage-acc-input-disabled"
                          />
                          <span className="voyage-acc-field-hint">
                            Email là định danh tài khoản và không thể tự thay đổi.
                          </span>
                        </div>

                        <div className="voyage-acc-field">
                          <label htmlFor="prof-phone">Số điện thoại liên hệ</label>
                          <input
                            id="prof-phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Ví dụ: 0912 345 678"
                          />
                        </div>

                        <div className="voyage-acc-field">
                          <label htmlFor="prof-city">Tỉnh / Thành phố sinh sống</label>
                          <input
                            id="prof-city"
                            type="text"
                            value={city}
                            onChange={(e) => setCity(e.target.value)}
                            placeholder="Ví dụ: Hà Nội, TP. Hồ Chí Minh..."
                          />
                        </div>

                        <button
                          type="submit"
                          className="voyage-acc-btn-primary"
                          disabled={savingProfile}
                        >
                          {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                        </button>
                      </form>
                    </div>

                    {/* Cột 2: Đổi mật khẩu & Tùy chọn */}
                    <div className="voyage-acc-form-panel">
                      <h3 className="voyage-acc-panel-title">Bảo mật & Mật khẩu</h3>
                      <p className="voyage-acc-panel-desc">
                        Đảm bảo an toàn tài khoản với mật khẩu tối thiểu 6 ký tự.
                      </p>

                      {passwordError && (
                        <div className="voyage-acc-alert voyage-acc-alert--error">
                          <span>{passwordError}</span>
                        </div>
                      )}

                      <form onSubmit={handleChangePassword} className="voyage-acc-form">
                        <div className="voyage-acc-field">
                          <label htmlFor="pwd-current">Mật khẩu hiện tại</label>
                          <input
                            id="pwd-current"
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Nhập mật khẩu hiện tại"
                            required
                          />
                        </div>

                        <div className="voyage-acc-field">
                          <label htmlFor="pwd-new">Mật khẩu mới</label>
                          <input
                            id="pwd-new"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Ít nhất 6 ký tự"
                            required
                          />
                        </div>

                        <div className="voyage-acc-field">
                          <label htmlFor="pwd-confirm">Xác nhận mật khẩu mới</label>
                          <input
                            id="pwd-confirm"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Nhập lại mật khẩu mới"
                            required
                          />
                        </div>

                        <button
                          type="submit"
                          className="voyage-acc-btn-outline"
                          disabled={savingPassword}
                        >
                          {savingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                        </button>
                      </form>

                      <div className="voyage-acc-divider-line" />

                      {/* Tùy chọn hệ thống */}
                      <div className="voyage-acc-preferences">
                        <h4 className="voyage-acc-pref-title">Tùy chọn hiển thị</h4>
                        <div className="voyage-acc-pref-item">
                          <div>
                            <strong>Ngôn ngữ</strong>
                            <p>Tiếng Việt (Mặc định)</p>
                          </div>
                          <span className="voyage-acc-badge voyage-acc-badge--neutral">Tiếng Việt</span>
                        </div>
                        <div className="voyage-acc-pref-item">
                          <div>
                            <strong>Đơn vị tiền tệ</strong>
                            <p>Việt Nam Đồng (VNĐ - ₫)</p>
                          </div>
                          <span className="voyage-acc-badge voyage-acc-badge--neutral">VNĐ</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {/* =======================================================
                  TAB 2: TOUR CỦA TÔI (TOURS)
                  ======================================================= */}
              {activeTab === "tours" && (
                <section className="voyage-acc-section" aria-label="Booked tours">
                  <div className="voyage-acc-section-header">
                    <div>
                      <h2 className="voyage-acc-section-title">Quản lý tour của tôi</h2>
                      <p className="voyage-acc-section-desc">
                        Theo dõi trạng thái đơn đặt tour, thời gian giữ chỗ vé và thông tin đoàn khởi hành.
                      </p>
                    </div>

                    {/* Bộ lọc trạng thái */}
                    <div className="voyage-acc-filter-group">
                      {[
                        { key: "all", label: "Tất cả" },
                        { key: "pending", label: "Chờ thanh toán" },
                        { key: "paid", label: "Đã xác nhận" },
                        { key: "cancelled", label: "Đã hủy" },
                      ].map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          className={`voyage-acc-filter-btn ${
                            bookingFilter === f.key ? "voyage-acc-filter-btn--active" : ""
                          }`}
                          onClick={() => setBookingFilter(f.key)}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingBookings ? (
                    <div className="voyage-acc-empty">
                      <div className="voyage-acc-spinner" />
                      <p>Đang tải danh sách đơn đặt tour của bạn...</p>
                    </div>
                  ) : filteredBookings.length === 0 ? (
                    <div className="voyage-acc-empty">
                      <h3>Không tìm thấy đơn đặt tour nào</h3>
                      <p>
                        {bookingFilter === "all"
                          ? "Bạn chưa có đơn đặt tour nào. Khám phá các hành trình trọn gói được thiết kế riêng bởi Aura Voyage."
                          : "Không có đơn tour nào ở trạng thái lọc này."}
                      </p>
                      <Link to="/tour" className="voyage-acc-btn-primary" style={{ marginTop: "14px" }}>
                        Khám phá tour du lịch →
                      </Link>
                    </div>
                  ) : (
                    <div className="voyage-acc-cards-list">
                      {filteredBookings.map((b) => {
                        const isPending =
                          (b.payment_status === "pending" || b.status === "pending" || b.status === "PENDING_PAYMENT") &&
                          !b.is_hold_expired &&
                          b.status !== "EXPIRED" &&
                          !b.status?.startsWith("CANCEL");
                        const isPaid =
                          b.payment_status === "paid" ||
                          b.payment_status === "SUCCESS" ||
                          b.status === "confirmed" ||
                          b.status === "PAID" ||
                          b.status === "paid";

                        const bookingCode = b.code || b.booking_code || `#BK-${b.id}`;
                        const tourTitle = b.tour_name || b.tour_title || `Tour #${b.tour_id}`;
                        const tourCover = b.tour_cover_url || b.tour_cover_image || "/images/tour-danang.jpg";
                        const tourDepart = b.depart_date
                          ? new Date(b.depart_date).toLocaleDateString("vi-VN")
                          : b.departure_date || "Đang cập nhật";
                        const tourGuests = b.guests || b.num_passengers || 1;

                        return (
                          <article key={b.id} className="voyage-acc-booking-card">
                            <div className="voyage-acc-booking-cover">
                              <img src={tourCover} alt={tourTitle} />
                            </div>

                            <div className="voyage-acc-booking-info">
                              <div className="voyage-acc-booking-top-row">
                                <span className="voyage-acc-booking-code">{bookingCode}</span>
                                {isPending && b.hold_expires_at && (
                                  <CountdownTimer
                                    holdExpiresAt={b.hold_expires_at}
                                    onExpired={() => fetchBookings()}
                                  />
                                )}
                                {isPending ? (
                                  <button
                                    type="button"
                                    className="voyage-acc-cta-action"
                                    onClick={() => setSelectedBooking(b)}
                                  >
                                    Thanh toán ngay →
                                  </button>
                                ) : (
                                  <span
                                    className={`voyage-acc-badge ${
                                      isPaid ? "voyage-acc-badge--success" : "voyage-acc-badge--danger"
                                    }`}
                                  >
                                    {isPaid ? "Đã xác nhận & Thanh toán" : "Đã hủy / Hết hạn"}
                                  </span>
                                )}
                              </div>

                              <h3 className="voyage-acc-booking-title">
                                <Link to={b.tour_slug ? `/tour/${b.tour_slug}` : "/tour"}>
                                  {tourTitle}
                                </Link>
                              </h3>

                              <div className="voyage-acc-booking-meta">
                                <span>Khởi hành: <strong>{tourDepart}</strong></span>
                                <span>•</span>
                                <span>Hành khách: <strong>{tourGuests} người</strong></span>
                                <span>•</span>
                                <span>Tổng tiền: <strong className="text-zinc-900">{Number(b.total_price || 0).toLocaleString("vi-VN")} ₫</strong></span>
                              </div>

                              <div className="voyage-acc-booking-actions">
                                <button
                                  type="button"
                                  className="voyage-acc-btn-outline-sm"
                                  onClick={() => setSelectedBooking(b)}
                                >
                                  Chi tiết đơn
                                </button>

                                {isPending && (
                                  <>
                                    <button
                                      type="button"
                                      className="voyage-acc-cta-action voyage-acc-cta-action--payos"
                                      onClick={() => handlePayPayos(b.id)}
                                      disabled={payingBookingId === b.id}
                                    >
                                      {payingBookingId === b.id ? "Đang chuyển..." : "VietQR payOS →"}
                                    </button>
                                    <button
                                      type="button"
                                      className="voyage-acc-cta-action voyage-acc-cta-action--stripe"
                                      onClick={() => handlePayStripe(b.id)}
                                      disabled={payingBookingId === b.id}
                                    >
                                      Stripe (Thẻ) →
                                    </button>
                                    <button
                                      type="button"
                                      className="voyage-acc-btn-outline-sm"
                                      onClick={() => handleCheckPayment(b.id)}
                                      disabled={checkingPaymentId === b.id}
                                      title="Kiểm tra trạng thái đối soát từ ngân hàng / payOS"
                                    >
                                      {checkingPaymentId === b.id ? "Đang kiểm tra..." : "Kiểm tra thanh toán ⟳"}
                                    </button>
                                    <button
                                      type="button"
                                      className="voyage-acc-btn-text-danger"
                                      onClick={() => setCancellingBooking(b)}
                                    >
                                      Hủy giữ chỗ
                                    </button>
                                  </>
                                )}

                                {b.tour_slug && (
                                  <Link
                                    to={`/tour/${b.tour_slug}`}
                                    className="voyage-acc-btn-link"
                                  >
                                    Xem tour gốc ↗
                                  </Link>
                                )}
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {/* =======================================================
                  TAB 3: LỊCH TRÌNH ĐÃ LƯU (ITINERARIES)
                  ======================================================= */}
              {activeTab === "itineraries" && (
                <section className="voyage-acc-section" aria-label="Saved itineraries">
                  <div className="voyage-acc-section-header">
                    <div>
                      <h2 className="voyage-acc-section-title">Lịch trình đã lưu</h2>
                      <p className="voyage-acc-section-desc">
                        Các kế hoạch du lịch và hành trình trải nghiệm được lưu trữ hoặc tối ưu cùng Trợ lý AI.
                      </p>
                    </div>

                    <Link to="/trips" className="voyage-acc-btn-primary">
                      + Lên lịch trình mới với AI
                    </Link>
                  </div>

                  {loadingItineraries ? (
                    <div className="voyage-acc-empty">
                      <div className="voyage-acc-spinner" />
                      <p>Đang tải danh sách lịch trình của bạn...</p>
                    </div>
                  ) : itineraries.length === 0 ? (
                    <div className="voyage-acc-empty">
                      <h3>Chưa có lịch trình nào được lưu</h3>
                      <p>
                        Hãy để Trợ lý AI Aura Voyage tạo lộ trình di chuyển tối ưu và gợi ý các điểm đến hấp dẫn cho bạn.
                      </p>
                      <Link to="/trips" className="voyage-acc-btn-primary" style={{ marginTop: "14px" }}>
                        Bắt đầu lên lịch trình →
                      </Link>
                    </div>
                  ) : (
                    <div className="voyage-acc-itinerary-grid">
                      {itineraries.map((it) => {
                        const diemDen = it.destination || "Việt Nam";
                        const imageUrl = getProvinceImage(diemDen, it.name);
                        const stopCount = (it.stops || []).length || (it.stops_details || []).length || 0;
                        const days = it.duration_days || 1;

                        return (
                          <article key={it.id} className="voyage-acc-itinerary-card">
                            <div className="voyage-acc-itinerary-thumb">
                              <img src={imageUrl} alt={it.name} />
                              <span className="voyage-acc-badge voyage-acc-badge--neutral">
                                {days} Ngày {days > 1 ? `${days - 1} Đêm` : ""}
                              </span>
                            </div>

                            <div className="voyage-acc-itinerary-body">
                              <span className="voyage-acc-itinerary-dest">📍 {diemDen}</span>
                              <h3 className="voyage-acc-itinerary-title">
                                <Link to={`/trips/${it.id}`}>
                                  {it.name || "Lịch trình khám phá Việt Nam"}
                                </Link>
                              </h3>

                              <p className="voyage-acc-itinerary-desc">
                                {it.description || "Hành trình trải nghiệm cá nhân hóa kết hợp các danh lam và ẩm thực đặc sắc."}
                              </p>

                              {/* Điểm dừng chân xem trước */}
                              {Array.isArray(it.stops_details) && it.stops_details.length > 0 && (
                                <div className="voyage-acc-stops-preview">
                                  {it.stops_details.slice(0, 3).map((st, sIdx) => (
                                    <span key={sIdx} className="voyage-acc-stop-pill">
                                      {st.name || `Điểm #${sIdx + 1}`}
                                    </span>
                                  ))}
                                  {it.stops_details.length > 3 && (
                                    <span className="voyage-acc-stop-pill voyage-acc-stop-pill--more">
                                      +{it.stops_details.length - 3} điểm nữa
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="voyage-acc-itinerary-foot">
                                <span className="voyage-acc-meta-item">
                                  <strong>{stopCount}</strong> điểm dừng chân
                                </span>
                                <div className="voyage-acc-itinerary-actions">
                                  <Link
                                    to={`/trips/${it.id}`}
                                    className="voyage-acc-btn-action"
                                  >
                                    Mở lịch trình →
                                  </Link>
                                  <button
                                    type="button"
                                    className="voyage-acc-icon-danger-btn"
                                    onClick={() => setDeletingItinerary(it)}
                                    title="Xóa lịch trình này"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* =======================================================
          MODAL CHI TIẾT & HƯỚNG DẪN THANH TOÁN (VIETQR / STRIPE)
          ======================================================= */}
      {selectedBooking && (
        <div className="voyage-acc-modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="voyage-acc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="voyage-acc-modal-header">
              <h3>
                Chi tiết đơn đặt tour{" "}
                {selectedBooking.code || selectedBooking.booking_code || `#BK-${selectedBooking.id}`}
              </h3>
              <button
                type="button"
                className="voyage-acc-modal-close"
                onClick={() => setSelectedBooking(null)}
              >
                ✕
              </button>
            </div>

            <div className="voyage-acc-modal-body">
              <div className="voyage-acc-modal-tour-title">
                {selectedBooking.tour_name || selectedBooking.tour_title || `Tour #${selectedBooking.tour_id}`}
              </div>

              <div className="voyage-acc-modal-details-grid">
                <div>
                  <span className="voyage-acc-modal-label">Mã tra cứu:</span>
                  <strong className="font-mono text-sky-700">
                    {selectedBooking.code || selectedBooking.booking_code || `#BK-${selectedBooking.id}`}
                  </strong>
                </div>
                <div>
                  <span className="voyage-acc-modal-label">Ngày khởi hành:</span>
                  <strong>
                    {selectedBooking.depart_date
                      ? new Date(selectedBooking.depart_date).toLocaleDateString("vi-VN")
                      : selectedBooking.departure_date || "Theo thỏa thuận"}
                  </strong>
                </div>
                <div>
                  <span className="voyage-acc-modal-label">Số khách:</span>
                  <strong>{selectedBooking.guests || selectedBooking.num_passengers || 1} người</strong>
                </div>
                <div>
                  <span className="voyage-acc-modal-label">Tổng thanh toán:</span>
                  <strong className="voyage-acc-price-highlight">
                    {Number(selectedBooking.total_price || 0).toLocaleString("vi-VN")} ₫
                  </strong>
                </div>
                <div>
                  <span className="voyage-acc-modal-label">Trạng thái:</span>
                  <strong>
                    {selectedBooking.payment_status === "paid" ||
                    selectedBooking.payment_status === "SUCCESS" ||
                    selectedBooking.status === "confirmed" ||
                    selectedBooking.status === "PAID"
                      ? "Đã thanh toán"
                      : selectedBooking.status === "cancelled" ||
                        selectedBooking.status?.startsWith("CANCEL") ||
                        selectedBooking.status === "EXPIRED" ||
                        selectedBooking.is_hold_expired
                      ? "Đã hủy / Hết hạn"
                      : "Chờ thanh toán"}
                  </strong>
                </div>
              </div>

              {/* Hướng dẫn thanh toán đa phương thức nếu chưa thanh toán */}
              {(() => {
                const isPaidStatus =
                  selectedBooking.payment_status === "paid" ||
                  selectedBooking.payment_status === "SUCCESS" ||
                  selectedBooking.status === "confirmed" ||
                  selectedBooking.status === "PAID";
                const isCancelledStatus =
                  selectedBooking.status === "cancelled" ||
                  selectedBooking.status?.startsWith("CANCEL") ||
                  selectedBooking.status === "EXPIRED" ||
                  selectedBooking.is_hold_expired;
                return !isPaidStatus && !isCancelledStatus;
              })() && (
                <div className="voyage-acc-payment-guide">
                  <div className="tour-checkout-section-header" style={{ marginBottom: 12 }}>
                    <h4 className="tour-checkout-section-title">Phương thức thanh toán</h4>
                    <span className="tour-checkout-section-sub">Lựa chọn cổng thanh toán trực tuyến bảo mật</span>
                  </div>

                  <div className="tour-checkout-group" role="radiogroup" aria-label="Phương thức thanh toán">
                    {/* VietQR payOS */}
                    <div
                      className={`tour-checkout-row ${modalPaymentMethod === "payos" ? "tour-checkout-row--selected tour-checkout-row--payos" : ""}`}
                      onClick={() => setModalPaymentMethod("payos")}
                      role="radio"
                      aria-checked={modalPaymentMethod === "payos"}
                      tabIndex={0}
                    >
                      <div className="tour-checkout-row-main">
                        <div className="tour-checkout-row-left">
                          <div className={`tour-checkout-radio-circle ${modalPaymentMethod === "payos" ? "tour-checkout-radio-circle--active-payos" : ""}`}>
                            {modalPaymentMethod === "payos" && <div className="tour-checkout-radio-dot tour-checkout-radio-dot--payos" />}
                          </div>
                          <div className="tour-checkout-row-text">
                            <div className="tour-checkout-row-title-line">
                              <span className="tour-checkout-row-name">Chuyển khoản VietQR (Napas 24/7)</span>
                              <span className="tour-checkout-badge-pill tour-checkout-badge-pill--green">
                                Khuyên dùng • Tự động 24/7
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

                      {modalPaymentMethod === "payos" && (
                        <div className="tour-checkout-row-detail">
                          <span className="tour-checkout-bank-support-text">
                            <b>Hỗ trợ 40+ ngân hàng:</b> TPBank, Techcombank, MB Bank, Vietcombank, BIDV, VPBank, ACB...
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Hairline Divider */}
                    <div className="tour-checkout-group-divider" />

                    {/* Stripe */}
                    <div
                      className={`tour-checkout-row ${modalPaymentMethod === "stripe" ? "tour-checkout-row--selected tour-checkout-row--stripe" : ""}`}
                      onClick={() => setModalPaymentMethod("stripe")}
                      role="radio"
                      aria-checked={modalPaymentMethod === "stripe"}
                      tabIndex={0}
                    >
                      <div className="tour-checkout-row-main">
                        <div className="tour-checkout-row-left">
                          <div className={`tour-checkout-radio-circle ${modalPaymentMethod === "stripe" ? "tour-checkout-radio-circle--active-stripe" : ""}`}>
                            {modalPaymentMethod === "stripe" && <div className="tour-checkout-radio-dot tour-checkout-radio-dot--stripe" />}
                          </div>
                          <div className="tour-checkout-row-text">
                            <div className="tour-checkout-row-title-line">
                              <span className="tour-checkout-row-name">Thẻ quốc tế (Visa / Mastercard / JCB)</span>
                              <span className="tour-checkout-badge-pill tour-checkout-badge-pill--purple">
                                Cổng quốc tế Stripe
                              </span>
                            </div>
                            <p className="tour-checkout-row-hint">
                              Bảo mật PCI-DSS qua Stripe. Hỗ trợ thẻ tín dụng/ghi nợ quốc tế, Apple Pay & Google Pay.
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

                      {modalPaymentMethod === "stripe" && (
                        <div className="tour-checkout-row-detail">
                          <span className="tour-checkout-stripe-support-text">
                            Bảo mật tuyệt đối PCI-DSS Cấp 1 toàn cầu bởi Stripe.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    className={`tour-checkout-pay-btn ${modalPaymentMethod === "payos" ? "tour-checkout-pay-btn--payos" : "tour-checkout-pay-btn--stripe"}`}
                    onClick={() => modalPaymentMethod === "payos" ? handlePayPayos(selectedBooking.id) : handlePayStripe(selectedBooking.id)}
                    disabled={payingBookingId === selectedBooking.id}
                    style={{ width: "100%", marginTop: 14 }}
                  >
                    {payingBookingId === selectedBooking.id ? (
                      "Đang kết nối cổng thanh toán..."
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">lock</span>
                        <span>
                          {modalPaymentMethod === "payos"
                            ? `Thanh toán VietQR (${Number(selectedBooking.total_price || 0).toLocaleString("vi-VN")} ₫) →`
                            : `Thanh toán qua Stripe (${Number(selectedBooking.total_price || 0).toLocaleString("vi-VN")} ₫) →`}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL XÁC NHẬN HỦY TOUR
          ======================================================= */}
      {cancellingBooking && (
        <div className="voyage-acc-modal-overlay" onClick={() => setCancellingBooking(null)}>
          <div className="voyage-acc-modal voyage-acc-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="voyage-acc-modal-header">
              <h3>Xác nhận hủy đặt tour</h3>
              <button
                type="button"
                className="voyage-acc-modal-close"
                onClick={() => setCancellingBooking(null)}
              >
                ✕
              </button>
            </div>
            <div className="voyage-acc-modal-body">
              <p className="voyage-acc-modal-warning">
                Bạn có chắc chắn muốn hủy đơn đặt tour <strong>{cancellingBooking.tour_title}</strong>? Chỗ giữ của bạn sẽ được hoàn trả về hệ thống.
              </p>
              <div className="voyage-acc-field" style={{ marginTop: "14px" }}>
                <label htmlFor="cancel-reason">Lý do hủy (không bắt buộc):</label>
                <textarea
                  id="cancel-reason"
                  rows="3"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ví dụ: Thay đổi lịch trình gia đình..."
                  className="voyage-acc-textarea"
                />
              </div>
              <div className="voyage-acc-modal-footer">
                <button
                  type="button"
                  className="voyage-acc-btn-outline"
                  onClick={() => setCancellingBooking(null)}
                >
                  Giữ lại đơn
                </button>
                <button
                  type="button"
                  className="voyage-acc-btn-danger"
                  onClick={handleConfirmCancelBooking}
                  disabled={submittingCancel}
                >
                  {submittingCancel ? "Đang hủy..." : "Xác nhận hủy đơn"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL XÁC NHẬN XÓA LỊCH TRÌNH
          ======================================================= */}
      {deletingItinerary && (
        <div className="voyage-acc-modal-overlay" onClick={() => setDeletingItinerary(null)}>
          <div className="voyage-acc-modal voyage-acc-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="voyage-acc-modal-header">
              <h3>Xóa lịch trình</h3>
              <button
                type="button"
                className="voyage-acc-modal-close"
                onClick={() => setDeletingItinerary(null)}
              >
                ✕
              </button>
            </div>
            <div className="voyage-acc-modal-body">
              <p className="voyage-acc-modal-warning">
                Bạn có chắc chắn muốn xóa lịch trình <strong>{deletingItinerary.name}</strong>? Thao tác này không thể khôi phục.
              </p>
              <div className="voyage-acc-modal-footer">
                <button
                  type="button"
                  className="voyage-acc-btn-outline"
                  onClick={() => setDeletingItinerary(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="voyage-acc-btn-danger"
                  onClick={handleConfirmDeleteItinerary}
                  disabled={submittingDeleteItinerary}
                >
                  {submittingDeleteItinerary ? "Đang xóa..." : "Xóa vĩnh viễn"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL XÁC NHẬN ĐĂNG XUẤT
          ======================================================= */}
      {showLogoutConfirm && (
        <div className="voyage-acc-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="voyage-acc-modal voyage-acc-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="voyage-acc-modal-header">
              <h3>Xác nhận đăng xuất</h3>
              <button
                type="button"
                className="voyage-acc-modal-close"
                onClick={() => setShowLogoutConfirm(false)}
              >
                ✕
              </button>
            </div>
            <div className="voyage-acc-modal-body">
              <p className="voyage-acc-modal-warning">
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong>{activeUser.email}</strong>?
              </p>
              <div className="voyage-acc-modal-footer">
                <button
                  type="button"
                  className="voyage-acc-btn-outline"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Ở lại
                </button>
                <button
                  type="button"
                  className="voyage-acc-btn-danger"
                  onClick={() => {
                    setShowLogoutConfirm(false);
                    onLogout?.();
                    navigate("/", { replace: true });
                  }}
                >
                  Đăng xuất ngay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
