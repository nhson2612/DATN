import { useState } from "react";
import { Link } from "react-router-dom";
import "./TourCard.css";

/**
 * Chuẩn hoá chuỗi văn bản, thay thế dấu gạch ngang dài.
 */
function cleanText(str) {
  if (!str) return "";
  return String(str).replaceAll("—", " - ").replaceAll("–", "-");
}

/**
 * Định dạng ngày sang chuẩn Việt Nam DD/MM/YYYY.
 */
function formatVnDate(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Trích xuất danh sách điểm nổi bật (highlights) tối đa 3 điểm.
 */
function parseHighlights(highlights) {
  if (!highlights) return [];
  if (Array.isArray(highlights)) {
    return highlights.filter(Boolean).slice(0, 3);
  }
  if (typeof highlights === "string") {
    try {
      const parsed = JSON.parse(highlights);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).slice(0, 3);
      }
    } catch {
      const parts = highlights.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      return parts.slice(0, 3);
    }
  }
  return [];
}

/**
 * Component thẻ Tour trọn gói theo đúng thiết kế .design/Tours.html (dòng 221-599).
 * - Bỏ rating giả theo yêu cầu ("Dữ liệu rating/review giả trong file HTML nếu có thì BỎ")
 * - Nối dữ liệu thật: cover_url, name, province_name, duration_days, price_from, original_price, is_sale, discount_pct, ngay_gan_nhat
 * - Cả nút "Chi tiết" và "Đặt ngay" đều dẫn tới /tour/:slug
 */
export default function TourCard({ tour, viewMode = "grid" }) {
  const [imgError, setImgError] = useState(false);

  if (!tour) return null;

  const cleanProvince = tour.province_name?.replace(/^(Thành phố|Tỉnh)\s+/, "") || "";
  const highlightsList = parseHighlights(tour.highlights);
  const durationText = tour.duration_days
    ? `${tour.duration_days} Ngày ${Math.max(0, tour.duration_days - 1)} Đêm`
    : "";

  return (
    <article
      className={`tour-card group ${viewMode === "list" ? "tour-card--list" : ""}`}
      data-purpose="tour-card"
    >
      <div className={viewMode === "list" ? "contents md:flex" : ""}>
        {/* Khung ảnh bìa & các nhãn thông tin trên ảnh */}
        <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-slate-100 tour-card__media">
          <Link to={`/tour/${tour.slug}`} className="block w-full h-full">
            {tour.cover_url && !imgError ? (
              <img
                src={tour.cover_url}
                alt={cleanText(tour.name)}
                loading="lazy"
                onError={() => setImgError(true)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400">
                <i className="fa-solid fa-mountain-sun text-3xl mb-1 text-slate-300" />
                <span className="text-[11px] font-medium text-slate-500">
                  {cleanProvince || "Khám phá Việt Nam"}
                </span>
              </div>
            )}
          </Link>

          {/* Badge giảm giá hoặc ưu đãi */}
          {tour.is_sale && tour.discount_pct > 0 ? (
            <span className="absolute top-3 left-3 bg-[#ea580c] text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded shadow-sm tracking-wide">
              GIẢM {tour.discount_pct}%
            </span>
          ) : cleanProvince ? (
            <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white text-[10px] font-bold uppercase px-2.5 py-1 rounded shadow-sm tracking-wide">
              {cleanProvince}
            </span>
          ) : null}

          {/* Nút yêu thích */}
          <button
            type="button"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/25 hover:bg-black/40 text-white flex items-center justify-center backdrop-blur-sm transition-colors cursor-pointer"
            aria-label="Lưu vào danh sách yêu thích"
          >
            <i className="fa-regular fa-heart text-sm" />
          </button>

          {/* Dải thông tin mờ chân ảnh: Thời lượng & Lịch khởi hành */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 py-2 flex items-center justify-between text-white text-[11px] font-medium">
            <span className="flex items-center">
              <i className="fa-regular fa-clock mr-1" />
              {durationText || "Lịch trình linh hoạt"}
            </span>
            <span className="flex items-center">
              <i className="fa-regular fa-calendar mr-1" />
              {tour.ngay_gan_nhat
                ? `Khởi hành: ${formatVnDate(tour.ngay_gan_nhat)}`
                : "Khởi hành hàng tuần"}
            </span>
          </div>
        </div>

        <div className="tour-card__content-wrap flex flex-col justify-between flex-1">
          {/* Thân thẻ: Tiêu đề và Điểm nổi bật */}
          <div className="p-4">
            <h3 className="font-bold text-[15px] text-slate-900 line-clamp-2 leading-snug mb-3 group-hover:text-orange-600 transition-colors">
              <Link to={`/tour/${tour.slug}`}>{cleanText(tour.name)}</Link>
            </h3>

            {/* Danh sách tính năng/điểm nổi bật (Highlights) */}
            {highlightsList.length > 0 ? (
              <ul className="space-y-1.5 text-[12px] text-slate-600 border-b border-gray-100 pb-4">
                {highlightsList.map((item, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="mr-2 text-orange-500 font-bold shrink-0 leading-tight">
                      •
                    </span>
                    <span className="line-clamp-1">{cleanText(item)}</span>
                  </li>
                ))}
              </ul>
            ) : tour.summary ? (
              <p className="text-[12px] text-slate-600 line-clamp-2 border-b border-gray-100 pb-4 leading-relaxed">
                {cleanText(tour.summary)}
              </p>
            ) : (
              <div className="border-b border-gray-100 pb-4" />
            )}
          </div>

          {/* Chân thẻ: Giá tiền và Nút CTA */}
          <div className="px-4 pb-4 pt-1 flex items-center justify-between gap-2">
            <div className="flex-shrink-0">
              {tour.is_sale && tour.original_price && (
                <div className="text-[11px] text-slate-400 line-through leading-tight">
                  {Number(tour.original_price).toLocaleString("vi-VN")}đ
                </div>
              )}
              <div className="text-sm font-bold text-orange-600 leading-none whitespace-nowrap">
                {Number(tour.price_from || 0).toLocaleString("vi-VN")}đ{" "}
                <span className="text-[10px] font-normal text-slate-400">/khách</span>
              </div>
            </div>

            <div className="flex items-center space-x-1.5 flex-shrink-0">
              <Link
                to={`/tour/${tour.slug}`}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 py-1.5 px-2 whitespace-nowrap transition-colors"
              >
                Chi tiết
              </Link>
              <Link
                to={`/tour/${tour.slug}`}
                className="text-xs font-bold text-orange-600 hover:text-orange-700 py-1.5 px-2 inline-flex items-center whitespace-nowrap transition-colors"
              >
                Đặt ngay <i className="fa-solid fa-arrow-right ml-1 text-[10px]" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
