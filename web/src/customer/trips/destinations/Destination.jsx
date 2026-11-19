import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../../shared/api";
import DetailSkeleton from "../../../shared/skeletons/DetailSkeleton";
import PlaceCard from "../../../shared/cards/PlaceCard";
import AppNavbar from "../../../shared/layout/AppNavbar";
import Footer from "../../../shared/layout/Footer";
import "./Destination.css";

const ICON = {
  tham_quan: "account_balance",
  an_uong: "restaurant",
  vui_choi: "theater_comedy",
  mua_sam: "shopping_bag",
  luu_tru: "hotel",
};

export default function Destination({ user, onNeedAuth, onLogout }) {
  const { slug } = useParams();
  const nav = useNavigate();
  const [d, setD] = useState(null);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    setD(null);
    setLoi("");
    api.destination(slug).then(setD).catch((e) => setLoi(e.message));
  }, [slug]);

  if (loi) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />
        <main className="destination-page flex-1 py-16 text-center">
          <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-rose-200 shadow-sm">
            <span className="material-symbols-outlined text-4xl text-rose-500 mb-3 block">error</span>
            <h2 className="destination-page__error-title">Không tìm thấy điểm đến</h2>
            <p className="destination-page__error-msg mb-4">Thử gõ tên tỉnh/thành, ví dụ "Đà Nẵng".</p>
            <button
              onClick={() => nav("/")}
              className="px-6 py-2.5 rounded-full bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition shadow-sm"
            >
              ← Về trang chủ
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (!d) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-50">
        <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />
        <main className="destination-page flex-1 py-8">
          <DetailSkeleton />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <AppNavbar user={user} onNeedAuth={onNeedAuth} onLogout={onLogout} />

      <main className="destination-page flex-1 py-8">
        <button type="button" onClick={() => nav("/")} className="destination-page__back-btn">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          <span>Tất cả điểm đến</span>
        </button>
        <h1 className="destination-page__title">{d.name}</h1>
        <p className="destination-page__subtitle">
          {d.groups.reduce((s, g) => s + g.items.length, 0)} địa điểm nổi bật
        </p>

        {d.groups.map((g) => (
          <section key={g.key} className="destination-page__section">
            <div className="destination-page__section-header">
              <h2 className="destination-page__section-title">
                <span className="material-symbols-outlined text-[20px] text-teal-600">
                  {ICON[g.key] || "location_on"}
                </span>
                <span>{g.ten}</span>
              </h2>
            </div>
            <div className="destination-page__grid">
              {g.items.slice(0, 8).map((p) => (
                <PlaceCard
                  key={`${p.type}-${p.id}`}
                  place={p}
                  group={g.key}
                  onClick={() => nav(`/dia-diem/${p.type}/${p.id}`)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      <Footer />
    </div>
  );
}
