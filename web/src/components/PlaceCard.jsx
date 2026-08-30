/* Thẻ địa điểm dùng chung cho lưới ở trang điểm đến, danh sách và yêu thích. */

/* Địa điểm chưa có ảnh: Wikimedia chỉ phủ được điểm nổi tiếng, phần lớn CSDL là
 * địa điểm địa phương nên đa số thẻ rơi vào nhánh này. Trước đây mỗi nhóm một
 * gradient màu khác nhau (sky, rose, violet, emerald...) · nhìn như bảng màu
 * mẫu, thương hiệu tan biến. Nay chỉ còn nền trung tính và một biểu tượng, màu
 * accent để dành cho hành động. */
const ICON_NHOM = {
  tham_quan: "fa-landmark",
  an_uong: "fa-utensils",
  vui_choi: "fa-masks-theater",
  mua_sam: "fa-bag-shopping",
  luu_tru: "fa-bed",
};

export default function PlaceCard({ place, group = "tham_quan", onClick, footer }) {
  return (
    <article className="group ui-card overflow-hidden bg-white dark:bg-zinc-900 hover:border-accent-600 transition">
      <div onClick={onClick} className="cursor-pointer">
        {place.anh ? (
          <img src={place.anh} alt="" loading="lazy" className="card-img" />
        ) : (
          <div className="card-img bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
            <i className={`fa-solid ${ICON_NHOM[group] || "fa-location-dot"} text-2xl text-zinc-300 dark:text-zinc-600`} />
          </div>
        )}
        <div className="p-3">
          <h3 className="font-semibold text-sm line-2 group-hover:text-accent-700 dark:group-hover:text-accent-500">
            {place.name}
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            {(place.category || "").replace(/_/g, " ")}
          </p>
          {place.dia_chi && (
            <p className="text-xs text-zinc-400 mt-1 line-2">
              <i className="fa-solid fa-location-dot" /> {place.dia_chi}
            </p>
          )}
          {place.met != null && (
            <p className="text-xs text-zinc-400 mt-1">cách {place.met} m</p>
          )}
        </div>
      </div>
      {footer}
    </article>
  );
}
