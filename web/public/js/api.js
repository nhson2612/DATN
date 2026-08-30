// Cấu hình API. Không hardcode host.
//
// Thứ tự ưu tiên:
//   1. window.APP_CONFIG.API_BASE  (đặt trong js/config.js, không track)
//   2. suy từ window.location — dev mở frontend ở cổng khác thì trỏ về cổng 8000
//   3. cùng origin (khi frontend được serve chung với backend)
const API_BASE = (() => {
    const configured = window.APP_CONFIG && window.APP_CONFIG.API_BASE;
    if (configured) return configured;

    const { protocol, hostname, port } = window.location;
    // Cổng dev thường dùng cho frontend tĩnh; backend mặc định ở 8000.
    const FRONTEND_DEV_PORTS = ["5500", "5501", "3000", "8080", ""];
    if (FRONTEND_DEV_PORTS.includes(port)) {
        return `${protocol}//${hostname}:8000/api`;
    }
    return `${protocol}//${hostname}${port ? ":" + port : ""}/api`;
})();

// Gửi request kèm Authorization nếu đã đăng nhập.
async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem("token");
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    return response;
}
