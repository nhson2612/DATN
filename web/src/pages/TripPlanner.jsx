import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import TripMap from "../components/TripMap";

/* Trình lên lịch chuyến đi: lịch trình bên trái, bản đồ bên phải, luôn thấy cùng
 * lúc.
 *
 * Khác hẳn zone tour: ở đó khách mua một gói đã soạn sẵn và thao tác chính là
 * "Đặt". Ở đây khách tự gom địa điểm rồi xếp vào ngày, nên thao tác chính là
 * thêm/bớt/chuyển ngày, và mọi thay đổi phải thấy ngay trên bản đồ. */
export default function TripPlanner({ user, onNeedAuth }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [ngayXem, setNgayXem] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [timKiem, setTimKiem] = useState("");
  const [ketQua, setKetQua] = useState([]);
  const [themVaoNgay, setThemVaoNgay] = useState(1);

  useEffect(() => {
    if (!user) { onNeedAuth(); return; }
    api.itineraries().then((d) => {
      const t = d.itineraries.find((x) => String(x.id) === String(id));
      if (!t) return nav("/chuyen-di");
      setTrip(t);
      setStops(t.stops_details || []);
    });
  }, [id, user]);

  const luu = useCallback(async (moi) => {
    setDangLuu(true);
    try {
      await api.updateItinerary(id, {
        name: trip.name,
        description: trip.description,
        duration_days: trip.duration_days,
        // Chỉ lưu tham chiếu {day,type,id}; tên và toạ độ được tra lại lúc đọc
        // để địa điểm đổi tên thì chuyến cũ vẫn đúng.
        stops: moi.map((s) => ({ day: s.day, type: s.type, id: s.id })),
      });
    } finally { setDangLuu(false); }
  }, [id, trip]);

  function capNhat(moi) { setStops(moi); luu(moi); }

  function xoaDiem(i) { capNhat(stops.filter((_, k) => k !== i)); }

  function doiNgay(i, ngay) {
    const moi = [...stops];
    moi[i] = { ...moi[i], day: ngay };
    capNhat(moi);
  }

  async function tim(e) {
    e?.preventDefault();
    if (!timKiem.trim()) return setKetQua([]);
    const d = await api.searchPlaces({ q: timKiem.trim(), page_size: 8 });
    setKetQua(d.items || []);
  }

  function them(p) {
    capNhat([...stops, {
      day: themVaoNgay, type: p.type, id: p.id,
      name: p.name, lon: p.lon, lat: p.lat, details: {},
    }]);
    setKetQua([]); setTimKiem("");
  }

  const theoNgay = useMemo(() => {
    const g = {};
    for (let d = 1; d <= (trip?.duration_days || 1); d++) g[d] = [];
    stops.forEach((s) => (g[s.day] ||= []).push(s));
    return g;
  }, [stops, trip]);

  if (!user) return <main className="max-w-6xl mx-auto px-4 py-10 text-sm text-zinc-500">Đăng nhập để mở chuyến đi.</main>;
  if (!trip) return <main className="max-w-6xl mx-auto px-4 py-10"><div className="skeleton h-96 rounded-card" /></main>;

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => nav("/chuyen-di")} className="text-sm text-zinc-500 hover:text-accent-700">
          <i className="fa-solid fa-arrow-left" />
        </button>
        <h1 className="text-xl font-bold tracking-tight flex-1">{trip.name}</h1>
        <span className="text-xs text-zinc-400">
          {dangLuu ? "Đang lưu..." : `${stops.length} địa điểm · ${trip.duration_days} ngày`}
        </span>
      </div>

      {/* Hai cột cùng khung nhìn — đặc trưng của mô hình planner. Trên mobile
          bản đồ xuống dưới, vẫn dính đầu màn hình khi cuộn danh sách. */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        <section className="space-y-5">
          {/* Thêm địa điểm */}
          <form onSubmit={tim} className="ui-card bg-white dark:bg-zinc-900 p-3">
            <div className="flex gap-2">
              <input value={timKiem} onChange={(e) => setTimKiem(e.target.value)}
                     placeholder="Tìm địa điểm để thêm..." className="ui-field flex-1" />
              <select value={themVaoNgay} onChange={(e) => setThemVaoNgay(Number(e.target.value))}
                      className="ui-field w-24">
                {Array.from({ length: trip.duration_days }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Ngày {i + 1}</option>
                ))}
              </select>
              <button className="btn-primary shrink-0"><i className="fa-solid fa-magnifying-glass" /></button>
            </div>
            {ketQua.length > 0 && (
              <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {ketQua.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-zinc-500">{(p.category || "").replace(/_/g, " ")}</p>
                    </div>
                    <button onClick={() => them(p)} className="btn-ghost !px-3 !py-1.5 shrink-0">
                      <i className="fa-solid fa-plus" /> Ngày {themVaoNgay}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </form>

          {/* Lịch trình theo ngày */}
          {Object.entries(theoNgay).map(([ngay, ds]) => (
            <div key={ngay} onMouseEnter={() => setNgayXem(Number(ngay))}
                 onMouseLeave={() => setNgayXem(null)}
                 className="ui-card bg-white dark:bg-zinc-900 p-4">
              <h2 className="font-semibold mb-3 flex items-center justify-between">
                <span>Ngày {ngay}</span>
                <span className="text-xs font-normal text-zinc-400">{ds.length} điểm</span>
              </h2>

              {ds.length === 0 ? (
                <p className="text-sm text-zinc-400">
                  Chưa có địa điểm. Dùng ô tìm kiếm phía trên để thêm.
                </p>
              ) : (
                <ol className="space-y-2">
                  {ds.map((s) => {
                    const i = stops.indexOf(s);
                    return (
                      <li key={`${s.type}-${s.id}-${i}`}
                          className="flex items-center gap-3 rounded-field border border-zinc-200 dark:border-zinc-800 p-2">
                        <span className="w-6 h-6 rounded-full bg-accent-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                          {ds.indexOf(s) + 1}
                        </span>
                        <button onClick={() => nav(`/dia-diem/${s.type}/${s.id}`)}
                                className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-medium truncate hover:text-accent-700">{s.name}</p>
                          {s.details?.address && (
                            <p className="text-xs text-zinc-400 truncate">{s.details.address}</p>
                          )}
                        </button>
                        <select value={s.day} onChange={(e) => doiNgay(i, Number(e.target.value))}
                                title="Chuyển sang ngày khác"
                                className="text-xs bg-transparent border border-zinc-200 dark:border-zinc-700 rounded-field px-1.5 py-1">
                          {Array.from({ length: trip.duration_days }, (_, k) => (
                            <option key={k + 1} value={k + 1}>N{k + 1}</option>
                          ))}
                        </select>
                        <button onClick={() => xoaDiem(i)} title="Bỏ khỏi chuyến"
                                className="text-zinc-300 hover:text-red-500 shrink-0">
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          ))}
        </section>

        <section className="lg:sticky lg:top-20 h-[420px] lg:h-[calc(100vh-7rem)]">
          <TripMap stops={stops} focusDay={ngayXem} />
        </section>
      </div>
    </main>
  );
}
