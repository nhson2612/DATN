/** Kiểm tra dữ liệu của từng bước trước khi cho đi tiếp.
 *  Trả về bản đồ: tên trường -> câu báo lỗi hiện ngay dưới ô nhập đó. */

const TOI_THIEU_TEN = 15;
const TOI_DA_MO_TA_NGAN = 250;

export function kiemTraBuoc(buoc, form) {
  const loi = {};

  if (buoc === "basic") {
    if (!form.name.trim()) loi.name = "Chưa nhập tên tour.";
    else if (form.name.trim().length < TOI_THIEU_TEN)
      loi.name = `Tên tour cần từ ${TOI_THIEU_TEN} ký tự để khách đọc ra được hành trình.`;

    if (!form.summary.trim()) loi.summary = "Chưa nhập mô tả ngắn.";
    else if (form.summary.length > TOI_DA_MO_TA_NGAN)
      loi.summary = `Mô tả ngắn tối đa ${TOI_DA_MO_TA_NGAN} ký tự.`;

    if (!form.province_id) loi.province_id = "Chưa chọn điểm đến chính.";
    if (!Number(form.duration_days)) loi.duration_days = "Chưa nhập số ngày của tour.";
    if (!form.departure_location.trim()) loi.departure_location = "Chưa nhập địa điểm khởi hành.";
    if (!form.transportation.length) loi.transportation = "Chưa chọn phương tiện di chuyển.";
    if (!form.tags.length) loi.tags = "Chưa gắn tag cho tour.";
  }

  if (buoc === "itinerary") {
    const soNgayTour = Number(form.duration_days) || 0;
    if (form.itinerary.length === 0) {
      loi.itinerary = "Chưa có ngày nào trong lịch trình.";
    } else if (soNgayTour > 0 && form.itinerary.length !== soNgayTour) {
      // BR-T1: lịch trình phải đúng bằng số ngày của tour.
      loi.itinerary = `Tour ${soNgayTour} ngày nên lịch trình phải có đúng ${soNgayTour} ngày, đang có ${form.itinerary.length} ngày.`;
    }
    form.itinerary.forEach((ngay, i) => {
      if (!ngay.title.trim()) loi[`ngay-${i}`] = "Chưa có tiêu đề.";
      else if ((ngay.places || []).length === 0) loi[`ngay-${i}`] = "Chưa gắn điểm đến nào.";
    });
  }

  if (buoc === "images") {
    if (!form.cover_url.trim()) loi.cover_url = "Chưa nhập ảnh bìa.";
  }

  if (buoc === "policy") {
    if (form.cancellation_policy.length === 0) loi.cancellation_policy = "Chưa có mốc hoàn tiền nào.";
  }

  // Bước xem lại kiểm tra hết những gì các bước trước yêu cầu.
  if (buoc === "review") {
    ["basic", "itinerary", "images", "policy"].forEach((b) => {
      Object.assign(loi, kiemTraBuoc(b, form));
    });
  }

  return loi;
}

/** Những gì còn thiếu để gửi duyệt (A1 của UC-T01), hiện ở bước xem lại. */
export function conThieuDeGuiDuyet(form) {
  const thieu = [];
  if (!form.name.trim() || form.name.trim().length < TOI_THIEU_TEN) thieu.push("tên tour");
  if (!form.summary.trim()) thieu.push("mô tả ngắn");
  if (!form.description.trim()) thieu.push("mô tả đầy đủ");
  if (!form.province_id) thieu.push("điểm đến chính (tỉnh, thành)");
  if (!Number(form.duration_days)) thieu.push("số ngày");
  if (!form.departure_location.trim()) thieu.push("địa điểm khởi hành");
  if (!form.transportation.length) thieu.push("phương tiện di chuyển");
  if (!form.tags.length) thieu.push("tag tour");

  const soNgay = Number(form.duration_days) || 0;
  if (form.itinerary.length === 0) thieu.push("lịch trình theo ngày");
  else if (soNgay > 0 && form.itinerary.length !== soNgay)
    thieu.push(`lịch trình đủ ${soNgay} ngày`);
  else if (form.itinerary.some((day) => (day.places || []).length === 0))
    thieu.push("điểm đến cho từng ngày");

  if (!form.cover_url.trim()) thieu.push("ảnh bìa");
  if (form.cancellation_policy.length === 0) thieu.push("chính sách hủy");
  return thieu;
}

/** Trường đầu tiên bị lỗi, để đưa con trỏ về đó. */
export function truongLoiDauTien(loi) {
  return Object.keys(loi)[0] || "";
}
