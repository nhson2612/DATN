import { useCallback, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import AuthModal from "./components/AuthModal";
import Header from "./components/Header";
import Destination from "./pages/Destination";
import Favorites from "./pages/Favorites";
import Home from "./pages/Home";
import PlaceDetail from "./pages/PlaceDetail";
import PlaceList from "./pages/PlaceList";
import TourDetail from "./pages/TourDetail";
import Tours from "./pages/Tours";
import TripPlanner from "./pages/TripPlanner";
import Trips from "./pages/Trips";

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
      <div className="font-sans min-h-screen flex flex-col">
        <Header user={user} onLogin={() => setMoAuth(true)} onLogout={dangXuat} />

        <div className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
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
            <Route path="/yeu-thich"
                   element={<Favorites user={user} onNeedAuth={canDangNhap} />} />
          </Routes>
        </div>

        <footer className="border-t border-zinc-200 dark:border-zinc-800 mt-16">
          <div className="max-w-6xl mx-auto px-4 py-8 text-sm text-zinc-500">
            <p className="font-semibold text-zinc-700 mb-1">Đi Đâu · Khoá luận tốt nghiệp</p>
            <p>Dữ liệu địa điểm: Overture Maps · Mạng đường: OpenStreetMap · Ảnh: Wikimedia Commons</p>
          </div>
        </footer>

        <AuthModal open={moAuth} onClose={() => setMoAuth(false)} onSuccess={setUser} />
      </div>
    </BrowserRouter>
  );
}
