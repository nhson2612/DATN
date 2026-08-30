import { useState } from "react";
import { api } from "../api/client";

/* Form gửi yêu cầu đặt chỗ.
 *
 * KHÔNG có giá và KHÔNG thanh toán: CSDL không có giá phòng lẫn tình trạng phòng
 * trống, nên hệ thống chỉ nhận yêu cầu rồi để admin liên hệ lại — đúng cách các
 * website du lịch nhỏ ở Việt Nam đang làm.
 */
export default function BookingForm({ open, onClose, placeType, placeId, placeName }) {
  const [f, setF] = useState({ full_name: "", phone: "", email: "", check_in: "", check_out: "", guests: 2, note: "" });
  const [loi, setLoi] = useState("");
  const [xong, setXong] = useState("");
  const [dangGui, setDangGui] = useState(false);

  if (!open) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function gui() {
    setLoi("");
    if (!f.full_name.trim() || !f.phone.trim()) return setLoi("Nhập họ tên và số điện thoại.");
    setDangGui(true);
    try {
      const d = await api.createBooking({
        place_type: placeType, place_id: placeId,
        full_name: f.full_name, phone: f.phone,
        email: f.email || null,
        check_in: f.check_in || null, check_out: f.check_out || null,
        guests: Number(f.guests) || 1, note: f.note || null,
      });
      setXong(d.message);
    } catch (e) { setLoi(e.message); }
    finally { setDangGui(false); }
  }

  const oCss = "w-full px-3 py-2 border border-slate-300 rounded-lg outline-none focus:border-brand-500 text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-1">
          <h3 className="font-bold text-lg">Yêu cầu đặt chỗ</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">{placeName}</p>

        {xong ? (
          <div className="text-center py-6">
            <i className="fa-solid fa-circle-check text-4xl text-emerald-500 mb-3" />
            <p className="text-slate-700">{xong}</p>
            <button onClick={onClose} className="mt-4 px-5 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium">
              Đóng
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <input value={f.full_name} onChange={set("full_name")} placeholder="Họ và tên *" className={oCss} />
              <input value={f.phone} onChange={set("phone")} placeholder="Số điện thoại *" className={oCss} />
              <input value={f.email} onChange={set("email")} type="email" placeholder="Email (không bắt buộc)" className={oCss} />
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-500">Ngày nhận
                  <input value={f.check_in} onChange={set("check_in")} type="date" className={oCss} />
                </label>
                <label className="text-xs text-slate-500">Ngày trả
                  <input value={f.check_out} onChange={set("check_out")} type="date" className={oCss} />
                </label>
              </div>
              <label className="text-xs text-slate-500 block">Số khách
                <input value={f.guests} onChange={set("guests")} type="number" min="1" className={oCss} />
              </label>
              <textarea value={f.note} onChange={set("note")} rows="2"
                        placeholder="Ghi chú (loại phòng, giờ đến...)" className={oCss} />
            </div>

            {loi && <p className="text-sm text-red-500 mt-3">{loi}</p>}

            <p className="text-xs text-slate-400 mt-3">
              Đây là yêu cầu liên hệ, không phải đặt phòng có thanh toán. Chúng tôi sẽ gọi lại để xác nhận.
            </p>
            <button onClick={gui} disabled={dangGui}
                    className="w-full mt-3 bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg">
              {dangGui ? "Đang gửi..." : "Gửi yêu cầu"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
