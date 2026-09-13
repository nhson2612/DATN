import { useCallback, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import AuthModal from "./shared/auth/AuthModal";
import AdminPage from "./admin/AdminPage";
import OperatorPage from "./operator/OperatorPage";
import Destination from "./customer/trips/destinations/Destination";
import Favorites from "./customer/trips/favorites/Favorites";
import HomePage from "./customer/trips/home";
import Navbar from "./customer/trips/home/components/Navbar/Navbar";
import PlaceDetail from "./customer/trips/place-detail";
import TourDetail from "./customer/tours/TourDetail";
import TourMyBookings from "./customer/my-bookings/TourMyBookings";
import Tours from "./customer/tours";
import TripPlanner from "./customer/trips/planner/TripPlanner";
import Trips from "./customer/trips/trips/Trips";

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

/* Đăng nhập xong, mỗi vai trò về đúng khu của mình. Khách về trang chủ, quản trị
 * về bảng quản trị. Khu nhà điều hành chưa có màn hình nào nên tạm về trang chủ —
 * dựng xong thì đổi đúng một dòng ở bảng dưới, không phải đi sửa chỗ khác. */
const TRANG_MAC_DINH = {
  admin: "/quan-tri",
  operator: "/nha-dieu-hanh",
  user: "/",
};

function trangMacDinh(role) {
  return TRANG_MAC_DINH[role] || "/";
}

function AppContent({ user, setUser, moAuth, setMoAuth, dangXuat, canDangNhap }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isPlanner = location.pathname.startsWith("/chuyen-di/") && location.pathname !== "/chuyen-di";
  const isHome = location.pathname === "/";
  const isTours = location.pathname === "/tour";
  const isAdmin = location.pathname.startsWith("/quan-tri");
  const isOperator = location.pathname.startsWith("/nha-dieu-hanh");

  // Đăng nhập xong thì về trang mặc định của chính vai trò đó: khách về trang chủ,
  // quản trị về bảng quản trị. Khách lỡ đăng nhập ở cửa quản trị cũng được đưa về
  // chỗ của mình thay vì đứng nhìn màn hình "không có quyền".
  const sauKhiDangNhap = (u) => {
    setUser(u);
    navigate(trangMacDinh(u?.role));
  };

  // Bảng quản trị có giao diện riêng: không mượn header/sidebar của web khách,
  // và web khách cũng không có lối nào vào đây (chỉ gõ thẳng /quan-tri).
  if (isAdmin) {
    return (
      <div className="font-sans min-h-screen bg-zinc-50">
        <AdminPage user={user} onLogout={dangXuat} onNeedAuth={() => setMoAuth(true)} />
        <AuthModal open={moAuth} onClose={() => setMoAuth(false)} onSuccess={sauKhiDangNhap} />
      </div>
    );
  }

  if (isOperator) {
    return <div className="font-sans min-h-screen"><OperatorPage user={user} onLogout={dangXuat} onNeedAuth={() => setMoAuth(true)} /><AuthModal open={moAuth} onClose={() => setMoAuth(false)} onSuccess={sauKhiDangNhap} /></div>;
  }

  return (
    <div className="font-sans min-h-screen">
      <Navbar
        user={user}
        onNeedAuth={() => setMoAuth(true)}
        onLogout={dangXuat}
        variant={isHome ? "home" : "sidebar"}
      />

      <div
        className={`min-h-screen flex flex-col ${
          isHome ? "" : "pt-16 lg:pl-[16.5rem] lg:pt-0"
        }`}
      >
        <div className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/diem-den/:slug" element={<Destination />} />
            <Route path="/dia-diem/:type/:id"
              element={<PlaceDetail user={user} onNeedAuth={canDangNhap} />} />
            <Route path="/tour" element={<Tours />} />
            <Route path="/tour/don-cua-toi"
              element={<TourMyBookings user={user} onNeedAuth={canDangNhap} />} />
            <Route path="/tour/:slug"
              element={<TourDetail user={user} onNeedAuth={canDangNhap} />} />
            <Route path="/chuyen-di"
              element={<Trips user={user} onNeedAuth={canDangNhap} />} />
            <Route path="/chuyen-di/:id"
              element={<TripPlanner user={user} onNeedAuth={canDangNhap} />} />
            <Route path="/tro-ly" element={<Navigate to="/chuyen-di" replace />} />
            <Route path="/yeu-thich"
              element={<Favorites user={user} onNeedAuth={canDangNhap} />} />

            <Route path="/map.html" element={<Navigate to="/chuyen-di" replace />} />
            <Route path="/admin.html" element={<Navigate to="/quan-tri" replace />} />
            <Route path="*" element={<KhongTimThay />} />
          </Routes>
        </div>

        {!isHome && !isPlanner && !isTours && (
          <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-16">
            <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-zinc-500">
              <p className="font-semibold text-zinc-700 mb-1">Đi Đâu · Khoá luận tốt nghiệp</p>
              <p>Dữ liệu địa điểm: Overture Maps · Mạng đường: OpenStreetMap · Ảnh: Wikimedia Commons</p>
            </div>
          </footer>
        )}

        <AuthModal open={moAuth} onClose={() => setMoAuth(false)} onSuccess={sauKhiDangNhap} />
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
