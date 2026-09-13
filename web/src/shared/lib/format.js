/** Định dạng dùng chung cho khu nhà điều hành. */

export function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function date(value) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}
