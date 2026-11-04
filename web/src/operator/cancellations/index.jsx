import { useState } from "react";

import { api } from "../../shared/api";
import { date } from "../../shared/lib/format";
import Toast from "../common/Toast";
import DeparturePicker from "../departures/components/DeparturePicker";
import DepartureTable from "../departures/components/DepartureTable";
import useDepartures from "../departures/hooks/useDepartures";

/**
 * Màn "Huỷ đợt": Đóng một đợt khởi hành và hủy các đơn còn hiệu lực của đợt đó.
 * Tuân thủ quy tắc BR-C5: Nhà điều hành hủy đợt -> hoàn tiền 100% cho khách hàng.
 */
export default function CancellationsScreen() {
  const { tours, tourId, setTourId, departures, reload } = useDepartures();

  const [cancelingDep, setCancelingDep] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const handleOpenCancelModal = (departure) => {
    setCancelingDep(departure);
    setCancelReason("Không đủ số khách tối thiểu để chạy tour");
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelingDep) return;

    try {
      setSubmitting(true);
      const result = await api.cancelOperatorDeparture(cancelingDep.id, cancelReason || "Nhà điều hành huỷ đợt");
      setCancelingDep(null);
      const autoRefunded = result.stripe_refunded_payment_ids?.length || 0;
      const manualRefunds = result.manual_refund_payment_ids?.length || 0;
      const failedRefunds = result.stripe_refund_failed?.length || 0;
      setToast({
        message: `Đã hủy đợt khởi hành ngày ${date(cancelingDep.depart_date)}. Stripe đã hoàn ${autoRefunded} giao dịch; ${manualRefunds + failedRefunds} giao dịch cần xử lý.`,
        type: failedRefunds ? "error" : "success",
      });
      reload();
    } catch (err) {
      setToast({ message: err.message || "Không thể hủy đợt khởi hành.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Toast thông báo */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header khu vực */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
        <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
          Huỷ đợt khởi hành
        </h1>
        <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
          Đóng chuyến đi và kích hoạt quy trình hoàn tiền 100% cho khách hàng khi không đủ điều kiện khởi hành
        </p>
      </div>

      {/* Bộ chọn Tour */}
      <DeparturePicker tours={tours} tourId={tourId} onChange={setTourId} />

      {/* Bảng danh sách đợt để chọn hủy */}
      <DepartureTable
        departures={departures}
        renderActions={(departure) => {
          const isCancelled = departure.status === "CANCELLED";
          return (
            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
              <button
                type="button"
                disabled={isCancelled}
                onClick={() => handleOpenCancelModal(departure)}
                title={isCancelled ? "Đợt này đã bị huỷ" : "Huỷ đợt khởi hành này"}
                aria-label={isCancelled ? "Đã huỷ" : "Huỷ đợt"}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  border: isCancelled ? "1px solid #e2e8f0" : "1px solid #fee2e2",
                  background: isCancelled ? "#f8fafc" : "#fff1f2",
                  color: isCancelled ? "#94a3b8" : "#dc2626",
                  cursor: isCancelled ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                  {isCancelled ? "check_circle" : "event_busy"}
                </span>
              </button>
            </div>
          );
        }}
      />

      {/* Modal xác nhận huỷ đợt */}
      {cancelingDep && (
        <div className="fade-in op-cancellations__div-15">
          <div className="op-cancellations__div-16 op-cancellations__div-4">
            <div className="op-cancellations__div-17">
              <div className="op-cancellations__div-18 op-cancellations__div-5">
                <span className="material-symbols-outlined op-cancellations__span-19">warning</span>
              </div>
              <div>
                <h3 className="op-cancellations__text-20">Xác nhận huỷ đợt khởi hành?</h3>
                <p className="op-cancellations__text-21">
                  Ngày khởi hành: <strong>{date(cancelingDep.depart_date)}</strong>
                </p>
              </div>
            </div>

            <div className="op-cancellations__div-22 op-cancellations__div-6">
              <p className="op-cancellations__text-23">
                <span className="material-symbols-outlined op-cancellations__span-24">info</span>
                Cảnh báo huỷ đợt:
              </p>
              <p>
                Đợt này có <strong>{cancelingDep.sold_seats || 0} chỗ đã bán</strong>. Khi xác nhận, hệ thống sẽ chuyển toàn bộ đơn hàng sang trạng thái hủy và khởi tạo yêu cầu hoàn trả 100% tiền cho khách.
              </p>
            </div>

            <form onSubmit={handleConfirmCancel} className="op-cancellations__form-25">
              <div>
                <label className="op-cancellations__label-26">
                  Lý do huỷ đợt <span className="op-cancellations__span-27">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do huỷ chuyến..."
                  className="op-cancellations__element-28 op-cancellations__element-7"
                />
              </div>

              <div className="op-cancellations__div-29">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setCancelingDep(null)}
                  className="op-cancellations__button-30 op-cancellations__button-8"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="op-cancellations__button-31"
                >
                  <span className="material-symbols-outlined op-cancellations__span-32">event_busy</span>
                  {submitting ? "Đang huỷ..." : "Xác nhận huỷ đợt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
