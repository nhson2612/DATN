import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GOI_Y_LICH_TRINH, TOUR_NOI_BAT } from "./homeData";

export default function HomeSections({ activeTab }) {
  const nav = useNavigate();
  const [expandedTourId, setExpandedTourId] = useState(TOUR_NOI_BAT[0]?.id || 1);
  const [favorites, setFavorites] = useState({});

  const toggleFavorite = (e, id) => {
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <main className="wl-main-content max-w-7xl mx-auto px-4 md:px-8 py-12 space-y-16">
      {/* Tab 1 Active View: Tour Nổi Bật (Horizontal Accordion Redesigned Card) */}
      {activeTab === "tour" && (
        <section className="space-y-8 transition-all">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="wl-section-title">Tour nổi bật</h2>
              <p className="wl-section-subtitle">Những hành trình được yêu thích nhất</p>
            </div>
            <button onClick={() => nav("/tour")} className="wl-link-more">
              Xem tất cả tour <i className="fa-solid fa-arrow-right text-xs" />
            </button>
          </div>

          {/* Horizontal Accordion Container */}
          <div className="wl-accordion-container flex flex-col md:flex-row gap-5 h-auto md:h-[450px]">
            {TOUR_NOI_BAT.map((tour) => {
              const isExpanded = expandedTourId === tour.id;
              const isFav = !!favorites[tour.id];

              return (
                <div
                  key={tour.id}
                  onMouseEnter={() => setExpandedTourId(tour.id)}
                  onClick={() => nav("/tour")}
                  className={`wl-accordion-item group relative overflow-hidden rounded-3xl cursor-pointer transition-all duration-500 ease-out border border-slate-200/90 bg-white shadow-md ${isExpanded
                    ? "md:flex-[4.5] shadow-xl"
                    : "md:flex-1 opacity-95 hover:opacity-100"
                    }`}
                >
                  {/* EXPANDED CONTENT: Left White Info Panel + Right Image with Organic Curved Wave */}
                  {isExpanded ? (
                    <div className="flex flex-col md:flex-row h-full w-full">
                      {/* Left Side: Clean White Info Panel */}
                      <div className="w-full md:w-[50%] p-6 md:p-8 flex flex-col justify-between bg-white text-slate-900 z-10 shrink-0">
                        {/* Top: Discount Badge & Title */}
                        <div className="space-y-3">
                          <div>
                            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                              {tour.discountTag || "Giảm 20%"}
                            </span>
                          </div>

                          <h3 className="text-xl md:text-2xl font-bold text-slate-900 leading-snug tracking-tight font-sans">
                            {tour.title}
                          </h3>

                          <div className="space-y-1 text-xs md:text-sm text-slate-500 font-medium pt-1">
                            <p className="flex items-center gap-1.5">
                              <i className="fa-regular fa-clock text-slate-400" />
                              {tour.duration}
                            </p>
                            {tour.departures && (
                              <p className="flex items-center gap-1.5 text-slate-500">
                                <i className="fa-regular fa-calendar-check text-slate-400" />
                                Khởi hành: {tour.departures}
                              </p>
                            )}
                          </div>

                          {/* Rating & Reviews */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <i className="fa-solid fa-star text-amber-400 text-sm" />
                            <span className="text-xs md:text-sm font-bold text-slate-900">
                              {tour.rating}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              ({tour.reviewsCount || 210})
                            </span>
                          </div>
                        </div>

                        {/* Bottom: Price & CTA Button */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                          <div>
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl md:text-3xl font-extrabold text-[#003527] tracking-tight">
                                {tour.price}
                              </span>
                              {tour.originalPrice && (
                                <span className="text-xs md:text-sm text-slate-400 line-through font-medium">
                                  {tour.originalPrice}
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              nav("/tour");
                            }}
                            className="bg-[#003527] hover:bg-[#064e3b] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 shrink-0"
                          >
                            Đặt ngay <i className="fa-solid fa-arrow-right text-[10px]" />
                          </button>
                        </div>
                      </div>

                      {/* Right Side: Photo with Organic Curved Wave Divider & Favorite Heart */}
                      <div className="w-full md:w-[50%] relative h-full min-h-[220px] overflow-hidden bg-slate-100 shrink-0">
                        {/* Organic Curved Wave Divider SVG */}
                        <svg
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          className="absolute top-0 bottom-0 -left-1 h-full w-10 text-white fill-current z-10 hidden md:block"
                        >
                          <path d="M0,0 C35,30 35,70 0,100 L0,100 L0,0 Z" />
                        </svg>

                        {/* Photo */}
                        <img
                          src={tour.image}
                          alt={tour.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />

                        {/* Favorite Heart Button top right */}
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(e, tour.id)}
                          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-slate-900/30 hover:bg-slate-900/50 backdrop-blur-md border border-white/30 text-white flex items-center justify-center transition-all active:scale-90 shadow-sm"
                          title="Lưu vào yêu thích"
                        >
                          <i
                            className={`${isFav ? "fa-solid text-red-500" : "fa-regular text-white"
                              } fa-heart text-base`}
                          />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* COLLAPSED CONTENT: Compact Vertical Preview */
                    <div className="h-full flex flex-col justify-between p-4 bg-white relative">
                      {/* Photo Thumbnail */}
                      <div className="h-44 rounded-2xl overflow-hidden relative">
                        <img
                          src={tour.image}
                          alt={tour.title}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => toggleFavorite(e, tour.id)}
                          className="absolute top-2 right-2 z-20 w-8 h-8 rounded-full bg-slate-900/40 backdrop-blur-md border border-white/30 text-white flex items-center justify-center"
                        >
                          <i
                            className={`${isFav ? "fa-solid text-red-500" : "fa-regular text-white"
                              } fa-heart text-xs`}
                          />
                        </button>
                      </div>

                      {/* Collapsed Info */}
                      <div className="space-y-1.5 pt-2">
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {tour.discountTag || "Giảm 20%"}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                          {tour.title}
                        </h3>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <span className="font-bold text-[#003527]">{tour.price}</span>
                          <span className="text-[11px] font-bold text-amber-500 flex items-center gap-0.5">
                            <i className="fa-solid fa-star" /> {tour.rating}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tab 2 Active View: Tự Thiết Kế Hành Trình (Matching User Reference Image) */}
      {activeTab === "plan" && (
        <section className="bg-[#f8f7f2] rounded-3xl p-6 sm:p-10 md:p-12 border border-slate-200/60 shadow-sm transition-all">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-12">
            {/* Left Column: Features & Value Proposition */}
            <div className="w-full lg:w-5/12 space-y-6">
              <div className="space-y-3">
                <h2 className="text-3xl md:text-4xl font-bold text-slate-900 font-sans tracking-tight">
                  Tự thiết kế hành trình
                </h2>
                <p className="text-sm md:text-base text-slate-600 font-medium leading-relaxed">
                  Bạn quyết định mọi thứ.<br />
                  Wanderlust giúp bạn tổ chức dễ dàng.
                </p>
              </div>

              {/* Feature Checkmarks List */}
              <div className="space-y-3 pt-2">
                {[
                  "Chọn điểm đến theo ý thích",
                  "Thêm địa điểm & hoạt động",
                  "Tối ưu thời gian & chi phí",
                  "Lưu và chia sẻ hành trình",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                      ✓
                    </span>
                    <span className="text-sm font-semibold text-slate-800">
                      {item}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Link Button */}
              <div className="pt-2">
                <button
                  onClick={() => nav("/chuyen-di")}
                  className="inline-flex items-center gap-2.5 text-[#003527] font-extrabold text-sm md:text-base hover:text-emerald-700 hover:translate-x-1 transition-all cursor-pointer"
                >
                  Bắt đầu thiết kế <i className="fa-solid fa-arrow-right text-sm" />
                </button>
              </div>
            </div>

            {/* Right Column: Interactive Map & Timeline Mockup */}
            <div className="w-full lg:w-7/12 space-y-4">
              {/* Main Mockup Area: Map + Floating Timeline Card */}
              <div className="flex flex-col sm:flex-row gap-4 relative">
                {/* Map Preview Box */}
                <div className="flex-1 bg-emerald-50/70 rounded-3xl border border-slate-200/80 relative overflow-hidden min-h-[280px] sm:min-h-[320px] p-4 flex items-center justify-center">
                  {/* Map Grid Background Pattern */}
                  <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] opacity-60" />
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-100/40 via-blue-50/30 to-amber-50/20" />

                  {/* Curved Dashed Route Line SVG */}
                  <svg
                    viewBox="0 0 200 200"
                    className="absolute inset-0 w-full h-full text-[#003527] stroke-current z-10"
                    fill="none"
                  >
                    <path
                      d="M 30,50 Q 110,100 170,160"
                      strokeWidth="2.5"
                      strokeDasharray="6,6"
                      strokeLinecap="round"
                    />
                  </svg>

                  {/* Map Location Pins */}
                  <div className="absolute top-[22%] left-[15%] z-20 flex flex-col items-center">
                    <span className="w-7 h-7 rounded-full bg-[#003527] text-white flex items-center justify-center text-xs shadow-md">
                      <i className="fa-solid fa-location-dot" />
                    </span>
                  </div>

                  <div className="absolute top-[48%] left-[52%] z-20 flex flex-col items-center">
                    <span className="w-7 h-7 rounded-full bg-[#003527] text-white flex items-center justify-center text-xs shadow-md">
                      <i className="fa-solid fa-location-dot" />
                    </span>
                  </div>

                  <div className="absolute bottom-[18%] right-[14%] z-20 flex flex-col items-center">
                    <span className="w-7 h-7 rounded-full bg-[#003527] text-white flex items-center justify-center text-xs shadow-md">
                      <i className="fa-solid fa-location-dot" />
                    </span>
                  </div>
                </div>

                {/* Right Floating Timeline Card */}
                <div className="w-full sm:w-64 bg-white rounded-3xl border border-slate-200/80 p-5 shadow-lg space-y-4 flex flex-col justify-between z-20">
                  <div className="space-y-4">
                    {[
                      { day: "Ngày 1", loc: "Đà Nẵng" },
                      { day: "Ngày 2", loc: "Hội An" },
                      { day: "Ngày 3", loc: "Bà Nà Hills" },
                      { day: "Ngày 4", loc: "Sơn Trà – Biển Mỹ Khê" },
                    ].map((step, idx, arr) => (
                      <div key={idx} className="relative flex items-start gap-3">
                        {idx < arr.length - 1 && (
                          <span className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-slate-200" />
                        )}
                        <span className="w-6 h-6 rounded-full bg-emerald-50 text-[#003527] flex items-center justify-center text-xs shrink-0 z-10">
                          <i className="fa-solid fa-location-dot text-[10px]" />
                        </span>
                        <div>
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                            {step.day}
                          </span>
                          <span className="text-xs font-bold text-slate-800 line-clamp-1">
                            {step.loc}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => nav("/chuyen-di")}
                      className="text-xs font-bold text-[#003527] hover:text-emerald-700 flex items-center gap-1.5 cursor-pointer py-1"
                    >
                      <i className="fa-solid fa-plus text-[10px]" /> Thêm ngày
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Sub-cards: Duration & Budget */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shrink-0">
                    <i className="fa-regular fa-calendar-days" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block">Thời gian</span>
                    <span className="text-sm font-bold text-slate-800">4 ngày 3 đêm</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#003527] flex items-center justify-center text-lg shrink-0">
                    <i className="fa-solid fa-wallet" />
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-slate-400 block">Ngân sách dự kiến</span>
                    <span className="text-sm font-bold text-[#003527]">3.450.000đ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
