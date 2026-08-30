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

      {/* HAI ZONE. Đây là quyết định sản phẩm quan trọng nhất của trang chủ:
          hai cách đi du lịch vận hành khác hẳn nhau, nên phải tách thành hai
          lối vào riêng chứ không trộn vào một danh sách tính năng.

            Tour trọn gói  giao dịch: chọn gói có sẵn, xem giá, đặt chỗ.
            Tự lên lịch    công cụ: gom địa điểm, xếp vào ngày, xem trên bản đồ.

          Người dùng chọn zone trước, mọi thứ sau đó nằm gọn trong zone đó. */}
      <section className="max-w-6xl mx-auto px-4 -mt-10 relative z-10">
        <div className="grid md:grid-cols-2 gap-4">

          <article onClick={() => nav("/tour")}
                   className="group cursor-pointer ui-card bg-white dark:bg-zinc-900 p-6 hover:border-accent-600 transition">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-field bg-accent-50 dark:bg-accent-900/30 text-accent-700 dark:text-accent-500 flex items-center justify-center">
                <i className="fa-solid fa-suitcase-rolling text-lg" />
              </div>
              <span className="text-[11px] font-semibold text-accent-700 dark:text-accent-500 bg-accent-50 dark:bg-accent-900/30 px-2 py-1 rounded-full">
                CÓ SẴN
              </span>
            </div>
            <h2 className="font-bold text-lg tracking-tight mb-1">Đi theo tour</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Xe, khách sạn, vé tham quan và hướng dẫn viên đã gộp trong một giá.
              Bạn chọn ngày khởi hành rồi đặt.
            </p>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1.5 mb-5">
              <li><i className="fa-solid fa-check text-accent-600 w-4" /> Lịch trình soạn sẵn theo ngày</li>
              <li><i className="fa-solid fa-check text-accent-600 w-4" /> Giá trọn gói, biết trước chi phí</li>
              <li><i className="fa-solid fa-check text-accent-600 w-4" /> Có ngày khởi hành cố định</li>
            </ul>
            <span className="text-sm font-semibold text-accent-700 dark:text-accent-500">
              Xem tour <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-0.5 transition-transform inline-block" />
            </span>
          </article>

          <article onClick={() => nav("/chuyen-di")}
                   className="group cursor-pointer ui-card bg-white dark:bg-zinc-900 p-6 hover:border-accent-600 transition">
            <div className="flex items-start justify-between mb-4">
              <div className="w-11 h-11 rounded-field bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center">
                <i className="fa-solid fa-map-pin text-lg" />
              </div>
              <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded-full">
                TỰ SẮP XẾP
              </span>
            </div>
            <h2 className="font-bold text-lg tracking-tight mb-1">Tự lên lịch trình</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Tự chọn địa điểm, xếp vào từng ngày và xem cả chuyến trên một bản
              đồ. Đi đâu, khi nào là do bạn.
            </p>
            <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1.5 mb-5">
              <li><i className="fa-solid fa-check text-zinc-400 w-4" /> Hỏi bằng tiếng Việt, kết quả hiện trên bản đồ</li>
              <li><i className="fa-solid fa-check text-zinc-400 w-4" /> Thêm vào chuyến rồi chia theo ngày</li>
              <li><i className="fa-solid fa-check text-zinc-400 w-4" /> Tối ưu thứ tự đi, vẽ đường thật</li>
            </ul>
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              Tạo chuyến đi <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-0.5 transition-transform inline-block" />
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
