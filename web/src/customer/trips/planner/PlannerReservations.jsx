import React, { useState } from "react";
import "./PlannerReservations.css";

const RES_TYPES = {
  flight: {
    key: "flight",
    label: "Chuyến bay",
    icon: "flight",
    defaultPlaceholder: "VD: Vietnam Airlines VN123",
  },
  lodging: {
    key: "lodging",
    label: "Khách sạn",
    icon: "hotel",
    defaultPlaceholder: "VD: Khách sạn Meliá Đà Nẵng",
  },
  car: {
    key: "car",
    label: "Thuê xe",
    icon: "directions_car",
    defaultPlaceholder: "VD: Thuê xe 5 chỗ tự lái",
  },
  train: {
    key: "train",
    label: "Vé tàu hoả",
    icon: "train",
    defaultPlaceholder: "VD: Tàu SE3 Hà Nội - Đà Nẵng",
  },
  attachment: {
    key: "attachment",
    label: "Tệp / PDF",
    icon: "attach_file",
    defaultPlaceholder: "VD: Vé điện tử / Bảo hiểm du lịch",
  },
  other: {
    key: "other",
    label: "Ghi chú khác",
    icon: "more_horiz",
    defaultPlaceholder: "VD: Vé tham quan, Voucher buffet",
  },
};

export default function PlannerReservations({
  reservations = [],
  onCapNhatReservations,
  tongChiPhi = 0,
  formatMoney = (v) => `${Number(v || 0).toLocaleString("vi-VN")} ₫`,
  scrollToSection,
}) {
  const [activeModalType, setActiveModalType] = useState(null);

  // Form states per field
  const [formData, setFormData] = useState({});

  const resList = Array.isArray(reservations) ? reservations : [];

  // Group reservations by type
  const countsByType = resList.reduce((acc, item) => {
    const t = item.type || "other";
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});

  const totalResCost = resList.reduce((sum, item) => sum + (Number(item.cost) || 0), 0);

  const handleOpenModal = (typeKey) => {
    setActiveModalType(typeKey);
    setFormData({});
  };

  const handleCloseModal = () => {
    setActiveModalType(null);
    setFormData({});
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!activeModalType) return;

    const currentMeta = RES_TYPES[activeModalType];
    const title = formData.title?.trim() || "";
    if (!title) return;

    const newItem = {
      id: `res_${Date.now()}`,
      type: activeModalType,
      title,
      code: formData.code?.trim() || "",
      cost: Number(formData.cost || 0),
      notes: formData.notes?.trim() || "",
      // Specialized attributes
      route: formData.from && formData.to ? `${formData.from.trim()} → ${formData.to.trim()}` : formData.route?.trim() || "",
      timeDept: formData.timeDept || "",
      timeArr: formData.timeArr || "",
      dates: formData.checkIn && formData.checkOut ? `${formData.checkIn} → ${formData.checkOut}` : formData.dates || "",
      room: formData.room?.trim() || "",
      seat: formData.seat?.trim() || "",
      address: formData.address?.trim() || "",
      provider: formData.provider?.trim() || "",
      fileUrl: formData.fileUrl?.trim() || "",
      created_at: new Date().toISOString(),
    };

    const nextList = [...resList, newItem];
    if (onCapNhatReservations) {
      onCapNhatReservations(nextList);
    }
    handleCloseModal();
  };

  const handleDeleteItem = (id) => {
    const nextList = resList.filter((item) => item.id !== id);
    if (onCapNhatReservations) {
      onCapNhatReservations(nextList);
    }
  };

  const currentItems = activeModalType
    ? resList.filter((item) => item.type === activeModalType)
    : [];

  return (
    <>
      <section id="overview-reservations" className="planner-feed__cards-row">
        {/* Card 1: Đặt chỗ & Vé */}
        <div className="planner-feed__res-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="planner-feed__res-card-title m-0">Đặt chỗ & Vé chuyến đi</h3>
            <span className="text-xs font-semibold text-slate-500">
              {resList.length > 0 ? `Đã lưu: ${resList.length} mục` : "Chưa có vé nào"}
            </span>
          </div>

          <div className="op1-res-grid">
            {Object.values(RES_TYPES).map((meta) => {
              const count = countsByType[meta.key] || 0;
              return (
                <button
                  key={meta.key}
                  type="button"
                  className={`op1-res-btn ${count > 0 ? "has-items" : ""}`}
                  onClick={() => handleOpenModal(meta.key)}
                >
                  <div className="op1-res-circle">
                    <span className="material-symbols-outlined text-[20px]">{meta.icon}</span>
                    {count > 0 && <span className="op1-res-badge">{count}</span>}
                  </div>
                  <span className="op1-res-label">{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Card 2: Budgeting Quick Card */}
        <div className="planner-feed__budget-quick-card">
          <div className="flex items-center justify-between">
            <h3 className="planner-feed__res-card-title m-0">Ngân sách dự tính</h3>
            <span className="material-symbols-outlined text-slate-400 text-[18px]">payments</span>
          </div>

          <div className="planner-feed__budget-quick-body">
            <span className="planner-feed__budget-quick-val">
              {formatMoney(tongChiPhi)}
            </span>
            {totalResCost > 0 && (
              <span className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1">
                <i className="fa-solid fa-arrow-trend-up text-[9px]" />
                <span>Gồm {formatMoney(totalResCost)} vé & dịch vụ</span>
              </span>
            )}
            <button
              type="button"
              onClick={() => scrollToSection && scrollToSection("budget-section")}
              className="planner-feed__budget-quick-link"
            >
              <span>Xem chi tiết chi tiêu</span>
              <i className="fa-solid fa-chevron-right text-[10px] ml-1" />
            </button>
          </div>
        </div>
      </section>

      {/* MODAL NHẬP LIỆU CHUYÊN BIỆT */}
      {activeModalType && (
        <div className="op1-modal-overlay" onClick={handleCloseModal}>
          <div className="op1-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="op1-modal-header">
              <h3 className="op1-modal-title">
                <span className="material-symbols-outlined text-blue-600">
                  {RES_TYPES[activeModalType]?.icon}
                </span>
                <span>Thông tin {RES_TYPES[activeModalType]?.label}</span>
              </h3>
              <button
                type="button"
                className="op1-modal-close"
                onClick={handleCloseModal}
              >
                &times;
              </button>
            </div>

            {/* Danh sách các vé/đặt chỗ đã lưu của mục này */}
            {currentItems.length > 0 && (
              <div className="op1-saved-wrap">
                <div className="op1-saved-label">
                  <span>DANH SÁCH ĐÃ LƯU ({currentItems.length})</span>
                </div>
                <div className="op1-saved-list">
                  {currentItems.map((item) => (
                    <div key={item.id} className="op1-saved-card">
                      <div className="flex-1 min-w-0">
                        <div className="op1-saved-title">
                          <span>{item.title}</span>
                          {item.code && (
                            <span className="op1-saved-code">#{item.code}</span>
                          )}
                        </div>
                        {item.route && (
                          <div className="op1-saved-sub">
                            <i className="fa-solid fa-arrow-right text-[9px] text-slate-400" />
                            <span>{item.route}</span>
                          </div>
                        )}
                        {item.dates && (
                          <div className="op1-saved-sub">
                            <i className="fa-regular fa-calendar text-[9px] text-slate-400" />
                            <span>{item.dates}</span>
                          </div>
                        )}
                        {item.address && (
                          <div className="op1-saved-sub">
                            <i className="fa-solid fa-location-dot text-[9px] text-slate-400" />
                            <span>{item.address}</span>
                          </div>
                        )}
                        {item.room && (
                          <div className="op1-saved-sub">
                            <i className="fa-solid fa-bed text-[9px] text-slate-400" />
                            <span>{item.room}</span>
                          </div>
                        )}
                        {item.seat && (
                          <div className="op1-saved-sub">
                            <i className="fa-solid fa-couch text-[9px] text-slate-400" />
                            <span>{item.seat}</span>
                          </div>
                        )}
                        {item.timeDept && (
                          <div className="op1-saved-sub">
                            <i className="fa-regular fa-clock text-[9px] text-slate-400" />
                            <span>Khởi hành: {item.timeDept.replace("T", " ")}</span>
                          </div>
                        )}
                        {item.notes && (
                          <div className="op1-saved-notes">
                            &bull; {item.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="op1-saved-cost">
                          {formatMoney(item.cost)}
                        </span>
                        <button
                          type="button"
                          className="op1-saved-del"
                          onClick={() => handleDeleteItem(item.id)}
                          title="Xoá đặt chỗ này"
                        >
                          <i className="fa-solid fa-trash-can" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* FORM CHUYÊN BIỆT */}
            <form onSubmit={handleSave}>
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-3">
                + Thêm {RES_TYPES[activeModalType]?.label.toLowerCase()} mới
              </div>

              {/* 1. CHUYẾN BAY */}
              {activeModalType === "flight" && (
                <>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Hãng bay & Số hiệu chuyến *</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Vietnam Airlines VN123"
                      value={formData.title || ""}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      required
                    />
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Sân bay cất cánh (Đi) *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Sân bay Nội Bài (HAN)"
                        value={formData.from || ""}
                        onChange={(e) => handleInputChange("from", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Sân bay hạ cánh (Đến) *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Sân bay Đà Nẵng (DAD)"
                        value={formData.to || ""}
                        onChange={(e) => handleInputChange("to", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Giờ cất cánh *</label>
                      <input
                        type="datetime-local"
                        className="op1-input"
                        value={formData.timeDept || ""}
                        onChange={(e) => handleInputChange("timeDept", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Giờ hạ cánh</label>
                      <input
                        type="datetime-local"
                        className="op1-input"
                        value={formData.timeArr || ""}
                        onChange={(e) => handleInputChange("timeArr", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Mã đặt chỗ (PNR / Code) *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: PNR-83921"
                        value={formData.code || ""}
                        onChange={(e) => handleInputChange("code", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Giá vé (VNĐ) *</label>
                      <input
                        type="number"
                        className="op1-input"
                        placeholder="VD: 1800000"
                        step="10000"
                        value={formData.cost || ""}
                        onChange={(e) => handleInputChange("cost", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Số ghế & Hành lý</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: 12A • 20kg ký gửi"
                        value={formData.seat || ""}
                        onChange={(e) => handleInputChange("seat", e.target.value)}
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Ghi chú thêm</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Có mặt trước 90 phút"
                        value={formData.notes || ""}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 2. KHÁCH SẠN */}
              {activeModalType === "lodging" && (
                <>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Tên khách sạn / Homestay / Resort *</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Meliá Đà Nẵng Beach Resort"
                      value={formData.title || ""}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      required
                    />
                  </div>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Địa chỉ</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: 19 Trường Sa, Ngũ Hành Sơn, Đà Nẵng"
                      value={formData.address || ""}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                    />
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Ngày nhận phòng (Check-in) *</label>
                      <input
                        type="date"
                        className="op1-input"
                        value={formData.checkIn || ""}
                        onChange={(e) => handleInputChange("checkIn", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Ngày trả phòng (Check-out) *</label>
                      <input
                        type="date"
                        className="op1-input"
                        value={formData.checkOut || ""}
                        onChange={(e) => handleInputChange("checkOut", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Hạng phòng / Loại phòng</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Deluxe King hướng biển"
                        value={formData.room || ""}
                        onChange={(e) => handleInputChange("room", e.target.value)}
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Mã xác nhận (Booking ID) *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: AGD-98124"
                        value={formData.code || ""}
                        onChange={(e) => handleInputChange("code", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Tổng tiền phòng (VNĐ) *</label>
                      <input
                        type="number"
                        className="op1-input"
                        placeholder="VD: 2100000"
                        step="10000"
                        value={formData.cost || ""}
                        onChange={(e) => handleInputChange("cost", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">SĐT Lễ tân / Ghi chú</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: 0236.392.9999 • Đã gồm ăn sáng"
                        value={formData.notes || ""}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 3. THUÊ XE */}
              {activeModalType === "car" && (
                <>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Đơn vị cho thuê / Nhà xe *</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Thuê xe tự lái Gia Huy / Xanh SM"
                      value={formData.title || ""}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      required
                    />
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Loại xe & Số chỗ *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Toyota Vios 5 chỗ / Xe máy Vision"
                        value={formData.room || ""}
                        onChange={(e) => handleInputChange("room", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Biển số xe</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: 43A-981.22"
                        value={formData.code || ""}
                        onChange={(e) => handleInputChange("code", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Điểm nhận xe *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Ga Sân bay Đà Nẵng"
                        value={formData.from || ""}
                        onChange={(e) => handleInputChange("from", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Điểm trả xe</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Trả tại khách sạn"
                        value={formData.to || ""}
                        onChange={(e) => handleInputChange("to", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Tiền thuê xe (VNĐ) *</label>
                      <input
                        type="number"
                        className="op1-input"
                        placeholder="VD: 1400000"
                        step="10000"
                        value={formData.cost || ""}
                        onChange={(e) => handleInputChange("cost", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Tiền cọc / Ghi chú</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Đã cọc CCCD + 2.000.000đ"
                        value={formData.notes || ""}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* 4. VÉ TÀU HOẢ / XE KHÁCH */}
              {activeModalType === "train" && (
                <>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Tên tàu / Nhà xe *</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Tàu SE3 / Limousine Hải Vân"
                      value={formData.title || ""}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      required
                    />
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Ga / Bến xuất phát *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Ga Hà Nội"
                        value={formData.from || ""}
                        onChange={(e) => handleInputChange("from", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Ga / Bến đến *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Ga Đà Nẵng"
                        value={formData.to || ""}
                        onChange={(e) => handleInputChange("to", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Giờ khởi hành *</label>
                      <input
                        type="datetime-local"
                        className="op1-input"
                        value={formData.timeDept || ""}
                        onChange={(e) => handleInputChange("timeDept", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Mã vé điện tử</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: DSVN-88219"
                        value={formData.code || ""}
                        onChange={(e) => handleInputChange("code", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Toa & Vị trí chỗ *</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: Toa 4 - Giường số 12"
                        value={formData.seat || ""}
                        onChange={(e) => handleInputChange("seat", e.target.value)}
                        required
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Giá vé (VNĐ) *</label>
                      <input
                        type="number"
                        className="op1-input"
                        placeholder="VD: 750000"
                        step="10000"
                        value={formData.cost || ""}
                        onChange={(e) => handleInputChange("cost", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Ghi chú thêm</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Cần in thẻ lên tàu trước 30p"
                      value={formData.notes || ""}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* 5. TỆP ĐÍNH KÈM */}
              {activeModalType === "attachment" && (
                <>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Tên tệp / Tài liệu *</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Vé máy bay PDF / Bảo hiểm du lịch"
                      value={formData.title || ""}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      required
                    />
                  </div>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Đường dẫn tệp (URL / Google Drive)</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: https://drive.google.com/..."
                      value={formData.fileUrl || ""}
                      onChange={(e) => handleInputChange("fileUrl", e.target.value)}
                    />
                  </div>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Ghi chú xuất trình</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Xuất trình khi làm thủ tục check-in"
                      value={formData.notes || ""}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* 6. KHÁC */}
              {activeModalType === "other" && (
                <>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Nội dung đặt chỗ / Ghi chú *</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Vé cáp treo Bà Nà Hills / Tour lặn biển"
                      value={formData.title || ""}
                      onChange={(e) => handleInputChange("title", e.target.value)}
                      required
                    />
                  </div>
                  <div className="op1-form-row-2">
                    <div className="op1-form-group">
                      <label className="op1-form-label">Mã voucher / Xác nhận</label>
                      <input
                        type="text"
                        className="op1-input"
                        placeholder="VD: KLOOK-8812"
                        value={formData.code || ""}
                        onChange={(e) => handleInputChange("code", e.target.value)}
                      />
                    </div>
                    <div className="op1-form-group">
                      <label className="op1-form-label">Chi phí (VNĐ)</label>
                      <input
                        type="number"
                        className="op1-input"
                        placeholder="VD: 900000"
                        step="10000"
                        value={formData.cost || ""}
                        onChange={(e) => handleInputChange("cost", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="op1-form-group">
                    <label className="op1-form-label">Thời gian & Ghi chú</label>
                    <input
                      type="text"
                      className="op1-input"
                      placeholder="VD: Bao gồm ăn buffet trưa"
                      value={formData.notes || ""}
                      onChange={(e) => handleInputChange("notes", e.target.value)}
                    />
                  </div>
                </>
              )}

              <button type="submit" className="op1-btn-submit mt-4">
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Lưu thông tin đặt chỗ</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
