import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../shared/api";
import Toast from "../shared/common/Toast";
import TourApproval from "./tour-approval";
import "./Admin.css";

const MENU_GROUPS = [
  {
    tieuDe: "Quản lý chung",
    items: [
      { id: "tong-quan", nhan: "Tổng quan", icon: "space_dashboard", desc: "Chỉ số tổng hợp và số liệu hệ thống" },
    ],
  },
  {
    tieuDe: "Vận hành & Duyệt",
    items: [
      { id: "duyet-tour", nhan: "Duyệt tour", icon: "verified", desc: "Phê duyệt các tour du lịch do nhà điều hành gửi lên" },
      { id: "dia-diem", nhan: "Cơ sở lưu trú", icon: "domain", desc: "Quản lý danh mục khách sạn, homestay và điểm lưu trú" },
    ],
  },
  {
    tieuDe: "Đơn hàng & Giao dịch",
    items: [
      { id: "dat-tour", nhan: "Đặt tour", icon: "confirmation_number", desc: "Danh sách đơn đặt tour du lịch trên toàn hệ thống" },
      { id: "thanh-toan", nhan: "Thanh toán & Đối soát", icon: "payments", desc: "Đối soát chuyển khoản ngân hàng và xác nhận giao dịch" },
    ],
  },
];

const ALL_TABS = MENU_GROUPS.flatMap((g) => g.items);

const FORM_RONG = {
  place_type: "accommodation",
  name: "",
  amenity: "",
  tourism: "",
  description: "",
  price_range: "",
  stars: 0,
  address: "",
  lon: "",
  lat: "",
};

function so(n) {
  return n == null ? "—" : Number(n).toLocaleString("vi-VN");
}

export default function AdminPage({ user, onLogout, onNeedAuth }) {
  const [params, setParams] = useSearchParams();
  const tabId = ALL_TABS.some((t) => t.id === params.get("tab"))
    ? params.get("tab")
    : "tong-quan";
  const currentTab = ALL_TABS.find((t) => t.id === tabId) || ALL_TABS[0];

  const setTab = (id) => setParams({ tab: id }, { replace: true });
  const mo = (id, loc) =>
    setParams(loc ? { tab: id, loc } : { tab: id }, { replace: true });
  const locTuUrl = params.get("loc") || "";

  if (!user) {
    return (
      <div className="admin-shell__gate">
        <div className="admin-shell__gate-card">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 text-white flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            Đ
          </div>
          <h1 className="admin-shell__gate-title">Khu vực Quản trị</h1>
          <p className="admin-shell__gate-text">
            Bạn cần đăng nhập bằng tài khoản Quản trị viên để truy cập bảng điều khiển.
          </p>
          {onNeedAuth && (
            <button
              type="button"
              onClick={onNeedAuth}
              className="w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Đăng nhập ngay
            </button>
          )}
        </div>
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="admin-shell__gate">
        <div className="admin-shell__gate-card">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-outlined text-2xl">block</span>
          </div>
          <h1 className="admin-shell__gate-title">Từ chối truy cập</h1>
          <p className="admin-shell__gate-text">
            Tài khoản ({user.email}) không có quyền hạn Quản trị viên của hệ thống.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            Quay lại trang chủ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      {/* 1. SIDEBAR CHUẨN SHADCN */}
      <aside className="admin-shell__aside">
        <div>
          {/* Logo & Brand */}
          <div className="admin-shell__brand">
            <div className="admin-shell__brand-mark">Đ</div>
            <div className="min-w-0">
              <span className="admin-shell__brand-title">Đi Đâu</span>
              <span className="admin-shell__brand-sub">Quản trị hệ thống</span>
            </div>
          </div>

          {/* Menu Phân nhóm */}
          {MENU_GROUPS.map((group) => (
            <div className="admin-shell__group" key={group.tieuDe}>
              <div className="admin-shell__group-title">{group.tieuDe}</div>
              <nav className="admin-shell__nav">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`admin-shell__nav-item ${
                      tabId === item.id ? "admin-shell__nav-item--active" : ""
                    }`}
                  >
                    <span className="material-symbols-outlined admin-shell__nav-icon">
                      {item.icon}
                    </span>
                    <span>{item.nhan}</span>
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Footer Account Card */}
        <div className="admin-shell__foot">
          <div className="admin-shell__account">
            <div className="admin-shell__account-row">
              <div className="admin-shell__avatar">
                {user.full_name ? user.full_name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="admin-shell__account-info">
                <span className="admin-shell__account-name">
                  {user.full_name || "Quản trị viên"}
                </span>
                <span className="admin-shell__account-role">{user.email}</span>
              </div>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="admin-shell__logout-btn"
                title="Đăng xuất"
              >
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* 2. MAIN BODY */}
      <div className="admin-shell__body">
        {/* Top Header */}
        <header className="admin-shell__header">
          <div className="admin-shell__header-left">
            <span className="material-symbols-outlined admin-shell__header-icon">
              space_dashboard
            </span>
            <div className="admin-shell__header-divider"></div>
            <div className="admin-shell__crumb">
              <span className="admin-shell__crumb-root">Quản trị</span>
              <span className="material-symbols-outlined text-sm text-zinc-400">
                chevron_right
              </span>
              <span className="admin-shell__crumb-active">{currentTab.nhan}</span>
            </div>
          </div>

          <div>
            <Link to="/" className="admin-shell__home-btn">
              <span className="material-symbols-outlined text-sm">home</span>
              <span>Về trang chủ</span>
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="admin-shell__main">
          {/* Header mục hiện tại */}
          <div className="border-b border-zinc-200 pb-5 mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              {currentTab.nhan}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">{currentTab.desc}</p>
          </div>

          {/* Màn hình tương ứng */}
          {tabId === "tong-quan" && <TongQuan onMo={mo} />}
          {tabId === "duyet-tour" && <TourApproval />}
          {tabId === "dia-diem" && <DiaDiem />}
          {tabId === "dat-tour" && <DatTour />}
          {tabId === "thanh-toan" && <ThanhToan locBanDau={locTuUrl} />}
        </main>
      </div>
    </div>
  );
}

/* ── 1. Tổng quan (KPI Metric Cards) ─────────────────────────────────────── */

function TongQuan({ onMo }) {
  const [tk, setTk] = useState(null);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    api
      .adminStats()
      .then((d) => setTk(d.stats))
      .catch((e) => setLoi(e.message));
  }, []);

  if (loi) return <Toast message={loi} type="error" onClose={() => setLoi("")} />;

  if (!tk) {
    return (
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="h-28 bg-white border border-zinc-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    {
      nhan: "Chờ xác nhận thanh toán",
      v: tk.cho_xac_nhan,
      tab: "thanh-toan",
      loc: "PENDING",
      sub: "Giao dịch chuyển khoản đang chờ đối soát",
      icon: "pending_actions",
      badgeColor: "bg-blue-50 text-blue-600 border-blue-100",
    },
    {
      nhan: "Giao dịch lệch tiền",
      v: tk.lech_tien,
      tab: "thanh-toan",
      loc: "MISMATCH",
      sub: "Số tiền chuyển lệch so với giá trị đơn",
      icon: "warning",
      badgeColor: "bg-rose-50 text-rose-600 border-rose-100",
    },
    {
      nhan: "Doanh thu đã thu",
      v: tk.doanh_thu,
      donVi: "đ",
      tab: "thanh-toan",
      loc: "SUCCESS",
      sub: "Tổng tiền đơn thanh toán thành công",
      icon: "payments",
      badgeColor: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
    {
      nhan: "Lượt đặt tour",
      v: tk.dat_tour,
      tab: "dat-tour",
      sub: "Tổng số lượt booking tour trên sàn",
      icon: "confirmation_number",
      badgeColor: "bg-zinc-50 text-zinc-700 border-zinc-200",
    },
    {
      nhan: "Cơ sở lưu trú",
      v: tk.luu_tru,
      tab: "dia-diem",
      sub: "Khách sạn, homestay trong cơ sở dữ liệu",
      icon: "domain",
      badgeColor: "bg-zinc-50 text-zinc-700 border-zinc-200",
    },
  ];

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cards.map((c) => (
        <button
          key={c.nhan}
          type="button"
          onClick={() => onMo(c.tab, c.loc)}
          className="bg-white p-5 rounded-xl border border-zinc-200 shadow-xs hover:border-zinc-400 hover:shadow-sm transition-all text-left flex items-start justify-between cursor-pointer group"
        >
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              {c.nhan}
            </p>
            <p className="text-2xl font-bold text-zinc-900 mt-1">
              {so(c.v)}
              {c.donVi ? <span className="text-sm font-semibold ml-1">{c.donVi}</span> : null}
            </p>
            <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{c.sub}</p>
          </div>
          <div
            className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${c.badgeColor} group-hover:scale-105 transition-transform`}
          >
            <span className="material-symbols-outlined text-xl">{c.icon}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

/* ── 2. Địa điểm (Cơ sở lưu trú) ─────────────────────────────────────────── */

const TOI_THIEU_KY_TU = 2;

const LOAI_LUU_TRU = {
  hotel: "Khách sạn",
  accommodation: "Cơ sở lưu trú",
  campsite: "Khu cắm trại",
  bed_and_breakfast: "Nhà nghỉ B&B",
  motel: "Nhà nghỉ",
  guest_house: "Nhà nghỉ",
  hostel: "Hostel",
  resort: "Khu nghỉ dưỡng",
  apartment: "Căn hộ",
  homestay: "Homestay",
  villa: "Biệt thự",
  chalet: "Nhà gỗ",
  camp_site: "Khu cắm trại",
};

function nhanLoai(category) {
  if (!category) return "Cơ sở lưu trú";
  return LOAI_LUU_TRU[category] || category.replace(/_/g, " ");
}

function DiaDiem() {
  const [q, setQ] = useState("");
  const [ds, setDs] = useState(null);
  const [tong, setTong] = useState(0);
  const [trang, setTrang] = useState(1);
  const [dangTai, setDangTai] = useState(false);
  const [loi, setLoi] = useState("");
  const [form, setForm] = useState(null);
  const [lanTai, setLanTai] = useState(0);

  const PAGE = 20;
  const tuKhoa = q.trim();
  const duDieuKien = tuKhoa.length >= TOI_THIEU_KY_TU;

  function taiLai() {
    setLanTai((n) => n + 1);
  }

  function xoaKetQua() {
    setDs(null);
    setTong(0);
    setLoi("");
  }

  useEffect(() => {
    if (!duDieuKien) return;
    let bo = false;
    const t = setTimeout(() => {
      setDangTai(true);
      setLoi("");
      api
        .searchPlaces({
          q: tuKhoa,
          place_type: "accommodation",
          page: trang,
          page_size: PAGE,
        })
        .then((d) => {
          if (!bo) {
            setDs(d.items || []);
            setTong(d.total || 0);
          }
        })
        .catch((e) => {
          if (!bo) {
            setDs([]);
            setTong(0);
            setLoi(e.message);
          }
        })
        .finally(() => {
          if (!bo) setDangTai(false);
        });
    }, 400);
    return () => {
      bo = true;
      clearTimeout(t);
    };
  }, [tuKhoa, trang, duDieuKien, lanTai]);

  async function xoa(item) {
    if (!window.confirm(`Xoá "${item.name}"? Thao tác này không thể khôi phục.`)) return;
    try {
      await api.deletePlace(item.type, item.id);
      taiLai();
    } catch (e) {
      setLoi(e.message);
    }
  }

  const soTrang = Math.max(1, Math.ceil(tong / PAGE));

  return (
    <div className="space-y-4">
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-zinc-200 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg pointer-events-none">
            search
          </span>
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setTrang(1);
              if (e.target.value.trim().length < TOI_THIEU_KY_TU) xoaKetQua();
            }}
            placeholder="Tìm kiếm cơ sở lưu trú theo tên để quản lý..."
            className="w-full pl-9 pr-8 py-2 text-sm bg-zinc-50 hover:bg-white focus:bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-800 transition"
          />
          {q && (
            <button
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 p-0.5 cursor-pointer"
              onClick={() => {
                setQ("");
                xoaKetQua();
              }}
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setForm({ ...FORM_RONG, place_type: "accommodation" })}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer w-fit"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>Thêm cơ sở lưu trú</span>
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 min-w-[260px]">Tên cơ sở</th>
                <th className="py-3 px-4 min-w-[140px]">Loại hình</th>
                <th className="py-3 px-4 min-w-[150px] hidden md:table-cell">Toạ độ</th>
                <th className="py-3 px-4 text-right min-w-[140px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {dangTai &&
                Array.from({ length: 6 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3.5" colSpan={4}>
                      <div className="h-5 bg-zinc-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))}

              {!dangTai && ds === null && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-zinc-400 text-xs">
                    <span className="material-symbols-outlined text-3xl block mb-2 text-zinc-300">
                      manage_search
                    </span>
                    Nhập ít nhất {TOI_THIEU_KY_TU} ký tự vào ô tìm kiếm để tra cứu địa điểm cần chỉnh sửa.
                  </td>
                </tr>
              )}

              {!dangTai && ds?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-zinc-500 text-xs">
                    Không tìm thấy cơ sở lưu trú nào khớp với từ khóa “{tuKhoa}”.
                  </td>
                </tr>
              )}

              {!dangTai &&
                (ds || []).map((it) => (
                  <tr key={`${it.type}-${it.id}`} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-medium">
                      <Link
                        to={`/dia-diem/${it.type}/${it.id}`}
                        className="text-zinc-900 hover:text-blue-600 transition-colors"
                      >
                        {it.name}
                      </Link>
                      {it.address && (
                        <p className="text-xs text-zinc-400 font-normal mt-0.5 line-clamp-1">
                          {it.address}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {nhanLoai(it.category)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-500 text-xs hidden md:table-cell font-mono">
                      {it.lon?.toFixed(4)}, {it.lat?.toFixed(4)}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...FORM_RONG,
                              id: it.id,
                              place_type: it.type,
                              name: it.name,
                              lon: it.lon,
                              lat: it.lat,
                              tourism: it.category || "",
                              address: it.address || "",
                              stars: it.stars || 0,
                              price_range: it.price_range || "",
                            })
                          }
                          className="px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors cursor-pointer"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => xoa(it)}
                          className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                        >
                          Xoá
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Phân trang */}
        {ds && ds.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 bg-zinc-50/50 text-xs text-zinc-500">
            <span>
              Tìm thấy <strong className="text-zinc-800">{so(tong)}</strong> kết quả · Trang {trang} / {so(soTrang)}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={trang <= 1}
                onClick={() => setTrang((t) => t - 1)}
                className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Trang trước
              </button>
              <button
                type="button"
                disabled={trang >= soTrang}
                onClick={() => setTrang((t) => t + 1)}
                className="px-3 py-1.5 bg-white border border-zinc-200 rounded-lg text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                Trang sau
              </button>
            </div>
          </div>
        )}
      </div>

      {form && (
        <FormDiaDiem
          form={form}
          setForm={setForm}
          onXong={() => {
            setForm(null);
            taiLai();
          }}
        />
      )}
    </div>
  );
}

function FormDiaDiem({ form, setForm, onXong }) {
  const [dangLuu, setDangLuu] = useState(false);
  const [loi, setLoi] = useState("");

  function dat(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function luu(e) {
    e.preventDefault();
    setDangLuu(true);
    setLoi("");
    const body = {
      name: form.name.trim(),
      lon: Number(form.lon),
      lat: Number(form.lat),
      tourism: form.tourism || null,
      amenity: form.amenity || null,
      price_range: form.price_range || null,
      stars: Number(form.stars) || 0,
      address: form.address || null,
    };
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
    <div className="admin-modal" onClick={() => setForm(null)}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={luu}
        className="admin-modal__card space-y-4"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <h2 className="text-base font-bold text-zinc-900">
            {form.id ? "Chỉnh sửa cơ sở lưu trú" : "Thêm mới cơ sở lưu trú"}
          </h2>
          <button
            type="button"
            className="text-zinc-400 hover:text-zinc-600 p-1 cursor-pointer"
            onClick={() => setForm(null)}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-zinc-700">Tên cơ sở *</span>
          <input
            required
            value={form.name}
            onChange={(e) => dat("name", e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700">Kinh độ (Longitude) *</span>
            <input
              required
              type="number"
              step="any"
              value={form.lon}
              onChange={(e) => dat("lon", e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700">Vĩ độ (Latitude) *</span>
            <input
              required
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => dat("lat", e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-zinc-700">Loại hình lưu trú</span>
          <input
            value={form.tourism}
            onChange={(e) => dat("tourism", e.target.value)}
            placeholder="hotel, guest_house, hostel, resort, homestay…"
            className="w-full mt-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700">Hạng sao (0 - 5)</span>
            <input
              type="number"
              min={0}
              max={5}
              value={form.stars}
              onChange={(e) => dat("stars", e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-zinc-700">Mức giá</span>
            <select
              value={form.price_range}
              onChange={(e) => dat("price_range", e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
            >
              <option value="">Không rõ</option>
              <option value="Rẻ">Bình dân / Tiết kiệm</option>
              <option value="Trung bình">Trung bình</option>
              <option value="Sang trọng">Cao cấp / Sang trọng</option>
            </select>
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-zinc-700">Địa chỉ cụ thể</span>
          <input
            value={form.address}
            onChange={(e) => dat("address", e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 text-zinc-900"
          />
        </label>

        {loi && <p className="text-xs text-rose-600 font-medium">{loi}</p>}

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
          <button
            type="button"
            onClick={() => setForm(null)}
            className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Huỷ bỏ
          </button>
          <button
            type="submit"
            disabled={dangLuu}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            {dangLuu ? "Đang lưu..." : "Lưu thông tin"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── 3. Thanh toán & Đối soát ────────────────────────────────────────────── */

const LOC_THANH_TOAN = [
  ["", "Tất cả giao dịch"],
  ["PENDING", "Chờ xác nhận"],
  ["SUCCESS", "Đã nhận tiền"],
  ["MISMATCH", "Lệch tiền"],
  ["FAILED", "Thất bại"],
];

const NHAN_THANH_TOAN = {
  PENDING: "Chờ xác nhận",
  SUCCESS: "Đã nhận tiền",
  MISMATCH: "Lệch tiền",
  FAILED: "Thất bại",
};

const NHAN_CACH_TRA = { CHUYEN_KHOAN: "Chuyển khoản", STRIPE: "Stripe", CARD: "Thẻ" };

function ngay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("vi-VN");
}

function ThanhToan({ locBanDau }) {
  const [loc, setLoc] = useState(locBanDau || "");
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState("");
  const [tin, setTin] = useState("");
  const [dangChay, setDangChay] = useState(0);

  function tai() {
    setDs(null);
    setLoi("");
    api
      .adminPayments(loc || undefined)
      .then((d) => setDs(d.payments || []))
      .catch((e) => {
        setDs([]);
        setLoi(e.message);
      });
  }
  useEffect(tai, [loc]);

  async function xacNhan(p) {
    const dongY = window.confirm(
      `Xác nhận đã nhận ${so(p.amount)} đ cho đơn hàng ${p.booking_code}?`
    );
    if (!dongY) return;
    setDangChay(p.id);
    setLoi("");
    setTin("");
    try {
      const kq = await api.adminConfirmPayment(p.id);
      setTin(kq.message || `Đã xác nhận thanh toán đơn ${p.booking_code}.`);
      tai();
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangChay(0);
    }
  }

  const bamDuoc = (tt) => tt === "PENDING" || tt === "MISMATCH";

  return (
    <div className="space-y-4">
      {tin && <Toast message={tin} onClose={() => setTin("")} />}
      {loi && <Toast message={loi} type="error" onClose={() => setLoi("")} />}

      {/* Filter Tabs Pills */}
      <div className="flex gap-2 flex-wrap items-center">
        {LOC_THANH_TOAN.map(([v, nhan]) => (
          <button
            key={v}
            type="button"
            onClick={() => setLoc(v)}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all cursor-pointer ${
              loc === v
                ? "bg-zinc-900 border-zinc-900 text-white shadow-xs"
                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {nhan}
          </button>
        ))}
      </div>

      {ds === null && (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 bg-white border border-zinc-200 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {ds?.length === 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
            <span className="material-symbols-outlined text-2xl">payments</span>
          </div>
          <h3 className="text-base font-semibold text-zinc-900">Không có giao dịch nào</h3>
          <p className="text-xs text-zinc-500 mt-1">Chưa ghi nhận khoản thanh toán nào ở danh mục này.</p>
        </div>
      )}

      {ds && ds.length > 0 && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                  <th className="py-3 px-4 min-w-[200px]">Mã giao dịch</th>
                  <th className="py-3 px-4 min-w-[130px] hidden sm:table-cell">Mã đơn</th>
                  <th className="py-3 px-4 min-w-[220px]">Tour</th>
                  <th className="py-3 px-4 min-w-[130px] text-right">Số tiền</th>
                  <th className="py-3 px-4 min-w-[150px]">Trạng thái</th>
                  <th className="py-3 px-4 text-right min-w-[160px]">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {ds.map((p) => {
                  let statusClasses = "bg-zinc-100 text-zinc-700 border-zinc-200";
                  let dotClass = "bg-zinc-500";
                  if (p.status === "SUCCESS") {
                    statusClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    dotClass = "bg-emerald-600";
                  } else if (p.status === "PENDING") {
                    statusClasses = "bg-blue-50 text-blue-700 border-blue-200";
                    dotClass = "bg-blue-600";
                  } else if (p.status === "MISMATCH" || p.status === "FAILED") {
                    statusClasses = "bg-rose-50 text-rose-700 border-rose-200";
                    dotClass = "bg-rose-600";
                  }

                  return (
                    <tr key={p.id} className="hover:bg-zinc-50/70 transition-colors" title={p.note || undefined}>
                      <td className="py-3.5 px-4 font-mono font-medium text-zinc-900 text-xs">
                        {p.txn_ref}
                        <span className="block text-zinc-500 font-sans font-normal text-xs mt-0.5">
                          {NHAN_CACH_TRA[p.method] || p.method}
                          {ngay(p.created_at) ? ` · ${ngay(p.created_at)}` : ""}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 hidden sm:table-cell font-mono text-xs font-semibold text-zinc-800">
                        {p.booking_code}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-900">
                        {p.tour_name}
                      </td>
                      <td className="py-3.5 px-4 text-right font-semibold text-zinc-900 tabular-nums">
                        {so(p.amount)} đ
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClasses}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`}></span>
                          <span>{NHAN_THANH_TOAN[p.status] || p.status}</span>
                        </span>
                        {p.confirmed_by_name && (
                          <span className="block text-zinc-400 text-xs mt-0.5">
                            Bởi {p.confirmed_by_name}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {bamDuoc(p.status) ? (
                          <button
                            type="button"
                            onClick={() => xacNhan(p)}
                            disabled={dangChay === p.id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <span className="material-symbols-outlined text-sm">verified</span>
                            <span>{dangChay === p.id ? "Đang xử lý..." : "Xác nhận nhận tiền"}</span>
                          </button>
                        ) : (
                          <span className="text-zinc-400 text-xs font-medium">Đã chốt</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 5. Đặt tour ─────────────────────────────────────────────────────────── */

function DatTour() {
  const [ds, setDs] = useState(null);
  const [loi, setLoi] = useState("");

  useEffect(() => {
    api
      .adminTourBookings()
      .then((d) => setDs(d.bookings || []))
      .catch((e) => {
        setLoi(e.message);
        setDs([]);
      });
  }, []);

  if (loi) return <Toast message={loi} type="error" onClose={() => setLoi("")} />;

  if (ds === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-20 bg-white border border-zinc-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (!ds.length) {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-3">
          <span className="material-symbols-outlined text-2xl">confirmation_number</span>
        </div>
        <h3 className="text-base font-semibold text-zinc-900">Chưa có lượt đặt tour nào</h3>
        <p className="text-xs text-zinc-500 mt-1">Khi khách hoàn tất đặt chỗ tour, đơn hàng sẽ hiển thị ở đây.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50/80 text-zinc-500 text-xs font-semibold uppercase tracking-wider">
              <th className="py-3 px-4 min-w-[220px]">Khách hàng</th>
              <th className="py-3 px-4 min-w-[240px]">Tour du lịch</th>
              <th className="py-3 px-4 min-w-[140px] hidden sm:table-cell">Khởi hành</th>
              <th className="py-3 px-4 min-w-[120px] text-right">Số lượng khách</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ds.map((b) => (
              <tr key={b.id} className="hover:bg-zinc-50/70 transition-colors">
                <td className="py-3.5 px-4">
                  <span className="font-semibold text-zinc-900 block">{b.full_name}</span>
                  <span className="text-xs font-mono text-zinc-500 block mt-0.5">{b.phone}</span>
                </td>
                <td className="py-3.5 px-4 font-medium text-zinc-800">
                  {b.tour_name || `#${b.tour_id}`}
                </td>
                <td className="py-3.5 px-4 text-zinc-600 text-xs hidden sm:table-cell">
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-zinc-400">calendar_month</span>
                    <span>{b.depart_date || "—"}</span>
                  </span>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                    {b.guests} khách
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
