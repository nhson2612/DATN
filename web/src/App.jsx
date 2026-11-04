import { useCallback, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import AuthModal from "./shared/auth/AuthModal";
import AdminPage from "./admin/AdminPage";
import OperatorPage from "./operator/OperatorPage";
import Destination from "./customer/trips/destinations/Destination";
import Favorites from "./customer/trips/favorites/Favorites";
import HomePage from "./customer/trips/home";
import PlaceDetail from "./customer/trips/place-detail";
import TourDetail from "./customer/tours/TourDetail";
import Tours from "./customer/tours";
import TripPlanner from "./customer/trips/planner/TripPlanner";
import Trips from "./customer/trips/trips/Trips";
import LoginPage from "./customer/auth/LoginPage";
import AccountPage from "./customer/account/AccountPage";
import SupportWidget from "./shared/support/SupportWidget";

function KhongTimThay() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-24 text-center">
      <p className="text-5xl font-bold text-zinc-300 dark:text-zinc-700">404</p>
      <h1 className="text-xl font-bold mt-4">Không có trang này</h1>
      <p className="text-zinc-500 mt-2">
        Đường dẫn bạn mở không tồn tại hoặc đã được thay bằng trang khác.
      </p>
      <Link to="/" className="btn-primary inline-block mt-6">Về trang chủ</Link>
    </div>
  );
}

function RedirectDonCuaToi() {
  const location = useLocation();
  const sp = new URLSearchParams(location.search);
  sp.set("tab", "tours");
  return <Navigate to={`/account?${sp.toString()}`} replace />;
}

function RedirectChuyenDiChiTiet() {
  const location = useLocation();
  const id = location.pathname.replace(/^\/chuyen-di\//, "");
  return <Navigate to={`/trips/${id}${location.search}`} replace />;
}

/* Đăng nhập xong, mỗi vai trò về đúng khu của mình. Khách về trang chủ, quản trị
 * về bảng quản trị, nhà điều hành về khu operator. */
const TRANG_MAC_DINH = {
  admin: "/admin",
  operator: "/operator",
  user: "/",
};

function trangMacDinh(role) {
  return TRANG_MAC_DINH[role] || "/";
}

function AppContent({ user, setUser, moAuth, setMoAuth, dangXuat, canDangNhap }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isPlanner = (location.pathname.startsWith("/trips/") || location.pathname.startsWith("/chuyen-di/")) &&
    location.pathname !== "/trips" && location.pathname !== "/chuyen-di";
  const isHome = location.pathname === "/";
  const isTours = location.pathname === "/tour" || location.pathname === "/tours";
  const isTourDetail = (location.pathname.startsWith("/tour/") || location.pathname.startsWith("/tours/")) &&
    location.pathname !== "/tour/don-cua-toi" && location.pathname !== "/tours/my-bookings";
  const isMyBookings = location.pathname === "/tour/don-cua-toi" || location.pathname === "/tours/my-bookings";
  const isTrips = location.pathname === "/trips" || location.pathname === "/chuyen-di";
  const isLogin = location.pathname === "/login" || location.pathname === "/dang-nhap" || location.pathname === "/dang-ky";
  const isAccount = location.pathname === "/account" || location.pathname === "/tai-khoan";
  const isAdmin = location.pathname.startsWith("/admin") || location.pathname.startsWith("/quan-tri");
  const isOperator = location.pathname.startsWith("/operator") || location.pathname.startsWith("/nha-dieu-hanh");

  // Chuyển tới trang đăng nhập chuẩn và lưu lại trang đang đứng để sau khi đăng nhập quay về
  const handleNeedAuth = useCallback(() => {
    navigate("/login", { state: { from: location.pathname } });
  }, [navigate, location.pathname]);

  // Đăng nhập xong thì về trang mặc định của chính vai trò đó: khách về trang chủ,
  // quản trị về bảng quản trị. Khách lỡ đăng nhập ở cửa quản trị cũng được đưa về
  // chỗ của mình thay vì đứng nhìn màn hình "không có quyền".
  const sauKhiDangNhap = (u, shouldNavigate = true) => {
    setUser(u);
    if (shouldNavigate) {
      navigate(trangMacDinh(u?.role));
    }
  };

  // Bảng quản trị có giao diện riêng: không mượn header/sidebar của web khách.
  if (isAdmin) {
    return (
      <div className="font-sans min-h-screen bg-zinc-50">
        <AdminPage user={user} onLogout={dangXuat} onNeedAuth={handleNeedAuth} />
        <AuthModal open={moAuth} onClose={() => setMoAuth(false)} onSuccess={sauKhiDangNhap} />
      </div>
    );
  }

  if (isOperator) {
    return <div className="font-sans min-h-screen"><OperatorPage user={user} onLogout={dangXuat} onNeedAuth={handleNeedAuth} /><AuthModal open={moAuth} onClose={() => setMoAuth(false)} onSuccess={sauKhiDangNhap} /></div>;
  }

  const isFullPage = isHome || isTours || isTourDetail || isMyBookings || isTrips || isPlanner || isLogin || isAccount;

  return (
    <div className="font-sans min-h-screen">
      <div className="min-h-screen flex flex-col">
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage user={user} onNeedAuth={handleNeedAuth} onLogout={dangXuat} />} />
            {/* Điểm đến */}
            <Route path="/destinations/:slug" element={<Destination />} />
            <Route path="/diem-den/:slug" element={<Destination />} />

            {/* Địa điểm */}
            <Route path="/places/:type/:id" element={<PlaceDetail user={user} onNeedAuth={handleNeedAuth} />} />
            <Route path="/dia-diem/:type/:id" element={<PlaceDetail user={user} onNeedAuth={handleNeedAuth} />} />

            {/* Tours */}
            <Route path="/tours" element={<Tours user={user} onNeedAuth={handleNeedAuth} onLogout={dangXuat} />} />
            <Route path="/tour" element={<Tours user={user} onNeedAuth={handleNeedAuth} onLogout={dangXuat} />} />
            <Route path="/tours/my-bookings" element={<RedirectDonCuaToi />} />
            <Route path="/tour/don-cua-toi" element={<RedirectDonCuaToi />} />
            <Route path="/tours/:slug" element={<TourDetail user={user} onNeedAuth={handleNeedAuth} onLogout={dangXuat} />} />
            <Route path="/tour/:slug" element={<TourDetail user={user} onNeedAuth={handleNeedAuth} onLogout={dangXuat} />} />

            {/* Chuyến đi / Trips */}
            <Route path="/trips/:id" element={<TripPlanner user={user} onNeedAuth={handleNeedAuth} />} />
            <Route path="/chuyen-di/:id" element={<RedirectChuyenDiChiTiet />} />
            <Route path="/trips" element={<Trips user={user} onNeedAuth={handleNeedAuth} onLogout={dangXuat} />} />
            <Route path="/chuyen-di" element={<Navigate to="/trips" replace />} />
            <Route path="/tro-ly" element={<Navigate to="/trips" replace />} />

            {/* Yêu thích */}
            <Route path="/favorites" element={<Favorites user={user} onNeedAuth={handleNeedAuth} />} />
            <Route path="/yeu-thich" element={<Favorites user={user} onNeedAuth={handleNeedAuth} />} />

            {/* Tài khoản */}
            <Route path="/account" element={<AccountPage user={user} onLogout={dangXuat} onNeedAuth={handleNeedAuth} />} />
            <Route path="/tai-khoan" element={<AccountPage user={user} onLogout={dangXuat} onNeedAuth={handleNeedAuth} />} />

            {/* Đăng nhập & Đăng ký */}
            <Route path="/login" element={<LoginPage user={user} onSuccess={sauKhiDangNhap} />} />
            <Route path="/dang-nhap" element={<Navigate to="/login" replace />} />
            <Route path="/register" element={<LoginPage user={user} onSuccess={sauKhiDangNhap} initialMode="register" />} />
            <Route path="/dang-ky" element={<LoginPage user={user} onSuccess={sauKhiDangNhap} initialMode="register" />} />

            {/* Quản trị & Điều hành */}
            <Route path="/admin" element={<AdminPage user={user} onLogout={dangXuat} onNeedAuth={handleNeedAuth} />} />
            <Route path="/quan-tri" element={<Navigate to="/admin" replace />} />
            <Route path="/admin.html" element={<Navigate to="/admin" replace />} />
            <Route path="/operator/*" element={<OperatorPage user={user} onLogout={dangXuat} onNeedAuth={handleNeedAuth} />} />
            <Route path="/nha-dieu-hanh/*" element={<Navigate to="/operator" replace />} />

            <Route path="/map.html" element={<Navigate to="/trips" replace />} />
            <Route path="*" element={<KhongTimThay />} />
          </Routes>
        </div>

        {!isHome && !isPlanner && !isTours && !isTourDetail && !isMyBookings && !isTrips && !isLogin && !isAccount && (
          <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-16">
            <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-zinc-500">
              <p className="font-semibold text-zinc-700 mb-1">Aura Voyage · Khoá luận tốt nghiệp</p>
              <p>Dữ liệu địa điểm: Overture Maps · Mạng đường: OpenStreetMap · Ảnh: Wikimedia Commons</p>
            </div>
          </footer>
        )}

        <AuthModal open={moAuth} onClose={() => setMoAuth(false)} onSuccess={sauKhiDangNhap} />
        {!isLogin && <SupportWidget user={user} onNeedAuth={handleNeedAuth} />}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user") || "null"); }
    catch { return null; }
  });
  const [moAuth, setMoAuth] = useState(false);

  const canDangNhap = useCallback(() => setMoAuth(true), []);

  function dangXuat() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <BrowserRouter>
      <AppContent
        user={user}
        setUser={setUser}
        moAuth={moAuth}
        setMoAuth={setMoAuth}
        dangXuat={dangXuat}
        canDangNhap={canDangNhap}
      />
    </BrowserRouter>
  );
}
