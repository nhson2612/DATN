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

  const dotColors = {
    success: "#16a34a",
    info: "#2563eb",
    danger: "#dc2626",
    neutral: "#94a3b8",
  };

  const textColors = {
    success: "#16a34a",
    info: "#2563eb",
    danger: "#dc2626",
    neutral: "#64748b",
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "13px",
        fontWeight: "500",
        color: textColors[tone],
        background: "transparent",
        border: "none",
        padding: 0,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: dotColors[tone],
          flexShrink: 0,
        }}
      />
      <span>{text}</span>
    </span>
  );
}
