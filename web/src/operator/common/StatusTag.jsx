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

  let tone = "neutral";

  if (["ACTIVE", "APPROVED", "PAID", "CONFIRMED", "SUCCESS"].includes(value)) {
    tone = "success";
  } else if (["PENDING_APPROVAL", "PENDING_PAYMENT", "OPEN", "PARTIALLY_PAID"].includes(value)) {
    tone = "info";
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
    tone = "danger";
  }

  return (
    <span
      className={`op-status-tag__span-1 op-status-tag--${tone}`}
    >
      <span className={`op-status-tag__span-2 op-status-tag__dot--${tone}`}></span>
      <span>{text}</span>
    </span>
  );
}
