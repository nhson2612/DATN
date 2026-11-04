import { useCallback, useEffect, useState } from "react";

import { api } from "../../shared/api";
import DataTable from "../common/DataTable";
import Notice from "../common/Notice";
import SectionHeader from "../common/SectionHeader";
import StatusTag from "../common/StatusTag";
import { date, money } from "../../shared/lib/format";

/** Màn "Đơn đặt tour": đơn thuộc các tour của nhà điều hành này. */
export default function BookingsScreen() {
  const [bookings, setBookings] = useState([]);
  const [message, setMessage] = useState("");

  const loadBookings = useCallback(() => {
    api
      .operatorBookings({ page_size: 100 })
      .then((data) => setBookings(data.bookings || []))
      .catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const confirm = async (bookingId) => {
    try {
      await api.confirmOperatorBooking(bookingId);
      loadBookings();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const setOperationalStatus = async (bookingId, status) => {
    try {
      await api.setOperatorBookingOperationalStatus(bookingId, status);
      loadBookings();
    } catch (error) {
      setMessage(error.message);
    }
  };

  return (
    <section>
      <SectionHeader title="Đơn đặt tour" />
      <Notice>{message}</Notice>

      <DataTable heads={["Mã đơn / khách", "Tour", "Khởi hành", "Tổng tiền", "Trạng thái", "Thao tác"]}>
        {bookings.map((booking) => (
          <tr key={booking.id}>
            <td>
              <b>{booking.code || `#${booking.id}`}</b>
              <small>
                {booking.full_name} · {booking.guests} khách
              </small>
            </td>
            <td>{booking.tour_name}</td>
            <td>{date(booking.depart_date)}</td>
            <td>{money(booking.total_price)}</td>
            <td>
              <StatusTag value={booking.status} />
            </td>
            <td>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {booking.status === "PAID" && (
                  <button
                    type="button"
                    onClick={() => confirm(booking.id)}
                    title="Xác nhận đơn đặt tour"
                    aria-label="Xác nhận"
                    style={{
                      width: "32px",
                      height: "32px",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "6px",
                      border: "none",
                      background: "#0f172a",
                      color: "#ffffff",
                      cursor: "pointer",
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>check</span>
                  </button>
                )}
                {booking.status === "CONFIRMED" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setOperationalStatus(booking.id, "COMPLETED")}
                      title="Đánh dấu đã hoàn thành"
                      aria-label="Đã hoàn thành"
                      style={{
                        width: "32px",
                        height: "32px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "6px",
                        border: "1px solid #e2e8f0",
                        background: "#ffffff",
                        color: "#16a34a",
                        cursor: "pointer",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>task_alt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setOperationalStatus(booking.id, "NO_SHOW")}
                      title="Đánh dấu khách vắng mặt (No-show)"
                      aria-label="Khách vắng mặt"
                      style={{
                        width: "32px",
                        height: "32px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "6px",
                        border: "1px solid #fee2e2",
                        background: "#fff1f2",
                        color: "#dc2626",
                        cursor: "pointer",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>person_off</span>
                    </button>
                  </>
                )}
              </div>
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
