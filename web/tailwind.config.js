/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "media",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Be Vietnam Pro"', "system-ui", "sans-serif"],
        // Chỉ dùng cho đúng một dòng nhấn ở hero. Không dùng ở chỗ nào khác.
        script: ['"Dancing Script"', "cursive"],
      },

      // MỘT accent duy nhất cho cả trang. Trước đây có 13 cặp gradient khác nhau
      // (sky, blue, violet, rose, amber, emerald...) — mỗi khối một màu, thương
      // hiệu tan biến. Chọn xanh rừng: gợi thiên nhiên Việt Nam và tránh hẳn
      // dải xanh-tím vốn là dấu hiệu giao diện do máy sinh.
      colors: {
        accent: {
          50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0",
          500: "#10b981", 600: "#059669", 700: "#047857", 900: "#064e3b",
        },
      },

      // SHAPE LOCK: đúng ba bậc, dùng nhất quán toàn trang.
      //   card  = 12px   nút = pill   ô nhập = 8px
      borderRadius: { card: "12px", field: "8px" },
    },
  },
  plugins: [],
}
