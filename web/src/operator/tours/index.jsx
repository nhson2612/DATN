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
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* 1. Tiêu đề trang */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", paddingBottom: "20px", borderBottom: "1px solid #e2e8f0" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", margin: "0 0 6px" }}>Tour của tôi</h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            Quản lý danh sách tour du lịch, theo dõi tiến độ duyệt và cấu hình thông tin mở bán.
          </p>
        </div>
        <button
          type="button"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "#0f172a",
            color: "#ffffff",
            padding: "9px 16px",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "13px",
            border: "none",
            cursor: "pointer",
          }}
          onClick={() => setSearchParams({ action: "create" })}
        >
          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>add</span>
          <span>Tạo tour mới</span>
        </button>
      </div>

      {/* Toast thông báo nổi chuẩn Shadcn */}
      <Toast message={message} onClose={() => setMessage("")} />

      {/* 2. Thẻ số liệu đo lường - Thiết kế tối giản, sạch sẽ, không icon nền màu */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px 20px" }}>
          <p style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", margin: 0 }}>
            Tổng số tour
          </p>
          <p style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "6px 0 2px" }}>
            {thongKe.tong}
          </p>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
            Tất cả tour trong hệ thống
          </p>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px 20px" }}>
          <p style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", margin: 0 }}>
            Đã duyệt / Đang bán
          </p>
          <p style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "6px 0 2px" }}>
            {thongKe.daDuyet}
          </p>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
            Sẵn sàng mở đợt khởi hành
          </p>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px 20px" }}>
          <p style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", margin: 0 }}>
            Chờ duyệt
          </p>
          <p style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "6px 0 2px" }}>
            {thongKe.choDuyet}
          </p>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
            Đang chờ ban quản trị xét duyệt
          </p>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px 20px" }}>
          <p style={{ fontSize: "12px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "#64748b", margin: 0 }}>
            Bản nháp / Cần sửa
          </p>
          <p style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", margin: "6px 0 2px" }}>
            {thongKe.canSua}
          </p>
          <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>
            Chưa gửi hoặc bị từ chối
          </p>
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

                    {/* Cột 2: Điểm đến (không dùng badge) */}
                    <td className="align-middle op-tours__td-65">
                      <span style={{ fontSize: "13px", color: "#334155", fontWeight: "500" }}>
                        {tenTinh(tour.province_id)}
                      </span>
                    </td>

                    {/* Cột 3: Thời lượng (không dùng badge) */}
                    <td className="align-middle op-tours__td-68">
                      <span style={{ fontSize: "13px", color: "#334155", fontWeight: "500" }}>
                        {tour.duration_days} ngày
                      </span>
                    </td>

                    {/* Cột 4: Ngày tạo */}
                    <td className="align-middle op-tours__td-71">
                      {ngayTao}
                    </td>

                    {/* Cột 5: Trạng thái (chữ kèm dot nhỏ, không dùng badge hộp màu mè) */}
                    <td className="align-middle op-tours__td-72">
                      {tour.status === "APPROVED" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#16a34a", fontWeight: "600" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }}></span>
                          <span>Đã duyệt</span>
                        </span>
                      )}
                      {tour.status === "ACTIVE" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#16a34a", fontWeight: "600" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a" }}></span>
                          <span>Đang bán</span>
                        </span>
                      )}
                      {tour.status === "PENDING_APPROVAL" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#d97706", fontWeight: "600" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#d97706" }}></span>
                          <span>Chờ duyệt</span>
                        </span>
                      )}
                      {tour.status === "DRAFT" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#64748b", fontWeight: "600" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#94a3b8" }}></span>
                          <span>Bản nháp</span>
                        </span>
                      )}
                      {tour.status === "REJECTED" && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "#dc2626", fontWeight: "600" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#dc2626" }}></span>
                          <span>Bị từ chối</span>
                        </span>
                      )}
                      {!["APPROVED", "ACTIVE", "PENDING_APPROVAL", "DRAFT", "REJECTED"].includes(tour.status) && (
                        <span style={{ fontSize: "13px", color: "#64748b" }}>
                          {tour.status}
                        </span>
                      )}
                    </td>

                    {/* Cột 6: Nhóm nút hành động dạng icon */}
                    <td className="align-middle op-tours__td-84">
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => moSua(tour)}
                          title="Chỉnh sửa thông tin tour"
                          aria-label="Sửa tour"
                          style={{
                            width: "32px",
                            height: "32px",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "6px",
                            border: "1px solid #e2e8f0",
                            background: "#ffffff",
                            color: "#475569",
                            cursor: "pointer",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>edit</span>
                        </button>

                        {(tour.status === "DRAFT" || tour.status === "REJECTED") && (
                          <button
                            type="button"
                            onClick={() => guiDuyet(tour)}
                            title="Gửi ban quản trị phê duyệt"
                            aria-label="Gửi duyệt"
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "6px",
                              border: "none",
                              background: "#0f172a",
                              color: "#ffffff",
                              cursor: "pointer",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>send</span>
                          </button>
                        )}

                        {(tour.status === "APPROVED" || tour.status === "ACTIVE") && (
                          <Link
                            to={`/operator/departures?tour_id=${tour.id}`}
                            title="Mở đợt khởi hành cho tour"
                            aria-label="Mở đợt"
                            style={{
                              width: "32px",
                              height: "32px",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              background: "#ffffff",
                              color: "#0f172a",
                              textDecoration: "none",
                            }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>calendar_month</span>
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
