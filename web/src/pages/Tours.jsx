import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import CardSkeleton from "../components/skeletons/CardSkeleton";
import "./Tours.css";

const tien = (v) => (v ? `${(v / 1_000_000).toFixed(1).replace(".0", "")} triệu` : "Liên hệ");

export default function Tours() {
  const [sp, setSp] = useSearchParams();
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
            className={`tours-page__filter-btn ${
              String(sp.get(k)) === String(v) ? "tours-page__filter-btn--active" : ""
            }`}>
      {nhan}
    </button>
  );

  return (
    <main className="tours-page">
      <h1 className="tours-page__title">Tour trọn gói</h1>
      <p className="tours-page__subtitle">
        Đã bao gồm xe, khách sạn, vé tham quan và hướng dẫn viên · bạn chỉ cần chọn ngày khởi hành.
      </p>

      <div className="tours-page__filter-bar">
        <span className="tours-page__filter-label mr-1">Số ngày:</span>
        {[2, 3, 4].map((n) => nutLoc("max_days", n, `≤ ${n} ngày`))}
        <span className="tours-page__filter-label mx-1">Giá:</span>
        {[2_000_000, 3_500_000, 5_000_000].map((p) => nutLoc("max_price", p, `≤ ${tien(p)}`))}
      </div>

      {d?.items?.length === 0 && <p className="tours-page__message">Không có tour nào khớp bộ lọc.</p>}

      <div className="tours-page__grid">
        {!d && <CardSkeleton count={6} />}
        {d?.items?.map((t) => (
          <Link key={t.id} to={`/tour/${t.slug}`} className="tours-page__card group">
            <div className="tours-page__card-banner">
              <i className="fa-solid fa-route tours-page__card-icon" />
              <span className="tours-page__card-province">{t.province_name?.replace(/^(Thành phố|Tỉnh)\s+/, "")}</span>
              <span className="tours-page__card-duration">{t.duration_days} ngày {t.duration_days - 1} đêm</span>
            </div>
            <div className="tours-page__card-body">
              <h3 className="tours-page__card-title">{t.name}</h3>
              <p className="tours-page__card-summary">{t.summary}</p>
              <div className="tours-page__card-footer">
                <div>
                  <p className="tours-page__price-label">Giá từ</p>
                  <p className="tours-page__price-val">
                    {t.price_from?.toLocaleString("vi-VN")}<span className="text-xs font-normal"> đ/khách</span>
                  </p>
                </div>
                {t.ngay_gan_nhat && (
                  <span className="tours-page__date-tag">
                    <i className="fa-regular fa-calendar" />{" "}
                    {new Date(t.ngay_gan_nhat).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
