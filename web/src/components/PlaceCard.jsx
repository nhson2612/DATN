/* Thẻ địa điểm dùng chung cho lưới ở trang điểm đến, danh sách và yêu thích. */

// Wikimedia chỉ có ảnh cho điểm nổi tiếng; phần lớn CSDL là địa điểm địa phương
// nên đa số thẻ rơi vào nhánh nền gradient này. Để ô trống trông như lỗi tải.
const MAU_NHOM = {
  tham_quan: "from-amber-400 to-orange-500",
  an_uong: "from-rose-400 to-red-500",
  vui_choi: "from-violet-400 to-purple-500",
  mua_sam: "from-emerald-400 to-teal-500",
  luu_tru: "from-sky-400 to-blue-500",
};

const ICON_NHOM = {
  tham_quan: "fa-landmark",
  an_uong: "fa-utensils",
  vui_choi: "fa-masks-theater",
  mua_sam: "fa-bag-shopping",
  luu_tru: "fa-bed",
};

export default function PlaceCard({ place, group = "tham_quan", onClick, footer }) {
  return (
    <article className="group rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg hover:-translate-y-0.5 transition">
      <div onClick={onClick} className="cursor-pointer">
        {place.anh ? (
          <img src={place.anh} alt="" loading="lazy" className="card-img" />
        ) : (
          <div
            className={`card-img bg-gradient-to-br ${MAU_NHOM[group] || "from-slate-300 to-slate-400"} flex items-center justify-center`}
          >
            <i className={`fa-solid ${ICON_NHOM[group] || "fa-location-dot"} text-white/80 text-3xl`} />
          </div>
        )}
        <div className="p-3">
          <h3 className="font-semibold text-sm line-2 group-hover:text-brand-600">{place.name}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {(place.category || "").replace(/_/g, " ")}
          </p>
          {place.dia_chi && (
            <p className="text-xs text-slate-400 mt-1 line-2">
              <i className="fa-solid fa-location-dot" /> {place.dia_chi}
            </p>
          )}
          {place.met != null && (
            <p className="text-xs text-slate-400 mt-1">cách {place.met} m</p>
          )}
        </div>
      </div>
      {footer}
    </article>
  );
}
