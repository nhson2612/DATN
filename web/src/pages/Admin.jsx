import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../api/client";

/* Trang quản trị. Bốn việc admin thật sự phải làm: xem hệ thống có gì, sửa dữ
 * liệu địa điểm, và trả lời hai loại yêu cầu khách gửi lên (đặt chỗ lẻ và đặt
 * tour).
 *
 * Trang cũ có một panel "Nhật ký hoạt động gần đây" ghi sẵn hai dòng bịa
 * ("Đồng bộ hoá 24 điểm địa danh du lịch Đà Nẵng · 10 phút trước") không đọc từ
 * đâu cả. Bỏ hẳn: một con số sai còn tệ hơn không có con số.
 */

const TABS = [
  { id: "tong-quan", nhan: "Tổng quan" },
  { id: "dia-diem",  nhan: "Địa điểm" },
  { id: "dat-cho",   nhan: "Yêu cầu đặt chỗ" },
  { id: "dat-tour",  nhan: "Đặt tour" },
];

const TRANG_THAI = { moi: "Mới", da_lien_he: "Đã liên hệ", huy: "Huỷ" };

const FORM_RONG = {
  place_type: "poi", name: "", amenity: "", tourism: "",
  description: "", price_range: "", stars: 0, address: "", lon: "", lat: "",
};

function so(n) {
  return n == null ? "—" : Number(n).toLocaleString("vi-VN");
}

export default function Admin({ user }) {
  // Tab nằm trong đường dẫn: tải lại trang giữa lúc xử lý một danh sách yêu cầu
  // đặt chỗ mà bị ném về Tổng quan là mất chỗ đang làm.
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === params.get("tab"))
    ? params.get("tab") : "tong-quan";
  const setTab = (id) => setParams({ tab: id }, { replace: true });

  if (!user) {
    return (
      <p className="max-w-6xl mx-auto px-4 py-16 text-center text-zinc-500">
        Cần đăng nhập bằng tài khoản quản trị.
      </p>
    );
  }
  if (user.role !== "admin") {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center">
        <p className="text-zinc-600 dark:text-zinc-400">
          Tài khoản này không có quyền quản trị.
        </p>
        <Link to="/" className="btn-ghost inline-block mt-4">Về trang chủ</Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Quản trị</h1>
      <p className="text-sm text-zinc-500 mb-6">{user.full_name || user.email}</p>

      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition
                    ${tab === t.id
                      ? "border-accent-600 text-accent-700 dark:text-accent-500"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
            {t.nhan}
          </button>
        ))}
      </div>

      {tab === "tong-quan" && <TongQuan />}
      {tab === "dia-diem"  && <DiaDiem />}
      {tab === "dat-cho"   && <DatCho />}
      {tab === "dat-tour"  && <DatTour />}
    </div>
  );
}

/* ── Tổng quan ──────────────────────────────────────────────────────────── */

function TongQuan() {
  const [tk, setTk] = useState(null);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    api.adminStats().then((d) => setTk(d.stats)).catch((e) => setLoi(e.message));
  }, []);

  if (loi) return <p className="text-sm text-red-600">{loi}</p>;
  if (!tk) return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton h-24 rounded-card" />)}
    </div>
  );

  const o = [
    { nhan: "Địa điểm (POI)", v: tk.poi },
    { nhan: "Cơ sở lưu trú", v: tk.luu_tru },
    { nhan: "Ảnh đã lấy về", v: tk.anh },
    { nhan: "Người dùng", v: tk.nguoi_dung },
    { nhan: "Lịch trình đã lưu", v: tk.lich_trinh },
    { nhan: "Tour đang mở", v: tk.tour },
    { nhan: "Đặt chỗ chờ xử lý", v: tk.dat_cho_moi },
    { nhan: "Lượt đặt tour", v: tk.dat_tour },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {o.map((x) => (
        <div key={x.nhan} className="ui-card p-4 bg-white dark:bg-zinc-900">
          <p className="text-sm text-zinc-500">{x.nhan}</p>
          <p className="text-2xl font-bold mt-1">{so(x.v)}</p>
          {x.chu && <p className="text-xs text-zinc-400 mt-1">{x.chu}</p>}
        </div>
      ))}
    </div>
  );
}

/* ── Địa điểm ───────────────────────────────────────────────────────────── */

function DiaDiem() {
  const [q, setQ] = useState("");
  const [bang, setBang] = useState("poi");
  const [ds, setDs] = useState([]);
  const [tong, setTong] = useState(0);
  const [trang, setTrang] = useState(1);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");
  const [form, setForm] = useState(null);   // null = đóng; object = đang sửa/thêm

  const PAGE = 20;

  function tai() {
    setDangTai(true);
    api.searchPlaces({ q: q || undefined, place_type: bang, page: trang, page_size: PAGE })
      .then((d) => { setDs(d.items || []); setTong(d.total || 0); })
      .catch((e) => setLoi(e.message))
      .finally(() => setDangTai(false));
  }

  // Gõ tới đâu tìm tới đó, nhưng chờ 400ms — gõ "khách sạn" mà bắn 8 request thì
  // kết quả về không đúng thứ tự và hiện nhầm.
  useEffect(() => {
    const t = setTimeout(tai, 400);
    return () => clearTimeout(t);
  }, [q, bang, trang]);

  async function xoa(item) {
    if (!window.confirm(`Xoá "${item.name}"? Không khôi phục được.`)) return;
    try { await api.deletePlace(item.type, item.id); tai(); }
    catch (e) { setLoi(e.message); }
  }

  const soTrang = Math.max(1, Math.ceil(tong / PAGE));

  return (
    <div>
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* POI và chỗ ở là hai bảng riêng trong CSDL, không gộp danh sách được. */}
        <select value={bang} onChange={(e) => { setBang(e.target.value); setTrang(1); }}
                className="ui-field">
          <option value="poi">Địa điểm du lịch</option>
          <option value="accommodation">Cơ sở lưu trú</option>
        </select>
        <input value={q} onChange={(e) => { setQ(e.target.value); setTrang(1); }}
               placeholder="Tìm theo tên"
               className="ui-field flex-1 min-w-[200px]" />
        <button onClick={() => setForm({ ...FORM_RONG, place_type: bang })}
                className="btn-primary">
          Thêm địa điểm
        </button>
      </div>

      {loi && <p className="text-sm text-red-600 mb-3">{loi}</p>}

      <div className="ui-card bg-white dark:bg-zinc-900 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">Tên</th>
              <th className="px-4 py-3 font-medium">Loại</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Toạ độ</th>
              <th className="px-4 py-3 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {dangTai && Array.from({ length: 6 }, (_, i) => (
              <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800/60">
                <td className="px-4 py-3" colSpan={4}><div className="skeleton h-4 rounded-field" /></td>
              </tr>
            ))}

            {!dangTai && !ds.length && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                Không có địa điểm nào khớp.
              </td></tr>
            )}

            {!dangTai && ds.map((it) => (
              <tr key={`${it.type}-${it.id}`}
                  className="border-b border-zinc-100 dark:border-zinc-800/60">
                <td className="px-4 py-3">
                  <Link to={`/dia-diem/${it.type}/${it.id}`} className="hover:text-accent-700">
                    {it.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">
                  {(it.category || "").replace(/_/g, " ") || it.type}
                </td>
                <td className="px-4 py-3 text-zinc-500 hidden md:table-cell tabular-nums">
                  {it.lon?.toFixed(4)}, {it.lat?.toFixed(4)}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button onClick={() => setForm({
                            ...FORM_RONG, id: it.id, place_type: it.type,
                            name: it.name, lon: it.lon, lat: it.lat,
                            ...(it.type === "poi" ? { amenity: it.category || "" }
                                                  : { tourism: it.category || "" }),
                          })}
                          className="text-zinc-500 hover:text-accent-700 px-2">Sửa</button>
                  <button onClick={() => xoa(it)}
                          className="text-zinc-500 hover:text-red-600 px-2">Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-zinc-500">{so(tong)} địa điểm · trang {trang}/{so(soTrang)}</span>
        <div className="flex gap-2">
          <button onClick={() => setTrang((t) => t - 1)} disabled={trang <= 1}
                  className="btn-ghost">Trước</button>
          <button onClick={() => setTrang((t) => t + 1)} disabled={trang >= soTrang}
                  className="btn-ghost">Sau</button>
        </div>
      </div>

      {form && <FormDiaDiem form={form} setForm={setForm}
                            onXong={() => { setForm(null); tai(); }} />}
    </div>
  );
}

function FormDiaDiem({ form, setForm, onXong }) {
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");
  const laPoi = form.place_type === "poi";

  function dat(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function luu(e) {
    e.preventDefault();
    setDangLuu(true); setLoi("");
    const chung = {
      name: form.name.trim(),
      lon: Number(form.lon), lat: Number(form.lat),
    };
    const body = laPoi
      ? { ...chung, amenity: form.amenity || null, tourism: form.tourism || null,
          description: form.description || null }
      : { ...chung, tourism: form.tourism || null, amenity: form.amenity || null,
          price_range: form.price_range || null, stars: Number(form.stars) || 0,
          address: form.address || null };
    try {
      if (form.id) await api.updatePlace(form.place_type, form.id, body);
      else await api.createPlace(form.place_type, body);
      onXong();
    } catch (e2) {
      setLoi(e2.message);
    } finally {
      setDangLuu(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-900/50 grid place-items-center p-4"
         onClick={() => setForm(null)}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={luu}
            className="ui-card bg-white dark:bg-zinc-900 p-6 w-full max-w-lg
                       max-h-[90vh] overflow-y-auto space-y-4">
        <h2 className="text-lg font-bold">
          {form.id ? "Sửa địa điểm" : "Thêm địa điểm"}
        </h2>

        <label className="block">
          <span className="text-sm text-zinc-500">Phân loại</span>
          {/* Đổi bảng của một bản ghi đã có nghĩa là chuyển dòng giữa hai bảng,
              backend không làm được — nên khoá lại khi đang sửa. */}
          <select value={form.place_type} disabled={!!form.id}
                  onChange={(e) => dat("place_type", e.target.value)}
                  className="ui-field w-full mt-1 disabled:opacity-60">
            <option value="poi">Địa điểm du lịch</option>
            <option value="accommodation">Cơ sở lưu trú</option>
          </select>
        </label>

        <label className="block">
          <span className="text-sm text-zinc-500">Tên</span>
          <input required value={form.name} onChange={(e) => dat("name", e.target.value)}
                 className="ui-field w-full mt-1" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm text-zinc-500">Kinh độ</span>
            <input required type="number" step="any" value={form.lon}
                   onChange={(e) => dat("lon", e.target.value)}
                   className="ui-field w-full mt-1" />
          </label>
          <label className="block">
            <span className="text-sm text-zinc-500">Vĩ độ</span>
            <input required type="number" step="any" value={form.lat}
                   onChange={(e) => dat("lat", e.target.value)}
                   className="ui-field w-full mt-1" />
          </label>
        </div>

        {laPoi ? (
          <>
            <label className="block">
              <span className="text-sm text-zinc-500">Loại (amenity)</span>
              <input value={form.amenity} onChange={(e) => dat("amenity", e.target.value)}
                     placeholder="restaurant, cafe, bar…"
                     className="ui-field w-full mt-1" />
            </label>
            <label className="block">
              <span className="text-sm text-zinc-500">Mô tả</span>
              <textarea rows={3} value={form.description}
                        onChange={(e) => dat("description", e.target.value)}
                        className="ui-field w-full mt-1" />
            </label>
          </>
        ) : (
          <>
            <label className="block">
              <span className="text-sm text-zinc-500">Loại hình lưu trú</span>
              <input value={form.tourism} onChange={(e) => dat("tourism", e.target.value)}
                     placeholder="hotel, guest_house, hostel…"
                     className="ui-field w-full mt-1" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-sm text-zinc-500">Hạng sao</span>
                <input type="number" min={0} max={5} value={form.stars}
                       onChange={(e) => dat("stars", e.target.value)}
                       className="ui-field w-full mt-1" />
              </label>
              <label className="block">
                <span className="text-sm text-zinc-500">Mức giá</span>
                <select value={form.price_range}
                        onChange={(e) => dat("price_range", e.target.value)}
                        className="ui-field w-full mt-1">
                  <option value="">Không rõ</option>
                  <option value="Rẻ">Rẻ</option>
                  <option value="Trung bình">Trung bình</option>
                  <option value="Sang trọng">Sang trọng</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-sm text-zinc-500">Địa chỉ</span>
              <input value={form.address} onChange={(e) => dat("address", e.target.value)}
                     className="ui-field w-full mt-1" />
            </label>
          </>
        )}

        {loi && <p className="text-sm text-red-600">{loi}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={() => setForm(null)} className="btn-ghost">Huỷ</button>
          <button type="submit" disabled={dangLuu} className="btn-primary">
            {dangLuu ? "Đang lưu" : "Lưu"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Yêu cầu đặt chỗ ────────────────────────────────────────────────────── */

function DatCho() {
  const [loc, setLoc] = useState("");
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState("");

  function tai() {
    setDs(null);
    api.adminBookings(loc || undefined)
      .then((d) => setDs(d.bookings || []))
      .catch((e) => { setLoi(e.message); setDs([]); });
  }
  useEffect(tai, [loc]);

  async function doiTrangThai(id, tt) {
    try { await api.adminSetBookingStatus(id, tt); tai(); }
    catch (e) { setLoi(e.message); }
  }

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {[["", "Tất cả"], ...Object.entries(TRANG_THAI)].map(([v, nhan]) => (
          <button key={v} onClick={() => setLoc(v)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition
                    ${loc === v ? "border-accent-600 text-accent-700 dark:text-accent-500"
                                : "border-zinc-300 dark:border-zinc-700 text-zinc-500 hover:border-accent-600"}`}>
            {nhan}
          </button>
        ))}
      </div>

      {loi && <p className="text-sm text-red-600 mb-3">{loi}</p>}

      {ds === null && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-24 rounded-card" />)}
        </div>
      )}

      {ds?.length === 0 && (
        <p className="text-zinc-500 py-10 text-center">Chưa có yêu cầu nào.</p>
      )}

      <div className="space-y-3">
        {(ds || []).map((b) => (
          <div key={b.id} className="ui-card p-4 bg-white dark:bg-zinc-900">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {b.full_name}
                  <span className="text-zinc-500 font-normal"> · {b.phone}</span>
                </p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  {b.place_name || `${b.place_type} #${b.place_id}`}
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  {b.check_in && b.check_out
                    ? `${b.check_in} → ${b.check_out} · `
                    : ""}
                  {b.guests} khách
                </p>
                {b.note && <p className="text-sm mt-2">{b.note}</p>}
              </div>

              <select value={b.status} onChange={(e) => doiTrangThai(b.id, e.target.value)}
                      className="ui-field shrink-0">
                {Object.entries(TRANG_THAI).map(([v, nhan]) => (
                  <option key={v} value={v}>{nhan}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Đặt tour ───────────────────────────────────────────────────────────── */

function DatTour() {
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    api.adminTourBookings()
      .then((d) => setDs(d.bookings || []))
      .catch((e) => { setLoi(e.message); setDs([]); });
  }, []);

  if (loi) return <p className="text-sm text-red-600">{loi}</p>;
  if (ds === null) return (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, i) => <div key={i} className="skeleton h-20 rounded-card" />)}
    </div>
  );
  if (!ds.length) return (
    <p className="text-zinc-500 py-10 text-center">Chưa có lượt đặt tour nào.</p>
  );

  return (
    <div className="ui-card bg-white dark:bg-zinc-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className="px-4 py-3 font-medium">Khách</th>
            <th className="px-4 py-3 font-medium">Tour</th>
            <th className="px-4 py-3 font-medium hidden sm:table-cell">Khởi hành</th>
            <th className="px-4 py-3 font-medium text-right">Số khách</th>
          </tr>
        </thead>
        <tbody>
          {ds.map((b) => (
            <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-800/60">
              <td className="px-4 py-3">
                {b.full_name}
                <span className="block text-zinc-500">{b.phone}</span>
              </td>
              <td className="px-4 py-3">{b.tour_name || `#${b.tour_id}`}</td>
              <td className="px-4 py-3 text-zinc-500 hidden sm:table-cell">
                {b.depart_date || "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{b.guests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
