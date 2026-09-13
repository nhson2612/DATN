/** Bảng mốc hoàn tiền mặc định khi khách huỷ, lấy từ tài liệu nghiệp vụ (BR-C).
 *  Mỗi tour sửa lại được. Tách riêng để file component chỉ xuất component. */
export const MOC_MAC_DINH = [
  { days_before: 15, refund_percent: 90 },
  { days_before: 8, refund_percent: 70 },
  { days_before: 4, refund_percent: 50 },
  { days_before: 1, refund_percent: 0 },
  { days_before: 0, refund_percent: 0 },
];
