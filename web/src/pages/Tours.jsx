import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import CardSkeleton from "../components/CardSkeleton";

const tien = (v) => (v ? `${(v / 1_000_000).toFixed(1).replace(".0", "")} triệu` : "Liên hệ");

export default function Tours() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const maxDays = sp.get("max_days") || "";
  const maxPrice = sp.get("max_price") || "";

  useEffect(() => {
    setD(null);
    api.tours({ max_days: maxDays, max_price: maxPrice }).then(setD).catch(() => setD({ items: [], total: 0 }));
  }, [maxDays, maxPrice]);

  const loc = (k, v) => {
    const moi = Object.fromEntries(sp);
    if (String(moi[k]) === String(v)) delete moi[k]; else moi[k] = v;
    setSp(moi);
  };

  const nutLoc = (k, v, nhan) => (
    <button key={`${k}${v}`} onClick={() => loc(k, v)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              String(sp.get(k)) === String(v)
                ? "bg-accent-600 text-white border-accent-600"
                : "border-zinc-300 text-zinc-600 hover:border-accent-600"}`}>
      {nhan}
    </button>
  );

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Tour trọn gói</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Đã bao gồm xe, khách sạn, vé tham quan và hướng dẫn viên · bạn chỉ cần chọn ngày khởi hành.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        <span className="text-sm text-zinc-400 self-center mr-1">Số ngày:</span>
        {[2, 3, 4].map((n) => nutLoc("max_days", n, `≤ ${n} ngày`))}
        <span className="text-sm text-zinc-400 self-center mx-1">Giá:</span>
        {[2_000_000, 3_500_000, 5_000_000].map((p) => nutLoc("max_price", p, `≤ ${tien(p)}`))}
      </div>

      {d?.items?.length === 0 && <p className="text-zinc-500 text-sm">Không có tour nào khớp bộ lọc.</p>}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {!d && <CardSkeleton count={6} />}
        {d?.items?.map((t) => (
          <article key={t.id} onClick={() => nav(`/tour/${t.slug}`)}
                   className="cursor-pointer ui-card overflow-hidden bg-white dark:bg-zinc-900 hover:border-accent-600 transition flex flex-col">
            <div className="card-img bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center p-4 text-center">
              <i className="fa-solid fa-route text-xl mb-2 text-zinc-300 dark:text-zinc-600" />
              <span className="font-semibold tracking-tight">{t.province_name?.replace(/^(Thành phố|Tỉnh)\s+/, "")}</span>
              <span className="text-sm text-zinc-500">{t.duration_days} ngày {t.duration_days - 1} đêm</span>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <h3 className="font-semibold text-sm line-2">{t.name}</h3>
              <p className="text-xs text-zinc-500 mt-1 line-2 flex-1">{t.summary}</p>
              <div className="flex items-end justify-between mt-3">
                <div>
                  <p className="text-xs text-zinc-400">Giá từ</p>
                  <p className="text-lg font-bold text-accent-700">
                    {t.price_from?.toLocaleString("vi-VN")}<span className="text-xs font-normal"> đ/khách</span>
                  </p>
                </div>
                {t.ngay_gan_nhat && (
                  <span className="text-xs text-zinc-500">
                    <i className="fa-regular fa-calendar" />{" "}
                    {new Date(t.ngay_gan_nhat).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
