import { Link, useLocation, useNavigate } from "react-router-dom";

export default function Header({ user, onLogin, onLogout }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  // Đánh dấu zone đang mở để người dùng luôn biết mình đang ở nhánh nào.
  const zone = pathname.startsWith("/tour") ? "tour"
             : pathname.startsWith("/chuyen-di") ? "tu-tuc" : null;

  return (
    <header className="sticky top-0 z-40 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-accent-700 shrink-0">
          <i className="fa-solid fa-mountain-sun" /> Đi Đâu
        </Link>

        {/* Hai zone tách hẳn nhau bằng vạch dọc: bên trái là mua gói có sẵn,
            bên phải là tự lên lịch. Gộp chung một hàng link thì người dùng
            không thấy đây là hai cách đi du lịch khác nhau. */}
        <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
          <Link to="/tour"
                className={`flex items-center gap-1.5 ${zone === "tour"
                  ? "text-accent-700 dark:text-accent-500" : "text-zinc-600 dark:text-zinc-400 hover:text-accent-700"}`}>
            <i className="fa-solid fa-suitcase-rolling" /> Tour trọn gói
          </Link>

          <span className="w-px h-5 bg-zinc-200 dark:bg-zinc-800" />

          <Link to="/chuyen-di"
                className={`flex items-center gap-1.5 ${zone === "tu-tuc"
                  ? "text-accent-700 dark:text-accent-500" : "text-zinc-600 dark:text-zinc-400 hover:text-accent-700"}`}>
            <i className="fa-solid fa-map-pin" /> Tự lên lịch
          </Link>
          <Link to="/" className="text-zinc-600 dark:text-zinc-400 hover:text-accent-700">Điểm đến</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/yeu-thich" className="px-3 py-2 text-sm text-zinc-600 hover:text-accent-700 dark:hover:text-accent-500">
            <i className="fa-regular fa-heart" /> <span className="hidden sm:inline">Yêu thích</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              {user.role === "admin" && (
                <Link to="/quan-tri" title="Quản trị" className="text-sm text-zinc-600 hover:text-accent-700">
                  <i className="fa-solid fa-screwdriver-wrench" />
                </Link>
              )}
              <span className="text-sm text-zinc-600 hidden sm:inline">{user.full_name || user.email}</span>
              <button onClick={() => { onLogout(); nav("/"); }}
                      className="text-sm text-zinc-400 hover:text-red-500" title="Đăng xuất">
                <i className="fa-solid fa-right-from-bracket" />
              </button>
            </div>
          ) : (
            <button onClick={onLogin}
                    className="btn-primary">
              Đăng nhập
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
