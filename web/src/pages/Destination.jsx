import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import PlaceCard from "../components/PlaceCard";

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
    <main className="max-w-6xl mx-auto px-4 py-10">
      <h2 className="text-xl font-bold mb-2">Không tìm thấy điểm đến</h2>
      <p className="text-slate-500 text-sm">Thử gõ tên tỉnh/thành, ví dụ "Đà Nẵng".</p>
      <button onClick={() => nav("/")} className="mt-4 text-brand-600 text-sm">← Trang chủ</button>
    </main>
  );
  if (!d) return <main className="max-w-6xl mx-auto px-4 py-10 text-slate-400 text-sm">Đang tải...</main>;

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <button onClick={() => nav("/")} className="text-sm text-slate-500 hover:text-brand-600 mb-4">
        <i className="fa-solid fa-arrow-left" /> Tất cả điểm đến
      </button>
      <h1 className="text-2xl font-bold">{d.name}</h1>
      <p className="text-sm text-slate-500 mb-8">
        {d.groups.reduce((s, g) => s + g.items.length, 0)} địa điểm nổi bật
      </p>

      {d.groups.map((g) => (
        <section key={g.key} className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">
              <i className={`fa-solid ${ICON[g.key] || "fa-location-dot"} text-brand-500`} /> {g.ten}
            </h2>
            <button onClick={() => nav(`/dia-diem?destination=${d.slug}&nhom=${g.key}`)}
                    className="text-sm text-brand-600 font-medium hover:underline">
              Xem tất cả
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
