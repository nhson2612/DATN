import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api";
import VoyageDrawer from "../../shared/layout/VoyageDrawer";
import "./AccountPage.css";

// Ngân hàng VietQR nếu có cấu hình từ môi trường
const BANK_NAME = import.meta.env.VITE_BANK_NAME || "MB Bank (Ngân hàng Quân Đội)";
const BANK_ACCOUNT_NO = import.meta.env.VITE_BANK_ACCOUNT_NO || "0987654321";
const BANK_ACCOUNT_NAME = import.meta.env.VITE_BANK_ACCOUNT_NAME || "VOYAGE TRAVEL VIETNAM";

// Bộ đếm ngược thời gian giữ chỗ (30 phút)
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
    return <span className="voyage-account-badge voyage-account-badge--expired">Đã hết hạn giữ chỗ</span>;
  }

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return (
    <span className={`voyage-account-countdown ${seconds <= 300 ? "voyage-account-countdown--urgent" : ""}`}>
      <span className="material-symbols-outlined text-[15px]">timer</span>
      Giữ chỗ còn: {m.toString().padStart(2, "0")}:{s.toString().padStart(2, "0")}
    </span>
  );
}

export default function AccountPage({ user, onLogout, onNeedAuth }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab hiện tại: overview | profile | tours | itineraries
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    ["overview", "profile", "tours", "itineraries"].includes(tabParam) ? tabParam : "overview"
  );

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  // Dữ liệu Tour của tôi
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [bookingFilter, setBookingFilter] = useState("all"); // all | pending | paid | cancelled
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [payingBookingId, setPayingBookingId] = useState(null);

  // Dữ liệu Lịch trình của tôi
  const [itineraries, setItineraries] = useState([]);
  const [loadingItineraries, setLoadingItineraries] = useState(true);
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

  // Hộp thoại xác nhận đăng xuất
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 3000);
  };

  // Tính tỷ lệ hoàn thiện hồ sơ (% COMPLETED)
  const profileCompletionPercent = useMemo(() => {
    let score = 0;
    if (user?.email) score += 25;
    if (user?.full_name) score += 25;
    if (user?.phone || phone) score += 25;
    if (user?.city || city) score += 25;
    return score;
  }, [user, phone, city]);

  // Tên hiển thị chào mừng: Hello [Tên]
  const greetingName = useMemo(() => {
    if (!user?.full_name) return "Traveler";
    const parts = user.full_name.trim().split(" ");
    return parts[parts.length - 1] || parts[0];
  }, [user?.full_name]);

  // Đồng bộ tab với URL param
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Tải danh sách tour của tôi
  const fetchBookings = useCallback(async () => {
    if (!user) {
      setLoadingBookings(false);
      return;
    }
    setLoadingBookings(true);
    try {
      const res = await api.myTourBookings(100);
      setBookings(Array.isArray(res) ? res : (res.bookings || []));
    } catch (err) {
      console.error("Error fetching bookings:", err);
    } finally {
      setLoadingBookings(false);
    }
  }, [user]);

  // Tải danh sách lịch trình
  const fetchItineraries = useCallback(async () => {
    if (!user) {
      setLoadingItineraries(false);
      return;
    }
    setLoadingItineraries(true);
    try {
      const res = await api.itineraries();
      setItineraries(Array.isArray(res) ? res : (res.itineraries || []));
    } catch (err) {
      console.error("Error fetching itineraries:", err);
    } finally {
      setLoadingItineraries(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchItineraries();
      setFullName(user.full_name || "");
      setPhone(user.phone || "");
    }
  }, [user, fetchBookings, fetchItineraries]);

  // Kiểm tra callback thanh toán Stripe từ URL
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      showToast("Thanh toán đơn tour thành công! Dữ liệu đã được cập nhật.");
      fetchBookings();
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

  // Xử lý xác nhận thanh toán chuyển khoản demo
  const handlePayMock = async (bookingId) => {
    setPayingBookingId(bookingId);
    try {
      await api.payTourBooking(bookingId, { note: "Thanh toán chuyển khoản ngân hàng" });
      showToast("Xác nhận thanh toán thành công!");
      fetchBookings();
      setSelectedBooking(null);
    } catch (err) {
      showToast(err.message || "Không thể cập nhật thanh toán.");
    } finally {
      setPayingBookingId(null);
    }
  };

  // Xử lý thanh toán Stripe
  const handlePayStripe = async (bookingId) => {
    setPayingBookingId(bookingId);
    try {
      const res = await api.checkoutTourBooking(bookingId, window.location.origin + "/tai-khoan?tab=tours");
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

  // Xử lý xóa lịch trình
  const handleConfirmDeleteItinerary = async () => {
    if (!deletingItinerary) return;
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

  // Cập nhật thông tin tài khoản
  const handleSaveProfile = (e) => {
    e.preventDefault();
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
    }, 450);
  };

  // Đổi mật khẩu
  const handleChangePassword = (e) => {
    e.preventDefault();
    setPasswordError("");
    if (!currentPassword) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setSavingPassword(true);
    setTimeout(() => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      showToast("Đổi mật khẩu thành công!");
      setSavingPassword(false);
    }, 500);
  };

  // Chưa đăng nhập -> Hiển thị thông báo sang trọng yêu cầu đăng nhập
  if (!user) {
    return (
      <div className="voyage-account-page">
        <header className="voyage-account-header">
          <div className="voyage-account-header-inner">
            <Link to="/" className="voyage-account-brand">
              Voyage
            </Link>
            <nav className="voyage-account-nav">
              <Link to="/" className="voyage-account-nav-link">Destinations</Link>
              <Link to="/tour" className="voyage-account-nav-link">Tours</Link>
              <Link to="/chuyen-di" className="voyage-account-nav-link">Experiences</Link>
            </nav>
            <div className="voyage-account-header-actions">
              <button
                type="button"
                className="voyage-account-btn-auth"
                onClick={onNeedAuth}
              >
                Sign in
              </button>
            </div>
          </div>
        </header>

        <main className="voyage-account-unauth">
          <div className="voyage-account-unauth-card">
            <span className="material-symbols-outlined voyage-account-unauth-icon">
              lock
            </span>
            <h1 className="voyage-account-unauth-title">Personal Voyage</h1>
            <p className="voyage-account-unauth-desc">
              Vui lòng đăng nhập để quản lý danh sách tour đã đặt, các lịch trình được cá nhân hóa và thông tin tài khoản của bạn.
            </p>
            <button
              type="button"
              className="voyage-account-btn-primary"
              onClick={onNeedAuth}
            >
              Đăng nhập với Voyage →
            </button>
          </div>
        </main>
      </div>
    );
  }

  const userInitial = (user.full_name || user.email || "V").charAt(0).toUpperCase();

  return (
    <div className={`voyage-account-page ${activeTab === "overview" ? "voyage-account-page--overview" : ""}`}>
      {/* =======================================================
          TOP NAVIGATION BAR (Đồng bộ chuẩn Voyage)
          ======================================================= */}
      <header className="voyage-account-header">
        <div className="voyage-account-header-inner">
          <Link to="/" className="voyage-account-brand">
            Voyage
          </Link>

          <nav className="voyage-account-nav" aria-label="Primary navigation">
            <Link to="/" className="voyage-account-nav-link">
              Destinations
            </Link>
            <Link to="/tour" className="voyage-account-nav-link">
              Tours
            </Link>
            <Link to="/chuyen-di" className="voyage-account-nav-link">
              Experiences
            </Link>
          </nav>

          <div className="voyage-account-header-actions">
            <Link
              to="/tour"
              className="voyage-account-icon-btn"
              title="Tìm kiếm tour"
              aria-label="Search tours"
            >
              <span className="material-symbols-outlined text-[20px]">search</span>
            </Link>

            <span className="voyage-account-user-pill">
              <span className="voyage-account-avatar-sm">{userInitial}</span>
              <span className="voyage-account-name-sm">{user.full_name || user.email}</span>
            </span>

            <button
              type="button"
              className="voyage-account-menu-btn"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open menu"
            >
              Menu
            </button>
          </div>
        </div>
      </header>

      {/* Shared Drawer Navigation */}
      <VoyageDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        user={user}
        onLogout={onLogout}
      />

      {/* =======================================================
          NỘI DUNG CHÍNH TRANG ACCOUNT (2 CỘT THEO ACCOUNT_PAGE.PNG)
          ======================================================= */}
      <main className="voyage-account-main">
        <div className="voyage-account-container">
          <div className="voyage-account-layout">
            {/* Cột trái: Sidebar điều hướng tối giản (Nền trắng sạch, không viền đỏ) */}
            <aside className="voyage-account-sidebar">
              <h2 className="voyage-account-sidebar-heading">Account</h2>
              <nav className="voyage-account-sidebar-nav" aria-label="Account navigation">
                <button
                  type="button"
                  className={`voyage-account-sidebar-link ${activeTab === "overview" ? "is-active" : ""}`}
                  onClick={() => handleTabChange("overview")}
                >
                  Overview
                </button>
                <button
                  type="button"
                  className={`voyage-account-sidebar-link ${activeTab === "profile" ? "is-active" : ""}`}
                  onClick={() => handleTabChange("profile")}
                >
                  Profile
                </button>
                <button
                  type="button"
                  className={`voyage-account-sidebar-link ${activeTab === "tours" ? "is-active" : ""}`}
                  onClick={() => handleTabChange("tours")}
                >
                  Tour của tôi
                </button>
                <button
                  type="button"
                  className={`voyage-account-sidebar-link ${activeTab === "itineraries" ? "is-active" : ""}`}
                  onClick={() => handleTabChange("itineraries")}
                >
                  Lịch trình
                </button>
                <button
                  type="button"
                  className="voyage-account-sidebar-link voyage-account-sidebar-link--logout"
                  onClick={() => setShowLogoutConfirm(true)}
                >
                  Log out
                </button>
              </nav>
            </aside>

            {/* Cột phải: Vùng nội dung tương ứng */}
            <div className="voyage-account-content">
              {/* Header: Hello [Tên] & Signed in as: [email] */}
              <div className="voyage-account-welcome-row">
                <h1 className="voyage-account-welcome-title">
                  Hello {greetingName}
                </h1>
                <div className="voyage-account-signed-in">
                  Signed in as: <strong className="voyage-account-signed-email">{user.email}</strong>
                </div>
              </div>

              <div className="voyage-account-divider" />

              {/* =======================================================
                  TAB 0: TỔNG QUAN (OVERVIEW)
                  ======================================================= */}
              {activeTab === "overview" && (
                <div className="voyage-account-overview-pane">
                  {/* Hàng chỉ số nhanh: Profile % COMPLETED | Tours BOOKED | Itineraries SAVED */}
                  <div className="voyage-account-stats-row">
                    <div className="voyage-account-stat-card">
                      <span className="voyage-account-stat-title">Profile</span>
                      <div className="voyage-account-stat-value-group">
                        <span className="voyage-account-stat-num">{profileCompletionPercent}%</span>
                        <span className="voyage-account-stat-unit">COMPLETED</span>
                      </div>
                    </div>

                    <div className="voyage-account-stat-card">
                      <span className="voyage-account-stat-title">Tour của tôi</span>
                      <div className="voyage-account-stat-value-group">
                        <span className="voyage-account-stat-num">{bookings.length}</span>
                        <span className="voyage-account-stat-unit">BOOKED</span>
                      </div>
                    </div>

                    <div className="voyage-account-stat-card">
                      <span className="voyage-account-stat-title">Lịch trình</span>
                      <div className="voyage-account-stat-value-group">
                        <span className="voyage-account-stat-num">{itineraries.length}</span>
                        <span className="voyage-account-stat-unit">SAVED</span>
                      </div>
                    </div>
                  </div>

                  {/* Banner hành động: Nếu có đơn đang chờ thanh toán thì hiển thị ngay CTA thu hút dòng tiền */}
                  {bookings.some((b) => (b.payment_status === "pending" || b.status === "pending") && b.status !== "cancelled" && b.status !== "expired") && (
                    <div className="voyage-account-pending-banner">
                      <div className="voyage-account-pending-banner-text">
                        <span className="material-symbols-outlined text-[22px] text-amber-600">error</span>
                        <div>
                          <strong>Đơn tour đang chờ hoàn tất thanh toán</strong>
                          <p>Quý khách có đơn tour đang trong thời gian giữ chỗ. Vui lòng thanh toán sớm để đảm bảo giữ vé khởi hành.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="voyage-account-cta-pay"
                        onClick={() => {
                          const firstPending = bookings.find((b) => (b.payment_status === "pending" || b.status === "pending") && b.status !== "cancelled");
                          if (firstPending) setSelectedBooking(firstPending);
                        }}
                      >
                        <span className="material-symbols-outlined">payments</span>
                        <span>Thanh toán giữ chỗ ngay →</span>
                      </button>
                    </div>
                  )}

                  {/* Phần Recent orders */}
                  <section className="voyage-account-overview-section">
                    <div className="voyage-account-overview-section-header">
                      <h2 className="voyage-account-section-subtitle">Recent orders</h2>
                      {bookings.length > 0 && (
                        <button
                          type="button"
                          className="voyage-account-text-link"
                          onClick={() => handleTabChange("tours")}
                        >
                          Xem tất cả ({bookings.length}) →
                        </button>
                      )}
                    </div>

                    {bookings.length === 0 ? (
                      <p className="voyage-account-no-recent">No recent orders</p>
                    ) : (
                      <div className="voyage-account-recent-orders-list">
                        {bookings.slice(0, 2).map((b) => {
                          const isPending =
                            (b.payment_status === "pending" || b.status === "pending") && b.status !== "cancelled" && b.status !== "expired";
                          const isPaid =
                            b.payment_status === "paid" || b.status === "confirmed" || b.status === "paid";
                          const isCancelled =
                            b.status === "cancelled" || b.status === "expired";
                          const bookingCode = b.booking_code || `#BK-${b.id}`;

                          return (
                            <div key={b.id} className="voyage-account-recent-order-item">
                              <div className="voyage-account-recent-order-info">
                                <span className="voyage-account-recent-code">{bookingCode}</span>
                                <h4 className="voyage-account-recent-title">
                                  {b.tour_title || `Tour #${b.tour_id}`}
                                </h4>
                                <div className="voyage-account-recent-meta">
                                  <span>{b.departure_date ? `Khởi hành: ${b.departure_date}` : "Chưa có ngày khởi hành"}</span>
                                  <span>•</span>
                                  <span>{b.num_passengers || 1} khách</span>
                                  <span>•</span>
                                  <strong className="text-zinc-900">{Number(b.total_price || 0).toLocaleString("vi-VN")} ₫</strong>
                                </div>
                              </div>
                              <div className="voyage-account-recent-order-right">
                                {isPending ? (
                                  <button
                                    type="button"
                                    className="voyage-account-cta-pay"
                                    onClick={() => setSelectedBooking(b)}
                                    title="Bấm để thanh toán giữ chỗ ngay"
                                  >
                                    <span className="material-symbols-outlined">payments</span>
                                    <span>Thanh toán ngay →</span>
                                  </button>
                                ) : (
                                  <span
                                    className={`voyage-account-badge ${
                                      isPaid
                                        ? "voyage-account-badge--success"
                                        : "voyage-account-badge--danger"
                                    }`}
                                  >
                                    {isPaid ? "Đã xác nhận" : "Đã hủy"}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  className="voyage-account-btn-sm"
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
                </div>
              )}

          {/* =======================================================
              TAB 1: QUẢN LÝ TOUR CỦA TÔI
              ======================================================= */}
          {activeTab === "tours" && (
            <section className="voyage-account-section" aria-label="My booked tours">
              <div className="voyage-account-section-header">
                <div>
                  <h2 className="voyage-account-section-title">Quản lý tour của tôi</h2>
                  <p className="voyage-account-section-desc">
                    Theo dõi trạng thái đơn đặt tour, thời gian giữ chỗ và thông tin khởi hành.
                  </p>
                </div>

                {/* Lọc trạng thái đơn */}
                <div className="voyage-account-filter-group">
                  {[
                    { key: "all", label: "Tất cả" },
                    { key: "pending", label: "Chờ thanh toán" },
                    { key: "paid", label: "Đã xác nhận" },
                    { key: "cancelled", label: "Đã hủy" },
                  ].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      className={`voyage-account-filter-btn ${bookingFilter === f.key ? "voyage-account-filter-btn--active" : ""}`}
                      onClick={() => setBookingFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {loadingBookings ? (
                <div className="voyage-account-empty">
                  <div className="voyage-account-spinner" />
                  <p>Đang tải danh sách đơn đặt tour của bạn...</p>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="voyage-account-empty">
                  <span className="material-symbols-outlined text-[44px] text-slate-400">
                    travel_explore
                  </span>
                  <h3>Không tìm thấy đơn đặt tour nào</h3>
                  <p>
                    {bookingFilter === "all"
                      ? "Bạn chưa có đơn đặt tour nào. Khám phá các hành trình trọn gói được thiết kế riêng bởi Voyage."
                      : "Không có đơn tour nào ở trạng thái này."}
                  </p>
                  <Link to="/tour" className="voyage-account-btn-primary">
                    Khám phá tour du lịch →
                  </Link>
                </div>
              ) : (
                <div className="voyage-account-cards-list">
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
                    const isCancelled =
                      b.status === "cancelled" ||
                      b.status === "expired" ||
                      b.status === "EXPIRED" ||
                      b.is_hold_expired ||
                      b.status?.startsWith("CANCEL");

                    const bookingCode = b.code || b.booking_code || `#BK-${b.id}`;
                    const tourTitle = b.tour_name || b.tour_title || `Tour #${b.tour_id}`;
                    const tourCover = b.tour_cover_url || b.tour_cover_image;
                    const tourDepart = b.depart_date
                      ? new Date(b.depart_date).toLocaleDateString("vi-VN")
                      : (b.departure_date || "Đang cập nhật");
                    const tourGuests = b.guests || b.num_passengers || 1;

                    return (
                      <article key={b.id} className="voyage-account-booking-card">
                        <div className="voyage-account-booking-cover">
                          {tourCover ? (
                            <img src={tourCover} alt={tourTitle} />
                          ) : (
                            <div className="voyage-account-booking-no-img">
                              <span className="material-symbols-outlined">image</span>
                            </div>
                          )}
                        </div>

                        <div className="voyage-account-booking-info">
                          <div className="voyage-account-booking-top-row">
                            <span className="voyage-account-booking-code">{bookingCode}</span>
                            {isPending && b.hold_expires_at && (
                              <CountdownTimer
                                holdExpiresAt={b.hold_expires_at}
                                onExpired={() => fetchBookings()}
                              />
                            )}
                            {isPending ? (
                              <button
                                type="button"
                                className="voyage-account-cta-pay"
                                onClick={() => setSelectedBooking(b)}
                                title="Bấm để thanh toán hoàn tất giữ chỗ"
                              >
                                <span>Thanh toán ngay →</span>
                              </button>
                            ) : (
                              <span
                                className={`voyage-account-badge ${
                                  isPaid
                                    ? "voyage-account-badge--success"
                                    : "voyage-account-badge--danger"
                                }`}
                              >
                                {isPaid ? "Đã xác nhận & Thanh toán" : "Đã hủy / Hết hạn"}
                              </span>
                            )}
                          </div>

                          <h3 className="voyage-account-booking-title">
                            <Link to={b.tour_slug ? `/tour/${b.tour_slug}` : "/tour"}>
                              {tourTitle}
                            </Link>
                          </h3>

                          <div className="voyage-account-booking-meta">
                            <span className="voyage-account-meta-item">
                              <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                              Khởi hành: <strong>{tourDepart}</strong>
                            </span>
                            <span className="voyage-account-meta-item">
                              <span className="material-symbols-outlined text-[16px]">group</span>
                              Hành khách: <strong>{tourGuests} người</strong>
                            </span>
                            <span className="voyage-account-meta-item">
                              <span className="material-symbols-outlined text-[16px]">payments</span>
                              Tổng tiền: <strong>{Number(b.total_price || 0).toLocaleString("vi-VN")} ₫</strong>
                            </span>
                          </div>

                          <div className="voyage-account-booking-actions">
                            <button
                              type="button"
                              className="voyage-account-btn-outline"
                              onClick={() => setSelectedBooking(b)}
                            >
                              Chi tiết đơn
                            </button>

                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  className="voyage-account-btn-action"
                                  onClick={() => setSelectedBooking(b)}
                                  disabled={payingBookingId === b.id}
                                >
                                  Thanh toán ngay →
                                </button>
                                <button
                                  type="button"
                                  className="voyage-account-btn-text-danger"
                                  onClick={() => setCancellingBooking(b)}
                                >
                                  Hủy giữ chỗ
                                </button>
                              </>
                            )}

                            {b.tour_slug && (
                              <Link
                                to={`/tour/${b.tour_slug}`}
                                className="voyage-account-btn-link"
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
              TAB 2: QUẢN LÝ LỊCH TRÌNH (ITINERARY)
              ======================================================= */}
          {activeTab === "itineraries" && (
            <section className="voyage-account-section" aria-label="My saved itineraries">
              <div className="voyage-account-section-header">
                <div>
                  <h2 className="voyage-account-section-title">Lịch trình đã lưu</h2>
                  <p className="voyage-account-section-desc">
                    Các kế hoạch du lịch và hành trình trải nghiệm được lưu trữ hoặc tối ưu cùng Trợ lý AI.
                  </p>
                </div>

                <Link to="/chuyen-di" className="voyage-account-btn-primary">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Lên lịch trình mới với AI
                </Link>
              </div>

              {loadingItineraries ? (
                <div className="voyage-account-empty">
                  <div className="voyage-account-spinner" />
                  <p>Đang tải danh sách lịch trình của bạn...</p>
                </div>
              ) : itineraries.length === 0 ? (
                <div className="voyage-account-empty">
                  <span className="material-symbols-outlined text-[44px] text-slate-400">
                    route
                  </span>
                  <h3>Chưa có lịch trình nào được lưu</h3>
                  <p>
                    Hãy để Trợ lý AI Voyage tạo lộ trình di chuyển tối ưu và gợi ý các điểm đến hấp dẫn cho bạn.
                  </p>
                  <Link to="/chuyen-di" className="voyage-account-btn-primary">
                    Bắt đầu lên lịch trình →
                  </Link>
                </div>
              ) : (
                <div className="voyage-account-itinerary-grid">
                  {itineraries.map((it) => {
                    const stopCount = (it.stops || []).length || (it.stops_details || []).length || 0;
                    const days = it.duration_days || 1;

                    return (
                      <article key={it.id} className="voyage-account-itinerary-card">
                        <div className="voyage-account-itinerary-top">
                          <span className="voyage-account-badge voyage-account-badge--neutral">
                            {days} ngày {days > 1 ? `${days - 1} đêm` : ""}
                          </span>
                          <span className="voyage-account-itinerary-date">
                            {it.created_at ? new Date(it.created_at).toLocaleDateString("vi-VN") : "Gần đây"}
                          </span>
                        </div>

                        <h3 className="voyage-account-itinerary-title">
                          <Link to={`/chuyen-di/${it.id}`}>
                            {it.name || "Lịch trình khám phá Việt Nam"}
                          </Link>
                        </h3>

                        <p className="voyage-account-itinerary-desc">
                          {it.description || it.destination || "Hành trình trải nghiệm cá nhân hóa kết hợp các danh lam và ẩm thực đặc sắc."}
                        </p>

                        <div className="voyage-account-itinerary-stats">
                          <span className="voyage-account-meta-item">
                            <span className="material-symbols-outlined text-[16px]">pin_drop</span>
                            <strong>{stopCount}</strong> điểm dừng chân
                          </span>
                          {it.destination && (
                            <span className="voyage-account-meta-item">
                              <span className="material-symbols-outlined text-[16px]">location_on</span>
                              {it.destination}
                            </span>
                          )}
                        </div>

                        {/* Điểm dừng chân xem trước */}
                        {Array.isArray(it.stops_details) && it.stops_details.length > 0 && (
                          <div className="voyage-account-itinerary-stops-preview">
                            {it.stops_details.slice(0, 3).map((st, sIdx) => (
                              <span key={sIdx} className="voyage-account-stop-pill">
                                {st.name || `Điểm #${st.id || sIdx + 1}`}
                              </span>
                            ))}
                            {it.stops_details.length > 3 && (
                              <span className="voyage-account-stop-pill voyage-account-stop-pill--more">
                                +{it.stops_details.length - 3} điểm khác
                              </span>
                            )}
                          </div>
                        )}

                        <div className="voyage-account-itinerary-actions">
                          <Link
                            to={`/chuyen-di/${it.id}`}
                            className="voyage-account-btn-action"
                          >
                            Mở lịch trình →
                          </Link>
                          <button
                            type="button"
                            className="voyage-account-icon-danger-btn"
                            onClick={() => setDeletingItinerary(it)}
                            title="Xóa lịch trình này"
                            aria-label="Delete itinerary"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* =======================================================
              TAB 3: THÔNG TIN TÀI KHOẢN & BẢO MẬT
              ======================================================= */}
          {activeTab === "profile" && (
            <section className="voyage-account-section" aria-label="Account details">
              <div className="voyage-account-grid-2col">
                {/* Cột 1: Thông tin cá nhân */}
                <div className="voyage-account-form-panel">
                  <h3 className="voyage-account-panel-title">Thông tin cá nhân</h3>
                  <p className="voyage-account-panel-desc">
                    Thông tin hiển thị khi đặt tour và liên hệ hỗ trợ khách hàng.
                  </p>

                  <form onSubmit={handleSaveProfile} className="voyage-account-form">
                    <div className="voyage-account-field">
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

                    <div className="voyage-account-field">
                      <label htmlFor="prof-email">Email đăng nhập</label>
                      <input
                        id="prof-email"
                        type="email"
                        value={user.email || ""}
                        disabled
                        className="voyage-account-input-disabled"
                      />
                      <span className="voyage-account-field-hint">
                        Email là định danh tài khoản và không thể tự thay đổi.
                      </span>
                    </div>

                    <div className="voyage-account-field">
                      <label htmlFor="prof-phone">Số điện thoại liên hệ</label>
                      <input
                        id="prof-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Ví dụ: 0912 345 678"
                      />
                    </div>

                    <div className="voyage-account-field">
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
                      className="voyage-account-btn-primary"
                      disabled={savingProfile}
                    >
                      {savingProfile ? "Đang lưu..." : "Lưu thay đổi"}
                    </button>
                  </form>
                </div>

                {/* Cột 2: Đổi mật khẩu & Tùy chọn */}
                <div className="voyage-account-form-panel">
                  <h3 className="voyage-account-panel-title">Bảo mật & Mật khẩu</h3>
                  <p className="voyage-account-panel-desc">
                    Đảm bảo an toàn tài khoản với mật khẩu tối thiểu 6 ký tự.
                  </p>

                  {passwordError && (
                    <div className="voyage-account-alert voyage-account-alert--error">
                      <span className="material-symbols-outlined text-[18px]">error</span>
                      <span>{passwordError}</span>
                    </div>
                  )}

                  <form onSubmit={handleChangePassword} className="voyage-account-form">
                    <div className="voyage-account-field">
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

                    <div className="voyage-account-field">
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

                    <div className="voyage-account-field">
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
                      className="voyage-account-btn-outline"
                      disabled={savingPassword}
                    >
                      {savingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
                    </button>
                  </form>

                  <div className="voyage-account-divider-line" />

                  {/* Tùy chọn hệ thống */}
                  <div className="voyage-account-preferences">
                    <h4 className="voyage-account-pref-title">Tùy chọn hiển thị</h4>
                    <div className="voyage-account-pref-item">
                      <div>
                        <strong>Ngôn ngữ</strong>
                        <p>Tiếng Việt (Mặc định hệ thống)</p>
                      </div>
                      <span className="voyage-account-badge voyage-account-badge--neutral">Tiếng Việt</span>
                    </div>
                    <div className="voyage-account-pref-item">
                      <div>
                        <strong>Đơn vị tiền tệ</strong>
                        <p>Việt Nam Đồng (VND - ₫)</p>
                      </div>
                      <span className="voyage-account-badge voyage-account-badge--neutral">VND</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

            {/* Phân cách và khối Got questions? */}
            <div className="voyage-account-footer-divider" />
            <section className="voyage-account-help-section" aria-label="Customer service">
              <div className="voyage-account-help-text">
                <h3 className="voyage-account-help-title">Got questions?</h3>
                <p className="voyage-account-help-desc">
                  You can find frequently asked questions and answers on our customer service page.
                </p>
              </div>
              <a
                href="#customer-service"
                className="voyage-account-help-link"
                onClick={(e) => {
                  e.preventDefault();
                  showToast("Tổng đài Voyage CSKH 24/7: 1900 6868 hoặc email support@voyage.vn");
                }}
              >
                Customer Service ↗
              </a>
            </section>
          </div>
        </div>
      </div>
    </main>

      {/* =======================================================
          MODAL CHI TIẾT & HƯỚNG DẪN THANH TOÁN
          ======================================================= */}
      {selectedBooking && (
        <div className="voyage-account-modal-overlay" onClick={() => setSelectedBooking(null)}>
          <div className="voyage-account-modal" onClick={(e) => e.stopPropagation()}>
            <div className="voyage-account-modal-header">
              <h3>Chi tiết đơn đặt tour {selectedBooking.booking_code || `#BK-${selectedBooking.id}`}</h3>
              <button
                type="button"
                className="voyage-account-modal-close"
                onClick={() => setSelectedBooking(null)}
              >
                ✕
              </button>
            </div>

            <div className="voyage-account-modal-body">
              <div className="voyage-account-modal-tour-title">
                {selectedBooking.tour_name || selectedBooking.tour_title || `Tour #${selectedBooking.tour_id}`}
              </div>

              <div className="voyage-account-modal-details-grid">
                <div>
                  <span className="voyage-account-modal-label">Ngày khởi hành:</span>
                  <strong>
                    {selectedBooking.depart_date
                      ? new Date(selectedBooking.depart_date).toLocaleDateString("vi-VN")
                      : (selectedBooking.departure_date || "Theo thỏa thuận")}
                  </strong>
                </div>
                <div>
                  <span className="voyage-account-modal-label">Số khách:</span>
                  <strong>{selectedBooking.guests || selectedBooking.num_passengers || 1} người</strong>
                </div>
                <div>
                  <span className="voyage-account-modal-label">Tổng thanh toán:</span>
                  <strong className="voyage-account-price-highlight">
                    {Number(selectedBooking.total_price || 0).toLocaleString("vi-VN")} ₫
                  </strong>
                </div>
                <div>
                  <span className="voyage-account-modal-label">Trạng thái:</span>
                  <strong>
                    {selectedBooking.payment_status === "paid" || selectedBooking.status === "confirmed"
                      ? "Đã thanh toán"
                      : selectedBooking.status === "cancelled"
                      ? "Đã hủy"
                      : "Chờ thanh toán"}
                  </strong>
                </div>
              </div>

              {/* Hướng dẫn thanh toán nếu chưa trả tiền */}
              {(selectedBooking.payment_status === "pending" || selectedBooking.status === "pending") &&
                selectedBooking.status !== "cancelled" && (
                  <div className="voyage-account-payment-guide">
                    <h4 className="voyage-account-payment-guide-title">
                      Hướng dẫn chuyển khoản ngân hàng (VietQR)
                    </h4>
                    <div className="voyage-account-qr-box">
                      <img
                        src={`https://img.vietqr.io/image/970422-0987654321-compact2.png?amount=${selectedBooking.total_price}&addInfo=VOYAGE%20BK${selectedBooking.id}&accountName=VOYAGE%20TRAVEL`}
                        alt="Mã QR Chuyển khoản"
                        className="voyage-account-qr-img"
                      />
                      <div className="voyage-account-qr-info">
                        <p><strong>Ngân hàng:</strong> {BANK_NAME}</p>
                        <p><strong>Số tài khoản:</strong> {BANK_ACCOUNT_NO}</p>
                        <p><strong>Chủ tài khoản:</strong> {BANK_ACCOUNT_NAME}</p>
                        <p><strong>Nội dung CK:</strong> <code>VOYAGE BK{selectedBooking.id}</code></p>
                      </div>
                    </div>

                    <div className="voyage-account-modal-pay-actions">
                      <button
                        type="button"
                        className="voyage-account-btn-primary"
                        onClick={() => handlePayMock(selectedBooking.id)}
                        disabled={payingBookingId === selectedBooking.id}
                      >
                        {payingBookingId === selectedBooking.id
                          ? "Đang xác nhận..."
                          : "Tôi đã chuyển khoản xong ✓"}
                      </button>

                      <button
                        type="button"
                        className="voyage-account-btn-stripe"
                        onClick={() => handlePayStripe(selectedBooking.id)}
                        disabled={payingBookingId === selectedBooking.id}
                      >
                        Thanh toán thẻ quốc tế (Stripe) →
                      </button>
                    </div>
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
        <div className="voyage-account-modal-overlay" onClick={() => setCancellingBooking(null)}>
          <div className="voyage-account-modal voyage-account-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="voyage-account-modal-header">
              <h3>Xác nhận hủy đặt tour</h3>
              <button
                type="button"
                className="voyage-account-modal-close"
                onClick={() => setCancellingBooking(null)}
              >
                ✕
              </button>
            </div>
            <div className="voyage-account-modal-body">
              <p className="voyage-account-modal-warning">
                Bạn có chắc chắn muốn hủy đơn đặt tour <strong>{cancellingBooking.tour_title}</strong>? Chỗ giữ của bạn sẽ được hoàn trả về hệ thống.
              </p>
              <div className="voyage-account-field">
                <label htmlFor="cancel-reason">Lý do hủy (không bắt buộc):</label>
                <textarea
                  id="cancel-reason"
                  rows="3"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ví dụ: Thay đổi lịch trình cá nhân..."
                />
              </div>
              <div className="voyage-account-modal-footer">
                <button
                  type="button"
                  className="voyage-account-btn-outline"
                  onClick={() => setCancellingBooking(null)}
                >
                  Giữ lại đơn
                </button>
                <button
                  type="button"
                  className="voyage-account-btn-danger"
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
        <div className="voyage-account-modal-overlay" onClick={() => setDeletingItinerary(null)}>
          <div className="voyage-account-modal voyage-account-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="voyage-account-modal-header">
              <h3>Xóa lịch trình</h3>
              <button
                type="button"
                className="voyage-account-modal-close"
                onClick={() => setDeletingItinerary(null)}
              >
                ✕
              </button>
            </div>
            <div className="voyage-account-modal-body">
              <p className="voyage-account-modal-warning">
                Bạn có chắc chắn muốn xóa lịch trình <strong>{deletingItinerary.name}</strong>? Thao tác này không thể khôi phục.
              </p>
              <div className="voyage-account-modal-footer">
                <button
                  type="button"
                  className="voyage-account-btn-outline"
                  onClick={() => setDeletingItinerary(null)}
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  className="voyage-account-btn-danger"
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
        <div className="voyage-account-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="voyage-account-modal voyage-account-modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="voyage-account-modal-header">
              <h3>Xác nhận đăng xuất</h3>
              <button
                type="button"
                className="voyage-account-modal-close"
                onClick={() => setShowLogoutConfirm(false)}
              >
                ✕
              </button>
            </div>
            <div className="voyage-account-modal-body">
              <p className="voyage-account-modal-warning">
                Bạn có chắc chắn muốn đăng xuất khỏi tài khoản <strong>{user.email}</strong>?
              </p>
              <div className="voyage-account-modal-footer">
                <button
                  type="button"
                  className="voyage-account-btn-outline"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Ở lại
                </button>
                <button
                  type="button"
                  className="voyage-account-btn-danger"
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

      {/* Toast thông báo */}
      {toastMessage && (
        <div className="voyage-account-toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
