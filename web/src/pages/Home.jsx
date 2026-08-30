import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

const MAU = ["from-sky-400 to-blue-600", "from-emerald-400 to-teal-600",
             "from-amber-400 to-orange-600", "from-violet-400 to-purple-600"];

export default function Home() {
  const [ds, setDs] = useState([]);
  const [loi, setLoi] = useState("");
  const [q, setQ] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    api.destinations(24).then((d) => setDs(d.destinations)).catch((e) => setLoi(e.message));
  }, []);

  return (
    <>
      {/* Ô tìm kiếm nằm ngay trong hero: Baymard đo được 99% người dùng tìm nó
          ngay khi vào trang, và 30% trang du lịch đặt nó dưới màn hình đầu. */}
      <section className="bg-gradient-to-br from-brand-600 to-sky-500 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Bạn muốn đi đâu?</h1>
          <p className="text-white/90 mb-8 max-w-xl">
            Khám phá điểm đến, chỗ ăn, chỗ ở và lên lịch trình cho chuyến đi của bạn — trên toàn Việt Nam.
          </p>
          <div className="bg-white rounded-2xl p-2 flex flex-col sm:flex-row gap-2 max-w-2xl shadow-xl">
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && q.trim() && nav(`/diem-den/${q.trim()}`)}
                   placeholder="Đà Nẵng, Hà Nội, Lâm Đồng..."
                   className="flex-1 px-4 py-3 text-slate-800 outline-none rounded-xl" />
            <button onClick={() => q.trim() && nav(`/diem-den/${q.trim()}`)}
                    className="bg-brand-500 hover:bg-brand-600 text-white font-semibold px-6 py-3 rounded-xl">
              <i className="fa-solid fa-magnifying-glass" /> Tìm kiếm
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-xl font-bold">Điểm đến nổi bật</h2>
        <p className="text-sm text-slate-500 mb-5">Chọn một tỉnh/thành để xem có gì ở đó</p>

        {loi && <p className="text-red-500 text-sm">{loi} — kiểm tra backend đã chạy chưa.</p>}
        {!ds.length && !loi && <p className="text-slate-400 text-sm">Đang tải...</p>}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ds.map((d, i) => (
            <article key={d.slug} onClick={() => nav(`/diem-den/${d.slug}`)}
                     className="cursor-pointer rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg transition">
              <div className={`card-img bg-gradient-to-br ${MAU[i % 4]} flex flex-col items-center justify-center text-white`}>
                <i className="fa-solid fa-location-dot text-2xl mb-1 opacity-80" />
                <span className="font-bold text-lg px-3 text-center">
                  {d.name.replace(/^(Thành phố|Tỉnh)\s+/, "")}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between text-xs text-slate-500">
                <span>{d.so_dia_diem.toLocaleString("vi-VN")} địa điểm</span>
                <span className="text-slate-400">{d.so_luu_tru.toLocaleString("vi-VN")} nơi ở</span>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
