// Sao chép sang js/config.js để ghi đè cấu hình khi cần.
// js/config.js nằm trong .gitignore — không commit.
//
// Bỏ trống thì API_BASE tự suy từ window.location (xem js/api.js):
//   mở qua http://localhost:5500  -> http://localhost:8000/api
//   deploy cùng domain            -> <origin>/api
window.APP_CONFIG = {
    // API_BASE: "http://localhost:8000/api",
};
