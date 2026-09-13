/** Nhãn trạng thái, hiện bằng chữ người dùng đọc được thay vì mã trạng thái. */
const NHAN = {
  DRAFT: "Bản nháp",
  PENDING_APPROVAL: "Chờ duyệt",
  ACTIVE: "Đang bán",
  REJECTED: "Bị từ chối",
  INACTIVE: "Ngừng bán",
  OPEN: "Đang mở",
  FULL: "Hết chỗ",
  CLOSED: "Đã khoá",
  DEPARTED: "Đã khởi hành",
  COMPLETED: "Đã kết thúc",
  CANCELLED: "Đã huỷ",
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  PARTIALLY_PAID: "Đã đặt cọc",
  CONFIRMED: "Đã xác nhận",
  EXPIRED: "Hết hạn giữ chỗ",
  CANCELLED_BY_CUSTOMER: "Khách huỷ",
  CANCELLED_BY_OPERATOR: "Nhà điều hành huỷ",
  REFUNDED: "Đã hoàn tiền",
  NO_SHOW: "Khách không có mặt",
  SUCCESS: "Thành công",
  FAILED: "Thất bại",
  MISMATCH: "Lệch tiền",
};

export default function StatusTag({ value }) {
  const text = NHAN[value] || value;

  let colorClasses = "bg-zinc-100 text-zinc-700 border-zinc-200";
  let dotClass = "bg-zinc-500";

  if (["ACTIVE", "APPROVED", "PAID", "CONFIRMED", "SUCCESS"].includes(value)) {
    colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
    dotClass = "bg-emerald-600";
  } else if (["PENDING_APPROVAL", "PENDING_PAYMENT", "OPEN", "PARTIALLY_PAID"].includes(value)) {
    colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
    dotClass = "bg-blue-600";
  } else if (
    [
      "REJECTED",
      "CANCELLED",
      "CANCELLED_BY_CUSTOMER",
      "CANCELLED_BY_OPERATOR",
      "FAILED",
      "EXPIRED",
    ].includes(value)
  ) {
    colorClasses = "bg-rose-50 text-rose-700 border-rose-200";
    dotClass = "bg-rose-600";
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClasses}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
      <span>{text}</span>
    </span>
  );
}
