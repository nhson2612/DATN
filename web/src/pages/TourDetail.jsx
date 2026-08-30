import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import DetailSkeleton from "../components/DetailSkeleton";
import TourBookingForm from "../components/TourBookingForm";

export default function TourDetail({ user, onNeedAuth }) {
  const { slug } = useParams();
  const nav = useNavigate();
  const [t, setT] = useState(null);
  const [loi, setLoi] = useState("");
  const [dot, setDot] = useState(null);
  const [moForm, setMoForm] = useState(false);

  useEffect(() => {
    setT(null);
    api.tour(slug).then((d) => { setT(d.tour); setDot(d.tour.departures?.[0] || null); })
      .catch((e) => setLoi(e.message));
  }, [slug]);

  if (loi) return <main className="max-w-6xl mx-auto px-4 py-10 text-red-500">{loi}</main>;
  if (!t) return <DetailSkeleton />;

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <button onClick={() => nav("/tour")} className="text-sm text-zinc-500 hover:text-accent-700 mb-4">
        <i className="fa-solid fa-arrow-left" /> Tất cả tour
      </button>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="rounded-card bg-zinc-900 text-white p-8 mb-6">
            <p className="text-white/80 text-sm mb-1">
              <i className="fa-solid fa-location-dot" /> {t.province_name}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold">{t.name}</h1>
            <p className="text-white/90 mt-2">{t.summary}</p>
          </div>

          {t.highlights?.length > 0 && (
            <section className="mb-8">
              <h2 className="font-bold mb-3">Điểm nhấn hành trình</h2>
              <div className="flex flex-wrap gap-2">
                {t.highlights.map((h, i) => (
                  <span key={i} className="px-3 py-1.5 bg-accent-50 text-accent-700 rounded-full text-sm">
                    <i className="fa-solid fa-star text-accent-400" /> {h}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="mb-8">
            <h2 className="font-bold mb-4">Lịch trình chi tiết</h2>
            <div className="space-y-4">
              {(t.itinerary || []).map((n) => (
                <div key={n.day} className="border-l-2 border-brand-200 pl-4 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-accent-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                      Ngày {n.day}
                    </span>
                    <h3 className="font-semibold text-sm">{n.title}</h3>
                  </div>
                  <p className="text-sm text-zinc-600 mb-2">{n.description}</p>
                  {n.places?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {n.places.map((p) => (
                        <button key={p.id} onClick={() => nav(`/dia-diem/poi/${p.id}`)}
                                className="text-xs px-2 py-1 border border-zinc-200 rounded hover:border-accent-600 hover:text-accent-700">
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <div className="grid sm:grid-cols-2 gap-4">
            {t.included && (
              <section className="ui-card p-4">
                <h3 className="font-semibold text-sm mb-2 text-accent-600">
                  <i className="fa-solid fa-circle-check" /> Giá bao gồm
                </h3>
                <p className="text-sm text-zinc-600">{t.included}</p>
              </section>
            )}
            {t.excluded && (
              <section className="ui-card p-4">
                <h3 className="font-semibold text-sm mb-2 text-zinc-500">
                  <i className="fa-solid fa-circle-xmark" /> Không bao gồm
                </h3>
                <p className="text-sm text-zinc-600">{t.excluded}</p>
              </section>
            )}
          </div>
        </div>

        <aside>
          <div className="ui-card bg-white dark:bg-zinc-900 p-5 sticky top-20">
            <p className="text-xs text-zinc-400">Giá từ</p>
            <p className="text-2xl font-bold tracking-tight text-accent-700 mb-4">
              {t.price_from?.toLocaleString("vi-VN")}
              <span className="text-sm font-normal text-zinc-500"> đ/khách</span>
            </p>

            <p className="text-sm font-semibold mb-2">Chọn ngày khởi hành</p>
            {t.departures?.length ? (
              <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                {t.departures.map((d) => (
                  <button key={d.id} onClick={() => setDot(d)}
                          className={`w-full text-left px-3 py-2 rounded-field border text-sm transition ${
                            dot?.id === d.id ? "border-accent-600 bg-accent-50" : "border-zinc-200 hover:border-zinc-300"}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">
                        {new Date(d.depart_date).toLocaleDateString("vi-VN", {
                          weekday: "short", day: "2-digit", month: "2-digit" })}
                      </span>
                      <span className="text-accent-700 font-semibold">
                        {d.price?.toLocaleString("vi-VN")} đ
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">còn {d.seats_left} chỗ</p>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 mb-4">Hiện chưa mở đợt khởi hành mới.</p>
            )}

            <button onClick={() => (user ? setMoForm(true) : onNeedAuth())}
                    disabled={!dot}
                    className="btn-primary w-full">
              <i className="fa-solid fa-paper-plane" /> Đặt tour
            </button>
            <p className="text-xs text-zinc-400 mt-3 text-center">
              Yêu cầu đặt chỗ, chưa thanh toán. Chúng tôi gọi lại xác nhận.
            </p>
          </div>
        </aside>
      </div>

      <TourBookingForm open={moForm} onClose={() => setMoForm(false)}
                       tour={t} departure={dot} />
    </main>
  );
}
