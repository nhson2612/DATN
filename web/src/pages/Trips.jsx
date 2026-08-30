import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CardSkeleton from "../components/CardSkeleton";

/* Danh sách chuyến đi tự lên lịch.
 *
 * Đây là nửa còn lại của sản phẩm: khách không mua gói có sẵn mà tự gom địa
 * điểm rồi xếp vào từng ngày. Zone tour (/tour) là giao dịch; zone này là công
 * cụ, nên nút chính là "Tạo chuyến" chứ không phải "Đặt ngay". */
export default function Trips({ user, onNeedAuth }) {
  const [ds, setDs] = useState(null);
  const [dangTao, setDangTao] = useState(false);
  const [form, setForm] = useState({ name: "", duration_days: 3 });
  const nav = useNavigate();

  useEffect(() => {
    if (!user) { onNeedAuth(); setDs([]); return; }
    api.itineraries().then((d) => setDs(d.itineraries)).catch(() => setDs([]));
  }, [user]);

  async function tao() {
    if (!form.name.trim()) return;
    const d = await api.saveItinerary({
      name: form.name.trim(),
      duration_days: Number(form.duration_days) || 1,
      stops: [],
    });
    nav(`/chuyen-di/${d.id}`);
  }

  async function xoa(id, e) {
    e.stopPropagation();
    if (!confirm("Xoá chuyến đi này?")) return;
    await api.deleteItinerary(id);
    setDs((cu) => cu.filter((x) => x.id !== id));
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chuyến đi của bạn</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Tự chọn địa điểm, xếp vào từng ngày và xem tất cả trên một bản đồ.
          </p>
        </div>
        <button onClick={() => (user ? setDangTao(true) : onNeedAuth())} className="btn-primary shrink-0">
          <i className="fa-solid fa-plus" /> Tạo chuyến
        </button>
      </div>

      {dangTao && (
        <div className="ui-card bg-white dark:bg-zinc-900 p-4 mb-6 flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex-1 text-xs text-zinc-500">
            Tên chuyến đi
            <input autoFocus value={form.name} onKeyDown={(e) => e.key === "Enter" && tao()}
                   onChange={(e) => setForm({ ...form, name: e.target.value })}
                   placeholder="Đà Nẵng cuối tuần" className="ui-field w-full mt-1" />
          </label>
          <label className="text-xs text-zinc-500 sm:w-28">
            Số ngày
            <input type="number" min="1" max="14" value={form.duration_days}
                   onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                   className="ui-field w-full mt-1" />
          </label>
          <div className="flex gap-2">
            <button onClick={tao} className="btn-primary">Tạo</button>
            <button onClick={() => setDangTao(false)} className="btn-ghost">Huỷ</button>
          </div>
        </div>
      )}

      {!user && <p className="text-zinc-500 text-sm">Đăng nhập để tạo và lưu chuyến đi.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {user && ds === null && <CardSkeleton count={3} />}
        {ds?.map((t) => (
          <article key={t.id} onClick={() => nav(`/chuyen-di/${t.id}`)}
                   className="cursor-pointer ui-card bg-white dark:bg-zinc-900 p-4 hover:border-accent-600 transition">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold line-2">{t.name}</h3>
              <button onClick={(e) => xoa(t.id, e)} title="Xoá"
                      className="text-zinc-300 hover:text-red-500 shrink-0">
                <i className="fa-solid fa-trash-can text-sm" />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              <i className="fa-regular fa-calendar" /> {t.duration_days} ngày
              <span className="mx-1.5">·</span>
              <i className="fa-solid fa-location-dot" /> {(t.stops_details || []).length} địa điểm
            </p>
          </article>
        ))}
      </div>

      {user && ds?.length === 0 && (
        <p className="text-zinc-500 text-sm">
          Chưa có chuyến nào. Bấm <b>Tạo chuyến</b> để bắt đầu.
        </p>
      )}
    </main>
  );
}
