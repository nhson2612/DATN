import { useMemo, useState } from "react";

import { api } from "../../shared/api";
import { money, date } from "../../shared/lib/format";
import Toast from "../common/Toast";
import DeparturePicker from "./components/DeparturePicker";
import DepartureTable from "./components/DepartureTable";
import useDepartures from "./hooks/useDepartures";

function formatToInputDate(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Tính ngày tối thiểu hợp lệ theo BR-D1: ít nhất sau hôm nay 2 ngày */
function getMinDepartDate() {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 2);
  return formatToInputDate(minDate);
}

export default function DeparturesScreen() {
  const { tours, tourId, setTourId, departures, reload } = useDepartures();

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSaleDep, setEditingSaleDep] = useState(null);
  const [cancelingDep, setCancelingDep] = useState(null);

  // Loading & Toast state
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Form mở đợt mới
  const minDateStr = useMemo(() => getMinDepartDate(), []);
  const [createForm, setCreateForm] = useState({
    depart_date: minDateStr,
    list_price: "",
    seats_total: 20,
    min_pax: 1,
    has_sale: false,
    sale_price: "",
    sale_starts_at: "",
    sale_ends_at: "",
  });

  // Form đặt/sửa giá sale
  const [saleForm, setSaleForm] = useState({
    sale_price: "",
    sale_starts_at: "",
    sale_ends_at: "",
  });

  // Form hủy đợt
  const [cancelReason, setCancelReason] = useState("");

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = departures.length;
    const openCount = departures.filter((d) => d.status === "OPEN").length;
    const sold = departures.reduce((sum, d) => sum + (d.sold_seats || 0), 0);
    const capacity = departures.reduce((sum, d) => sum + (d.seats_total || 0), 0);
    const occupancyRate = capacity > 0 ? Math.round((sold / capacity) * 100) : 0;
    return { total, openCount, sold, capacity, occupancyRate };
  }, [departures]);

  // Xử lý tạo đợt mới
  const handleOpenCreate = () => {
    setCreateForm({
      depart_date: minDateStr,
      list_price: "",
      seats_total: 20,
      min_pax: 1,
      has_sale: false,
      sale_price: "",
      sale_starts_at: "",
      sale_ends_at: "",
    });
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!tourId) {
      setToast({ message: "Vui lòng chọn tour trước khi mở đợt.", type: "error" });
      return;
    }
    const listPrice = Number(createForm.list_price);
    if (!listPrice || listPrice <= 0) {
      setToast({ message: "Giá niêm yết phải lớn hơn 0.", type: "error" });
      return;
    }

    const payload = {
      depart_date: createForm.depart_date,
      list_price: listPrice,
      seats_total: Number(createForm.seats_total) || 20,
      min_pax: Number(createForm.min_pax) || 1,
    };

    if (createForm.has_sale && createForm.sale_price) {
      const salePrice = Number(createForm.sale_price);
      if (salePrice >= listPrice) {
        setToast({ message: "Giá khuyến mãi phải nhỏ hơn giá niêm yết gốc.", type: "error" });
        return;
      }
      payload.sale_price = salePrice;
      if (createForm.sale_starts_at) payload.sale_starts_at = new Date(createForm.sale_starts_at).toISOString();
      if (createForm.sale_ends_at) payload.sale_ends_at = new Date(createForm.sale_ends_at).toISOString();
    }

    try {
      setSubmitting(true);
      await api.createOperatorDeparture(tourId, payload);
      setIsCreateOpen(false);
      setToast({ message: "Mở đợt khởi hành mới thành công.", type: "success" });
      reload();
    } catch (err) {
      setToast({ message: err.message || "Không thể tạo đợt khởi hành.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Mở modal sửa giá sale
  const handleOpenSaleModal = (departure) => {
    setEditingSaleDep(departure);
    setSaleForm({
      sale_price: departure.sale_price || "",
      sale_starts_at: departure.sale_starts_at ? departure.sale_starts_at.slice(0, 16) : "",
      sale_ends_at: departure.sale_ends_at ? departure.sale_ends_at.slice(0, 16) : "",
    });
  };

  const handleSaveSale = async (e) => {
    e.preventDefault();
    if (!editingSaleDep) return;

    const salePrice = Number(saleForm.sale_price);
    if (!salePrice || salePrice <= 0) {
      setToast({ message: "Vui lòng nhập giá khuyến mãi hợp lệ.", type: "error" });
      return;
    }
    if (salePrice >= editingSaleDep.list_price) {
      setToast({
        message: `Giá sale (${money(salePrice)}) phải nhỏ hơn giá gốc (${money(editingSaleDep.list_price)}).`,
        type: "error",
      });
      return;
    }

    const payload = {
      sale_price: salePrice,
      sale_starts_at: saleForm.sale_starts_at ? new Date(saleForm.sale_starts_at).toISOString() : null,
      sale_ends_at: saleForm.sale_ends_at ? new Date(saleForm.sale_ends_at).toISOString() : null,
    };

    try {
      setSubmitting(true);
      await api.setOperatorSale(editingSaleDep.id, payload);
      setEditingSaleDep(null);
      setToast({ message: "Cập nhật giá khuyến mãi thành công.", type: "success" });
      reload();
    } catch (err) {
      setToast({ message: err.message || "Không thể cập nhật giá sale.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveSale = async () => {
    if (!editingSaleDep) return;
    try {
      setSubmitting(true);
      await api.removeOperatorSale(editingSaleDep.id);
      setEditingSaleDep(null);
      setToast({ message: "Đã gỡ giá khuyến mãi, quay về giá gốc.", type: "success" });
      reload();
    } catch (err) {
      setToast({ message: err.message || "Không thể gỡ giá khuyến mãi.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Mở modal hủy đợt
  const handleOpenCancelModal = (departure) => {
    setCancelingDep(departure);
    setCancelReason("Không đủ số khách tối thiểu để chạy tour");
  };

  const handleConfirmCancel = async (e) => {
    e.preventDefault();
    if (!cancelingDep) return;

    try {
      setSubmitting(true);
      await api.cancelOperatorDeparture(cancelingDep.id, cancelReason || "Nhà điều hành huỷ đợt");
      setCancelingDep(null);
      setToast({
        message: `Đã hủy đợt khởi hành ngày ${date(cancelingDep.depart_date)}. Các đơn liên quan đã chuyển hủy và kích hoạt hoàn tiền.`,
        type: "success",
      });
      reload();
    } catch (err) {
      setToast({ message: err.message || "Không thể hủy đợt khởi hành.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Xuất file CSV danh sách khách
  const handleExportGuests = async (departureId) => {
    try {
      setToast({ message: "Đang tải xuống danh sách khách...", type: "info" });
      await api.downloadOperatorGuests(departureId);
      setToast({ message: "Tải danh sách khách thành công.", type: "success" });
    } catch (err) {
      setToast({ message: err.message || "Không thể tải danh sách khách.", type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast thông báo */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header khu vực */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            Đợt khởi hành &amp; giá
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Quản lý ngày chạy tour, số lượng chỗ ngồi và chính sách giá bán khuyến mãi
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors shadow-xs shrink-0 cursor-pointer"
        >
          <span className="material-symbols-outlined text-lg">calendar_add_on</span>
          Mở đợt khởi hành
        </button>
      </div>

      {/* Bộ chọn Tour */}
      <DeparturePicker tours={tours} tourId={tourId} onChange={setTourId} />

      {/* Thẻ chỉ số nhanh */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-zinc-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>TỔNG SỐ ĐỢT</span>
            <span className="material-symbols-outlined text-lg text-zinc-400">event_available</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">{stats.total}</div>
          <div className="text-xs text-zinc-500 mt-1">
            Đang mở bán: <strong className="text-emerald-600">{stats.openCount}</strong> đợt
          </div>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>CHỖ ĐÃ BÁN</span>
            <span className="material-symbols-outlined text-lg text-zinc-400">airline_seat_recline_normal</span>
          </div>
          <div className="mt-2 text-2xl font-bold text-zinc-900">
            {stats.sold} <span className="text-sm font-normal text-zinc-400">/ {stats.capacity} chỗ</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">
            Tỉ lệ lấp đầy toàn tour: <strong className="text-zinc-800">{stats.occupancyRate}%</strong>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-zinc-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>CHÍNH SÁCH BÁN</span>
            <span className="material-symbols-outlined text-lg text-zinc-400">local_offer</span>
          </div>
          <div className="mt-2 text-sm font-semibold text-zinc-900">Giảm giá trực tiếp theo đợt</div>
          <div className="text-xs text-zinc-500 mt-1">
            Không dùng coupon, hiển thị giá gạch ngang tự động
          </div>
        </div>
      </div>

      {/* Bảng danh sách đợt khởi hành */}
      <DepartureTable
        departures={departures}
        onEditSale={handleOpenSaleModal}
        onExportGuests={handleExportGuests}
        onCancelDeparture={handleOpenCancelModal}
      />

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL 1: Mở đợt khởi hành mới */}
      {/* ────────────────────────────────────────────────────────── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-lg w-full p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-zinc-200">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Mở đợt khởi hành mới</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Thiết lập ngày đi, giá bán và số lượng chỗ ngồi cho chuyến đi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md hover:bg-zinc-100 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Ngày khởi hành */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Ngày khởi hành <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={minDateStr}
                  value={createForm.depart_date}
                  onChange={(e) => setCreateForm({ ...createForm, depart_date: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Theo quy định BR-D1: Ngày khởi hành phải cách thời điểm hiện tại ít nhất 2 ngày.
                </p>
              </div>

              {/* Giá niêm yết */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Giá niêm yết gốc (VND) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  placeholder="Ví dụ: 3500000"
                  value={createForm.list_price}
                  onChange={(e) => setCreateForm({ ...createForm, list_price: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                />
                {createForm.list_price ? (
                  <p className="text-xs font-medium text-emerald-700 mt-1">
                    Định dạng hiển thị: {money(Number(createForm.list_price))}
                  </p>
                ) : null}
              </div>

              {/* Số chỗ & Khách tối thiểu */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Tổng số chỗ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="500"
                    value={createForm.seats_total}
                    onChange={(e) => setCreateForm({ ...createForm, seats_total: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Số khách tối thiểu (min_pax)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={createForm.min_pax}
                    onChange={(e) => setCreateForm({ ...createForm, min_pax: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 font-mono"
                  />
                </div>
              </div>

              {/* Tùy chọn đặt giá sale ngay */}
              <div className="pt-2 border-t border-zinc-200">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={createForm.has_sale}
                    onChange={(e) => setCreateForm({ ...createForm, has_sale: e.target.checked })}
                    className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-xs font-medium text-zinc-800">
                    Áp dụng giá khuyến mãi ngay cho đợt này
                  </span>
                </label>

                {createForm.has_sale && (
                  <div className="mt-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-3 animate-in fade-in duration-150">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700 mb-1">
                        Giá bán khuyến mãi (VND) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1000"
                        step="1000"
                        placeholder="Giá bán thấp hơn giá gốc"
                        value={createForm.sale_price}
                        onChange={(e) => setCreateForm({ ...createForm, sale_price: e.target.value })}
                        className="w-full bg-white border border-zinc-200 rounded-md px-3 py-1.5 text-sm text-zinc-900 font-mono"
                      />
                      {createForm.sale_price && createForm.list_price && Number(createForm.sale_price) < Number(createForm.list_price) && (
                        <div className="text-xs font-semibold text-rose-600 mt-1 flex items-center gap-1.5">
                          <span>Giảm {Math.round(((Number(createForm.list_price) - Number(createForm.sale_price)) / Number(createForm.list_price)) * 100)}%</span>
                          <span>(Tiết kiệm {money(Number(createForm.list_price) - Number(createForm.sale_price))})</span>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-600 mb-0.5">
                          Bắt đầu (tùy chọn)
                        </label>
                        <input
                          type="datetime-local"
                          value={createForm.sale_starts_at}
                          onChange={(e) => setCreateForm({ ...createForm, sale_starts_at: e.target.value })}
                          className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-800"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-zinc-600 mb-0.5">
                          Kết thúc (tùy chọn)
                        </label>
                        <input
                          type="datetime-local"
                          value={createForm.sale_ends_at}
                          onChange={(e) => setCreateForm({ ...createForm, sale_ends_at: e.target.value })}
                          className="w-full bg-white border border-zinc-200 rounded px-2 py-1 text-xs text-zinc-800"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-medium rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                >
                  {submitting ? "Đang xử lý..." : "Lưu đợt khởi hành"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL 2: Đặt hoặc Sửa giá khuyến mãi */}
      {/* ────────────────────────────────────────────────────────── */}
      {editingSaleDep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 relative">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200">
              <div>
                <h3 className="text-lg font-bold text-zinc-900">Thiết lập giá khuyến mãi</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Đợt ngày {date(editingSaleDep.depart_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSaleDep(null)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md hover:bg-zinc-100 transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>

            <div className="mb-4 p-3 bg-zinc-50 rounded-lg border border-zinc-200 text-xs space-y-1">
              <div className="flex justify-between text-zinc-600">
                <span>Giá niêm yết gốc:</span>
                <span className="font-bold text-zinc-900 font-mono text-sm">{money(editingSaleDep.list_price)}</span>
              </div>
              <div className="flex justify-between text-zinc-600">
                <span>Số chỗ còn lại:</span>
                <span className="font-semibold text-zinc-800">{editingSaleDep.seats_left}/{editingSaleDep.seats_total} chỗ</span>
              </div>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Giá bán khuyến mãi (VND) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  placeholder="Nhập giá thấp hơn giá gốc"
                  value={saleForm.sale_price}
                  onChange={(e) => setSaleForm({ ...saleForm, sale_price: e.target.value })}
                  className="w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-900 font-mono focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />

                {saleForm.sale_price && Number(saleForm.sale_price) < editingSaleDep.list_price && (
                  <div className="mt-2 p-2 rounded bg-rose-50 border border-rose-200 text-xs font-medium text-rose-800 flex items-center justify-between">
                    <span>
                      Giảm: <strong>{Math.round(((editingSaleDep.list_price - Number(saleForm.sale_price)) / editingSaleDep.list_price) * 100)}%</strong>
                    </span>
                    <span>Tiết kiệm: {money(editingSaleDep.list_price - Number(saleForm.sale_price))}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Bắt đầu (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={saleForm.sale_starts_at}
                    onChange={(e) => setSaleForm({ ...saleForm, sale_starts_at: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 mb-1">
                    Kết thúc (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={saleForm.sale_ends_at}
                    onChange={(e) => setSaleForm({ ...saleForm, sale_ends_at: e.target.value })}
                    className="w-full bg-white border border-zinc-200 rounded px-2.5 py-1.5 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-zinc-200">
                {editingSaleDep.sale_price ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleRemoveSale}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 text-zinc-600 hover:text-rose-600 hover:border-rose-200 transition-colors cursor-pointer"
                  >
                    Gỡ giá sale
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setEditingSaleDep(null)}
                    className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 text-xs font-semibold rounded-md bg-zinc-900 text-white hover:bg-zinc-800 transition-colors cursor-pointer shadow-xs disabled:opacity-60"
                  >
                    {submitting ? "Đang lưu..." : "Lưu giá sale"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* MODAL 3: Xác nhận huỷ đợt khởi hành (BR-C5) */}
      {/* ────────────────────────────────────────────────────────── */}
      {cancelingDep && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-xl border border-zinc-200 shadow-2xl max-w-md w-full p-6 relative">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <span className="material-symbols-outlined text-2xl">warning</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900">Xác nhận huỷ đợt khởi hành?</h3>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Ngày khởi hành: <strong>{date(cancelingDep.depart_date)}</strong>
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/75 rounded-lg border border-rose-200 text-xs text-rose-900 space-y-1.5 mb-4 leading-relaxed">
              <p className="font-semibold flex items-center gap-1 text-rose-700">
                <span className="material-symbols-outlined text-sm">info</span>
                Quy định bồi hoàn theo chuẩn BR-C5:
              </p>
              <p>
                Khi nhà điều hành hủy đợt, hệ thống sẽ tự động hủy toàn bộ các đơn đặt tour còn hiệu lực và kích hoạt quy trình <strong>hoàn trả 100% tiền</strong> cho khách hàng.
              </p>
            </div>

            <form onSubmit={handleConfirmCancel} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Lý do huỷ đợt <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do huỷ chuyến..."
                  className="w-full bg-white border border-zinc-200 rounded-md p-2.5 text-xs text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-200">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setCancelingDep(null)}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer shadow-xs disabled:opacity-60 flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">event_busy</span>
                  {submitting ? "Đang huỷ..." : "Xác nhận huỷ đợt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
