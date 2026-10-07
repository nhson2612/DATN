import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api";
import VoyageDrawer from "../../shared/layout/VoyageDrawer";
import "./TourMyBookings.css";

// Cấu hình ngân hàng đọc từ env (nếu có), KHÔNG hardcode ngân hàng giả
const BANK_NAME = import.meta.env.VITE_BANK_NAME || "";
const BANK_ACCOUNT_NO = import.meta.env.VITE_BANK_ACCOUNT_NO || "";
const BANK_ACCOUNT_NAME = import.meta.env.VITE_BANK_ACCOUNT_NAME || "";

// Component đếm ngược giữ chỗ 30 phút cho từng booking
function BookingCountdown({ holdExpiresAt, onExpired }) {
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
    return <span className="tour-mb-countdown tour-mb-countdown--expired">Hết hạn giữ chỗ</span>;
  }

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  return (
    <span className={`tour-mb-countdown ${seconds <= 300 ? "tour-mb-countdown--urgent" : ""}`}>
      Giữ chỗ còn {timeStr}
    </span>
  );
}

export default function TourMyBookings({ user, onNeedAuth, onLogout }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // all | pending | paid | expired
  const [payingBookingId, setPayingBookingId] = useState(null);
  const [stripePayingBookingId, setStripePayingBookingId] = useState(null);
  const [instructionBooking, setInstructionBooking] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");
  const [cancellingBookingId, setCancellingBookingId] = useState(null);

  // State thông báo trạng thái thanh toán Stripe Checkout
  const [checkoutNotice, setCheckoutNotice] = useState(null);
  const pollTimerRef = useRef(null);

  // Dọn dẹp poll interval khi unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  const fetchBookings = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.myTourBookings(100);
      setBookings(res.bookings || []);
    } catch (err) {
      setError(err.message || "Không thể tải danh sách đơn đặt tour.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Stripe trở về web; webhook độc lập mới là nguồn xác nhận thanh toán.
  useEffect(() => {
    const checkoutParam = searchParams.get("checkout");
    if (!checkoutParam) return;

    const bookingIdParam = searchParams.get("booking_id");
    // Xóa ngay query param để tránh bị lặp lại khi người dùng F5 / reload
    setSearchParams({}, { replace: true });

    if (checkoutParam === "cancelled") {
      setCheckoutNotice({
        type: "cancelled",
        bookingId: bookingIdParam ? Number(bookingIdParam) : null,
        message: "Quý khách đã huỷ thanh toán. Chỗ vẫn được giữ đến hết thời hạn.",
      });
      return;
    }

    if (checkoutParam === "success") {
      setCheckoutNotice({
        type: "verifying",
        message: "Thanh toán đã được ghi nhận. Đang xác nhận với hệ thống...",
      });

      let pollCount = 0;
      const MAX_POLLS = 20;

      const runPolling = (targetBookingId) => {
        if (!targetBookingId) {
          setCheckoutNotice({
            type: "info",
            message: "Hệ thống đang xử lý, vui lòng bấm Làm mới sau vài phút.",
          });
          return;
        }

        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
        }

        pollTimerRef.current = setInterval(async () => {
          pollCount += 1;
          try {
            const st = await api.tourBookingStatus(targetBookingId);
            const status = st?.status;
            const isHoldExpired = st?.is_hold_expired;
            const paymentStatus = st?.payment_status;

            if (status === "PAID" || status === "CONFIRMED") {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              setCheckoutNotice({
                type: "success",
                bookingId: targetBookingId,
                message: "Thanh toán thành công!",
              });
              fetchBookings();
              return;
            }

            if (isHoldExpired || status === "EXPIRED") {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              setCheckoutNotice({
                type: "expired",
                bookingId: targetBookingId,
                message: "Đơn hàng đã hết hạn giữ chỗ.",
              });
              fetchBookings();
              return;
            }

            if (paymentStatus === "MISMATCH") {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              setCheckoutNotice({
                type: "error",
                bookingId: targetBookingId,
                message: "Số tiền không khớp, vui lòng liên hệ quản trị viên.",
              });
              return;
            }

            if (pollCount >= MAX_POLLS) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              setCheckoutNotice({
                type: "info",
                bookingId: targetBookingId,
                message: "Hệ thống đang xử lý, vui lòng bấm Làm mới sau vài phút.",
              });
              fetchBookings();
            }
          } catch (pollErr) {
            console.warn("Lỗi thăm dò trạng thái thanh toán:", pollErr);
            if (pollCount >= MAX_POLLS) {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              setCheckoutNotice({
                type: "info",
                bookingId: targetBookingId,
                message: "Hệ thống đang xử lý, vui lòng bấm Làm mới sau vài phút.",
              });
              fetchBookings();
            }
          }
        }, 2000);
      };

      const resolveBookingAndPoll = async () => {
        let bId = bookingIdParam ? Number(bookingIdParam) : null;
        if (bId && !isNaN(bId)) {
          runPolling(bId);
          return;
        }

        try {
          const res = await api.myTourBookings(100);
          const list = res.bookings || [];
          setBookings(list);
          const pendingBooking = list.find((b) => b.status === "PENDING_PAYMENT");
          const target = pendingBooking || list[0];
          if (target?.id) {
            runPolling(target.id);
          } else {
            setCheckoutNotice({
              type: "info",
              message: "Hệ thống đang xử lý, vui lòng bấm Làm mới sau vài phút.",
            });
          }
        } catch (fetchErr) {
          console.warn("Lỗi tìm kiếm đơn đặt tour:", fetchErr);
          setCheckoutNotice({
            type: "info",
            message: "Hệ thống đang xử lý, vui lòng bấm Làm mới sau vài phút.",
          });
        }
      };

      resolveBookingAndPoll();
    }
  }, [searchParams, setSearchParams, fetchBookings]);

  const handleStripeCheckout = async (bookingId) => {
    setStripePayingBookingId(bookingId);
    setCheckoutNotice(null);
    try {
      const res = await api.checkoutTourBooking(bookingId, window.location.origin);
      if (res?.checkout_url) {
        window.location.assign(res.checkout_url);
      } else {
        setCheckoutNotice({
          type: "error",
          bookingId,
          message: "Không nhận được liên kết thanh toán từ Stripe.",
        });
      }
    } catch (err) {
      setCheckoutNotice({
        type: "error",
        bookingId,
        message: err.message || "Không thể khởi tạo thanh toán Stripe. Vui lòng thử lại.",
      });
    } finally {
      setStripePayingBookingId(null);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Hủy đơn này? Chỗ sẽ được trả lại. Giao dịch đã thanh toán sẽ được đưa vào quy trình hoàn tiền.")) return;
    setCancellingBookingId(bookingId);
    try {
      await api.cancelMyTourBooking(bookingId);
      await fetchBookings();
    } catch (err) {
      setCheckoutNotice({ type: "error", bookingId, message: err.message || "Không thể hủy đơn." });
    } finally {
      setCancellingBookingId(null);
    }
  };

  // Xử lý tạo thông tin chuyển khoản cho đơn PENDING_PAYMENT chưa có payment
  const handleCreatePayment = async (bookingId) => {
    setPayingBookingId(bookingId);
    try {
      const payRes = await api.payTourBooking(bookingId, { method: "CHUYEN_KHOAN" });
      // Cập nhật lại booking trong state
      setBookings((prev) =>
        prev.map((b) =>
          b.id === bookingId
            ? {
                ...b,
                payment_id: payRes.id,
                payment_txn_ref: payRes.txn_ref,
                payment_amount: payRes.amount || b.total_price,
                payment_status: payRes.status || "PENDING",
              }
            : b
        )
      );
      // Mở luôn modal hướng dẫn cho khách
      const updatedBooking = bookings.find((b) => b.id === bookingId);
      if (updatedBooking) {
        setInstructionBooking({
          ...updatedBooking,
          payment_txn_ref: payRes.txn_ref,
          payment_amount: payRes.amount || updatedBooking.total_price,
        });
      }
    } catch (err) {
      alert(err.message || "Không thể tạo thông tin chuyển khoản.");
    } finally {
      setPayingBookingId(null);
    }
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(""), 2000);
  };

  // Phân loại đơn theo tab
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const isExpired = b.is_hold_expired || b.status === "EXPIRED";
      if (activeTab === "pending") {
        return b.status === "PENDING_PAYMENT" && !isExpired;
      }
      if (activeTab === "paid") {
        return b.status === "PAID" || b.payment_status === "SUCCESS";
      }
      if (activeTab === "expired") {
        return isExpired || b.status?.startsWith("CANCELLED");
      }
      return true; // "all"
    });
  }, [bookings, activeTab]);

  const userInitial = (user?.full_name || user?.email || "U").trim().charAt(0).toUpperCase();

  const countPending = useMemo(
    () => bookings.filter((b) => b.status === "PENDING_PAYMENT" && !b.is_hold_expired && b.status !== "EXPIRED").length,
    [bookings]
  );
  const countPaid = useMemo(
    () => bookings.filter((b) => b.status === "PAID" || b.payment_status === "SUCCESS").length,
    [bookings]
  );
  const countExpired = useMemo(
    () => bookings.filter((b) => b.is_hold_expired || b.status === "EXPIRED" || b.status?.startsWith("CANCELLED")).length,
    [bookings]
  );

  return (
    <div className="tour-my-bookings">
      {/* Top Header đồng bộ toàn hệ thống Voyage */}
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
            <Link to="/tai-khoan" className="voyage-account-nav-link">
              Account
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

            {user ? (
              <span className="voyage-account-user-pill">
                <span className="voyage-account-avatar-sm">{userInitial}</span>
                <span className="voyage-account-name-sm">{user.full_name || user.email}</span>
              </span>
            ) : (
              <button
                type="button"
                className="voyage-account-login-btn"
                onClick={onNeedAuth}
              >
                Sign In
              </button>
            )}

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

      <main className="tour-my-bookings__main">
        <div className="tour-my-bookings__container">
          {/* Header trang */}
          <div className="tour-mb-header">
            <div>
              <h1 className="tour-mb-title">Đơn tour của tôi</h1>
              <p className="tour-mb-subtitle">
                Quản lý các chuyến đi đã đặt, thời gian giữ chỗ và thông tin thanh toán.
              </p>
            </div>
            {user && (
              <button
                type="button"
                className="tour-mb-btn-refresh"
                onClick={fetchBookings}
                disabled={loading}
                title="Làm mới danh sách"
              >
                {loading ? "Đang tải..." : "Làm mới"}
              </button>
            )}
          </div>

          {/* Banner thông báo thanh toán */}
          {checkoutNotice && (
            <div
              className={`tour-mb-notice tour-mb-notice--${checkoutNotice.type}`}
              role="status"
            >
              <span className="tour-mb-notice-text">{checkoutNotice.message}</span>
              <button
                type="button"
                className="tour-mb-notice-close"
                onClick={() => setCheckoutNotice(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
          )}

          {/* Chưa đăng nhập */}
          {!user ? (
            <div className="tour-mb-auth">
              <h2 className="tour-mb-auth-title">Vui lòng đăng nhập</h2>
              <p className="tour-mb-auth-desc">
                Quý khách cần đăng nhập tài khoản để tra cứu và quản lý các đơn đặt tour đã tạo.
              </p>
              <button
                type="button"
                className="tour-mb-btn-primary"
                onClick={onNeedAuth}
              >
                Đăng nhập tài khoản
              </button>
            </div>
          ) : loading ? (
            /* Trạng thái đang tải */
            <div className="tour-mb-loading">
              <div className="tour-mb-spinner" />
              <p>Đang tải danh sách đơn đặt tour...</p>
            </div>
          ) : error ? (
            /* Trạng thái lỗi */
            <div className="tour-mb-error-box">
              <p>{error}</p>
              <button
                type="button"
                className="tour-mb-btn-secondary"
                onClick={fetchBookings}
              >
                Thử lại
              </button>
            </div>
          ) : (
            <>
              {/* Bộ lọc tab chuẩn Voyage Segmented Control */}
              <div className="tour-mb-tabs-bar">
                <div className="tour-mb-tabs">
                  {[
                    { id: "all", label: `Tất cả (${bookings.length})` },
                    { id: "pending", label: `Chờ thanh toán (${countPending})` },
                    { id: "paid", label: `Đã xác nhận (${countPaid})` },
                    { id: "expired", label: `Hết hạn / Hủy (${countExpired})` },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={`tour-mb-tab ${
                        activeTab === tab.id ? "tour-mb-tab--active" : ""
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Danh sách thẻ đơn tour */}
              {filteredBookings.length === 0 ? (
                <div className="tour-mb-empty">
                  <h3 className="tour-mb-empty-title">Không tìm thấy đơn đặt tour nào</h3>
                  <p className="tour-mb-empty-desc">
                    {activeTab === "all"
                      ? "Bạn chưa có đơn đặt tour nào. Khám phá các hành trình trọn gói được thiết kế riêng bởi Voyage."
                      : "Không có đơn tour nào ở trạng thái này."}
                  </p>
                  <Link to="/tour" className="tour-mb-btn-primary">
                    Khám phá tour du lịch →
                  </Link>
                </div>
              ) : (
                <div className="tour-mb-list">
                  {filteredBookings.map((b) => {
                    const isExpired = b.is_hold_expired || b.status === "EXPIRED";
                    const isPaid = b.status === "PAID" || b.payment_status === "SUCCESS";
                    const isPending = b.status === "PENDING_PAYMENT" && !isExpired;
                    const isCancelled = b.status?.startsWith("CANCELLED");
                    const bookingCode = b.code || `TX-#${b.id}`;

                    return (
                      <article key={b.id} className="tour-mb-card">
                        {/* Ảnh bìa bên trái */}
                        <div className="tour-mb-card__cover">
                          {b.tour_cover_url ? (
                            <img
                              src={b.tour_cover_url}
                              alt={b.tour_name || "Tour"}
                              className="tour-mb-card__img"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="tour-mb-card__no-img">Voyage Tour</div>
                          )}
                        </div>

                        {/* Nội dung bên phải */}
                        <div className="tour-mb-card__content">
                          {/* Hàng trên: Mã đơn + Ngày tạo + Trạng thái */}
                          <div className="tour-mb-card__top">
                            <div className="tour-mb-card__meta-left">
                              <span className="tour-mb-card__code">{bookingCode}</span>
                              <span className="tour-mb-card__date">
                                {b.created_at
                                  ? new Date(b.created_at).toLocaleDateString("vi-VN", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric",
                                    })
                                  : ""}
                              </span>
                            </div>

                            <div className="tour-mb-card__status-wrap">
                              {isPending && (
                                <>
                                  <BookingCountdown
                                    holdExpiresAt={b.hold_expires_at}
                                    onExpired={fetchBookings}
                                  />
                                  <span className="tour-mb-badge tour-mb-badge--pending">
                                    <span className="tour-mb-badge__dot" />
                                    Chờ thanh toán
                                  </span>
                                </>
                              )}
                              {isPaid && (
                                <span className="tour-mb-badge tour-mb-badge--paid">
                                  <span className="tour-mb-badge__dot" />
                                  Đã xác nhận & Thanh toán
                                </span>
                              )}
                              {isExpired && (
                                <span className="tour-mb-badge tour-mb-badge--expired">
                                  Hết hạn giữ chỗ
                                </span>
                              )}
                              {isCancelled && (
                                <span className="tour-mb-badge tour-mb-badge--cancelled">
                                  Đã hủy
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Tiêu đề tour */}
                          <h3 className="tour-mb-card__title">
                            <Link to={`/tour/${b.tour_slug || ""}`}>
                              {b.tour_name || `Tour #${b.tour_id}`}
                            </Link>
                          </h3>

                          {/* Thông tin chuyến đi */}
                          <div className="tour-mb-card__details">
                            <span>
                              Khởi hành: <strong>{b.depart_date ? new Date(b.depart_date).toLocaleDateString("vi-VN") : "Theo thỏa thuận"}</strong>
                            </span>
                            <span className="tour-mb-card__sep">•</span>
                            <span>
                              Hành khách: <strong>{b.guests || 1} người</strong>
                            </span>
                            {b.note && (
                              <>
                                <span className="tour-mb-card__sep">•</span>
                                <span className="tour-mb-card__note">Ghi chú: {b.note}</span>
                              </>
                            )}
                          </div>

                          {/* Hàng dưới: Giá tiền & Hành động */}
                          <div className="tour-mb-card__bottom">
                            <div className="tour-mb-card__price-wrap">
                              <span className="tour-mb-card__price-label">Tổng tiền:</span>
                              <span className="tour-mb-card__price-val">
                                {(b.total_price || 0).toLocaleString("vi-VN")} ₫
                              </span>
                              {b.savings > 0 && (
                                <span className="tour-mb-card__savings">
                                  (Tiết kiệm {b.savings.toLocaleString("vi-VN")} ₫)
                                </span>
                              )}
                            </div>

                            <div className="tour-mb-card__actions">
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    className="tour-mb-btn-primary"
                                    onClick={() => handleStripeCheckout(b.id)}
                                    disabled={stripePayingBookingId === b.id || payingBookingId === b.id}
                                  >
                                    {stripePayingBookingId === b.id ? "Đang xử lý..." : "Thanh toán Stripe"}
                                  </button>

                                  {b.payment_txn_ref ? (
                                    <button
                                      type="button"
                                      className="tour-mb-btn-secondary"
                                      onClick={() => setInstructionBooking(b)}
                                    >
                                      Chuyển khoản VietQR
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="tour-mb-btn-secondary"
                                      onClick={() => handleCreatePayment(b.id)}
                                      disabled={payingBookingId === b.id || stripePayingBookingId === b.id}
                                    >
                                      {payingBookingId === b.id ? "Đang tạo..." : "Chuyển khoản VietQR"}
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    className="tour-mb-btn-ghost"
                                    onClick={() => handleCancelBooking(b.id)}
                                    disabled={cancellingBookingId === b.id}
                                  >
                                    {cancellingBookingId === b.id ? "Đang hủy..." : "Hủy đơn"}
                                  </button>
                                </>
                              )}

                              {isPaid && (
                                <>
                                  <Link to={`/tour/${b.tour_slug || ""}`} className="tour-mb-btn-secondary">
                                    Xem chi tiết
                                  </Link>
                                  <button
                                    type="button"
                                    className="tour-mb-btn-ghost"
                                    onClick={() => handleCancelBooking(b.id)}
                                    disabled={cancellingBookingId === b.id}
                                  >
                                    {cancellingBookingId === b.id ? "Đang hủy..." : "Hủy đơn"}
                                  </button>
                                </>
                              )}

                              {isExpired && (
                                <Link to={`/tour/${b.tour_slug || ""}`} className="tour-mb-btn-secondary">
                                  Đặt lại tour
                                </Link>
                              )}

                              {isCancelled && (
                                <Link to={`/tour/${b.tour_slug || ""}`} className="tour-mb-btn-secondary">
                                  Đặt tour mới
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

        {/* Modal Hướng dẫn Chuyển khoản (An toàn, Không fake bank, Không fake QR) */}
        {instructionBooking && (
          <div
            className="tour-booking-wizard__backdrop"
            onClick={(e) => e.target === e.currentTarget && setInstructionBooking(null)}
            role="dialog"
            aria-modal="true"
          >
            <div className="tour-booking-wizard tour-my-bookings__modal">
              <header className="tour-booking-wizard__header">
                <div className="tour-booking-wizard__header-main">
                  <span className="material-symbols-outlined tour-booking-wizard__header-icon">
                    account_balance
                  </span>
                  <div className="tour-booking-wizard__header-text">
                    <h3 className="tour-booking-wizard__title">Hướng dẫn chuyển khoản</h3>
                    <p className="tour-booking-wizard__tour-name">
                      Đơn {instructionBooking.code || `TX-#${instructionBooking.id}`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="tour-booking-wizard__close-btn"
                  onClick={() => setInstructionBooking(null)}
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </header>

              <div className="tour-booking-wizard__body">
                <div className="tour-booking-wizard__countdown-card">
                  <div className="tour-booking-wizard__countdown-label">
                    <span className="material-symbols-outlined">schedule</span>
                    <span>Hạn giữ chỗ 30 phút:</span>
                  </div>
                  <div className="tour-booking-wizard__countdown-hint">
                    Vui lòng hoàn tất chuyển khoản trước khi đơn hết hạn giữ chỗ.
                  </div>
                </div>

                <div className="tour-booking-wizard__payment-box">
                  <div className="tour-booking-wizard__payment-details">
                    <div className="tour-booking-wizard__pay-row">
                      <span className="tour-booking-wizard__pay-label">Mã đơn đặt tour:</span>
                      <div className="tour-booking-wizard__pay-val-wrap">
                        <b className="tour-booking-wizard__pay-code">
                          {instructionBooking.code || `TX-#${instructionBooking.id}`}
                        </b>
                        <button
                          type="button"
                          className="tour-booking-wizard__copy-btn"
                          onClick={() =>
                            handleCopy(
                              instructionBooking.code || `TX-#${instructionBooking.id}`,
                              "modal-code"
                            )
                          }
                        >
                          {copiedKey === "modal-code" ? "Đã chép" : "Sao chép"}
                        </button>
                      </div>
                    </div>

                    {instructionBooking.payment_txn_ref && (
                      <div className="tour-booking-wizard__pay-row tour-booking-wizard__pay-row--highlight">
                        <span className="tour-booking-wizard__pay-label">Mã giao dịch:</span>
                        <div className="tour-booking-wizard__pay-val-wrap">
                          <b className="tour-booking-wizard__pay-code text-primary font-mono">
                            {instructionBooking.payment_txn_ref}
                          </b>
                          <button
                            type="button"
                            className="tour-booking-wizard__copy-btn"
                            onClick={() =>
                              handleCopy(instructionBooking.payment_txn_ref, "modal-pm")
                            }
                          >
                            {copiedKey === "modal-pm" ? "Đã chép" : "Sao chép"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="tour-booking-wizard__pay-row">
                      <span className="tour-booking-wizard__pay-label">Số tiền cần chuyển:</span>
                      <div className="tour-booking-wizard__pay-val-wrap">
                        <b className="tour-booking-wizard__pay-amount">
                          {(
                            instructionBooking.payment_amount || instructionBooking.total_price
                          ).toLocaleString("vi-VN")}
                          ₫
                        </b>
                        <button
                          type="button"
                          className="tour-booking-wizard__copy-btn"
                          onClick={() =>
                            handleCopy(
                              String(
                                instructionBooking.payment_amount || instructionBooking.total_price
                              ),
                              "modal-amount"
                            )
                          }
                        >
                          {copiedKey === "modal-amount" ? "Đã chép" : "Sao chép"}
                        </button>
                      </div>
                    </div>

                    {/* Hiển thị ngân hàng nếu có cấu hình thật từ env, nếu không thì hiển thị hướng dẫn an toàn */}
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
                              onClick={() => handleCopy(BANK_ACCOUNT_NO, "modal-acc")}
                            >
                              {copiedKey === "modal-acc" ? "Đã chép" : "Sao chép"}
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
                          <b>
                            {instructionBooking.payment_txn_ref ||
                              instructionBooking.code ||
                              `TX-#${instructionBooking.id}`}
                          </b>{" "}
                          và chờ xác nhận.
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
                          {instructionBooking.payment_txn_ref ||
                            instructionBooking.code ||
                            `TX-#${instructionBooking.id}`}
                        </code>
                        <button
                          type="button"
                          className="tour-booking-wizard__copy-btn"
                          onClick={() =>
                            handleCopy(
                              instructionBooking.payment_txn_ref ||
                                instructionBooking.code ||
                                `TX-#${instructionBooking.id}`,
                              "modal-content"
                            )
                          }
                        >
                          {copiedKey === "modal-content" ? "Đã chép" : "Sao chép"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <footer className="tour-booking-wizard__footer">
                <button
                  type="button"
                  className="tour-booking-wizard__btn-secondary"
                  onClick={() => setInstructionBooking(null)}
                >
                  Đóng
                </button>
              </footer>
            </div>
          </div>
        )}
      </div>
    </main>
  </div>
);
}
