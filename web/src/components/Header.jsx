import { Link, useNavigate } from "react-router-dom";

export default function Header({ user, onLogin, onLogout }) {
  const nav = useNavigate();
  const NHOM = [
    ["tham_quan", "Tham quan"],
    ["an_uong", "Ăn uống"],
    ["luu_tru", "Nơi ở"],
  ];

  return (
    <header className="sticky top-0 z-40 bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur border-b border-zinc-200 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center gap-6">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-accent-700 shrink-0">
          <i className="fa-solid fa-mountain-sun" /> Đi Đâu
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-zinc-600">
          <Link to="/tour" className="hover:text-accent-700 font-semibold text-accent-700">
            <i className="fa-solid fa-route" /> Tour trọn gói
          </Link>
          <Link to="/" className="hover:text-accent-700">Điểm đến</Link>
          {NHOM.map(([k, t]) => (
            <Link key={k} to={`/dia-diem?nhom=${k}`} className="hover:text-accent-700">{t}</Link>
          ))}
          <a href="/map.html" className="hover:text-accent-700">Bản đồ</a>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link to="/yeu-thich" className="px-3 py-2 text-sm text-zinc-600 hover:text-accent-700 dark:hover:text-accent-500">
            <i className="fa-regular fa-heart" /> <span className="hidden sm:inline">Yêu thích</span>
          </Link>

          {user ? (
            <div className="flex items-center gap-2">
              {user.role === "admin" && (
                <a href="/admin.html" title="Quản trị" className="text-sm text-zinc-600 hover:text-accent-700">
                  <i className="fa-solid fa-screwdriver-wrench" />
                </a>
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
