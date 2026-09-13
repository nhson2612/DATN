import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../../shared/api";
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
    return <span className="tour-my-bookings__time-expired">Đã hết hạn</span>;
  }

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const timeStr = `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;

  return (
    <span className={`tour-my-bookings__time-remain ${seconds <= 300 ? "tour-my-bookings__time-remain--urgent" : ""}`}>
      <span className="material-symbols-outlined">timer</span>
      Còn lại: {timeStr}
    </span>
  );
}

export default function TourMyBookings({ user, onNeedAuth }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // all | pending | paid | expired
  const [payingBookingId, setPayingBookingId] = useState(null);
  const [stripePayingBookingId, setStripePayingBookingId] = useState(null);
  const [instructionBooking, setInstructionBooking] = useState(null);
  const [copiedKey, setCopiedKey] = useState("");

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

  // Xử lý khi trang được điều hướng về từ Stripe Checkout (Phase 3.3)
  useEffect(() => {
    const checkoutParam = searchParams.get("checkout");
    if (!checkoutParam) return;

    const bookingIdParam = searchParams.get("booking_id");
    const sessionIdParam = searchParams.get("session_id");

    // Xóa ngay query param để tránh bị lặp lại khi người dùng F5 / reload
    setSearchParams({}, { replace: true });

    // Trường hợp 1: Người dùng hủy thanh toán trên cổng Stripe
    if (checkoutParam === "cancelled") {
      setCheckoutNotice({
        type: "cancelled",
        bookingId: bookingIdParam ? Number(bookingIdParam) : null,
        message: "Quý khách đã huỷ thanh toán. Chỗ vẫn được giữ đến hết thời hạn.",
      });
      return;
    }

    // Trường hợp 2: Khách hoàn tất thanh toán trên Stripe thành công -> Bắt đầu poll
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

  // Xử lý thanh toán thẻ qua Stripe từ trang đơn của tôi
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
          message: "Không nhận được liên kết thanh toán từ cổng Stripe.",
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

  return (
    <main className="tour-my-bookings">
      <div className="tour-my-bookings__container">
        {/* Header trang */}
        <div className="tour-my-bookings__header">
          <div className="tour-my-bookings__header-titles">
            <h1 className="tour-my-bookings__title">Đơn tour của tôi</h1>
            <p className="tour-my-bookings__subtitle">
              Quản lý danh sách các chuyến đi đã đặt, hạn giữ chỗ và trạng thái thanh toán.
            </p>
          </div>
          {user && (
            <button
              type="button"
              className="tour-my-bookings__btn-refresh"
              onClick={fetchBookings}
              disabled={loading}
              title="Làm mới danh sách"
            >
              <span className={`material-symbols-outlined ${loading ? "tour-my-bookings__spin" : ""}`}>
                refresh
              </span>
              <span>Làm mới</span>
            </button>
          )}
        </div>

        {/* Banner thông báo Stripe Checkout */}
        {checkoutNotice && (
          <div
            className={`tour-my-bookings__notice tour-my-bookings__notice--${checkoutNotice.type}`}
            role="status"
          >
            <div className="tour-my-bookings__notice-content">
              {checkoutNotice.type === "verifying" && (
                <span className="tour-my-bookings__notice-spinner" />
              )}
              {checkoutNotice.type === "success" && (
                <span className="material-symbols-outlined">check_circle</span>
              )}
              {(checkoutNotice.type === "cancelled" || checkoutNotice.type === "info") && (
                <span className="material-symbols-outlined">info</span>
              )}
              {(checkoutNotice.type === "expired" || checkoutNotice.type === "error") && (
                <span className="material-symbols-outlined">warning</span>
              )}
              <span className="tour-my-bookings__notice-text">{checkoutNotice.message}</span>
            </div>
            <button
              type="button"
              className="tour-my-bookings__notice-close"
              onClick={() => setCheckoutNotice(null)}
              aria-label="Đóng thông báo"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        )}

        {/* Chưa đăng nhập */}
        {!user ? (
          <div className="tour-my-bookings__auth-prompt">
            <span className="material-symbols-outlined tour-my-bookings__auth-icon">
              account_circle
            </span>
            <h2 className="tour-my-bookings__auth-title">Vui lòng đăng nhập</h2>
            <p className="tour-my-bookings__auth-desc">
              Quý khách cần đăng nhập tài khoản để tra cứu và quản lý các đơn đặt tour đã tạo.
            </p>
            <button
              type="button"
              className="tour-my-bookings__btn-primary"
              onClick={onNeedAuth}
            >
              <span className="material-symbols-outlined">login</span>
              <span>Đăng nhập ngay</span>
            </button>
          </div>
        ) : loading ? (
          /* Trạng thái đang tải */
          <div className="tour-my-bookings__loading">
            <div className="tour-my-bookings__spinner" />
            <p>Đang tải danh sách đơn đặt tour...</p>
          </div>
        ) : error ? (
          /* Trạng thái lỗi */
          <div className="tour-my-bookings__error-box">
            <span className="material-symbols-outlined">error</span>
            <p>{error}</p>
            <button
              type="button"
              className="tour-my-bookings__btn-secondary"
              onClick={fetchBookings}
            >
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {/* Bộ lọc tab */}
            <div className="tour-my-bookings__tabs">
              <button
                type="button"
                className={`tour-my-bookings__tab ${
                  activeTab === "all" ? "tour-my-bookings__tab--active" : ""
                }`}
                onClick={() => setActiveTab("all")}
              >
                Tất cả ({bookings.length})
              </button>
              <button
                type="button"
                className={`tour-my-bookings__tab ${
                  activeTab === "pending" ? "tour-my-bookings__tab--active" : ""
                }`}
                onClick={() => setActiveTab("pending")}
              >
                Chờ thanh toán (
                {
                  bookings.filter(
                    (b) => b.status === "PENDING_PAYMENT" && !b.is_hold_expired && b.status !== "EXPIRED"
                  ).length
                }
                )
              </button>
              <button
                type="button"
                className={`tour-my-bookings__tab ${
                  activeTab === "paid" ? "tour-my-bookings__tab--active" : ""
                }`}
                onClick={() => setActiveTab("paid")}
              >
                Đã thanh toán (
                {
                  bookings.filter(
                    (b) => b.status === "PAID" || b.payment_status === "SUCCESS"
                  ).length
                }
                )
              </button>
              <button
                type="button"
                className={`tour-my-bookings__tab ${
                  activeTab === "expired" ? "tour-my-bookings__tab--active" : ""
                }`}
                onClick={() => setActiveTab("expired")}
              >
                Hết hạn / Đã hủy (
                {
                  bookings.filter(
                    (b) => b.is_hold_expired || b.status === "EXPIRED" || b.status?.startsWith("CANCELLED")
                  ).length
                }
                )
              </button>
            </div>

            {/* Danh sách thẻ đơn tour */}
            {filteredBookings.length === 0 ? (
              <div className="tour-my-bookings__empty">
                <span className="material-symbols-outlined tour-my-bookings__empty-icon">
                  receipt_long
                </span>
                <h3 className="tour-my-bookings__empty-title">Không có đơn đặt tour nào</h3>
                <p className="tour-my-bookings__empty-desc">
                  Quý khách chưa có đơn đặt tour nào trong mục này.
                </p>
                <Link to="/tour" className="tour-my-bookings__btn-primary">
                  <span className="material-symbols-outlined">travel_explore</span>
                  <span>Khám phá các tour ngay</span>
                </Link>
              </div>
            ) : (
              <div className="tour-my-bookings__list">
                {filteredBookings.map((b) => {
                  const isExpired = b.is_hold_expired || b.status === "EXPIRED";
                  const isPaid = b.status === "PAID" || b.payment_status === "SUCCESS";
                  const isPending = b.status === "PENDING_PAYMENT" && !isExpired;
                  const isCancelled = b.status?.startsWith("CANCELLED");

                  return (
                    <div key={b.id} className="tour-booking-card">
                      {/* Header thẻ */}
                      <div className="tour-booking-card__header">
                        <div className="tour-booking-card__meta">
                          <span className="tour-booking-card__code">
                            {b.code || `TX-#${b.id}`}
                          </span>
                          <span className="tour-booking-card__created-at">
                            Đặt lúc:{" "}
                            {b.created_at
                              ? new Date(b.created_at).toLocaleDateString("vi-VN", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "N/A"}
                          </span>
                        </div>

                        {/* Badge trạng thái */}
                        <div className="tour-booking-card__badge-wrap">
                          {isPaid && (
                            <span className="tour-booking-card__badge tour-booking-card__badge--paid">
                              <span className="material-symbols-outlined">check_circle</span>
                              Đã thanh toán
                            </span>
                          )}
                          {isPending && (
                            <span className="tour-booking-card__badge tour-booking-card__badge--pending">
                              <span className="material-symbols-outlined">schedule</span>
                              Chờ chuyển khoản
                            </span>
                          )}
                          {isExpired && (
                            <span className="tour-booking-card__badge tour-booking-card__badge--expired">
                              <span className="material-symbols-outlined">timer_off</span>
                              Hết hạn giữ chỗ
                            </span>
                          )}
                          {isCancelled && (
                            <span className="tour-booking-card__badge tour-booking-card__badge--cancelled">
                              <span className="material-symbols-outlined">cancel</span>
                              Đã hủy
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Body thẻ */}
                      <div className="tour-booking-card__body">
                        {b.tour_cover_url && (
                          <div className="tour-booking-card__thumb">
                            <img
                              src={b.tour_cover_url}
                              alt={b.tour_name || "Tour"}
                              className="tour-booking-card__thumb-img"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          </div>
                        )}

                        <div className="tour-booking-card__info">
                          <h3 className="tour-booking-card__tour-title">
                            <Link
                              to={`/tour/${b.tour_slug || ""}`}
                              className="tour-booking-card__tour-link"
                            >
                              {b.tour_name || `Tour #${b.tour_id}`}
                            </Link>
                          </h3>

                          <div className="tour-booking-card__specs">
                            <div className="tour-booking-card__spec-item">
                              <span className="material-symbols-outlined">calendar_today</span>
                              <span>
                                Khởi hành:{" "}
                                <b>
                                  {b.depart_date
                                    ? new Date(b.depart_date).toLocaleDateString("vi-VN")
                                    : "Theo thỏa thuận"}
                                </b>
                              </span>
                            </div>

                            <div className="tour-booking-card__spec-item">
                              <span className="material-symbols-outlined">group</span>
                              <span>
                                Số khách: <b>{b.guests || 1} khách</b>
                              </span>
                            </div>

                            {b.note && (
                              <div className="tour-booking-card__spec-item tour-booking-card__spec-item--note">
                                <span className="material-symbols-outlined">notes</span>
                                <span>Ghi chú: {b.note}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="tour-booking-card__pricing">
                          <span className="tour-booking-card__price-label">Tổng chi phí:</span>
                          <span className="tour-booking-card__price-val">
                            {(b.total_price || 0).toLocaleString("vi-VN")}₫
                          </span>
                          {b.savings > 0 && (
                            <span className="tour-booking-card__price-savings">
                              Tiết kiệm: {b.savings.toLocaleString("vi-VN")}₫
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Footer thẻ: Thanh toán & Hành động */}
                      <div className="tour-booking-card__footer">
                        {/* 1. Đơn PENDING còn hạn */}
                        {isPending && (
                          <div className="tour-booking-card__action-row">
                            <div className="tour-booking-card__timer-wrap">
                              <BookingCountdown
                                holdExpiresAt={b.hold_expires_at}
                                onExpired={fetchBookings}
                              />
                            </div>

                            <div className="tour-booking-card__action-btns">
                              {/* Nút thanh toán thẻ qua cổng Stripe */}
                              <button
                                type="button"
                                className="tour-booking-card__btn-stripe"
                                onClick={() => handleStripeCheckout(b.id)}
                                disabled={stripePayingBookingId === b.id || payingBookingId === b.id}
                              >
                                {stripePayingBookingId === b.id ? (
                                  <span className="tour-my-bookings__spin-inline" />
                                ) : (
                                  <span className="material-symbols-outlined">credit_card</span>
                                )}
                                <span>Thanh toán bằng thẻ</span>
                              </button>

                              {b.payment_txn_ref ? (
                                <button
                                  type="button"
                                  className="tour-booking-card__btn-pay-info"
                                  onClick={() => setInstructionBooking(b)}
                                >
                                  <span className="material-symbols-outlined">payments</span>
                                  <span>Xem thông tin chuyển khoản ({b.payment_txn_ref})</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="tour-booking-card__btn-create-pay"
                                  onClick={() => handleCreatePayment(b.id)}
                                  disabled={payingBookingId === b.id || stripePayingBookingId === b.id}
                                >
                                  {payingBookingId === b.id ? (
                                    <span className="tour-my-bookings__spin-inline" />
                                  ) : (
                                    <span className="material-symbols-outlined">add_card</span>
                                  )}
                                  <span>Tạo thông tin chuyển khoản</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 2. Đơn Hết hạn */}
                        {isExpired && (
                          <div className="tour-booking-card__expired-row">
                            <div className="tour-booking-card__expired-notice">
                              <span className="material-symbols-outlined">info</span>
                              <span>
                                Chỗ giữ đã hết hạn (sau 30 phút) và đã được hoàn trả về hệ thống. Đơn này không thể thanh toán.
                              </span>
                            </div>
                            <Link
                              to={`/tour/${b.tour_slug || ""}`}
                              className="tour-booking-card__btn-rebook"
                            >
                              <span className="material-symbols-outlined">refresh</span>
                              <span>Đặt lại tour</span>
                            </Link>
                          </div>
                        )}

                        {/* 3. Đơn Đã thanh toán */}
                        {isPaid && (
                          <div className="tour-booking-card__paid-row">
                            <span className="material-symbols-outlined">verified</span>
                            <span>
                              Thanh toán thành công {b.payment_txn_ref ? `(Mã: ${b.payment_txn_ref})` : ""}. Bộ phận chăm sóc khách hàng sẽ liên hệ trước ngày khởi hành.
                            </span>
                          </div>
                        )}

                        {/* 4. Đơn Đã hủy */}
                        {isCancelled && (
                          <div className="tour-booking-card__cancelled-row">
                            <span className="material-symbols-outlined">block</span>
                            <span>Đơn đặt tour này đã bị hủy.</span>
                          </div>
                        )}
                      </div>
                    </div>
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
  );
}
