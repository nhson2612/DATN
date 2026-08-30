import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api/client";
import ErrorBoundary from "../components/ErrorBoundary";
import PlaceFinder from "../components/PlaceFinder";
import TripMap from "../components/TripMap";

/* Trình lên lịch: TOÀN BỘ luồng tự đi du lịch nằm trên một màn hình.
 *
 *   hỏi / tìm  ->  xem trên bản đồ  ->  thêm vào chuyến  ->  chia theo ngày
 *              ->  sắp thứ tự  ->  tối ưu đường đi
 *
 * Trước đây hỏi đáp bằng tiếng Việt nằm ở một trang riêng (/tro-ly): người dùng
 * hỏi ra danh sách hay, rồi phải tự nhớ tên mà gõ lại vào ô tìm kiếm bên này.
 * Gộp lại thì kết quả hỏi đáp thêm được thẳng vào chuyến, và cùng hiện trên một
 * bản đồ với các điểm đã xếp.
 *
 * NGÀY 0 = "chưa xếp ngày". Cần nó vì hai việc khác nhau: gom địa điểm ưng ý
 * (làm trước, nhanh) và quyết ngày nào đi đâu (làm sau, cần nhìn cả bản đồ).
 * Bắt chọn ngày ngay lúc thêm là ép làm hai việc cùng lúc.
 */
export default function TripPlanner({ user, onNeedAuth }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [trip, setTrip] = useState(null);
  const [stops, setStops] = useState([]);
  const [ngayXem, setNgayXem] = useState(null);
  const [dangLuu, setDangLuu] = useState(false);
  const [themVaoNgay, setThemVaoNgay] = useState(0);
  const [timThay, setTimThay] = useState([]);
  const [noiBat, setNoiBat] = useState(null);
  const [viTri, setViTri] = useState(null);
  const [toiUu, setToiUu] = useState(null);   // {day, truoc_m, sau_m}
  const [duong, setDuong] = useState(null);   // {day, doan, met}
  const [dangVe, setDangVe] = useState(null); // ngày đang tính đường
  const [loi, setLoi] = useState("");

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setViTri({ lon: p.coords.longitude, lat: p.coords.latitude }), () => {});
  }, []);

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
    } catch (e) {
      setLoi(e.message);
    } finally { setDangLuu(false); }
  }, [id, trip]);

  function capNhat(moi) { setStops(moi); setToiUu(null); setDuong(null); luu(moi); }

  function xoaDiem(s) { capNhat(stops.filter((x) => x !== s)); }

  function doiNgay(s, ngay) {
    capNhat(stops.map((x) => (x === s ? { ...x, day: ngay } : x)));
  }

  /* Đổi chỗ hai điểm LIỀN NHAU TRONG CÙNG NGÀY. Không đổi theo chỉ số của mảng
     `stops`: các ngày nằm xen kẽ nhau trong đó, nên đổi chỗ theo chỉ số mảng có
     thể quăng điểm sang ngày khác. */
  function chuyen(s, huong) {
    const cungNgay = stops.filter((x) => x.day === s.day);
    const i = cungNgay.indexOf(s);
    const j = i + huong;
    if (j < 0 || j >= cungNgay.length) return;
    const a = stops.indexOf(cungNgay[i]);
    const b = stops.indexOf(cungNgay[j]);
    const moi = [...stops];
    [moi[a], moi[b]] = [moi[b], moi[a]];
    capNhat(moi);
  }

  function them(p, ngay = themVaoNgay) {
    if (stops.some((s) => s.type === p.type && s.id === p.id)) return;
    capNhat([...stops, {
      day: ngay, type: p.type, id: p.id,
      name: p.name, lon: p.lon, lat: p.lat, details: {},
    }]);
  }

  async function toiUuNgay(ngay) {
    setDangLuu(true); setLoi("");
    try {
      const d = await api.optimizeItinerary(id, ngay);
      setStops(d.stops_details || []);
      setToiUu(d.thong_ke?.[0] || null);
    } catch (e) {
      setLoi(e.message);
    } finally { setDangLuu(false); }
  }

  /* Đường bộ thật cho một ngày: pgRouting từng chặng liên tiếp.
     Một lượt pgr_dijkstra mất khoảng 2,7 giây nên đây phải là hành động người
     dùng chủ động bấm, không phải thứ tự chạy mỗi lần đổi lịch. Cũng vì thế thứ
     tự điểm được tối ưu bằng đường chim bay (n² lượt sẽ mất hàng chục giây),
     còn đường thật chỉ tính cho thứ tự đã chốt: n-1 lượt. */
  async function veDuongThat(ngay) {
    const ds = stops.filter((s) => s.day === ngay && s.lon != null);
    if (ds.length < 2) return;
    setDangVe(ngay); setLoi("");
    const doan = [];
    let met = 0;
    try {
      for (let i = 0; i < ds.length - 1; i++) {
        const d = await api.route({
          start_lon: ds[i].lon, start_lat: ds[i].lat,
          end_lon: ds[i + 1].lon, end_lat: ds[i + 1].lat,
        });
        met += d.total_distance_meters || 0;
        d.path.forEach((c) => doan.push({
          type: "Feature", properties: { name: c.street_name }, geometry: c.geom,
        }));
      }
      setDuong({ day: ngay, doan, met });
    } catch (e) {
      // Điểm nằm quá xa mạng lưới đường bộ là chuyện bình thường với dữ liệu
      // Overture (quán trong hẻm, điểm trên đảo) — báo rõ chứ đừng im lặng.
      setLoi(`Không tính được đường cho ngày ${ngay}: ${e.message}`);
    } finally {
      setDangVe(null);
    }
  }

  const theoNgay = useMemo(() => {
    const g = { 0: [] };
    for (let d = 1; d <= (trip?.duration_days || 1); d++) g[d] = [];
    stops.forEach((s) => (g[s.day ?? 0] ||= []).push(s));
    return g;
  }, [stops, trip]);

  const chuaXep = theoNgay[0] || [];

  if (!user) return (
    <main className="max-w-6xl mx-auto px-4 py-10 text-sm text-zinc-500">
      Đăng nhập để mở chuyến đi.
    </main>
  );
  if (!trip) return (
    <main className="max-w-6xl mx-auto px-4 py-10"><div className="skeleton h-96 rounded-card" /></main>
  );

  return (
    <main className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => nav("/chuyen-di")} title="Về danh sách chuyến"
                className="text-sm text-zinc-500 hover:text-accent-700">
          <i className="fa-solid fa-arrow-left" />
        </button>
        <h1 className="text-xl font-bold tracking-tight flex-1">{trip.name}</h1>
        <span className="text-xs text-zinc-400">
          {dangLuu ? "Đang lưu…"
                   : `${stops.length} địa điểm · ${trip.duration_days} ngày`}
        </span>
      </div>

      {loi && <p className="text-sm text-red-600 mb-3">{loi}</p>}

      {/* Hai cột cùng khung nhìn — đặc trưng của mô hình planner. Trên mobile
          bản đồ xuống dưới, vẫn dính đầu màn hình khi cuộn danh sách. */}
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
        <section className="space-y-5">
          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-sm font-semibold text-zinc-500">
                1 · Hỏi hoặc tìm địa điểm
              </h2>
              <label className="text-xs text-zinc-500 flex items-center gap-1.5">
                Thêm vào
                <select value={themVaoNgay} onChange={(e) => setThemVaoNgay(Number(e.target.value))}
                        className="ui-field !py-1 !px-2 text-xs">
                  <option value={0}>Chưa xếp ngày</option>
                  {Array.from({ length: trip.duration_days }, (_, i) => (
                    <option key={i + 1} value={i + 1}>Ngày {i + 1}</option>
                  ))}
                </select>
              </label>
            </div>

            <PlaceFinder
              viTri={viTri}
              onResults={setTimThay}
              onPick={setNoiBat}
              hanhDong={(p) => them(p)}
              nhanHanhDong={themVaoNgay === 0 ? "Lưu" : `Ngày ${themVaoNgay}`}
            />
          </div>

          {chuaXep.length > 0 && (
            <Ngay nhan="Chưa xếp ngày" ds={chuaXep} trip={trip} stops={stops}
                  onHover={() => setNgayXem(null)}
                  doiNgay={doiNgay} xoaDiem={xoaDiem} chuyen={chuyen} nav={nav}
                  moTa="Kéo sang một ngày cụ thể khi đã biết lịch." />
          )}

          <h2 className="text-sm font-semibold text-zinc-500 pt-1">
            2 · Chia theo ngày và sắp thứ tự
          </h2>

          {Array.from({ length: trip.duration_days }, (_, k) => k + 1).map((ngay) => (
            <Ngay key={ngay} nhan={`Ngày ${ngay}`} ds={theoNgay[ngay] || []}
                  trip={trip} stops={stops}
                  onHover={(v) => setNgayXem(v ? ngay : null)}
                  doiNgay={doiNgay} xoaDiem={xoaDiem} chuyen={chuyen} nav={nav}
                  onToiUu={() => toiUuNgay(ngay)} dangLuu={dangLuu}
                  toiUu={toiUu?.day === ngay ? toiUu : null}
                  onVeDuong={() => veDuongThat(ngay)} dangVe={dangVe === ngay}
                  duong={duong?.day === ngay ? duong : null} />
          ))}
        </section>

        <section className="lg:sticky lg:top-20 h-[420px] lg:h-[calc(100vh-7rem)]">
          <ErrorBoundary ten="Bản đồ">
            <TripMap stops={stops} focusDay={duong ? duong.day : ngayXem}
                     timThay={timThay} noiBat={noiBat} onThem={(p) => them(p)}
                     duongThat={duong?.doan} />
          </ErrorBoundary>
        </section>
      </div>
    </main>
  );
}

/* Một ngày trong lịch trình. Tách ra vì "chưa xếp ngày" dùng đúng khung này,
   chỉ khác là không có nút tối ưu (chưa xếp thì chưa có thứ tự để tối ưu). */
function Ngay({ nhan, ds, trip, stops, onHover, doiNgay, xoaDiem, chuyen, nav,
                onToiUu, dangLuu, toiUu, moTa, onVeDuong, dangVe, duong }) {
  return (
    <div onMouseEnter={() => onHover(true)} onMouseLeave={() => onHover(false)}
         className="ui-card bg-white dark:bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="font-semibold">{nhan}</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">{ds.length} điểm</span>
          {onToiUu && ds.length >= 3 && (
            <button onClick={onToiUu} disabled={dangLuu}
                    title="Sắp lại thứ tự cho đi ít đường nhất"
                    className="text-xs text-accent-700 dark:text-accent-500
                               hover:underline disabled:opacity-50">
              Tối ưu thứ tự
            </button>
          )}
          {onVeDuong && ds.length >= 2 && (
            <button onClick={onVeDuong} disabled={dangVe}
                    title="Tính đường bộ thật bằng pgRouting"
                    className="text-xs text-accent-700 dark:text-accent-500
                               hover:underline disabled:opacity-50">
              {dangVe ? "Đang tính…" : "Vẽ đường thật"}
            </button>
          )}
        </div>
      </div>

      {toiUu && (
        <p className="text-xs text-accent-700 dark:text-accent-500 mb-3">
          Đã sắp lại: {(toiUu.truoc_m / 1000).toFixed(1)} km →{" "}
          <b>{(toiUu.sau_m / 1000).toFixed(1)} km</b>{" "}
          <span className="text-zinc-400">(đường chim bay)</span>
        </p>
      )}

      {duong && (
        <p className="text-xs text-accent-700 dark:text-accent-500 mb-3">
          Đường bộ thật: <b>{(duong.met / 1000).toFixed(1)} km</b>{" "}
          <span className="text-zinc-400">({ds.length - 1} chặng, pgRouting)</span>
        </p>
      )}

      {ds.length === 0 ? (
        <p className="text-sm text-zinc-400">{moTa || "Chưa có địa điểm nào."}</p>
      ) : (
        <ol className="space-y-2">
          {ds.map((s, i) => (
            <li key={`${s.type}-${s.id}`}
                className="flex items-center gap-2 rounded-field border border-zinc-200
                           dark:border-zinc-800 p-2">
              <span className="w-6 h-6 rounded-full bg-accent-600 text-white text-xs
                               font-semibold flex items-center justify-center shrink-0">
                {i + 1}
              </span>

              <button onClick={() => nav(`/dia-diem/${s.type}/${s.id}`)}
                      className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium truncate hover:text-accent-700">{s.name}</p>
                {s.mo_ta && <p className="text-xs text-zinc-400 truncate">{s.mo_ta}</p>}
              </button>

              <div className="flex flex-col shrink-0">
                <button onClick={() => chuyen(s, -1)} disabled={i === 0}
                        title="Lên trước" className="text-zinc-300 hover:text-accent-700
                                                     disabled:opacity-30 leading-none">
                  <i className="fa-solid fa-caret-up" />
                </button>
                <button onClick={() => chuyen(s, 1)} disabled={i === ds.length - 1}
                        title="Xuống sau" className="text-zinc-300 hover:text-accent-700
                                                     disabled:opacity-30 leading-none">
                  <i className="fa-solid fa-caret-down" />
                </button>
              </div>

              <select value={s.day ?? 0} onChange={(e) => doiNgay(s, Number(e.target.value))}
                      title="Chuyển sang ngày khác"
                      className="text-xs bg-transparent border border-zinc-200
                                 dark:border-zinc-700 rounded-field px-1.5 py-1 shrink-0">
                <option value={0}>—</option>
                {Array.from({ length: trip.duration_days }, (_, k) => (
                  <option key={k + 1} value={k + 1}>N{k + 1}</option>
                ))}
              </select>

              <button onClick={() => xoaDiem(s)} title="Bỏ khỏi chuyến"
                      className="text-zinc-300 hover:text-red-500 shrink-0">
                <i className="fa-solid fa-xmark" />
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
