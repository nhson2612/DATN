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
      const result = await api.cancelOperatorDeparture(cancelingDep.id, cancelReason || "Nhà điều hành huỷ đợt");
      setCancelingDep(null);
      const autoRefunded = result.stripe_refunded_payment_ids?.length || 0;
      const manualRefunds = result.manual_refund_payment_ids?.length || 0;
      const failedRefunds = result.stripe_refund_failed?.length || 0;
      setToast({
        message: `Đã hủy đợt khởi hành ngày ${date(cancelingDep.depart_date)}. Stripe đã hoàn ${autoRefunded} giao dịch; ${manualRefunds + failedRefunds} giao dịch cần xử lý.`,
        type: failedRefunds ? "error" : "success",
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
    <div className="op-departures__div-1">
      {/* Toast thông báo */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header khu vực */}
      <div className="op-departures__div-2">
        <div>
          <h1 className="op-departures__text-3">
            Đợt khởi hành &amp; giá
          </h1>
          <p className="op-departures__text-4">
            Quản lý ngày chạy tour, số lượng chỗ ngồi và chính sách giá bán khuyến mãi
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="op-departures__button-5 op-departures__button-1"
        >
          <span className="material-symbols-outlined op-departures__span-6">calendar_add_on</span>
          Mở đợt khởi hành
        </button>
      </div>

      {/* Bộ chọn Tour */}
      <DeparturePicker tours={tours} tourId={tourId} onChange={setTourId} />

      {/* Thẻ chỉ số nhanh */}
      <div className="op-departures__div-7">
        <div className="op-departures__div-8 op-departures__div-2">
          <div className="op-departures__div-9">
            <span>TỔNG SỐ ĐỢT</span>
            <span className="material-symbols-outlined op-departures__span-10">event_available</span>
          </div>
          <div className="op-departures__div-11">{stats.total}</div>
          <div className="op-departures__div-12">
            Đang mở bán: <strong className="op-departures__text-13">{stats.openCount}</strong> đợt
          </div>
        </div>

        <div className="op-departures__div-14 op-departures__div-3">
          <div className="op-departures__div-15">
            <span>CHỖ ĐÃ BÁN</span>
            <span className="material-symbols-outlined op-departures__span-16">airline_seat_recline_normal</span>
          </div>
          <div className="op-departures__div-17">
            {stats.sold} <span className="op-departures__span-18">/ {stats.capacity} chỗ</span>
          </div>
          <div className="op-departures__div-19">
            Tỉ lệ lấp đầy toàn tour: <strong className="op-departures__text-20">{stats.occupancyRate}%</strong>
          </div>
        </div>

        <div className="op-departures__div-21 op-departures__div-4">
          <div className="op-departures__div-22">
            <span>CHÍNH SÁCH BÁN</span>
            <span className="material-symbols-outlined op-departures__span-23">local_offer</span>
          </div>
          <div className="op-departures__div-24">Giảm giá trực tiếp theo đợt</div>
          <div className="op-departures__div-25">
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
        <div className="fade-in op-departures__div-26">
          <div className="op-departures__div-27 op-departures__div-5">
            <div className="op-departures__div-28">
              <div>
                <h3 className="op-departures__text-29">Mở đợt khởi hành mới</h3>
                <p className="op-departures__text-30">
                  Thiết lập ngày đi, giá bán và số lượng chỗ ngồi cho chuyến đi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="op-departures__button-31"
              >
                <span className="material-symbols-outlined op-departures__span-32">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="op-departures__form-33">
              {/* Ngày khởi hành */}
              <div>
                <label className="op-departures__label-34">
                  Ngày khởi hành <span className="op-departures__span-35">*</span>
                </label>
                <input
                  type="date"
                  required
                  min={minDateStr}
                  value={createForm.depart_date}
                  onChange={(e) => setCreateForm({ ...createForm, depart_date: e.target.value })}
                  className="op-departures__element-36 op-departures__element-6"
                />
                <p className="op-departures__text-37">
                  Theo quy định BR-D1: Ngày khởi hành phải cách thời điểm hiện tại ít nhất 2 ngày.
                </p>
              </div>

              {/* Giá niêm yết */}
              <div>
                <label className="op-departures__label-38">
                  Giá niêm yết gốc (VND) <span className="op-departures__span-39">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  placeholder="Ví dụ: 3500000"
                  value={createForm.list_price}
                  onChange={(e) => setCreateForm({ ...createForm, list_price: e.target.value })}
                  className="op-departures__element-40 op-departures__element-7"
                />
                {createForm.list_price ? (
                  <p className="op-departures__text-41">
                    Định dạng hiển thị: {money(Number(createForm.list_price))}
                  </p>
                ) : null}
              </div>

              {/* Số chỗ & Khách tối thiểu */}
              <div className="op-departures__div-42">
                <div>
                  <label className="op-departures__label-43">
                    Tổng số chỗ <span className="op-departures__span-44">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="500"
                    value={createForm.seats_total}
                    onChange={(e) => setCreateForm({ ...createForm, seats_total: e.target.value })}
                    className="op-departures__element-45 op-departures__element-8"
                  />
                </div>
                <div>
                  <label className="op-departures__label-46">
                    Số khách tối thiểu (min_pax)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="100"
                    value={createForm.min_pax}
                    onChange={(e) => setCreateForm({ ...createForm, min_pax: e.target.value })}
                    className="op-departures__element-47 op-departures__element-9"
                  />
                </div>
              </div>

              {/* Tùy chọn đặt giá sale ngay */}
              <div className="op-departures__div-48">
                <label className="op-departures__label-49">
                  <input
                    type="checkbox"
                    checked={createForm.has_sale}
                    onChange={(e) => setCreateForm({ ...createForm, has_sale: e.target.checked })}
                    className="op-departures__element-50 op-departures__element-10"
                  />
                  <span className="op-departures__span-51">
                    Áp dụng giá khuyến mãi ngay cho đợt này
                  </span>
                </label>

                {createForm.has_sale && (
                  <div className="fade-in op-departures__div-52 op-departures__div-11">
                    <div>
                      <label className="op-departures__label-53">
                        Giá bán khuyến mãi (VND) <span className="op-departures__span-54">*</span>
                      </label>
                      <input
                        type="number"
                        min="1000"
                        step="1000"
                        placeholder="Giá bán thấp hơn giá gốc"
                        value={createForm.sale_price}
                        onChange={(e) => setCreateForm({ ...createForm, sale_price: e.target.value })}
                        className="op-departures__element-55 op-departures__element-12"
                      />
                      {createForm.sale_price && createForm.list_price && Number(createForm.sale_price) < Number(createForm.list_price) && (
                        <div className="op-departures__div-56">
                          <span>Giảm {Math.round(((Number(createForm.list_price) - Number(createForm.sale_price)) / Number(createForm.list_price)) * 100)}%</span>
                          <span>(Tiết kiệm {money(Number(createForm.list_price) - Number(createForm.sale_price))})</span>
                        </div>
                      )}
                    </div>

                    <div className="op-departures__div-57">
                      <div>
                        <label className="op-departures__label-58">
                          Bắt đầu (tùy chọn)
                        </label>
                        <input
                          type="datetime-local"
                          value={createForm.sale_starts_at}
                          onChange={(e) => setCreateForm({ ...createForm, sale_starts_at: e.target.value })}
                          className="op-departures__element-59 op-departures__element-13"
                        />
                      </div>
                      <div>
                        <label className="op-departures__label-60">
                          Kết thúc (tùy chọn)
                        </label>
                        <input
                          type="datetime-local"
                          value={createForm.sale_ends_at}
                          onChange={(e) => setCreateForm({ ...createForm, sale_ends_at: e.target.value })}
                          className="op-departures__element-61 op-departures__element-14"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="op-departures__div-62">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setIsCreateOpen(false)}
                  className="op-departures__button-63 op-departures__button-15"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="op-departures__button-64"
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
        <div className="fade-in op-departures__div-65">
          <div className="op-departures__div-66 op-departures__div-16">
            <div className="op-departures__div-67">
              <div>
                <h3 className="op-departures__text-68">Thiết lập giá khuyến mãi</h3>
                <p className="op-departures__text-69">
                  Đợt ngày {date(editingSaleDep.depart_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingSaleDep(null)}
                className="op-departures__button-70"
              >
                <span className="material-symbols-outlined op-departures__span-71">close</span>
              </button>
            </div>

            <div className="op-departures__div-72 op-departures__div-17">
              <div className="op-departures__div-73">
                <span>Giá niêm yết gốc:</span>
                <span className="op-departures__span-74">{money(editingSaleDep.list_price)}</span>
              </div>
              <div className="op-departures__div-75">
                <span>Số chỗ còn lại:</span>
                <span className="op-departures__span-76">{editingSaleDep.seats_left}/{editingSaleDep.seats_total} chỗ</span>
              </div>
            </div>

            <form onSubmit={handleSaveSale} className="op-departures__form-77">
              <div>
                <label className="op-departures__label-78">
                  Giá bán khuyến mãi (VND) <span className="op-departures__span-79">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="1000"
                  placeholder="Nhập giá thấp hơn giá gốc"
                  value={saleForm.sale_price}
                  onChange={(e) => setSaleForm({ ...saleForm, sale_price: e.target.value })}
                  className="op-departures__element-80 op-departures__element-18"
                />

                {saleForm.sale_price && Number(saleForm.sale_price) < editingSaleDep.list_price && (
                  <div className="op-departures__div-81 op-departures__div-19">
                    <span>
                      Giảm: <strong>{Math.round(((editingSaleDep.list_price - Number(saleForm.sale_price)) / editingSaleDep.list_price) * 100)}%</strong>
                    </span>
                    <span>Tiết kiệm: {money(editingSaleDep.list_price - Number(saleForm.sale_price))}</span>
                  </div>
                )}
              </div>

              <div className="op-departures__div-82">
                <div>
                  <label className="op-departures__label-83">
                    Bắt đầu (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={saleForm.sale_starts_at}
                    onChange={(e) => setSaleForm({ ...saleForm, sale_starts_at: e.target.value })}
                    className="op-departures__element-84 op-departures__element-20"
                  />
                </div>
                <div>
                  <label className="op-departures__label-85">
                    Kết thúc (tùy chọn)
                  </label>
                  <input
                    type="datetime-local"
                    value={saleForm.sale_ends_at}
                    onChange={(e) => setSaleForm({ ...saleForm, sale_ends_at: e.target.value })}
                    className="op-departures__element-86 op-departures__element-21"
                  />
                </div>
              </div>

              <div className="op-departures__div-87">
                {editingSaleDep.sale_price ? (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleRemoveSale}
                    className="op-departures__button-88 op-departures__button-22"
                  >
                    Gỡ giá sale
                  </button>
                ) : <span />}

                <div className="op-departures__div-89">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setEditingSaleDep(null)}
                    className="op-departures__button-90 op-departures__button-23"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="op-departures__button-91"
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
        <div className="fade-in op-departures__div-92">
          <div className="op-departures__div-93 op-departures__div-24">
            <div className="op-departures__div-94">
              <div className="op-departures__div-95 op-departures__div-25">
                <span className="material-symbols-outlined op-departures__span-96">warning</span>
              </div>
              <div>
                <h3 className="op-departures__text-97">Xác nhận huỷ đợt khởi hành?</h3>
                <p className="op-departures__text-98">
                  Ngày khởi hành: <strong>{date(cancelingDep.depart_date)}</strong>
                </p>
              </div>
            </div>

            <div className="op-departures__div-99 op-departures__div-26">
              <p className="op-departures__text-100">
                <span className="material-symbols-outlined op-departures__span-101">info</span>
                Quy định bồi hoàn theo chuẩn BR-C5:
              </p>
              <p>
                Khi nhà điều hành hủy đợt, hệ thống sẽ tự động hủy toàn bộ các đơn đặt tour còn hiệu lực và kích hoạt quy trình <strong>hoàn trả 100% tiền</strong> cho khách hàng.
              </p>
            </div>

            <form onSubmit={handleConfirmCancel} className="op-departures__form-102">
              <div>
                <label className="op-departures__label-103">
                  Lý do huỷ đợt <span className="op-departures__span-104">*</span>
                </label>
                <textarea
                  required
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Nhập lý do huỷ chuyến..."
                  className="op-departures__element-105 op-departures__element-27"
                />
              </div>

              <div className="op-departures__div-106">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setCancelingDep(null)}
                  className="op-departures__button-107 op-departures__button-28"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="op-departures__button-108"
                >
                  <span className="material-symbols-outlined op-departures__span-109">event_busy</span>
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
