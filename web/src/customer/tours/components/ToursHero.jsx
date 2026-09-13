import { useEffect, useState } from "react";
import "./ToursHero.css";

/**
 * Khối Hero Section từ .design/Tours.html (dòng 50-81):
 * - Banner tiêu đề & lời giới thiệu
 * - Ô tìm kiếm điểm đến nhanh (liên kết với bộ lọc tỉnh/thành)
 * - Thanh cam kết dịch vụ / Trust Badges nổi bật
 */
export default function ToursHero({
  provinces = [],
  selectedProvinceId = "",
  onSelectProvince,
}) {
  const [keyword, setKeyword] = useState("");

  // Đồng bộ ô tìm kiếm nếu filter tỉnh thành thay đổi từ bên ngoài
  useEffect(() => {
    if (selectedProvinceId && provinces.length > 0) {
      const current = provinces.find(
        (p) => String(p.id) === String(selectedProvinceId)
      );
      if (current) {
        setKeyword(current.name.replace(/^(Thành phố|Tỉnh)\s+/, ""));
        return;
      }
    }
    if (!selectedProvinceId) {
      setKeyword("");
    }
  }, [selectedProvinceId, provinces]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const cleanKw = keyword.trim().toLowerCase();
    if (!cleanKw) {
      onSelectProvince("");
      return;
    }

    // Tìm kiếm tỉnh thành khớp với từ khoá người dùng nhập
    const matched = provinces.find((p) => {
      const pName = p.name.toLowerCase();
      const pSimple = pName.replace(/^(thành phố|tỉnh)\s+/, "");
      return pName.includes(cleanKw) || pSimple.includes(cleanKw) || cleanKw.includes(pSimple);
    });

    if (matched) {
      onSelectProvince(String(matched.id));
    } else {
      // Nếu không khớp chính xác tỉnh nào, vẫn giữ keyword hoặc xóa filter
      onSelectProvince("");
    }

    // Cuộn nhẹ xuống danh sách kết quả
    const catalogEl = document.getElementById("tours-catalog");
    if (catalogEl) {
      catalogEl.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <section className="tours-hero">
      {/* Background hình ảnh kèm mask gradient theo bản thiết kế */}
      <div className="tours-hero__bg-wrap">
        <div className="tours-hero__bg-img" />
        <div className="tours-hero__bg-overlay" />
      </div>

      <div className="max-w-[1536px] mx-auto px-4 sm:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pt-4 pb-6">
          {/* Nội dung tiêu đề Hero */}
          <div className="max-w-2xl text-center lg:text-left">
            <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-[#0f172a] tracking-tight leading-[1.22] mb-3">
              Khám Phá Tour
              <br />
              Việt Nam Trọn Gói
            </h1>
            <p className="text-slate-600 text-sm sm:text-[15px] leading-relaxed max-w-xl font-normal mx-auto lg:mx-0">
              Hơn 120+ tour tuyển chọn từ Bắc chí Nam, lịch trình tối ưu,
              <br className="hidden sm:block" />
              hướng dẫn viên chuyên nghiệp và cam kết trải nghiệm độc bản.
            </p>
          </div>

          {/* Thanh tìm kiếm Hero */}
          <div className="w-full lg:w-auto lg:min-w-[660px]">
            <form
              onSubmit={handleSearchSubmit}
              className="bg-white rounded-2xl flex items-center border border-gray-200 overflow-hidden shadow-sm hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center pl-5 pr-3 flex-1 py-1">
                <i className="fa-solid fa-location-dot text-orange-500 text-base mr-3" />
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Bạn muốn đi đâu? (Hạ Long, Đà Nẵng, Phú Quốc...)"
                  className="w-full border-0 focus:ring-0 text-slate-800 placeholder-slate-400 text-[14.5px] font-normal p-0 outline-none bg-transparent"
                />
                {keyword && (
                  <button
                    type="button"
                    onClick={() => {
                      setKeyword("");
                      onSelectProvince("");
                    }}
                    className="text-slate-400 hover:text-slate-600 mr-2 text-xs"
                    title="Xóa tìm kiếm"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="bg-[#ea580c] hover:bg-orange-700 text-white font-semibold text-[14px] px-8 py-4 rounded-none transition-colors cursor-pointer shrink-0"
              >
                Tìm tour
              </button>
            </form>
          </div>
        </div>

        {/* Thanh phù hiệu tin cậy / Trust Badges nổi bật */}
        <div className="mt-6 relative overflow-hidden rounded-2xl sm:rounded-full bg-white/40 backdrop-blur-md max-w-3xl ml-auto py-2.5 px-6 shadow-sm border border-white/60">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 relative z-10 md:divide-x divide-orange-100/60">
            {/* Mục 1: Đánh giá */}
            <div className="flex items-center space-x-2.5 px-2 py-0.5 group">
              <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-orange-500/50 flex items-center justify-center text-[#ea580c] flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105">
                <svg
                  className="w-4 h-4 text-[#ea580c] stroke-current fill-transparent stroke-[1.75]"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M12 8a2.5 2.5 0 0 0-2.5 2.5c0 1.6 1.8 3.1 2.5 3.6.7-.5 2.5-2 2.5-3.6A2.5 2.5 0 0 0 12 8z" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="font-bold text-slate-900 text-[12.5px] leading-tight whitespace-nowrap">
                  4.9/5.0
                </div>
                <span className="text-[10px] text-slate-500 font-normal whitespace-nowrap">
                  Đánh giá hài lòng
                </span>
              </div>
            </div>

            {/* Mục 2: Bảo hiểm */}
            <div className="flex items-center space-x-2.5 px-2 py-0.5 group">
              <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-orange-500/50 flex items-center justify-center text-[#ea580c] flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105">
                <svg
                  className="w-4 h-4 text-[#ea580c] stroke-current fill-transparent stroke-[1.75]"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="font-bold text-slate-900 text-[12px] leading-tight whitespace-nowrap">
                  Bảo hiểm trọn gói
                </div>
                <span className="text-[10px] text-slate-500 font-normal whitespace-nowrap">
                  100 triệu/khách
                </span>
              </div>
            </div>

            {/* Mục 3: Hỗ trợ 24/7 */}
            <div className="flex items-center space-x-2.5 px-2 py-0.5 group">
              <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-orange-500/50 flex items-center justify-center text-[#ea580c] flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105">
                <svg
                  className="w-4 h-4 text-[#ea580c] stroke-current fill-transparent stroke-[1.75]"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="font-bold text-slate-900 text-[12.5px] leading-tight whitespace-nowrap">
                  Hỗ trợ 24/7
                </div>
                <span className="text-[10px] text-slate-500 font-normal whitespace-nowrap">
                  Tư vấn tận tâm
                </span>
              </div>
            </div>

            {/* Mục 4: Thanh toán an toàn */}
            <div className="flex items-center space-x-2.5 px-2 py-0.5 group">
              <div className="w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm border border-orange-500/50 flex items-center justify-center text-[#ea580c] flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-105">
                <svg
                  className="w-4 h-4 text-[#ea580c] stroke-current fill-transparent stroke-[1.75]"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <rect height="16" rx="2" width="22" x="1" y="4" />
                  <line x1="1" x2="23" y1="10" y2="10" />
                  <line x1="5" x2="9" y1="15" y2="15" />
                </svg>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="font-bold text-slate-900 text-[12px] leading-tight whitespace-nowrap">
                  Thanh toán an toàn
                </div>
                <span className="text-[10px] text-slate-500 font-normal whitespace-nowrap">
                  Đa dạng &amp; linh hoạt
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
