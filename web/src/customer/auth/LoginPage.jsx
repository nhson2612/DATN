import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../shared/api";
import "./LoginPage.css";

const HOME_BG_URL = "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=2000&q=90";
const HOME_TRANSITION_DURATION = 1250;

/**
 * Trang Đăng nhập & Đăng ký Voyage chuẩn thiết kế login.html
 * Nền Vịnh Lan Hạ, Việt Nam
 */
export default function LoginPage({ _user, onSuccess, initialMode }) {
  const navigate = useNavigate();
  const location = useLocation();

  const isRegisterParam =
    initialMode === "register" ||
    location.pathname === "/dang-ky" ||
    new URLSearchParams(location.search).get("mode") === "register";

  const [isLogin, setIsLogin] = useState(!isRegisterParam);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Preload ảnh nền của Home để khi login xong hiệu ứng đổi ảnh xảy ra tức thì
  useEffect(() => {
    const img = new Image();
    img.src = HOME_BG_URL;
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage("");
    }, 2400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Vui lòng nhập đầy đủ email và mật khẩu.");
      return;
    }

    if (!isLogin && !fullName.trim()) {
      setError("Vui lòng nhập họ và tên của bạn.");
      return;
    }

    setLoading(true);

    try {
      let res;
      if (isLogin) {
        res = await api.login({ email, password });
      } else {
        res = await api.register({
          email,
          password,
          full_name: fullName,
        });
      }

      localStorage.setItem("token", res.access_token);
      localStorage.setItem("user", JSON.stringify(res.user));

      const targetPath =
        location.state?.from ||
        (res.user?.role === "admin"
          ? "/quan-tri"
          : res.user?.role === "operator"
          ? "/nha-dieu-hanh"
          : "/");

      // Nếu chuyển về trang Home ("/") hoặc luồng khách thông thường:
      // Kích hoạt hiệu ứng đổi ảnh nền hero sang ảnh nền của Home và phóng to tràn màn hình
      if (targetPath === "/") {
        setIsTransitioning(true);
        if (onSuccess) onSuccess(res.user, false);

        const transitionDuration = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? 0
          : HOME_TRANSITION_DURATION;

        setTimeout(() => {
          navigate("/", { replace: true, state: { fromLoginTransition: true } });
        }, transitionDuration);
      } else {
        if (onSuccess) onSuccess(res.user, true);
        navigate(targetPath, { replace: true });
      }
    } catch (err) {
      setError(err.message || "Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialClick = (provider) => {
    showToast(`Đăng nhập với ${provider} sẽ sớm khả dụng.`);
  };

  return (
    <div className={`voyage-login-page ${isTransitioning ? "voyage-login-page--transitioning" : ""}`}>
      <main className={`voyage-login-shell ${isTransitioning ? "voyage-login-shell--transitioning" : ""}`}>
        {/* =======================================================
            CỘT TRÁI: HERO VỊNH LAN HẠ
            ======================================================= */}
        <section className={`voyage-login-hero ${isTransitioning ? "voyage-login-hero--transitioning" : ""}`} aria-label="Travel inspiration">
          {/* Ảnh nền Home cross-fade khi chuyển cảnh */}
          <div
            className="voyage-login-home-bg-preview"
            style={{ backgroundImage: `url(${HOME_BG_URL})` }}
            aria-hidden="true"
          />

          {/* Lớp overlay hiệu ứng chuyển giao */}
          <div className="voyage-login-transition-curtain" aria-hidden="true">
            <div className="voyage-login-transition-pulse">
              <span className="voyage-login-transition-brand">Voyage</span>
            </div>
          </div>
          <header className="voyage-login-nav">
            <Link to="/" className="voyage-login-brand">
              Voyage
            </Link>

            <nav className="voyage-login-nav-links" aria-label="Primary navigation">
              <Link to="/" className="voyage-login-nav-link">
                Destinations
              </Link>
              <Link to="/tour" className="voyage-login-nav-link">
                Tours
              </Link>
              <Link to="/chuyen-di" className="voyage-login-nav-link">
                Experiences
              </Link>
            </nav>

            <div className="voyage-login-nav-actions">
              <Link to="/tour" className="voyage-login-icon-btn" aria-label="Search tours">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.4-3.4" />
                </svg>
              </Link>
            </div>
          </header>

          <div className="voyage-login-hero-content">
            <p className="voyage-login-eyebrow">A more meaningful way to travel</p>
            <h1>Extraordinary places await</h1>
            <p className="voyage-login-hero-copy">
              Curated journeys. Deeper experiences.
              <br />
              A more connected you.
            </p>
          </div>

          <div className="voyage-login-hero-footer">
            <div className="voyage-login-tagline">Explore a brighter tomorrow</div>

            <div className="voyage-login-place">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
                <circle cx="12" cy="10" r="2.4" />
              </svg>
              <strong>Lan Ha Bay, Vietnam</strong>
              <span>Cat Ba Archipelago, Hai Phong</span>
            </div>
          </div>
        </section>

        {/* =======================================================
            CỘT PHẢI: FORM AUTHENTICATION
            ======================================================= */}
        <section className="voyage-login-auth" aria-label="Authentication">
          <div className="voyage-login-auth-top">
            <Link to="/" className="voyage-login-auth-brand">
              Voyage
            </Link>
            <div className="voyage-login-account-prompt">
              {isLogin ? "New to Voyage?" : "Already have an account?"}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
              >
                {isLogin ? "Create an account" : "Sign in"}
              </button>
            </div>
          </div>

          <div className="voyage-login-form-wrap">
            <h2>{isLogin ? "Welcome back" : "Create an account"}</h2>
            <p className="voyage-login-subtitle">
              {isLogin
                ? "Sign in to continue planning your next journey."
                : "Join Voyage to discover curated itineraries and personalized tours."}
            </p>

            {error && (
              <div className="voyage-login-error">
                <span className="material-symbols-outlined text-[19px]">error</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Họ tên khi đăng ký */}
              {!isLogin && (
                <div className="voyage-login-field">
                  <label htmlFor="fullName">Full name</label>
                  <div className="voyage-login-input-shell">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <input
                      id="fullName"
                      type="text"
                      placeholder="e.g. Alex Nguyen"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* Email */}
              <div className="voyage-login-field">
                <label htmlFor="email">Email address</label>
                <div className="voyage-login-input-shell">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m4 7 8 6 8-6" />
                  </svg>
                  <input
                    id="email"
                    type="email"
                    placeholder="you@yourmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="voyage-login-field">
                <label htmlFor="password">Password</label>
                <div className="voyage-login-input-shell">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="5" y="10" width="14" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                  </svg>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                  />
                  <button
                    className="voyage-login-password-toggle"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                      {showPassword ? (
                        <>
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </>
                      ) : (
                        <>
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
                          <circle cx="12" cy="12" r="2.6" />
                        </>
                      )}
                    </svg>
                  </button>
                </div>
              </div>

              {/* Remember me & Forgot password */}
              {isLogin && (
                <div className="voyage-login-row">
                  <label className="voyage-login-remember">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="voyage-login-forgot"
                    onClick={() => showToast("Vui lòng liên hệ quản trị viên để khôi phục mật khẩu.")}
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Submit CTA */}
              <button className="voyage-login-primary" type="submit" disabled={loading}>
                <span>
                  {loading
                    ? "Please wait..."
                    : isLogin
                    ? "Sign in"
                    : "Create account"}
                </span>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m14 7 5 5-5 5" />
                </svg>
              </button>
            </form>

            <div className="voyage-login-divider">
              <span>Or continue with</span>
            </div>

            {/* Social Logins */}
            <div className="voyage-login-socials">
              <button
                className="voyage-login-social"
                type="button"
                onClick={() => handleSocialClick("Google")}
                title="Sign in with Google"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.22-.2-1.75H12v3.17h5.52a4.76 4.76 0 0 1-2.05 3.04l-.02.1 2.98 2.31.21.02c1.93-1.78 2.96-4.4 2.96-6.89Z" />
                  <path fill="#34A853" d="M12 22c2.7 0 4.97-.89 6.63-2.42l-3.17-2.43c-.85.57-1.97.97-3.46.97a5.99 5.99 0 0 1-5.67-4.13l-.1.01-3.1 2.4-.04.09A10 10 0 0 0 12 22Z" />
                  <path fill="#FBBC05" d="M6.33 13.99A6.18 6.18 0 0 1 6 12c0-.69.12-1.35.32-1.99l-.01-.13-3.14-2.44-.1.05A10 10 0 0 0 2 12c0 1.62.39 3.15 1.08 4.5l3.25-2.51Z" />
                  <path fill="#EA4335" d="M12 5.88c1.88 0 3.15.81 3.88 1.49l2.82-2.75C16.97 3.02 14.7 2 12 2a10 10 0 0 0-8.92 5.5l3.24 2.51A5.99 5.99 0 0 1 12 5.88Z" />
                </svg>
                <span>Google</span>
              </button>

              <button
                className="voyage-login-social"
                type="button"
                onClick={() => handleSocialClick("Apple")}
                title="Sign in with Apple"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M16.7 12.3c0-2.1 1.7-3.1 1.8-3.2-1-.1-2.2-.6-3.7-.6-1.6 0-2.5.6-3.7.6-1.3 0-2.4-.6-3.8-.6-2 0-4 1.2-5.1 3.2-2.2 3.8-.6 9.5 1.6 12.6 1.1 1.5 2.3 3.1 4 3 .1 0 1.4-.5 2.9-.5 1.4 0 2.7.5 2.9.5 1.7 0 2.9-1.5 4-3 1.2-1.8 1.7-3.5 1.7-3.6-.1 0-2.6-1-2.6-4.4ZM14 6.8c1-1.2 1.7-2.8 1.5-4.4-1.4.1-3 .9-4 2.1-.9 1-1.7 2.6-1.5 4.2 1.5.1 3-.7 4-1.9Z" transform="scale(.75) translate(4 1)" />
                </svg>
                <span>Apple</span>
              </button>

              <button
                className="voyage-login-social"
                type="button"
                onClick={() => handleSocialClick("Microsoft")}
                title="Sign in with Microsoft"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#f25022" d="M2 2h9v9H2z" />
                  <path fill="#7fba00" d="M13 2h9v9h-9z" />
                  <path fill="#00a4ef" d="M2 13h9v9H2z" />
                  <path fill="#ffb900" d="M13 13h9v9h-9z" />
                </svg>
                <span>Microsoft</span>
              </button>
            </div>

            <div className="voyage-login-helper">
              By continuing, you agree to Voyage Terms of Service and Privacy Policy.
            </div>
          </div>
        </section>
      </main>

      {/* Toast Notification */}
      <div className={`voyage-login-toast ${toastMessage ? "show" : ""}`} role="status">
        {toastMessage}
      </div>
    </div>
  );
}
