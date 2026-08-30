import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import MiniMap from "../components/MiniMap";
import BookingForm from "../components/BookingForm";

export default function PlaceDetail({ user, onNeedAuth }) {
  const { type, id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [loi, setLoi] = useState("");
  const [daLuu, setDaLuu] = useState(false);
  const [moForm, setMoForm] = useState(false);

  useEffect(() => {
    setP(null); setDaLuu(false);
    api.place(type, id).then((d) => setP(d.place)).catch((e) => setLoi(e.message));
  }, [type, id]);

  async function luu() {
    if (!user) return onNeedAuth();
    try {
      await api.addFavorite(type, Number(id));
      setDaLuu(true);
    } catch (e) { alert(e.message); }
  }

  if (loi) return <main className="max-w-6xl mx-auto px-4 py-10 text-red-500">{loi}</main>;
  if (!p) return <main className="max-w-6xl mx-auto px-4 py-10 text-slate-400 text-sm">Đang tải...</main>;

  const thongTin = [
    p.dia_chi && ["fa-location-dot", p.dia_chi],
    p.dien_thoai && ["fa-phone", <a key="p" href={`tel:${p.dien_thoai}`} className="text-brand-600">{p.dien_thoai}</a>],
    p.stars && ["fa-star", `${p.stars} sao`],
    p.price_range && ["fa-tag", p.price_range],
  ].filter(Boolean);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <button onClick={() => nav(-1)} className="text-sm text-slate-500 hover:text-brand-600 mb-4">
        <i className="fa-solid fa-arrow-left" /> Quay lại
      </button>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {p.anh ? (
            <>
              <img src={p.anh} className="w-full rounded-2xl mb-2" alt="" />
              <p className="text-xs text-slate-400 mb-4">Ảnh: {p.anh_nguon || "Wikimedia Commons"}</p>
            </>
          ) : (
            <div className="w-full h-64 rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center mb-4">
              <i className="fa-solid fa-image text-4xl text-white" />
            </div>
          )}

          <h1 className="text-2xl font-bold">{p.name}</h1>
          <p className="text-sm text-brand-600 mb-4">{(p.category || "").replace(/_/g, " ")}</p>
          {p.description && <p className="text-slate-600 leading-relaxed mb-6">{p.description}</p>}

          <div className="space-y-2 text-sm mb-6">
            {thongTin.map(([ic, t], i) => (
              <div key={i}><i className={`fa-solid ${ic} text-slate-400 w-5`} /> {t}</div>
            ))}
          </div>

          <MiniMap lon={p.lon} lat={p.lat} />
        </div>

        <aside>
          <div className="border border-slate-200 rounded-2xl p-5 sticky top-20">
            <button onClick={luu} disabled={daLuu}
                    className="w-full mb-2 py-2.5 rounded-lg border border-slate-300 hover:border-rose-400 hover:text-rose-500 font-medium text-sm disabled:opacity-70">
              <i className={`fa-${daLuu ? "solid" : "regular"} fa-heart ${daLuu ? "text-rose-500" : ""}`} />{" "}
              {daLuu ? "Đã lưu" : "Lưu yêu thích"}
            </button>
            <button onClick={() => (user ? setMoForm(true) : onNeedAuth())}
                    className="w-full mb-2 py-2.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-semibold text-sm">
              <i className="fa-solid fa-paper-plane" /> Gửi yêu cầu đặt chỗ
            </button>
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer"
                 className="block text-center w-full py-2.5 rounded-lg border border-slate-300 hover:border-brand-500 text-sm font-medium">
                <i className="fa-solid fa-arrow-up-right-from-square" /> Trang chính thức
              </a>
            )}
            {/* Baymard: 85% trang không link ra nguồn đánh giá bên thứ ba, mà
                người dùng vốn không tin review nội bộ. */}
            <p className="text-xs text-slate-400 mt-3 text-center">
              Xem đánh giá tại trang chính thức của địa điểm.
            </p>
          </div>
        </aside>
      </div>

      {p.nearby?.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold mb-4">
            <i className="fa-solid fa-location-crosshairs text-brand-500" /> Gần đây
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.nearby.map((n) => (
              <article key={n.id} onClick={() => nav(`/dia-diem/poi/${n.id}`)}
                       className="cursor-pointer rounded-xl border border-slate-200 p-3 hover:shadow-md transition">
                <h3 className="font-semibold text-sm line-2">{n.name}</h3>
                <p className="text-xs text-slate-400 mt-1">cách {n.met} m</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <BookingForm open={moForm} onClose={() => setMoForm(false)}
                   placeType={type} placeId={Number(id)} placeName={p.name} />
    </main>
  );
}
