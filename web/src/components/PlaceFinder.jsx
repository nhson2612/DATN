import { useEffect, useRef, useState } from "react";

import { api } from "../api/client";

/* Bước 1 của luồng tự lên lịch: HỎI / TÌM / LƯU địa điểm.
 *
 * Một component dùng cho cả hai chỗ — trang khám phá và trong trình lên lịch —
 * nên hỏi đáp bằng tiếng Việt không còn là một màn riêng phải rời đi mới dùng
 * được. Trước đây trợ lý nằm ở /tro-ly tách hẳn: người dùng hỏi ra một danh
 * sách hay, rồi phải tự nhớ tên mà gõ lại vào ô tìm kiếm của trình lên lịch.
 *
 * Hai cách tìm, vì chúng trả lời hai câu hỏi khác nhau:
 *   Hỏi trợ lý   "quán cà phê ở tỉnh Hà Tĩnh" — chưa biết muốn đi đâu cụ thể.
 *   Tìm theo tên "Chùa Thiên Mụ"              — đã biết đích danh chỗ cần thêm.
 *
 * Kết quả được đẩy lên component cha (onResults) để vẽ chung lên bản đồ, và mỗi
 * dòng có một nút do cha quyết định (thêm vào ngày, lưu vào chuyến...).
 */
const GOI_Y = ["Bãi biển ở Hà Tĩnh", "Chùa ở Huế", "Quán cà phê gần đây"];

function khoangCach(m) {
  return m == null ? "" : m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function PlaceFinder({
  onResults, onPick, hanhDong, nhanHanhDong = "Thêm", goiY = true, viTri,
}) {
  const [che, setChe] = useState("hoi");     // hoi | ten
  const [oNhap, setONhap] = useState("");
  const [dangChay, setDangChay] = useState(false);
  const [loi, setLoi] = useState("");
  const [ketQua, setKetQua] = useState([]);
  const [traLoi, setTraLoi] = useState(null);   // {text, anchor, candidates, goc}

  // Cha chỉ cần biết danh sách hiện tại để vẽ bản đồ; giữ trong ref để không
  // phải đưa onResults vào deps (cha hay truyền hàm mới mỗi lần render).
  const onResultsRef = useRef(onResults);
  onResultsRef.current = onResults;
  useEffect(() => { onResultsRef.current?.(ketQua); }, [ketQua]);

  async function chay(e, cauHoiEp, chonMoc) {
    e?.preventDefault();
    const q = (cauHoiEp ?? oNhap).trim();
    if (!q || dangChay) return;
    setDangChay(true); setLoi("");
    try {
      if (che === "hoi") {
        const d = await api.chat({
          question: q, resolved_admin: chonMoc || undefined,
          user_lon: viTri?.lon, user_lat: viTri?.lat,
        });
        setTraLoi({ text: d.explanation, anchor: d.anchor,
                    candidates: d.candidates || [], goc: q });
        setKetQua(d.results || []);
      } else {
        const d = await api.searchPlaces({ q, page_size: 10 });
        setTraLoi(null);
        setKetQua(d.items || []);
      }
      if (cauHoiEp) setONhap(cauHoiEp);
    } catch (e2) {
      setLoi(e2.message);
    } finally {
      setDangChay(false);
    }
  }

  function doiChe(m) {
    setChe(m); setKetQua([]); setTraLoi(null); setLoi("");
  }

  return (
    <div className="ui-card bg-white dark:bg-zinc-900 p-4">
      <div className="flex gap-1 mb-3">
        {[["hoi", "Hỏi trợ lý"], ["ten", "Tìm theo tên"]].map(([m, nhan]) => (
          <button key={m} onClick={() => doiChe(m)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition
                    ${che === m ? "border-accent-600 text-accent-700 dark:text-accent-500"
                                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
            {nhan}
          </button>
        ))}
      </div>

      <form onSubmit={chay} className="flex gap-2">
        <input value={oNhap} onChange={(e) => setONhap(e.target.value)}
               placeholder={che === "hoi" ? "Bạn muốn tìm gì?" : "Tên địa điểm"}
               className="ui-field flex-1" />
        <button type="submit" disabled={dangChay || !oNhap.trim()}
                className="btn-primary shrink-0">
          {dangChay ? "Đang tìm" : che === "hoi" ? "Hỏi" : "Tìm"}
        </button>
      </form>

      {goiY && che === "hoi" && !ketQua.length && !dangChay && (
        <div className="flex flex-wrap gap-2 mt-3">
          {GOI_Y.map((g) => (
            <button key={g} onClick={(e) => chay(e, g)}
                    className="text-xs px-2.5 py-1 rounded-full border border-zinc-300
                               dark:border-zinc-700 text-zinc-500 hover:border-accent-600
                               hover:text-accent-700 transition">
              {g}
            </button>
          ))}
        </div>
      )}

      {dangChay && (
        <div className="space-y-2 mt-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="skeleton h-10 rounded-field" />
          ))}
        </div>
      )}

      {loi && <p className="text-sm text-red-600 mt-3">{loi}</p>}

      {traLoi?.text && !dangChay && (
        <div className="mt-3 text-sm">
          <p className="whitespace-pre-wrap text-zinc-600 dark:text-zinc-300">
            {traLoi.text.split("\n")[0]}
          </p>

          {/* Địa danh nhập nhằng: cho bấm chọn thẳng. Bắt gõ lại tên thì câu
              trả lời bị hiểu thành một câu hỏi mới. */}
          {traLoi.candidates?.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {traLoi.candidates.map((c) => (
                <button key={c.name} onClick={(e) => chay(e, traLoi.goc, c.name)}
                        disabled={dangChay}
                        className="text-xs px-2.5 py-1 rounded-full border border-zinc-300
                                   dark:border-zinc-700 hover:border-accent-600
                                   hover:text-accent-700 disabled:opacity-50 transition">
                  {c.name}
                  <span className="text-zinc-400 ml-1">
                    {c.la_vung ? "cả vùng" : "một điểm"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {ketQua.length > 0 && !dangChay && (
        <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800
                       max-h-[46vh] overflow-y-auto">
          {ketQua.map((p, i) => (
            <li key={`${p.type}-${p.id}`}
                onMouseEnter={() => onPick?.(i)} onMouseLeave={() => onPick?.(null)}
                className="flex items-center gap-2 py-2">
              <span className="shrink-0 w-6 h-6 rounded-full border-2 border-accent-600
                               text-accent-700 dark:text-accent-500 text-xs font-semibold
                               grid place-items-center">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-zinc-500 truncate">
                  {(p.category || "").replace(/_/g, " ")}
                  {p.met != null && ` · cách ${khoangCach(p.met)}`}
                </p>
              </div>
              {hanhDong && (
                <button onClick={() => hanhDong(p)} className="btn-ghost !px-3 !py-1.5 shrink-0">
                  <i className="fa-solid fa-plus" /> {nhanHanhDong}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
