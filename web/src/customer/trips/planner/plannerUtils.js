/**
 * Accent đỏ dùng chung cho MỌI ngày trong hành trình.
 *
 * Trước đây chỗ này là một "bảng màu theo ngày" gồm 7 phần tử giống hệt nhau,
 * còn TripMap giữ thêm một bản sao của cùng mảng đó — hai nguồn sự thật cho một
 * màu duy nhất. Nay chỉ còn hằng số này, mọi nơi import từ đây.
 */
export const MAU_NGAY = "#f15b4a";

/**
 * Ghép chuỗi thông tin phụ của địa điểm (loại hình, địa chỉ, mô tả tóm tắt)
 */
export function dongPhu(s) {
  if (!s) return "";
  return [s.dia_chi || s.mo_ta]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Định dạng nhãn hiển thị ngày theo thứ và ngày/tháng
 */
export function nhanNgay(startDate, day) {
  const THU = ["Chủ nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  if (!startDate) return `Ngày ${day}`;
  const d = new Date(startDate);
  d.setDate(d.getDate() + day - 1);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${THU[d.getDay()]}, ${dd}/${mm}`;
}

/**
 * Kiểm tra 2 đối tượng địa điểm có cùng loại và ID không
 */
export function cungDiem(a, b) {
  if (!a || !b) return false;
  return a.type === b.type && String(a.id) === String(b.id);
}

/**
 * Tính khoảng cách chim bay (km) giữa 2 tọa độ theo công thức Haversine
 */
export function tinhKhoangCachKm(a, b) {
  if (!a || !b || a.lat == null || a.lon == null || b.lat == null || b.lon == null) return null;
  const lat1 = Number(a.lat);
  const lon1 = Number(a.lon);
  const lat2 = Number(b.lat);
  const lon2 = Number(b.lon);
  if (Number.isNaN(lat1) || Number.isNaN(lon1) || Number.isNaN(lat2) || Number.isNaN(lon2)) return null;

  const R = 6371; // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const radLat1 = (lat1 * Math.PI) / 180;
  const radLat2 = (lat2 * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(radLat1) * Math.cos(radLat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(R * c * 10) / 10;
}

/**
 * Ước tính thời gian di chuyển bằng xe từ khoảng cách km
 */
export function uocTinhThoiGian(km) {
  if (km == null || km <= 0) return null;
  const phut = Math.max(5, Math.round(km * 3.5));
  if (phut < 60) return `~${phut} phút`;
  const h = Math.floor(phut / 60);
  const m = phut % 60;
  return m > 0 ? `~${h}h ${m}p` : `~${h} giờ`;
}

/**
 * Định dạng khoảng ngày bắt đầu - kết thúc chuyến đi (như 9/11 - 9/14 trong Wanderlog)
 */
export function dinhDangKhoangNgay(startDate, durationDays) {
  if (!startDate) return `${durationDays || 1} ngày`;
  const start = new Date(startDate);
  const end = new Date(startDate);
  end.setDate(end.getDate() + Math.max(0, (durationDays || 1) - 1));
  const sDay = String(start.getDate()).padStart(2, "0");
  const sMon = String(start.getMonth() + 1).padStart(2, "0");
  const eDay = String(end.getDate()).padStart(2, "0");
  const eMon = String(end.getMonth() + 1).padStart(2, "0");
  return `${sDay}/${sMon} - ${eDay}/${eMon}`;
}

