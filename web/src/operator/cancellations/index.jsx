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
    <div className="space-y-6">
      {/* Toast thông báo */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header khu vực */}
      <div className="pb-5 border-b border-zinc-200">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
          Huỷ đợt khởi hành
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Đóng chuyến đi và kích hoạt quy trình hoàn tiền 100% cho khách hàng khi không đủ điều kiện khởi hành
        </p>
      </div>

      {/* Banner nghiệp vụ BR-C5 & BR-C7 */}
      <div className="bg-amber-50/75 border border-amber-200 rounded-lg p-4 text-xs text-amber-900 flex items-start gap-3">
        <span className="material-symbols-outlined text-xl text-amber-600 shrink-0 mt-0.5">
          gavel
        </span>
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Quy tắc nghiệp vụ huỷ đợt (BR-C5 &amp; BR-C7):</p>
          <ul className="list-disc list-inside space-y-0.5 text-amber-800">
            <li>
              <strong>BR-C5:</strong> Do lỗi từ phía nhà điều hành, khi hủy đợt toàn bộ đơn hàng liên quan sẽ được <strong>hoàn tiền 100%</strong> mà không áp bất kỳ khoản phí nào.
            </li>
            <li>
              <strong>BR-C7:</strong> Nếu hủy vì không đủ số khách tối thiểu (<code>min_pax</code>), nhà điều hành cần thông báo trước ngày khởi hành để khách chủ động lịch trình.
            </li>
          </ul>
        </div>
      </div>

      {/* Bộ chọn Tour */}
      <DeparturePicker tours={tours} tourId={tourId} onChange={setTourId} />

      {/* Bảng danh sách đợt để chọn hủy */}
      <DepartureTable
        departures={departures}
        renderActions={(departure) => {
          const isCancelled = departure.status === "CANCELLED";
          return (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isCancelled}
                onClick={() => handleOpenCancelModal(departure)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer shadow-2xs ${
                  isCancelled
                    ? "bg-zinc-100 text-zinc-400 border-zinc-200 cursor-not-allowed"
                    : "bg-white text-rose-600 border-rose-200 hover:bg-rose-50 hover:border-rose-300"
                }`}
              >
                <span className="material-symbols-outlined text-sm">
                  {isCancelled ? "check_circle" : "event_busy"}
                </span>
                {isCancelled ? "Đã huỷ" : "Huỷ đợt này"}
              </button>
            </div>
          );
        }}
      />

      {/* Modal xác nhận huỷ đợt */}
      {cancelingDep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 relative">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Xác nhận huỷ đợt khởi hành?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ngày khởi hành: <strong>{date(cancelingDep.depart_date)}</strong>
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/75 rounded-lg border border-rose-200 text-xs text-rose-900 space-y-1.5 mb-4 leading-relaxed">
              <p className="font-semibold flex items-center gap-1 text-rose-700">
                <span className="material-symbols-outlined text-sm">info</span>
                Cảnh báo huỷ đợt:
              </p>
              <p>
                Đợt này có <strong>{cancelingDep.sold_seats || 0} chỗ đã bán</strong>. Khi xác nhận, hệ thống sẽ chuyển toàn bộ đơn hàng sang trạng thái hủy và khởi tạo yêu cầu hoàn trả 100% tiền cho khách.
              </p>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Lý do huỷ đợt <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do huỷ chuyến..."
                  className="w-full bg-white border border-zinc-200 rounded-md p-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setCancelingDep(null)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer shadow-xs disabled:opacity-60 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">event_busy</span>
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
