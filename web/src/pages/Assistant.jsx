import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/client";
import SearchMap from "../components/SearchMap";

/* Trợ lý bản đồ — hỏi bằng tiếng Việt, trả lời kèm địa điểm trên bản đồ.
 *
 * Đây là tính năng lõi của đề tài ("hỏi đáp tiếng Việt -> truy vấn không gian
 * -> trả lời + hiển thị bản đồ"). Bố cục: câu hỏi và danh sách bên trái, bản đồ
 * bên phải, hai bên luôn thấy cùng lúc — người dùng cần đối chiếu dòng thứ 3
 * trong danh sách với chấm số 3 trên bản đồ.
 *
 * Khác trang chủ ở chỗ bản đồ được phép làm trung tâm: ở đây bản đồ CHÍNH LÀ
 * câu trả lời, không phải đồ trang trí.
 */

const GOI_Y = [
  "Quán cà phê gần đây",
  "Khách sạn gần biển Mỹ Khê",
  "Quán bún đậu ở Hà Đông",
  "Chùa ở Huế",
];

function khoangCach(met) {
  return met < 1000 ? `${Math.round(met)} m` : `${(met / 1000).toFixed(1)} km`;
}

export default function Assistant() {
  const [luot, setLuot] = useState([]);        // [{hoi, dap, anchor, results}]
  const [cauHoi, setCauHoi] = useState("");
  const [dangHoi, setDangHoi] = useState(false);
  const [loi, setLoi] = useState("");
  const [chon, setChon] = useState(null);      // chỉ số kết quả đang nhấn mạnh
  const [viTri, setViTri] = useState(null);

  const [cheDoDuong, setCheDoDuong] = useState(false);
  const [diemDuong, setDiemDuong] = useState([]);
  const [tuyen, setTuyen] = useState(null);
  const [dangTinh, setDangTinh] = useState(false);

  const cuoiRef = useRef(null);
  const moiNhat = luot[luot.length - 1];
  const [params, setParams] = useSearchParams();

  // Xin vị trí một lần. Không có thì backend tự suy từ IP.
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => setViTri({ lon: p.coords.longitude, lat: p.coords.latitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    cuoiRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [luot, dangHoi]);

  // ?q=... để câu hỏi thành đường dẫn chia sẻ được, và để chỗ khác trong trang
  // (ô tìm ở trang chủ chẳng hạn) dẫn thẳng sang đây kèm câu hỏi.
  const qUrl = params.get("q");
  useEffect(() => {
    if (qUrl) hoi(qUrl);
    // Chỉ chạy khi đường dẫn đổi, không chạy lại theo state trong trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qUrl]);

  /* `chonMoc` là địa danh người dùng đã chọn ở lượt hỏi lại trước.
   *
   * Phải gửi kèm CÂU HỎI GỐC chứ không gửi tên địa danh như một câu hỏi mới:
   * hỏi "bãi biển ở Hà Tĩnh" rồi trả lời "Tỉnh Hà Tĩnh" mà gửi mỗi chuỗi đó thì
   * backend hiểu người dùng đang tìm địa điểm TÊN "tỉnh hà tĩnh", và khớp mờ ra
   * "Tịnh Hiên Chay", "Chùa Tỉnh Hội" quanh chỗ đang đứng. */
  async function hoi(text, chonMoc) {
    const q = (text ?? cauHoi).trim();
    if (!q || dangHoi) return;
    setCauHoi(""); setLoi(""); setChon(null); setDangHoi(true);
    setLuot((l) => [...l, { hoi: chonMoc ? `${q} · ${chonMoc}` : q }]);
    // replace chứ không push: gõ 5 câu rồi bấm Back không nên phải bấm 5 lần
    // mới rời được trang.
    if (params.get("q") !== q) setParams({ q }, { replace: true });
    try {
      const d = await api.chat({
        question: q,
        resolved_admin: chonMoc || undefined,
        user_lon: viTri?.lon, user_lat: viTri?.lat,
      });
      setLuot((l) => [
        ...l.slice(0, -1),
        {
          hoi: chonMoc ? `${q} · ${chonMoc}` : q,
          goc: q,                        // giữ để lượt chọn mốc gửi lại
          dap: d.explanation,
          anchor: d.anchor,
          results: d.results || [],
          candidates: d.candidates || [],
        },
      ]);
    } catch (e) {
      setLoi(e.message);
      setLuot((l) => l.slice(0, -1));
    } finally {
      setDangHoi(false);
    }
  }

  // Bấm bản đồ chỉ có tác dụng khi đang ở chế độ chỉ đường — nếu không, mọi cú
  // bấm nhầm sẽ xoá kết quả hỏi đáp.
  const bamBanDo = useCallback((lngLat) => {
    setDiemDuong((ds) => {
      const moi = ds.length >= 2 ? [] : [...ds];
      moi.push([lngLat.lng, lngLat.lat]);
      return moi;
    });
    setTuyen(null);
  }, []);

  async function tinhDuong() {
    if (diemDuong.length < 2) return;
    setDangTinh(true); setLoi("");
    try {
      const d = await api.route({
        start_lon: diemDuong[0][0], start_lat: diemDuong[0][1],
        end_lon: diemDuong[1][0], end_lat: diemDuong[1][1],
      });
      // Nối thêm hai đoạn đi bộ từ điểm người dùng bấm tới đường gần nhất, nếu
      // không tuyến sẽ bắt đầu lơ lửng cách marker vài chục mét.
      const doan = d.path.map((s) => ({
        type: "Feature", properties: { name: s.street_name }, geometry: s.geom,
      }));
      if (d.start_snap_lon != null) doan.unshift({
        type: "Feature", properties: {},
        geometry: { type: "LineString", coordinates: [diemDuong[0], [d.start_snap_lon, d.start_snap_lat]] },
      });
      if (d.end_snap_lon != null) doan.push({
        type: "Feature", properties: {},
        geometry: { type: "LineString", coordinates: [[d.end_snap_lon, d.end_snap_lat], diemDuong[1]] },
      });
      setTuyen({ doan, met: d.total_distance_meters });
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangTinh(false);
    }
  }

  function thoatCheDoDuong() {
    setCheDoDuong(false); setDiemDuong([]); setTuyen(null);
  }

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6">
      <div className="grid lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-6
                      lg:h-[calc(100vh-8rem)]">

        {/* ── Cột trái: hỏi đáp ─────────────────────────────────────────── */}
        <div className="flex flex-col min-h-0">
          <div className="mb-3">
            <h1 className="text-xl font-bold">Trợ lý bản đồ</h1>
            <p className="text-sm text-zinc-500">
              Hỏi bằng tiếng Việt, kết quả hiện ngay trên bản đồ bên cạnh.
            </p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[240px]">
            {!luot.length && !dangHoi && (
              <div className="ui-card p-4 bg-white dark:bg-zinc-900">
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-3">
                  Thử một trong các câu sau:
                </p>
                <div className="flex flex-wrap gap-2">
                  {GOI_Y.map((g) => (
                    <button key={g} onClick={() => hoi(g)}
                            className="text-sm px-3 py-1.5 rounded-full border border-zinc-300
                                       dark:border-zinc-700 hover:border-accent-600
                                       hover:text-accent-700 transition">
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {luot.map((t, i) => (
              <div key={i} className="space-y-3">
                <p className="text-sm font-medium bg-accent-50 dark:bg-accent-900/40
                              text-accent-900 dark:text-accent-100 rounded-card px-3 py-2 inline-block">
                  {t.hoi}
                </p>

                {t.dap && (
                  <div className="ui-card p-4 bg-white dark:bg-zinc-900">
                    <p className="text-sm whitespace-pre-wrap">{t.dap}</p>

                    {/* Địa danh nhập nhằng: cho bấm chọn thẳng. Bắt gõ lại tên
                        thì câu trả lời bị hiểu thành câu hỏi mới. */}
                    {t.candidates?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {t.candidates.map((c) => (
                          <button key={c.name} onClick={() => hoi(t.goc, c.name)} disabled={dangHoi}
                                  className="text-sm px-3 py-1.5 rounded-full border
                                             border-zinc-300 dark:border-zinc-700
                                             hover:border-accent-600 hover:text-accent-700
                                             disabled:opacity-50 transition">
                            {c.name}
                            <span className="text-zinc-400 ml-1.5">
                              {c.la_vung ? "cả vùng" : "một điểm"}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {t.anchor && (
                      <p className="mt-2 text-xs text-zinc-500">
                        <i className="fa-solid fa-location-dot" /> Tính từ <b>{t.anchor.name}</b>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}

            {dangHoi && (
              <div className="ui-card p-4 bg-white dark:bg-zinc-900 space-y-2">
                <div className="skeleton h-3 w-2/3 rounded-field" />
                <div className="skeleton h-3 w-5/6 rounded-field" />
                <div className="skeleton h-3 w-1/2 rounded-field" />
              </div>
            )}

            {/* Danh sách kết quả của lượt mới nhất — mỗi dòng ứng với một chấm
                số trên bản đồ. */}
            {moiNhat?.results?.length > 0 && (
              <ul className="space-y-2">
                {moiNhat.results.map((r, i) => (
                  <li key={`${r.type}-${r.id}`}
                      onMouseEnter={() => setChon(i)}
                      onMouseLeave={() => setChon(null)}
                      className={`ui-card p-3 bg-white dark:bg-zinc-900 flex gap-3 transition
                                  ${chon === i ? "border-accent-600" : ""}`}>
                    <span className="shrink-0 w-6 h-6 rounded-full bg-accent-600 text-white
                                     text-xs font-semibold grid place-items-center">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link to={`/dia-diem/${r.type}/${r.id}`}
                            className="text-sm font-medium hover:text-accent-700 line-2">
                        {r.name}
                      </Link>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {(r.category || "").replace(/_/g, " ")} · cách {khoangCach(r.met)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {loi && (
              <p className="text-sm text-red-600 dark:text-red-400">{loi}</p>
            )}
            <div ref={cuoiRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); hoi(); }}
                className="mt-3 flex gap-2">
            <input value={cauHoi} onChange={(e) => setCauHoi(e.target.value)}
                   placeholder="Bạn muốn tìm gì?"
                   className="ui-field flex-1" />
            <button type="submit" disabled={dangHoi || !cauHoi.trim()}
                    className="btn-primary shrink-0">
              {dangHoi ? "Đang tìm" : "Hỏi"}
            </button>
          </form>
        </div>

        {/* ── Cột phải: bản đồ ──────────────────────────────────────────── */}
        <div className="relative h-[70vh] lg:h-full mt-6 lg:mt-0">
          <SearchMap
            results={moiNhat?.results}
            anchor={moiNhat?.anchor}
            highlight={chon}
            route={tuyen?.doan}
            routePoints={diemDuong}
            onMapClick={cheDoDuong ? bamBanDo : null}
            onPick={setChon}
          />

          {/* Chỉ đường pgRouting — công cụ phụ, nên nằm nổi trên bản đồ chứ
              không chiếm chỗ của hỏi đáp. */}
          <div className="absolute top-3 left-3 right-3 sm:right-auto sm:w-80">
            {!cheDoDuong ? (
              <button onClick={() => setCheDoDuong(true)}
                      className="btn bg-white dark:bg-zinc-900 border border-zinc-300
                                 dark:border-zinc-700 shadow-sm hover:border-accent-600">
                <i className="fa-solid fa-diamond-turn-right" /> Chỉ đường
              </button>
            ) : (
              <div className="ui-card bg-white dark:bg-zinc-900 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="text-sm font-semibold">Đường đi ngắn nhất</p>
                    <p className="text-xs text-zinc-500">Bấm hai điểm trên bản đồ</p>
                  </div>
                  <button onClick={thoatCheDoDuong}
                          className="text-zinc-400 hover:text-zinc-700" title="Đóng">
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>

                <ol className="text-sm space-y-1 mb-3">
                  {["A · điểm đi", "B · điểm đến"].map((nhan, i) => (
                    <li key={nhan} className="flex justify-between gap-2">
                      <span className="text-zinc-500">{nhan}</span>
                      <span className={diemDuong[i] ? "" : "text-zinc-400"}>
                        {diemDuong[i]
                          ? `${diemDuong[i][0].toFixed(4)}, ${diemDuong[i][1].toFixed(4)}`
                          : "chưa chọn"}
                      </span>
                    </li>
                  ))}
                </ol>

                <button onClick={tinhDuong} disabled={diemDuong.length < 2 || dangTinh}
                        className="btn-primary w-full">
                  {dangTinh ? "Đang tính" : "Tìm đường"}
                </button>

                {tuyen && (
                  <p className="mt-3 text-sm">
                    Quãng đường <b>{(tuyen.met / 1000).toFixed(2)} km</b>
                    <span className="text-zinc-500"> ({Math.round(tuyen.met)} m)</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
