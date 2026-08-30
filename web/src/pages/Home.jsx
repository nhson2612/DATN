import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CardSkeleton from "../components/CardSkeleton";

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
      {/* Nền đơn sắc thay cho dải xanh dương chuyển sắc: dải gradient xanh
          tím là dấu hiệu rõ nhất của giao diện do máy sinh. Màu accent để dành
          cho nút, không rải khắp nền. */}
      <section className="bg-zinc-900 dark:bg-zinc-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-16 md:py-24">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tighter leading-none mb-4">Bạn muốn đi đâu?</h1>
          <p className="text-white/90 mb-8 max-w-xl">
            Khám phá điểm đến, chỗ ăn, chỗ ở và lên lịch trình cho chuyến đi của bạn · trên toàn Việt Nam.
          </p>
          <div className="bg-white rounded-full p-2 flex flex-col sm:flex-row gap-2 max-w-2xl">
            <input value={q} onChange={(e) => setQ(e.target.value)}
                   onKeyDown={(e) => e.key === "Enter" && q.trim() && nav(`/diem-den/${q.trim()}`)}
                   placeholder="Đà Nẵng, Hà Nội, Lâm Đồng..."
                   className="flex-1 px-4 py-3 text-zinc-900 bg-transparent outline-none" />
            <button onClick={() => q.trim() && nav(`/diem-den/${q.trim()}`)}
                    className="btn-primary px-6 py-3">
              <i className="fa-solid fa-magnifying-glass" /> Tìm kiếm
            </button>
          </div>
        </div>
      </section>

      {/* Hai kiểu đi du lịch khác hẳn nhau về nghiệp vụ, nên tách rõ ngay từ
          trang chủ thay vì để người dùng tự mò: đi tour thì mọi thứ đã soạn sẵn
          và có giá cụ thể; đi tự túc thì tự chọn địa điểm, tự lên lịch trình. */}
      <section className="max-w-6xl mx-auto px-4 -mt-8 relative z-10">
        <div className="grid md:grid-cols-2 gap-4">
          <article onClick={() => nav("/tour")}
                   className="cursor-pointer ui-card bg-white dark:bg-zinc-900 p-6 hover:border-accent-600 transition">
            <div className="w-11 h-11 rounded-field bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-500 flex items-center justify-center mb-3">
              <i className="fa-solid fa-route text-xl" />
            </div>
            <h3 className="font-bold text-lg mb-1">Đi theo tour</h3>
            <p className="text-sm text-zinc-500 mb-3">
              Trọn gói xe, khách sạn, vé tham quan và hướng dẫn viên. Lịch trình đã
              soạn sẵn, bạn chỉ chọn ngày khởi hành.
            </p>
            <span className="text-sm font-semibold text-accent-700">
              Xem tour <i className="fa-solid fa-arrow-right text-xs" />
            </span>
          </article>

          <article onClick={() => document.getElementById("kham-pha")?.scrollIntoView({ behavior: "smooth" })}
                   className="cursor-pointer ui-card bg-white dark:bg-zinc-900 p-6 hover:border-accent-600 transition">
            <div className="w-11 h-11 rounded-field bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center mb-3">
              <i className="fa-solid fa-compass text-xl" />
            </div>
            <h3 className="font-bold text-lg mb-1">Đi tự túc</h3>
            <p className="text-sm text-zinc-500 mb-3">
              Tự chọn điểm đến, tìm chỗ ăn chỗ ở, rồi để AI gợi ý lịch trình theo
              số ngày và sở thích của bạn.
            </p>
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              Bắt đầu khám phá <i className="fa-solid fa-arrow-right text-xs" />
            </span>
          </article>
        </div>
      </section>

      <main id="kham-pha" className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-xl font-bold">Điểm đến nổi bật</h2>
        <p className="text-sm text-zinc-500 mb-5">Chọn một tỉnh/thành để xem có gì ở đó</p>

        {loi && <p className="text-red-500 text-sm">{loi} · kiểm tra backend đã chạy chưa.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {!ds.length && !loi && <CardSkeleton count={6} />}
          {ds.map((d) => (
            <article key={d.slug} onClick={() => nav(`/diem-den/${d.slug}`)}
                     className="cursor-pointer ui-card overflow-hidden bg-white dark:bg-zinc-900 hover:border-accent-600 transition">
              {/* Không gradient: trước đây mỗi thẻ một màu trong bộ bốn (xanh
                  dương, xanh lá, cam, tím) nên lưới trông như bảng màu mẫu.
                  Tên tỉnh tự nó đã là nội dung, không cần màu để phân biệt. */}
              <div className="card-img bg-zinc-100 dark:bg-zinc-800 flex flex-col items-center justify-center">
                <i className="fa-solid fa-location-dot text-xl mb-2 text-zinc-300 dark:text-zinc-600" />
                <span className="font-semibold text-lg px-3 text-center tracking-tight">
                  {d.name.replace(/^(Thành phố|Tỉnh)\s+/, "")}
                </span>
              </div>
              <div className="p-3 flex items-center justify-between text-xs text-zinc-500">
                <span>{d.so_dia_diem.toLocaleString("vi-VN")} địa điểm</span>
                <span className="text-zinc-400">{d.so_luu_tru.toLocaleString("vi-VN")} nơi ở</span>
              </div>
            </article>
          ))}
        </div>
      </main>
    </>
  );
}
