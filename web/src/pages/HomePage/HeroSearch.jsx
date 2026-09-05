import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Home.css";

const POPULAR_DESTINATIONS = [
  "Hà Nội",
  "Đà Nẵng",
  "Phú Quốc",
  "Đà Lạt",
  "Hội An",
  "Nha Trang",
  "Hạ Long",
  "Sapa"
];

export default function HeroSearch({ activeTab, setActiveTab }) {
  const nav = useNavigate();
  const [diemDen, setDiemDen] = useState("");
  const [thoiGian, setThoiGian] = useState("");
  const [soNguoi, setSoNguoi] = useState("");
  const [diemBatDau, setDiemBatDau] = useState("");
  const [ngayDi, setNgayDi] = useState("");

  // Typewriter Animated Placeholder state
  const [placeholderText, setPlaceholderText] = useState("");
  const [destIndex, setDestIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentFullText = POPULAR_DESTINATIONS[destIndex];
    let timer;

    if (!isDeleting && charIndex < currentFullText.length) {
      timer = setTimeout(() => {
        setPlaceholderText(currentFullText.substring(0, charIndex + 1));
        setCharIndex((prev) => prev + 1);
      }, 120);
    } else if (!isDeleting && charIndex === currentFullText.length) {
      timer = setTimeout(() => {
        setIsDeleting(true);
      }, 1800);
    } else if (isDeleting && charIndex > 0) {
      timer = setTimeout(() => {
        setPlaceholderText(currentFullText.substring(0, charIndex - 1));
        setCharIndex((prev) => prev - 1);
      }, 60);
    } else if (isDeleting && charIndex === 0) {
      setIsDeleting(false);
      setDestIndex((prev) => (prev + 1) % POPULAR_DESTINATIONS.length);
    }

    return () => clearTimeout(timer);
  }, [charIndex, isDeleting, destIndex]);

  function handleTimTour(e) {
    e.preventDefault();
    const qs = new URLSearchParams();
    if (diemDen) qs.set("destination", diemDen);
    nav(`/tour?${qs.toString()}`);
  }

  function handleThietKe(e) {
    e.preventDefault();
    nav("/chuyen-di");
  }

  return (
    <section className="relative overflow-hidden bg-[#faf8ff] py-16 md:py-24 px-4 md:px-12 min-h-[560px] flex items-center justify-center">
      {/* Local TomTom Background Globe SVG Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
        <img
          src="/hero_background_globe.svg"
          alt="TomTom Hero Globe Background"
          className="w-full h-full object-cover object-center"
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        {/* LEFT COLUMN: Clean Hero Headline (TomTom Style) */}
        <div className="lg:col-span-5 space-y-6 text-left">
          <h1 className="text-4xl md:text-6xl font-extrabold font-serif leading-tight text-[#003527] tracking-tight">
            Đi xa hơn,<br />
            để hiểu hơn.
          </h1>

          <p className="text-lg md:text-xl text-slate-600 font-medium max-w-xl leading-relaxed">
            Khám phá những hành trình tuyệt vời theo cách riêng của bạn.
          </p>
        </div>

        {/* RIGHT COLUMN: Right Visual Map Container with Floating UI Card */}
        <div className="lg:col-span-7 relative min-h-[460px] md:min-h-[500px] rounded-3xl border border-slate-200/90 overflow-hidden flex items-end sm:items-center justify-start p-4 sm:p-8 shadow-sm">
          {/* Inner Map Graphic Background */}
          <div className="absolute inset-0 z-0">
            <img
              src="/assets/images/hero-search-bg.jpg"
              alt="Background Map Graphic"
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-slate-950/20" />
          </div>

          {/* FLOATING CARD OVERLAY (Semi-transparent Glassmorphism) */}
          <div className="relative z-10 bg-white/75 backdrop-blur-xl rounded-2xl p-5 sm:p-6 border border-white/80 w-full max-w-md shadow-lg">
            {/* Pill Switch Controller */}
            <div className="bg-slate-100/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-200/70 flex items-center gap-1 mb-4">
              <button
                type="button"
                onClick={() => setActiveTab("tour")}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 text-center cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === "tour"
                  ? "bg-white text-[#003527] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <i className="fa-solid fa-compass text-emerald-600" />
                <span>Khám phá Tour</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("plan")}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs sm:text-sm font-bold transition-all duration-200 text-center cursor-pointer flex items-center justify-center gap-1.5 ${activeTab === "plan"
                  ? "bg-white text-[#003527] shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
                  }`}
              >
                <i className="fa-solid fa-route text-emerald-600" />
                <span>Thiết kế chuyến đi</span>
              </button>
            </div>

            {/* Form 1: Khám phá Tour */}
            {activeTab === "tour" && (
              <form onSubmit={handleTimTour} className="space-y-3">
                <div className="relative">
                  <i className="fa-solid fa-location-dot absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 text-xs" />
                  <input
                    type="text"
                    placeholder={placeholderText || "Hà Nội"}
                    value={diemDen}
                    onChange={(e) => setDiemDen(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200/90 rounded-xl outline-none text-xs sm:text-sm text-slate-800 focus:border-[#003527] font-medium bg-white/90 backdrop-blur-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <i className="fa-regular fa-calendar-days absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-[11px]" />
                    <input
                      type="text"
                      placeholder="Thời gian (3 ngày)"
                      value={thoiGian}
                      onChange={(e) => setThoiGian(e.target.value)}
                      className="w-full pl-8 pr-2 py-2 border border-slate-200/90 rounded-xl outline-none text-xs text-slate-800 focus:border-[#003527] font-medium bg-white/90 backdrop-blur-sm"
                    />
                  </div>
                  <div className="relative">
                    <i className="fa-solid fa-user-group absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 text-[11px]" />
                    <input
                      type="text"
                      placeholder="Số người"
                      value={soNguoi}
                      onChange={(e) => setSoNguoi(e.target.value)}
                      className="w-full pl-8 pr-2 py-2 border border-slate-200/90 rounded-xl outline-none text-xs text-slate-800 focus:border-[#003527] font-medium bg-white/90 backdrop-blur-sm"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#003527] hover:bg-[#064e3b] text-white font-bold text-xs sm:text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
                >
                  <i className="fa-solid fa-magnifying-glass text-xs" />
                  <span>Tìm kiếm ngay</span>
                </button>
              </form>
            )}

            {/* Form 2: Thiết kế chuyến đi */}
            {activeTab === "plan" && (
              <form onSubmit={handleThietKe} className="space-y-3">
                <div className="relative">
                  <i className="fa-solid fa-circle-dot absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 text-xs" />
                  <input
                    type="text"
                    placeholder={placeholderText || "Hà Nội"}
                    value={diemBatDau}
                    onChange={(e) => setDiemBatDau(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 border border-slate-200/90 rounded-xl outline-none text-xs sm:text-sm text-slate-800 focus:border-[#003527] font-medium bg-white/90 backdrop-blur-sm"
                  />
                </div>

                <div className="relative">
                  <i className="fa-regular fa-calendar absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-600 text-xs" />
                  <input
                    type="date"
                    value={ngayDi}
                    onChange={(e) => setNgayDi(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200/90 rounded-xl outline-none text-xs text-slate-800 focus:border-[#003527] font-medium bg-white/90 backdrop-blur-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#003527] hover:bg-[#064e3b] text-white font-bold text-xs sm:text-sm py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
                >
                  <i className="fa-solid fa-wand-magic-sparkles text-xs" />
                  <span>Tạo lịch trình ngay</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
