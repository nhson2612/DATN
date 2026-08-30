import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import PlaceCard from "../components/PlaceCard";

const NHOM = {
  tham_quan: { ten: "Tham quan", icon: "fa-landmark" },
  an_uong: { ten: "Ăn uống", icon: "fa-utensils" },
  vui_choi: { ten: "Vui chơi", icon: "fa-masks-theater" },
  mua_sam: { ten: "Mua sắm", icon: "fa-bag-shopping" },
  luu_tru: { ten: "Nơi lưu trú", icon: "fa-bed" },
};
const PAGE_SIZE = 24;

export default function PlaceList() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const destination = sp.get("destination") || "";
  const nhom = sp.get("nhom") || "tham_quan";

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");

  useEffect(() => { setPage(1); setItems([]); }, [destination, nhom]);

  useEffect(() => {
    let huy = false;
    setDangTai(true); setLoi("");

    // "Nơi lưu trú" nằm ở bảng accommodation, còn /places/search chỉ tra bảng
    // poi — lấy qua trang điểm đến.
    const nap = nhom === "luu_tru"
      ? (destination
          ? api.destination(destination).then((d) => ({
              items: d.groups.find((g) => g.key === "luu_tru")?.items || [],
              total: 0,
            }))
          : Promise.resolve({ items: [], total: 0, error: "Chọn một điểm đến để xem nơi lưu trú." }))
      : api.searchPlaces({ destination, nhom, page, page_size: PAGE_SIZE });

    nap.then((d) => {
      if (huy) return;
      setItems((cu) => (page === 1 ? d.items : [...cu, ...d.items]));
      setTotal(d.total || d.items.length);
      if (d.error) setLoi(d.error);
    }).catch((e) => !huy && setLoi(e.message))
      .finally(() => !huy && setDangTai(false));

    return () => { huy = true; };
  }, [destination, nhom, page]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-10">
      <button onClick={() => nav(destination ? `/diem-den/${destination}` : "/")}
              className="text-sm text-slate-500 hover:text-brand-600 mb-4">
        <i className="fa-solid fa-arrow-left" /> Quay lại
      </button>
      <h1 className="text-2xl font-bold mb-4">
        {NHOM[nhom]?.ten || "Địa điểm"}{destination ? "" : " — cả nước"}
      </h1>

      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(NHOM).map(([k, v]) => (
          <button key={k}
                  onClick={() => setSp({ ...(destination && { destination }), nhom: k })}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    k === nhom ? "bg-brand-500 text-white border-brand-500"
                               : "border-slate-300 text-slate-600 hover:border-brand-500"}`}>
            <i className={`fa-solid ${v.icon}`} /> {v.ten}
          </button>
        ))}
      </div>

      {loi && <p className="text-slate-500 text-sm mb-4">{loi}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((p) => (
          <PlaceCard key={`${p.type}-${p.id}`} place={p} group={nhom}
                     onClick={() => nav(`/dia-diem/${p.type}/${p.id}`)} />
        ))}
      </div>

      {dangTai && <p className="text-slate-400 text-sm mt-6">Đang tải...</p>}

      {!dangTai && total > items.length && (
        <div className="text-center mt-8">
          <button onClick={() => setPage(page + 1)}
                  className="px-6 py-2.5 border border-slate-300 rounded-lg hover:border-brand-500 text-sm font-medium">
            Xem thêm ({(total - items.length).toLocaleString("vi-VN")} địa điểm)
          </button>
        </div>
      )}
      {!dangTai && items.length > 0 && total <= items.length && (
        <p className="text-center text-sm text-slate-400 mt-8">
          Đã hết — tổng {total.toLocaleString("vi-VN")} địa điểm.
        </p>
      )}
    </main>
  );
}
