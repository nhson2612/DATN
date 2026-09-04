import { useCallback, useState } from "react";
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";

import AuthModal from "./components/auth/AuthModal";
import Header from "./components/layout/Header";
import Admin from "./pages/Admin";
import Destination from "./pages/Destination";
import Favorites from "./pages/Favorites";
import HomePage from "./pages/HomePage";
import PlaceDetail from "./pages/PlaceDetail";
import PlaceList from "./pages/PlaceList";
import TourDetail from "./pages/TourDetail";
import Tours from "./pages/Tours";
import TripPlanner from "./pages/TripPlanner";
import Trips from "./pages/Trips";

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

function AppContent({ user, setUser, moAuth, setMoAuth, dangXuat, canDangNhap }) {
  const location = useLocation();
  const isPlanner = location.pathname.startsWith("/chuyen-di/") && location.pathname !== "/chuyen-di";

  return (
    <div className="font-sans min-h-screen flex flex-col">
      <Header user={user} onLogin={() => setMoAuth(true)} onLogout={dangXuat} />

      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/diem-den/:slug" element={<Destination />} />
          <Route path="/dia-diem" element={<PlaceList />} />
          <Route path="/dia-diem/:type/:id"
            element={<PlaceDetail user={user} onNeedAuth={canDangNhap} />} />
          <Route path="/tour" element={<Tours />} />
          <Route path="/tour/:slug"
            element={<TourDetail user={user} onNeedAuth={canDangNhap} />} />
          <Route path="/chuyen-di"
            element={<Trips user={user} onNeedAuth={canDangNhap} />} />
          <Route path="/chuyen-di/:id"
            element={<TripPlanner user={user} onNeedAuth={canDangNhap} />} />
          <Route path="/tro-ly" element={<Navigate to="/chuyen-di" replace />} />
          <Route path="/quan-tri" element={<Admin user={user} />} />
          <Route path="/yeu-thich"
            element={<Favorites user={user} onNeedAuth={canDangNhap} />} />

          <Route path="/map.html" element={<Navigate to="/chuyen-di" replace />} />
          <Route path="/admin.html" element={<Navigate to="/quan-tri" replace />} />
          <Route path="*" element={<KhongTimThay />} />
        </Routes>
      </div>

      {!isPlanner && (
        <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-16">
          <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-zinc-500">
            <p className="font-semibold text-zinc-700 mb-1">Đi Đâu · Khoá luận tốt nghiệp</p>
            <p>Dữ liệu địa điểm: Overture Maps · Mạng đường: OpenStreetMap · Ảnh: Wikimedia Commons</p>
          </div>
        </footer>
      )}

      <AuthModal open={moAuth} onClose={() => setMoAuth(false)} onSuccess={setUser} />
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
