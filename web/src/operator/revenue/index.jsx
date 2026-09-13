import { useEffect, useState } from "react";

import { api } from "../../shared/api";
import DataTable from "../common/DataTable";
import Notice from "../common/Notice";
import SectionHeader from "../common/SectionHeader";
import StatBox from "../common/StatBox";
import { money } from "../../shared/lib/format";

/** Màn "Doanh thu": tiền đã thu của nhà điều hành này, tách theo tháng. */
export default function RevenueScreen() {
  const [revenue, setRevenue] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api
      .operatorRevenue()
      .then(setRevenue)
      .catch((error) => setMessage(error.message));
  }, []);

  const summary = revenue?.summary || {};
  const months = revenue?.months || [];

  return (
    <section>
      <SectionHeader title="Doanh thu" />
      <Notice>{message}</Notice>

      {revenue && (
        <>
          <div className="op-stats">
            <StatBox label="Đã thu" value={money(summary.gross_revenue)} />
            <StatBox label="Đơn đã thanh toán" value={summary.paid_bookings || 0} />
            <StatBox label="Đơn đã xác nhận" value={summary.confirmed_bookings || 0} />
          </div>

          <DataTable heads={["Tháng", "Doanh thu", "Đơn đã thu"]}>
            {months.map((month) => (
              <tr key={month.month}>
                <td>{month.month}</td>
                <td>{money(month.revenue)}</td>
                <td>{month.bookings}</td>
              </tr>
            ))}
          </DataTable>
        </>
      )}
    </section>
  );
}
