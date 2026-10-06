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
    <div className="op-tours__div-1">
      {/* 1. Tiêu đề trang chuẩn Shadcn Page Header */}
      <div className="op-tours__div-2">
        <div>
          <h1 className="op-tours__text-3">Tour của tôi</h1>
          <p className="op-tours__text-4">
            Quản lý danh sách tour du lịch, theo dõi tiến độ duyệt và cấu hình thông tin mở bán.
          </p>
        </div>
        <button
          type="button"
          className="op-tours__button-5"
          onClick={() => setSearchParams({ action: "create" })}
        >
          <span className="material-symbols-outlined op-tours__span-6">add</span>
          <span>Tạo tour mới</span>
        </button>
      </div>

      {/* Toast thông báo nổi chuẩn Shadcn */}
      <Toast message={message} onClose={() => setMessage("")} />

      {/* 2. Thẻ số liệu đo lường chuẩn Shadcn Metric Cards */}
      <div className="op-tours__div-7">
        <div className="op-tours__div-8 op-tours__div-1">
          <div>
            <p className="op-tours__text-9">Tổng số tour</p>
            <p className="op-tours__text-10">{thongKe.tong}</p>
            <p className="op-tours__text-11">Tất cả tour trong hệ thống</p>
          </div>
          <div className="op-tours__div-12 op-tours__div-2">
            <span className="material-symbols-outlined op-tours__span-13">map</span>
          </div>
        </div>

        <div className="op-tours__div-14 op-tours__div-3">
          <div>
            <p className="op-tours__text-15">Đã duyệt / Đang bán</p>
            <p className="op-tours__text-16">{thongKe.daDuyet}</p>
            <p className="op-tours__text-17">Sẵn sàng mở đợt khởi hành</p>
          </div>
          <div className="op-tours__div-18 op-tours__div-4">
            <span className="material-symbols-outlined op-tours__span-19">verified</span>
          </div>
        </div>

        <div className="op-tours__div-20 op-tours__div-5">
          <div>
            <p className="op-tours__text-21">Chờ duyệt</p>
            <p className="op-tours__text-22">{thongKe.choDuyet}</p>
            <p className="op-tours__text-23">Đang chờ ban quản trị xét duyệt</p>
          </div>
          <div className="op-tours__div-24 op-tours__div-6">
            <span className="material-symbols-outlined op-tours__span-25">pending_actions</span>
          </div>
        </div>

        <div className="op-tours__div-26 op-tours__div-7">
          <div>
            <p className="op-tours__text-27">Bản nháp / Cần sửa</p>
            <p className="op-tours__text-28">{thongKe.canSua}</p>
            <p className="op-tours__text-29">Chưa gửi hoặc bị từ chối</p>
          </div>
          <div className="op-tours__div-30 op-tours__div-8">
            <span className="material-symbols-outlined op-tours__span-31">edit_document</span>
          </div>
        </div>
      </div>

      {/* 3. Thanh công cụ tìm kiếm và lọc (Shadcn Data Table Toolbar) */}
      <div className="op-tours__div-32 op-tours__div-9">
        <div className="op-tours__div-33">
          {/* Ô tìm kiếm từ khóa */}
          <div className="op-tours__div-34">
            <span className="material-symbols-outlined op-tours__span-35">
              search
            </span>
            <input
              type="text"
              placeholder="Tìm theo tên tour, tóm tắt..."
              className="op-tours__input-36 op-tours__input-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="op-tours__button-37"
                onClick={() => setSearch("")}
                title="Xoá tìm kiếm"
              >
                <span className="material-symbols-outlined op-tours__span-38">close</span>
              </button>
            )}
          </div>

          {/* Lọc theo trạng thái */}
          <select
            className="op-tours__select-39 op-tours__select-11"
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
            className="op-tours__select-40 op-tours__select-12"
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
              className="op-tours__button-41"
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

        <div className="op-tours__div-42">
          Hiển thị <span className="op-tours__span-43">{filteredTours.length}</span> / {tours.length} tour
        </div>
      </div>

      {/* 4. Bảng dữ liệu chuẩn Shadcn Table */}
      <div className="op-tours__div-44 op-tours__div-13">
        <div className="op-tours__div-45">
          <table className="op-tours__table-46">
            <thead>
              <tr className="op-tours__tr-47">
                <th className="op-tours__th-48">Tour</th>
                <th className="op-tours__th-49">Điểm đến</th>
                <th className="op-tours__th-50">Thời lượng</th>
                <th className="op-tours__th-51">Ngày tạo</th>
                <th className="op-tours__th-52">Trạng thái</th>
                <th className="op-tours__th-53">Thao tác</th>
              </tr>
            </thead>
            <tbody className="op-tours__table-body">
              {filteredTours.map((tour) => {
                const ngayTao = tour.created_at
                  ? new Date(tour.created_at).toLocaleDateString("vi-VN")
                  : "—";

                return (
                  <tr key={tour.id} className="op-tours__tr-54">
                    {/* Cột 1: Thông tin Tour + Thumbnail */}
                    <td className="align-top op-tours__td-55">
                      <div className="op-tours__div-56">
                        {tour.cover_url ? (
                          <img
                            src={tour.cover_url}
                            alt={tour.name}
                            className="op-tours__img-57 op-tours__img-14"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="op-tours__div-58 op-tours__div-15">
                            <span className="material-symbols-outlined op-tours__span-59">image</span>
                          </div>
                        )}
                        <div className="op-tours__div-60">
                          <button
                            type="button"
                            className="op-tours__button-61"
                            onClick={() => moSua(tour)}
                            title={tour.name}
                          >
                            {tour.name}
                          </button>
                          {tour.summary && (
                            <p className="op-tours__text-62" title={tour.summary}>
                              {tour.summary}
                            </p>
                          )}
                          {tour.status === "REJECTED" && tour.reject_reason && (
                            <div className="op-tours__div-63 op-tours__div-16">
                              <span className="material-symbols-outlined op-tours__span-64">info</span>
                              <span>Từ chối: {tour.reject_reason}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Cột 2: Điểm đến */}
                    <td className="align-middle op-tours__td-65">
                      <span className="op-tours__span-66">
                        <span className="material-symbols-outlined op-tours__span-67">location_on</span>
                        <span>{tenTinh(tour.province_id)}</span>
                      </span>
                    </td>

                    {/* Cột 3: Thời lượng */}
                    <td className="align-middle op-tours__td-68">
                      <span className="op-tours__span-69">
                        <span className="material-symbols-outlined op-tours__span-70">schedule</span>
                        <span>{tour.duration_days} ngày</span>
                      </span>
                    </td>

                    {/* Cột 4: Ngày tạo */}
                    <td className="align-middle op-tours__td-71">
                      {ngayTao}
                    </td>

                    {/* Cột 5: Trạng thái chuẩn Shadcn Badge */}
                    <td className="align-middle op-tours__td-72">
                      {tour.status === "APPROVED" && (
                        <span className="op-tours__span-73 op-tours__span-17">
                          <span className="op-tours__span-74"></span>
                          <span>Đã duyệt</span>
                        </span>
                      )}
                      {tour.status === "ACTIVE" && (
                        <span className="op-tours__span-75 op-tours__span-18">
                          <span className="op-tours__span-76"></span>
                          <span>Đang bán</span>
                        </span>
                      )}
                      {tour.status === "PENDING_APPROVAL" && (
                        <span className="op-tours__span-77 op-tours__span-19">
                          <span className="op-tours__span-78"></span>
                          <span>Chờ duyệt</span>
                        </span>
                      )}
                      {tour.status === "DRAFT" && (
                        <span className="op-tours__span-79 op-tours__span-20">
                          <span className="op-tours__span-80"></span>
                          <span>Bản nháp</span>
                        </span>
                      )}
                      {tour.status === "REJECTED" && (
                        <span className="op-tours__span-81 op-tours__span-21">
                          <span className="op-tours__span-82"></span>
                          <span>Bị từ chối</span>
                        </span>
                      )}
                      {!["APPROVED", "ACTIVE", "PENDING_APPROVAL", "DRAFT", "REJECTED"].includes(tour.status) && (
                        <span className="op-tours__span-83 op-tours__span-22">
                          <span>{tour.status}</span>
                        </span>
                      )}
                    </td>

                    {/* Cột 6: Nhóm nút hành động */}
                    <td className="align-middle op-tours__td-84">
                      <div className="op-tours__div-85">
                        <button
                          type="button"
                          className="op-tours__button-86 op-tours__button-23"
                          onClick={() => moSua(tour)}
                          title="Chỉnh sửa thông tin và lịch trình tour"
                        >
                          <span className="material-symbols-outlined op-tours__span-87">edit</span>
                          <span>Sửa</span>
                        </button>

                        {(tour.status === "DRAFT" || tour.status === "REJECTED") && (
                          <button
                            type="button"
                            className="op-tours__button-88"
                            onClick={() => guiDuyet(tour)}
                            title="Gửi ban quản trị phê duyệt"
                          >
                            <span className="material-symbols-outlined op-tours__span-89">send</span>
                            <span>Gửi duyệt</span>
                          </button>
                        )}

                        {(tour.status === "APPROVED" || tour.status === "ACTIVE") && (
                          <Link
                            to={`/nha-dieu-hanh/departures?tour_id=${tour.id}`}
                            className="op-tours__link-90 op-tours__link-24"
                            title="Mở và cấu hình đợt khởi hành cho tour này"
                          >
                            <span className="material-symbols-outlined op-tours__span-91">calendar_month</span>
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
          <div className="op-tours__div-92">
            <div className="op-tours__div-93">
              <span className="material-symbols-outlined op-tours__span-94">search_off</span>
            </div>
            <h3 className="op-tours__text-95">Không tìm thấy tour nào</h3>
            <p className="op-tours__text-96">
              {search || statusFilter || provinceFilter
                ? "Không có tour nào khớp với bộ lọc tìm kiếm hiện tại của bạn."
                : "Bạn chưa có tour du lịch nào. Hãy bắt đầu tạo tour đầu tiên của bạn."}
            </p>
            {search || statusFilter || provinceFilter ? (
              <button
                type="button"
                className="op-tours__button-97 op-tours__button-25"
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
                className="op-tours__button-98"
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
