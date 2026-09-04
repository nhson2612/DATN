import "./AuthModal.css";
import { useState } from "react";
import { api } from "../../api/client";

export default function AuthModal({ open, onClose, onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isLogin) {
        const res = await api.login({ email, password });
        localStorage.setItem("token", res.access_token);
        localStorage.setItem("user", JSON.stringify(res.user));
        onSuccess(res.user);
      } else {
        const res = await api.register({
          email,
          password,
          full_name: fullName,
        });
        localStorage.setItem("token", res.access_token);
        localStorage.setItem("user", JSON.stringify(res.user));
        onSuccess(res.user);
      }
      onClose();
    } catch (err) {
      setError(err.message || "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>
          <i className="fa-solid fa-xmark" />
        </button>

        <h2 className="auth-title">
          {isLogin ? "Đăng nhập" : "Tạo tài khoản mới"}
        </h2>
        <p className="auth-subtitle">
          {isLogin
            ? "Đăng nhập để lưu địa điểm và chuyến đi"
            : "Tham gia để trải nghiệm đầy đủ tính năng"}
        </p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div>
              <label className="auth-label">Họ và tên</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="auth-input"
              />
            </div>
          )}

          <div>
            <label className="auth-label">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@example.com"
              className="auth-input"
            />
          </div>

          <div>
            <label className="auth-label">Mật khẩu</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="auth-input"
            />
          </div>

          <button type="submit" disabled={loading} className="auth-submit">
            {loading
              ? "Đang xử lý..."
              : isLogin
              ? "Đăng nhập"
              : "Đăng ký"}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? (
            <p>
              Chưa có tài khoản?{" "}
              <button onClick={() => setIsLogin(false)}>Đăng ký ngay</button>
            </p>
          ) : (
            <p>
              Đã có tài khoản?{" "}
              <button onClick={() => setIsLogin(true)}>Đăng nhập</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
