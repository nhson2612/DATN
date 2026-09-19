/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "media",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Playfair Display"', "Georgia", "serif"],
        // Chỉ dùng cho đúng một dòng nhấn ở hero. Không dùng ở chỗ nào khác.
        script: ['"Dancing Script"', "cursive"],
      },

      colors: {
        // MỘT accent duy nhất cho web khách. Trước đây có 13 cặp gradient khác nhau
        // (sky, blue, violet, rose, amber, emerald...) — mỗi khối một màu, thương
        // hiệu tan biến. Chọn xanh rừng: gợi thiên nhiên Việt Nam và tránh hẳn
        // dải xanh-tím vốn là dấu hiệu giao diện do máy sinh.
        accent: {
          50: "#ecfdf5", 100: "#d1fae5", 200: "#a7f3d0",
          500: "#10b981", 600: "#059669", 700: "#047857", 900: "#064e3b",
        },

        // Bộ token của bản thiết kế khu nhà điều hành (Material 3, tông cam đất).
        // Chỉ dùng trong khu nhà điều hành.
        primary: {
          DEFAULT: "#9d4300", container: "#f97316",
          fixed: "#ffdbca", "fixed-dim": "#ffb690",
        },
        tertiary: { DEFAULT: "#b02f00", container: "#ff6c40", fixed: "#ffdbd1" },
        secondary: { DEFAULT: "#565e74", container: "#dae2fd", fixed: "#dae2fd" },
        background: "#f8f9ff",
        surface: {
          DEFAULT: "#f8f9ff",
          dim: "#cbdbf5",
          bright: "#f8f9ff",
          variant: "#d3e4fe",
          "container-lowest": "#ffffff",
          "container-low": "#eff4ff",
          container: "#e5eeff",
          "container-high": "#dce9ff",
          "container-highest": "#d3e4fe",
        },
        "on-surface": "#0b1c30",
        "on-surface-variant": "#584237",
        "on-primary": "#ffffff",
        "on-primary-container": "#582200",
        "on-secondary": "#ffffff",
        "on-secondary-fixed": "#131b2e",
        outline: { DEFAULT: "#8c7164", variant: "#e0c0b1" },
        error: { DEFAULT: "#ba1a1a", container: "#ffdad6" },
      },

      // SHAPE LOCK: đúng ba bậc, dùng nhất quán toàn trang.
      //   card  = 12px   nút = pill   ô nhập = 8px
      borderRadius: { card: "12px", field: "8px" },

      spacing: {
        "space-2xs": "0.25rem",
        "space-xs": "0.5rem",
        "space-sm": "0.75rem",
        "space-md": "1rem",
        "space-lg": "1.5rem",
        "space-xl": "2rem",
        "space-2xl": "3rem",
        "space-3xl": "4rem",
        "container-max": "1280px",
      },

      fontFamily: {
        sans: ['"Playfair Display"', "Georgia", "serif"],
        serif: ['"Playfair Display"', "Georgia", "serif"],
        script: ['"Dancing Script"', "cursive"],
        "headline-sm": ['"Playfair Display"', "Georgia", "serif"],
        "headline-md": ['"Playfair Display"', "Georgia", "serif"],
        "title-md": ['"Playfair Display"', "Georgia", "serif"],
        "body-md": ['"Playfair Display"', "Georgia", "serif"],
        "body-sm": ['"Playfair Display"', "Georgia", "serif"],
        "label-md": ['"Playfair Display"', "Georgia", "serif"],
        "label-lg": ['"Playfair Display"', "Georgia", "serif"],
        "label-caps": ['"Playfair Display"', "Georgia", "serif"],
      },

      fontSize: {
        "headline-sm": ["20px", { lineHeight: "28px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.015em", fontWeight: "700" }],
        "title-md": ["16px", { lineHeight: "24px", letterSpacing: "-0.005em", fontWeight: "600" }],
        "body-md": ["15px", { lineHeight: "24px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.02em", fontWeight: "600" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "600" }],
        "label-caps": ["11px", { lineHeight: "16px", letterSpacing: "0.06em", fontWeight: "700" }],
      },
    },
  },
  plugins: [],
}
