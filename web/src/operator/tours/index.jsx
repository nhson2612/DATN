import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { api } from "../../shared/api";
import Toast from "../common/Toast";
import TourWizard from "./TourWizard";

/**
 * Màn hình "Tour của tôi" — Thiết kế chuẩn Shadcn UI Admin Dashboard
 * Loại bỏ cột giá từ không hợp lệ, bổ sung thống kê metric cards, bộ lọc tìm kiếm và bảng dữ liệu hiện đại.
 */
export default function ToursScreen() {
  const [searchParams, setSearchParams] = useSearchParams();
  const action = searchParams.get("action");
  const editId = searchParams.get("id");

  const [tours, setTours] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [message, setMessage] = useState("");
  const [dangMo, setDangMo] = useState(null);

  // Bộ lọc tìm kiếm và trạng thái
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("");

  const loadTours = useCallback(() => {
    api
      .operatorTours({ page_size: 100 })
      .then((data) => setTours(data.tours || []))
      .catch((error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    loadTours();
    api
      .tourProvinces(true)
      .then((data) => setProvinces(data.provinces || []))
      .catch(() => setProvinces([]));
  }, [loadTours]);

  // Đồng bộ trạng thái mở wizard với query param
  useEffect(() => {
    if (action === "create") {
      setDangMo((prev) => (prev && !prev.id ? prev : {}));
    } else if (action === "edit" && editId) {
      if (!dangMo || String(dangMo.id) !== String(editId)) {
        api
          .operatorTour(editId)
          .then((data) => setDangMo(data.tour))
          .catch((error) => setMessage(error.message));
      }
    } else if (!action) {
      setDangMo(null);
    }
  }, [action, editId]);

  // Gửi tour cho quản trị duyệt
  const guiDuyet = async (tour) => {
    setMessage("");
    try {
      await api.operatorSubmitTour(tour.id);
      setMessage(`Đã gửi duyệt tour "${tour.name}" thành công.`);
      loadTours();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const moSua = (tour) => {
    setMessage("");
    setSearchParams({ action: "edit", id: tour.id });
  };

  const tenTinh = (provinceId) => {
    const province = provinces.find((p) => String(p.id) === String(provinceId));
    return province ? province.name || province.ten : "—";
  };

  // Thống kê số liệu cho các thẻ Metrics (Shadcn Cards)
  const thongKe = useMemo(() => {
    const tong = tours.length;
    const daDuyet = tours.filter((t) => t.status === "APPROVED" || t.status === "ACTIVE").length;
    const choDuyet = tours.filter((t) => t.status === "PENDING_APPROVAL").length;
    const canSua = tours.filter((t) => t.status === "DRAFT" || t.status === "REJECTED").length;
    return { tong, daDuyet, choDuyet, canSua };
  }, [tours]);

  // Lọc danh sách tour
  const filteredTours = useMemo(() => {
    return tours.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (provinceFilter && String(t.province_id) !== String(provinceFilter)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = (t.name || "").toLowerCase().includes(q);
        const matchSummary = (t.summary || "").toLowerCase().includes(q);
        const matchSlug = (t.slug || "").toLowerCase().includes(q);
        if (!matchName && !matchSummary && !matchSlug) return false;
      }
      return true;
    });
  }, [tours, search, statusFilter, provinceFilter]);

  if (dangMo !== null) {
    return (
      <TourWizard
        tour={dangMo.id ? dangMo : null}
        provinces={provinces}
        onCancel={() => {
          setSearchParams({});
          setDangMo(null);
        }}
        onSaved={() => {
          setSearchParams({});
          setDangMo(null);
          loadTours();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Tiêu đề trang chuẩn Shadcn Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tour của tôi</h1>
          <p className="text-sm text-slate-500 mt-1">
            Quản lý danh sách tour du lịch, theo dõi tiến độ duyệt và cấu hình thông tin mở bán.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white text-sm font-semibold rounded-lg shadow-sm transition-all cursor-pointer w-fit"
          onClick={() => setSearchParams({ action: "create" })}
        >
          <span className="material-symbols-outlined text-lg">add</span>
          <span>Tạo tour mới</span>
        </button>
      </div>

      {/* Toast thông báo nổi chuẩn Shadcn */}
      <Toast message={message} onClose={() => setMessage("")} />

      {/* 2. Thẻ số liệu đo lường chuẩn Shadcn Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng số tour</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{thongKe.tong}</p>
            <p className="text-xs text-slate-400 mt-0.5">Tất cả tour trong hệ thống</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <span className="material-symbols-outlined text-xl">map</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đã duyệt / Đang bán</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{thongKe.daDuyet}</p>
            <p className="text-xs text-slate-400 mt-0.5">Sẵn sàng mở đợt khởi hành</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <span className="material-symbols-outlined text-xl">verified</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Chờ duyệt</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{thongKe.choDuyet}</p>
            <p className="text-xs text-slate-400 mt-0.5">Đang chờ ban quản trị xét duyệt</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <span className="material-symbols-outlined text-xl">pending_actions</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Bản nháp / Cần sửa</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{thongKe.canSua}</p>
            <p className="text-xs text-slate-400 mt-0.5">Chưa gửi hoặc bị từ chối</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <span className="material-symbols-outlined text-xl">edit_document</span>
          </div>
        </div>
      </div>

      {/* 3. Thanh công cụ tìm kiếm và lọc (Shadcn Data Table Toolbar) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Ô tìm kiếm từ khóa */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm theo tên tour, tóm tắt..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-slate-800 transition"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                onClick={() => setSearch("")}
                title="Xoá tìm kiếm"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            )}
          </div>

          {/* Lọc theo trạng thái */}
          <select
            className="px-3 py-2 text-sm bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-slate-700 cursor-pointer"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="DRAFT">Bản nháp</option>
            <option value="PENDING_APPROVAL">Chờ duyệt</option>
            <option value="APPROVED">Đã duyệt</option>
            <option value="ACTIVE">Đang bán</option>
            <option value="REJECTED">Bị từ chối</option>
          </select>

          {/* Lọc theo điểm đến */}
          <select
            className="px-3 py-2 text-sm bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-slate-700 cursor-pointer max-w-[200px]"
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
          >
            <option value="">Tất cả điểm đến</option>
            {provinces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || p.ten}
              </option>
            ))}
          </select>

          {(search || statusFilter || provinceFilter) && (
            <button
              type="button"
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setProvinceFilter("");
              }}
            >
              Đặt lại
            </button>
          )}
        </div>

        <div className="text-xs font-medium text-slate-500 whitespace-nowrap self-center">
          Hiển thị <span className="font-semibold text-slate-800">{filteredTours.length}</span> / {tours.length} tour
        </div>
      </div>

      {/* 4. Bảng dữ liệu chuẩn Shadcn Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3 px-4 min-w-[280px]">Tour</th>
                <th className="py-3 px-4 min-w-[140px]">Điểm đến</th>
                <th className="py-3 px-4 min-w-[110px]">Thời lượng</th>
                <th className="py-3 px-4 min-w-[110px]">Ngày tạo</th>
                <th className="py-3 px-4 min-w-[130px]">Trạng thái</th>
                <th className="py-3 px-4 text-right min-w-[180px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTours.map((tour) => {
                const ngayTao = tour.created_at
                  ? new Date(tour.created_at).toLocaleDateString("vi-VN")
                  : "—";

                return (
                  <tr key={tour.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Cột 1: Thông tin Tour + Thumbnail */}
                    <td className="py-3.5 px-4 align-top">
                      <div className="flex items-start gap-3">
                        {tour.cover_url ? (
                          <img
                            src={tour.cover_url}
                            alt={tour.name}
                            className="w-12 h-12 rounded-lg object-cover bg-slate-100 border border-slate-200 shrink-0"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <span className="material-symbols-outlined text-xl">image</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="font-semibold text-slate-900 hover:text-blue-600 transition-colors text-left block truncate max-w-md cursor-pointer"
                            onClick={() => moSua(tour)}
                            title={tour.name}
                          >
                            {tour.name}
                          </button>
                          {tour.summary && (
                            <p className="text-xs text-slate-500 line-clamp-1 max-w-md mt-0.5" title={tour.summary}>
                              {tour.summary}
                            </p>
                          )}
                          {tour.status === "REJECTED" && tour.reject_reason && (
                            <div className="inline-flex items-center gap-1 text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 mt-1 font-medium">
                              <span className="material-symbols-outlined text-xs">info</span>
                              <span>Từ chối: {tour.reject_reason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cột 2: Điểm đến */}
                    <td className="py-3.5 px-4 align-middle">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                        <span className="material-symbols-outlined text-xs text-slate-500">location_on</span>
                        <span>{tenTinh(tour.province_id)}</span>
                      </span>
                    </td>

                    {/* Cột 3: Thời lượng */}
                    <td className="py-3.5 px-4 align-middle">
                      <span className="inline-flex items-center gap-1 text-slate-700 font-medium text-xs">
                        <span className="material-symbols-outlined text-xs text-slate-400">schedule</span>
                        <span>{tour.duration_days} ngày</span>
                      </span>
                    </td>

                    {/* Cột 4: Ngày tạo */}
                    <td className="py-3.5 px-4 align-middle text-xs text-slate-500">
                      {ngayTao}
                    </td>

                    {/* Cột 5: Trạng thái chuẩn Shadcn Badge */}
                    <td className="py-3.5 px-4 align-middle">
                      {tour.status === "APPROVED" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          <span>Đã duyệt</span>
                        </span>
                      )}
                      {tour.status === "ACTIVE" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          <span>Đang bán</span>
                        </span>
                      )}
                      {tour.status === "PENDING_APPROVAL" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                          <span>Chờ duyệt</span>
                        </span>
                      )}
                      {tour.status === "DRAFT" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                          <span>Bản nháp</span>
                        </span>
                      )}
                      {tour.status === "REJECTED" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                          <span>Bị từ chối</span>
                        </span>
                      )}
                      {!["APPROVED", "ACTIVE", "PENDING_APPROVAL", "DRAFT", "REJECTED"].includes(tour.status) && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <span>{tour.status}</span>
                        </span>
                      )}
                    </td>

                    {/* Cột 6: Nhóm nút hành động */}
                    <td className="py-3.5 px-4 align-middle text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition-colors shadow-xs cursor-pointer"
                          onClick={() => moSua(tour)}
                          title="Chỉnh sửa thông tin và lịch trình tour"
                        >
                          <span className="material-symbols-outlined text-sm">edit</span>
                          <span>Sửa</span>
                        </button>

                        {(tour.status === "DRAFT" || tour.status === "REJECTED") && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors shadow-xs cursor-pointer"
                            onClick={() => guiDuyet(tour)}
                            title="Gửi ban quản trị phê duyệt"
                          >
                            <span className="material-symbols-outlined text-sm">send</span>
                            <span>Gửi duyệt</span>
                          </button>
                        )}

                        {(tour.status === "APPROVED" || tour.status === "ACTIVE") && (
                          <Link
                            to={`/nha-dieu-hanh/departures?tour_id=${tour.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors"
                            title="Mở và cấu hình đợt khởi hành cho tour này"
                          >
                            <span className="material-symbols-outlined text-sm">calendar_month</span>
                            <span>Mở đợt</span>
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Trạng thái trống (Shadcn Empty State) */}
        {filteredTours.length === 0 && (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
              <span className="material-symbols-outlined text-2xl">search_off</span>
            </div>
            <h3 className="text-base font-semibold text-slate-900">Không tìm thấy tour nào</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || statusFilter || provinceFilter
                ? "Không có tour nào khớp với bộ lọc tìm kiếm hiện tại của bạn."
                : "Bạn chưa có tour du lịch nào. Hãy bắt đầu tạo tour đầu tiên của bạn."}
            </p>
            {search || statusFilter || provinceFilter ? (
              <button
                type="button"
                className="mt-4 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("");
                  setProvinceFilter("");
                }}
              >
                Xoá bộ lọc tìm kiếm
              </button>
            ) : (
              <button
                type="button"
                className="mt-4 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                onClick={() => setSearchParams({ action: "create" })}
              >
                + Tạo tour đầu tiên
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
