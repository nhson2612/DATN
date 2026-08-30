import { useState } from "react";
import { api } from "../api/client";

export default function AuthModal({ open, onClose, onSuccess }) {
  const [dangKy, setDangKy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [loi, setLoi] = useState("");
  const [dangGui, setDangGui] = useState(false);

  if (!open) return null;

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function gui() {
    setLoi("");
    if (!form.email || !form.password) return setLoi("Nhập email và mật khẩu.");
    setDangGui(true);
    try {
      if (dangKy) {
        await api.register(form.email, form.password, form.full_name || form.email);
      }
      const d = await api.login(form.email, form.password);
      localStorage.setItem("token", d.access_token);
      localStorage.setItem("user", JSON.stringify(d.user));
      onSuccess(d.user);
      onClose();
    } catch (e) {
      setLoi(e.message);
    } finally {
      setDangGui(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
         onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-zinc-900 rounded-card p-6 w-full max-w-sm">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg">{dangKy ? "Đăng ký" : "Đăng nhập"}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {dangKy && (
          <input value={form.full_name} onChange={set("full_name")} placeholder="Họ và tên"
                 className="ui-field w-full mb-3" />
        )}
        <input value={form.email} onChange={set("email")} type="email" placeholder="Email"
               className="ui-field w-full mb-3" />
        <input value={form.password} onChange={set("password")} type="password" placeholder="Mật khẩu"
               onKeyDown={(e) => e.key === "Enter" && gui()}
               className="ui-field w-full mb-3" />

        {loi && <p className="text-sm text-red-500 mb-3">{loi}</p>}

        <button onClick={gui} disabled={dangGui}
                className="w-full btn-primary w-full">
          {dangGui ? "Đang xử lý..." : "Tiếp tục"}
        </button>

        <p className="text-sm text-zinc-500 mt-3 text-center">
          {dangKy ? "Đã có tài khoản?" : "Chưa có tài khoản?"}{" "}
          <button onClick={() => { setDangKy(!dangKy); setLoi(""); }}
                  className="text-accent-700 font-medium">
            {dangKy ? "Đăng nhập" : "Đăng ký"}
          </button>
        </p>
      </div>
    </div>
  );
}
