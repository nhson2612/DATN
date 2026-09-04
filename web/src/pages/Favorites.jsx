import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import CardSkeleton from "../components/skeletons/CardSkeleton";
import PlaceCard from "../components/cards/PlaceCard";
import "./Favorites.css";

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
    <main className="favorites-page">
      <h1 className="favorites-page__title">Địa điểm đã lưu</h1>
      {!user && <p className="favorites-page__message">Đăng nhập để xem danh sách yêu thích.</p>}
      
      {user && ds?.length === 0 && (
        <p className="favorites-page__message">
          Chưa lưu địa điểm nào. <button onClick={() => nav("/")} className="favorites-page__explore-btn">Khám phá ngay</button>
        </p>
      )}
      <div className="favorites-page__grid">
        {user && ds === null && <CardSkeleton count={4} />}
        {(ds || []).map((f) => (
          <PlaceCard key={`${f.place_type}-${f.place_id}`}
                     place={{ ...f, type: f.place_type }}
                     onClick={() => nav(`/dia-diem/${f.place_type}/${f.place_id}`)}
                     footer={
                       <button onClick={() => bo(f.place_type, f.place_id)}
                               className="favorites-page__remove-btn">
                         <i className="fa-solid fa-xmark" /> Bỏ lưu
                       </button>
                     } />
        ))}
      </div>
    </main>
  );
}
