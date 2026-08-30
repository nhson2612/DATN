import { useState } from "react";
import { api } from "../api/client";

export default function TourBookingForm({ open, onClose, tour, departure }) {
  const [f, setF] = useState({ full_name: "", phone: "", email: "", guests: 2, note: "" });
  const [loi, setLoi] = useState("");
  const [xong, setXong] = useState(null);
  const [dangGui, setDangGui] = useState(false);

  if (!open) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const tong = (departure?.price || tour.price_from || 0) * (Number(f.guests) || 1);

  async function gui() {
    setLoi("");
    if (!f.full_name.trim() || !f.phone.trim()) return setLoi("Nhập họ tên và số điện thoại.");
    setDangGui(true);
    try {
      const d = await api.bookTour({
        tour_id: tour.id, departure_id: departure?.id || null,
        full_name: f.full_name, phone: f.phone, email: f.email || null,
        guests: Number(f.guests) || 1, note: f.note || null,
      });
      setXong(d);
    } catch (e) { setLoi(e.message); }
    finally { setDangGui(false); }
  }

  const oCss = "ui-field w-full";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-zinc-900 rounded-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-lg">Đặt tour</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <p className="text-sm text-zinc-500 mb-4">{tour.name}</p>

        {xong ? (
          <div className="text-center py-6">
            <i className="fa-solid fa-circle-check text-4xl text-accent-500 mb-3" />
            <p className="text-zinc-700 mb-2">{xong.message}</p>
            {xong.total_price && (
              <p className="text-sm text-zinc-500">
                Tạm tính: <b className="text-accent-700">{xong.total_price.toLocaleString("vi-VN")} đ</b>
              </p>
            )}
            <button onClick={onClose} className="btn-primary mt-4">
              Đóng
            </button>
          </div>
        ) : (
          <>
            {departure && (
              <div className="bg-accent-50 rounded-field p-3 mb-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Khởi hành</span>
                  <b>{new Date(departure.depart_date).toLocaleDateString("vi-VN")}</b>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-zinc-600">Giá / khách</span>
                  <b>{departure.price?.toLocaleString("vi-VN")} đ</b>
                </div>
                <div className="flex justify-between mt-1 pt-1 border-t border-brand-100">
                  <span className="text-zinc-600">Tạm tính {f.guests} khách</span>
                  <b className="text-accent-700">{tong.toLocaleString("vi-VN")} đ</b>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <input value={f.full_name} onChange={set("full_name")} placeholder="Họ và tên *" className={oCss} />
              <input value={f.phone} onChange={set("phone")} placeholder="Số điện thoại *" className={oCss} />
              <input value={f.email} onChange={set("email")} type="email" placeholder="Email (không bắt buộc)" className={oCss} />
              <label className="text-xs text-zinc-500 block">Số khách
                <input value={f.guests} onChange={set("guests")} type="number" min="1"
                       max={departure?.seats_left || 20} className={oCss} />
              </label>
              <textarea value={f.note} onChange={set("note")} rows="2"
                        placeholder="Ghi chú (ăn chay, trẻ em, đón tại...)" className={oCss} />
            </div>

            {loi && <p className="text-sm text-red-500 mt-3">{loi}</p>}

            <button onClick={gui} disabled={dangGui}
                    className="w-full mt-4 btn-primary w-full">
              {dangGui ? "Đang gửi..." : "Gửi yêu cầu đặt tour"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
