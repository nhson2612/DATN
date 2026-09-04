import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import DetailSkeleton from "../components/skeletons/DetailSkeleton";
import PlaceCard from "../components/cards/PlaceCard";
import "./Destination.css";

const ICON = {
  tham_quan: "fa-landmark", an_uong: "fa-utensils", vui_choi: "fa-masks-theater",
  mua_sam: "fa-bag-shopping", luu_tru: "fa-bed",
};

export default function Destination() {
  const { slug } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    setD(null); setLoi("");
    api.destination(slug).then(setD).catch((e) => setLoi(e.message));
  }, [slug]);

  if (loi) return (
    <main className="destination-page">
      <h2 className="destination-page__error-title">Không tìm thấy điểm đến</h2>
      <p className="destination-page__error-msg">Thử gõ tên tỉnh/thành, ví dụ "Đà Nẵng".</p>
      <button onClick={() => nav("/")} className="destination-page__home-link">← Trang chủ</button>
    </main>
  );
  if (!d) return <DetailSkeleton />;

  return (
    <main className="destination-page">
      <button onClick={() => nav("/")} className="destination-page__back-btn">
        <i className="fa-solid fa-arrow-left" /> Tất cả điểm đến
      </button>
      <h1 className="destination-page__title">{d.name}</h1>
      <p className="destination-page__subtitle">
        {d.groups.reduce((s, g) => s + g.items.length, 0)} địa điểm nổi bật
      </p>

      {d.groups.map((g) => (
        <section key={g.key} className="destination-page__section">
          <div className="destination-page__section-header">
            <h2 className="destination-page__section-title">
              <i className={`fa-solid ${ICON[g.key] || "fa-location-dot"} destination-page__section-icon`} /> {g.ten}
            </h2>
            <button onClick={() => nav(`/dia-diem?destination=${d.slug}&nhom=${g.key}`)}
                    className="destination-page__see-all-btn">
              Xem tất cả
            </button>
          </div>
          <div className="destination-page__grid">
            {g.items.slice(0, 8).map((p) => (
              <PlaceCard key={`${p.type}-${p.id}`} place={p} group={g.key}
                         onClick={() => nav(`/dia-diem/${p.type}/${p.id}`)} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
