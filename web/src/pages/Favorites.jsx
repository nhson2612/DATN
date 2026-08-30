import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CardSkeleton from "../components/CardSkeleton";
import PlaceCard from "../components/PlaceCard";

export default function Favorites({ user, onNeedAuth }) {
  const [ds, setDs] = useState(null);
  const nav = useNavigate();

  useEffect(() => {
    if (!user) { onNeedAuth(); setDs([]); return; }
    api.favorites().then((d) => setDs(d.favorites)).catch(() => setDs([]));
  }, [user]);

  async function bo(type, id) {
    await api.removeFavorite(type, id);
    setDs((cu) => cu.filter((f) => !(f.place_type === type && f.place_id === id)));
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold tracking-tight mb-5">Địa điểm đã lưu</h1>
      {!user && <p className="text-zinc-500 text-sm">Đăng nhập để xem danh sách yêu thích.</p>}
      
      {user && ds?.length === 0 && (
        <p className="text-zinc-500 text-sm">
          Chưa lưu địa điểm nào. <button onClick={() => nav("/")} className="text-accent-700">Khám phá ngay</button>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {user && ds === null && <CardSkeleton count={4} />}
        {(ds || []).map((f) => (
          <PlaceCard key={`${f.place_type}-${f.place_id}`}
                     place={{ ...f, type: f.place_type }}
                     onClick={() => nav(`/dia-diem/${f.place_type}/${f.place_id}`)}
                     footer={
                       <button onClick={() => bo(f.place_type, f.place_id)}
                               className="w-full py-2 text-xs text-zinc-400 hover:text-accent-700 dark:hover:text-accent-500 border-t border-zinc-100">
                         <i className="fa-solid fa-xmark" /> Bỏ lưu
                       </button>
                     } />
        ))}
      </div>
    </main>
  );
}
