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
              {booking.status === "PAID" && <button onClick={() => confirm(booking.id)}>Xác nhận</button>}
              {booking.status === "CONFIRMED" && <>
                <button onClick={() => setOperationalStatus(booking.id, "COMPLETED")}>Đã hoàn thành</button>
                <button onClick={() => setOperationalStatus(booking.id, "NO_SHOW")}>Vắng mặt</button>
              </>}
            </td>
          </tr>
        ))}
      </DataTable>
    </section>
  );
}
