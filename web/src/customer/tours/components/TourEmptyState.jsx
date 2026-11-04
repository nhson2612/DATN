// Linh vật 2D Flat Vector SVG "Aura the Explorer" (Chuẩn style Duolingo/Headspace)
export function AuraMascotSvg({ width = 180, height = 180, className = "" }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Linh vật Aura the Explorer"
    >
      <defs>
        {/* Bóng mềm dưới chân */}
        <radialGradient id="auraShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>
        {/* Vầng sáng phía sau */}
        <radialGradient id="auraGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#f8fafc" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Vầng sáng nền phía sau linh vật */}
      <circle cx="100" cy="100" r="72" fill="url(#auraGlow)" />

      {/* Bóng đổ chân linh vật */}
      <ellipse cx="100" cy="180" rx="46" ry="7" fill="url(#auraShadow)" />

      {/* CHIẾC VALI DU LỊCH BÊN CẠNH */}
      <g className="mascot-suitcase">
        {/* Thân vali */}
        <rect x="26" y="136" width="34" height="40" rx="7" fill="#f59e0b" stroke="#0f172a" strokeWidth="3" />
        {/* Tay kéo vali */}
        <path d="M38 136 V124 C38 122 48 122 48 124 V136" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
        {/* 2 đường kẻ trang trí vali */}
        <line x1="37" y1="136" x2="37" y2="176" stroke="#d97706" strokeWidth="2.5" />
        <line x1="49" y1="136" x2="49" y2="176" stroke="#d97706" strokeWidth="2.5" />
        {/* Tem dán tròn du lịch */}
        <circle cx="43" cy="154" r="5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.5" />
        {/* Bánh xe nhỏ */}
        <circle cx="32" cy="177" r="3" fill="#0f172a" />
        <circle cx="54" cy="177" r="3" fill="#0f172a" />
      </g>

      {/* LINH VẬT CHÍNH: CHÚ RÁI CÁ KHÁM PHÁ AURA */}
      <g className="mascot-body-group">
        {/* Đuôi cong phía sau */}
        <path
          d="M142 152 C158 155 170 146 172 136 C173 130 168 127 163 131 C156 137 148 143 140 144"
          fill="#3b82f6"
          stroke="#0f172a"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* 2 Chân ngắn mũm mĩm */}
        <ellipse cx="85" cy="177" rx="9" ry="5.5" fill="#1e3a8a" stroke="#0f172a" strokeWidth="3" />
        <ellipse cx="118" cy="177" rx="9" ry="5.5" fill="#1e3a8a" stroke="#0f172a" strokeWidth="3" />

        {/* Balo nhỏ đeo sau lưng */}
        <rect x="130" y="98" width="16" height="28" rx="6" fill="#f97316" stroke="#0f172a" strokeWidth="3" />
        {/* Mền cuộn trên balo */}
        <rect x="128" y="90" width="20" height="9" rx="4.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="2.5" />

        {/* Thân tròn mũm mĩm */}
        <path
          d="M72 118 C70 94 82 78 102 78 C122 78 134 94 132 118 C130 148 126 174 102 174 C78 174 74 148 72 118 Z"
          fill="#0284c7"
          stroke="#0f172a"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />

        {/* Bụng yếm trắng kem */}
        <path
          d="M84 122 C84 104 92 94 102 94 C112 94 120 104 120 122 C120 144 116 166 102 166 C88 166 84 144 84 122 Z"
          fill="#f0f9ff"
        />

        {/* 2 Tai tròn xoe */}
        <circle cx="75" cy="74" r="9" fill="#0284c7" stroke="#0f172a" strokeWidth="3" />
        <circle cx="75" cy="74" r="4.5" fill="#bae6fd" />
        <circle cx="129" cy="74" r="9" fill="#0284c7" stroke="#0f172a" strokeWidth="3" />
        <circle cx="129" cy="74" r="4.5" fill="#bae6fd" />

        {/* MŨ TAI BÈO PHIÊU LƯU (BUCKET HAT) */}
        <g className="mascot-hat">
          {/* Vành mũ cong bo tròn */}
          <ellipse cx="102" cy="72" rx="38" ry="11" fill="#38bdf8" stroke="#0f172a" strokeWidth="3.5" />
          {/* Chóp mũ */}
          <path
            d="M80 70 C81 50 88 44 102 44 C116 44 123 50 124 70 Z"
            fill="#0ea5e9"
            stroke="#0f172a"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Dải nơ mũ màu vàng cam */}
          <path d="M82 66 Q102 70 122 66" stroke="#f59e0b" strokeWidth="4.5" strokeLinecap="round" />
        </g>

        {/* KHUÔN MẶT BIỂU CẢM */}
        {/* Hai mắt to tròn long lanh */}
        <circle cx="91" cy="98" r="4.5" fill="#0f172a" />
        <circle cx="92.5" cy="96.5" r="1.5" fill="#ffffff" />
        <circle cx="113" cy="98" r="4.5" fill="#0f172a" />
        <circle cx="114.5" cy="96.5" r="1.5" fill="#ffffff" />

        {/* Má hồng pastel dễ thương */}
        <ellipse cx="83" cy="105" rx="5" ry="3" fill="#f472b6" opacity="0.6" />
        <ellipse cx="121" cy="105" rx="5" ry="3" fill="#f472b6" opacity="0.6" />

        {/* Mõm trắng và mũi */}
        <ellipse cx="102" cy="105" rx="9" ry="6.5" fill="#ffffff" />
        <ellipse cx="102" cy="102" rx="3.5" ry="2.5" fill="#0f172a" />
        {/* Miệng cười tò mò hơi nghiêng */}
        <path d="M99 106 Q102 109 105 106" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" fill="none" />

        {/* Tay trái ôm bản đồ du lịch */}
        <g className="mascot-arm-left">
          <ellipse cx="73" cy="128" rx="7" ry="12" transform="rotate(20 73 128)" fill="#0284c7" stroke="#0f172a" strokeWidth="3" />
        </g>

        {/* TAY PHẢI CẦM KÍNH LÚP NGÓ TÌM KIẾM */}
        <g className="mascot-magnifier-arm">
          {/* Tay phải chìa ra */}
          <ellipse cx="130" cy="124" rx="11" ry="6.5" transform="rotate(-15 130 124)" fill="#0284c7" stroke="#0f172a" strokeWidth="3" />
          {/* Cán kính lúp */}
          <line x1="138" y1="126" x2="152" y2="136" stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" />
          {/* Vành kính lúp to */}
          <circle cx="156" cy="116" r="17" fill="#e0f2fe" stroke="#0f172a" strokeWidth="3.5" />
          {/* Ánh sáng tròng kính */}
          <path d="M148 110 Q156 104 163 110" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          {/* Chấm hỏi nhỏ trong tròng kính lúp thể hiện đang tìm kiếm */}
          <path
            d="M154 112 C154 110 156 109 157.5 110 C159 111 158 113 156.5 114.5 V116"
            stroke="#0284c7"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="156.5" cy="119.5" r="1.3" fill="#0284c7" />
        </g>
      </g>
    </svg>
  );
}

// GỢI Ý CÁC ĐIỂM ĐẾN PHỔ BIẾN
const POPULAR_SUGGESTIONS = [
  { name: "Hạ Long", kw: "hạ long" },
  { name: "Đà Nẵng", kw: "đà nẵng" },
  { name: "Phú Quốc", kw: "phú quốc" },
  { name: "Sa Pa", kw: "sa pa" },
  { name: "Nha Trang", kw: "nha trang" },
  { name: "Đà Lạt", kw: "đà lạt" },
];

export default function TourEmptyState({
  onReset,
  onSelectSuggestion,
  hasActiveFilters = true,
}) {
  return (
    <div className="tour-empty-state-card" role="region" aria-label="Không có kết quả">
      <div className="empty-mascot-container">
        <img
          src="/images/aura-mascot.png"
          alt="Linh vật du lịch Aura Voyage"
          className="empty-mascot-img"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const fallback = document.getElementById("auraMascotSvgFallback");
            if (fallback) fallback.style.display = "block";
          }}
        />
        <div id="auraMascotSvgFallback" style={{ display: "none" }}>
          <AuraMascotSvg width={180} height={180} className="empty-mascot-graphic" />
        </div>
      </div>

      <div className="empty-content-box">
        <span className="empty-kicker-tag">CHƯA TÌM THẤY CHUYẾN ĐI</span>
        <h3 className="empty-title">Không tìm thấy hành trình phù hợp</h3>
        <p className="empty-desc">
          Các điều kiện lọc hiện tại chưa khớp với tour nào đang mở bán.
          <br />
          Bạn có thể đặt lại bộ lọc hoặc chọn nhanh một điểm đến phổ biến bên dưới.
        </p>

        {/* Nút hành động chính */}
        <div className="empty-action-group">
          {hasActiveFilters && (
            <button
              type="button"
              className="empty-reset-btn"
              onClick={onReset}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
              <span>Xóa toàn bộ bộ lọc</span>
            </button>
          )}
        </div>

        {/* Các chip gợi ý điểm đến hot */}
        <div className="empty-suggestions-tray">
          <span className="empty-suggestions-label">Gợi ý tìm nhanh:</span>
          <div className="empty-chips-wrap">
            {POPULAR_SUGGESTIONS.map((item) => (
              <button
                key={item.name}
                type="button"
                className="empty-suggest-chip"
                onClick={() => onSelectSuggestion && onSelectSuggestion(item.name)}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
