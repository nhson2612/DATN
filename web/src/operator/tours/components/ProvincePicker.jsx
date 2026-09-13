import { useEffect, useId, useMemo, useRef, useState } from "react";

/** Hàm chuẩn hóa tiếng Việt để tìm kiếm không dấu / có dấu */
function normalizeText(text) {
  return (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .trim();
}

/** Danh sách địa danh du lịch nổi tiếng map sang tỉnh thành tương ứng */
const TOURISM_ALIASES = {
  "Kiên Giang": ["phú quốc", "phu quoc", "rạch giá", "hà tiên", "nam du"],
  "Khánh Hòa": ["nha trang", "cam ranh", "bình ba", "điệp sơn", "vân phong"],
  "Lâm Đồng": ["đà lạt", "da lat", "bảo lộc", "langbiang", "tuyền lâm"],
  "Quảng Ninh": ["hạ long", "ha long", "vân đồn", "móng cái", "yên tử", "cô tô"],
  "Quảng Nam": ["hội an", "hoi an", "mỹ sơn", "cù lao chàm"],
  "Bà Rịa - Vũng Tàu": ["vũng tàu", "vung tau", "côn đảo", "con dao", "long hải", "hồ tràm"],
  "Bình Thuận": ["phan thiết", "mũi né", "mui ne", "phú quý", "kê gà"],
  "Bình Định": ["quy nhơn", "quy nhon", "kỳ co", "eo gió"],
  "Quảng Bình": ["phong nha", "kẻ bàng", "động thiên đường", "hang sơn đoòng", "đồng hới"],
  "Ninh Bình": ["tràng an", "tam cốc", "bái đính", "hoa lư", "hang múa"],
  "Huế": ["huế", "lăng cô", "đại nội", "hương giang"],
  "Lào Cai": ["sa pa", "sapa", "fansipan", "bắc hà", "y tý"],
  "Hà Giang": ["đồng văn", "mã pí lèng", "mèo vạc", "lũng cú", "hoàng su phì"],
  "Đà Nẵng": ["bà nà", "ngũ hành sơn", "sơn trà", "cầu vàng", "mỹ khê"],
  "Hà Nội": ["hoàn kiếm", "phố cổ", "hồ tây", "ba đình", "nội bài"],
  "Hồ Chí Minh": ["sài gòn", "saigon", "bến thành", "quận 1", "tân sơn nhất"],
  "Cần Thơ": ["chợ nổi cái răng", "bến ninh kiều", "cái răng"],
};

/** Phân chia 63 tỉnh thành theo 3 miền địa lý */
const REGIONS = [
  {
    id: "all",
    label: "Tất cả",
  },
  {
    id: "bac",
    label: "Miền Bắc",
    keywords: [
      "Hà Nội", "Hải Phòng", "Bắc Ninh", "Hà Nam", "Hải Dương", "Hưng Yên",
      "Nam Định", "Ninh Bình", "Thái Bình", "Vĩnh Phúc", "Bắc Giang", "Bắc Kạn",
      "Cao Bằng", "Hà Giang", "Lạng Sơn", "Phú Thọ", "Quảng Ninh", "Thái Nguyên",
      "Tuyên Quang", "Điện Biên", "Hòa Bình", "Lai Châu", "Lào Cai", "Sơn La", "Yên Bái"
    ]
  },
  {
    id: "trung",
    label: "Miền Trung & Tây Nguyên",
    keywords: [
      "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Huế",
      "Đà Nẵng", "Quảng Nam", "Quảng Ngãi", "Bình Định", "Phú Yên", "Khánh Hòa",
      "Ninh Thuận", "Bình Thuận", "Kon Tum", "Gia Lai", "Đắk Lắk", "Đắk Nông", "Lâm Đồng"
    ]
  },
  {
    id: "nam",
    label: "Miền Nam",
    keywords: [
      "Hồ Chí Minh", "Bà Rịa - Vũng Tàu", "Bình Dương", "Bình Phước", "Đồng Nai",
      "Tây Ninh", "Cần Thơ", "An Giang", "Bạc Liêu", "Bến Tre", "Cà Mau",
      "Đồng Tháp", "Hậu Giang", "Kiên Giang", "Long An", "Sóc Trăng", "Tiền Giang",
      "Trà Vinh", "Vĩnh Long"
    ]
  }
];

/** Điểm đến du lịch hàng đầu để chọn nhanh */
const TOP_DESTINATIONS = [
  "Đà Nẵng",
  "Hà Nội",
  "Hồ Chí Minh",
  "Kiên Giang",
  "Khánh Hòa",
  "Lâm Đồng",
  "Quảng Ninh",
  "Quảng Nam",
];

export default function ProvincePicker({
  provinces = [],
  value,
  onChange,
  error,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeRegion, setActiveRegion] = useState("all");
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listboxId = useId();

  // Tỉnh/thành đang được chọn
  const selectedProvince = useMemo(() => {
    return provinces.find((p) => String(p.id) === String(value));
  }, [provinces, value]);

  // Lọc theo từ khóa tìm kiếm và vùng miền
  const filteredProvinces = useMemo(() => {
    let list = provinces;

    // Lọc theo vùng miền nếu không chọn "all" và không đang gõ search
    if (activeRegion !== "all" && !search.trim()) {
      const regionCfg = REGIONS.find((r) => r.id === activeRegion);
      if (regionCfg?.keywords) {
        list = list.filter((p) =>
          regionCfg.keywords.some((kw) => p.name.includes(kw))
        );
      }
    }

    // Lọc theo từ khóa tìm kiếm (hỗ trợ có dấu, không dấu, và alias du lịch)
    if (search.trim()) {
      const q = normalizeText(search.trim());
      list = list.filter((p) => {
        const nameNorm = normalizeText(p.name);
        const cleanName = p.name.replace(/^(Thành phố|Tỉnh)\s+/, "");
        const cleanNorm = normalizeText(cleanName);

        if (nameNorm.includes(q) || cleanNorm.includes(q)) return true;

        // Kiểm tra alias địa danh du lịch
        const aliases = TOURISM_ALIASES[cleanName] || [];
        return aliases.some((alias) => normalizeText(alias).includes(q));
      });
    }

    return list;
  }, [provinces, search, activeRegion]);

  // Click outside & Esc để đóng dropdown
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Auto focus ô tìm kiếm khi mở popover
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSelect = (provinceId) => {
    onChange(String(provinceId));
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange("");
  };

  // Các nút chọn nhanh
  const quickPicks = useMemo(() => {
    return TOP_DESTINATIONS.map((name) =>
      provinces.find((p) => p.name.includes(name))
    ).filter(Boolean);
  }, [provinces]);

  const cleanSelectedName = selectedProvince?.name
    ? selectedProvince.name.replace(/^(Thành phố|Tỉnh)\s+/, "")
    : "";

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* Combobox Trigger Box */}
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen(!open)}
          className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 min-h-[48px] bg-white border rounded-md text-left transition-all cursor-pointer shadow-2xs ${
            error
              ? "border-rose-500 focus:ring-1 focus:ring-rose-500"
              : open
              ? "border-zinc-900 ring-2 ring-zinc-900/10"
              : "border-zinc-300 hover:border-zinc-400"
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span
              className={`material-symbols-outlined text-[20px] shrink-0 ${
                selectedProvince ? "text-zinc-900" : "text-zinc-400"
              }`}
            >
              pin_drop
            </span>
            {selectedProvince ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-900 text-white truncate">
                  {cleanSelectedName}
                </span>
                <span className="text-xs text-zinc-500 truncate hidden sm:inline">
                  ({selectedProvince.name})
                </span>
              </div>
            ) : (
              <span className="text-sm text-zinc-400 truncate">
                Tìm hoặc chọn tỉnh/thành phố điểm đến...
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {selectedProvince && (
              <button
                type="button"
                onClick={handleClear}
                title="Xóa lựa chọn"
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[16px] block">
                  close
                </span>
              </button>
            )}
            <span className="material-symbols-outlined text-[20px] text-zinc-400">
              unfold_more
            </span>
          </div>
        </button>

        {/* Popover Dropdown Panel */}
        {open && (
          <div
            id={listboxId}
            role="listbox"
            tabIndex={-1}
            className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-zinc-200 rounded-lg shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150"
          >
            {/* Input Search Box */}
            <div className="relative mb-2">
              <span className="material-symbols-outlined text-[18px] text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                search
              </span>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Gõ tên tỉnh thành hoặc địa danh (VD: Phú Quốc, Sa Pa, Đà Nẵng...)"
                className="w-full bg-zinc-50 border border-zinc-200 rounded-md pl-9 pr-8 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm block">close</span>
                </button>
              )}
            </div>

            {/* Region Tabs (Ẩn khi đang gõ search) */}
            {!search.trim() && (
              <div className="flex items-center gap-1 pb-2 border-b border-zinc-100 overflow-x-auto">
                {REGIONS.map((region) => {
                  const isActive = activeRegion === region.id;
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => setActiveRegion(region.id)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors shrink-0 cursor-pointer ${
                        isActive
                          ? "bg-zinc-900 text-white font-semibold"
                          : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                      }`}
                    >
                      {region.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Provinces Results Grid */}
            <div className="max-h-[260px] overflow-y-auto pt-1.5 space-y-0.5">
              {filteredProvinces.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  <span className="material-symbols-outlined text-2xl mb-1 text-zinc-300 block">
                    search_off
                  </span>
                  Không tìm thấy tỉnh thành hoặc địa danh phù hợp
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {filteredProvinces.map((province) => {
                    const isSelected = String(province.id) === String(value);
                    const cleanName = province.name.replace(
                      /^(Thành phố|Tỉnh)\s+/,
                      ""
                    );
                    const prefix = province.name.startsWith("Thành phố")
                      ? "TP"
                      : "Tỉnh";

                    return (
                      <button
                        key={province.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => handleSelect(province.id)}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-xs text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-zinc-900 text-white font-semibold"
                            : "hover:bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        <div className="min-w-0 flex items-baseline gap-1.5 truncate">
                          <span className="font-medium truncate">{cleanName}</span>
                          <span
                            className={`text-[10px] shrink-0 ${
                              isSelected ? "text-zinc-300" : "text-zinc-600"
                            }`}
                          >
                            {prefix}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm shrink-0 text-white">
                            check
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer đếm số lượng */}
            <div className="pt-2 mt-1 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-600 px-1">
              <span>{filteredProvinces.length} / {provinces.length} tỉnh thành</span>
              <span className="italic text-[10px]">Hỗ trợ tìm theo tên thành phố, đảo, thắng cảnh</span>
            </div>
          </div>
        )}
      </div>

      {/* Thanh chọn nhanh (Quick-Pick Chips) */}
      {quickPicks.length > 0 && (
        <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
          <span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider mr-1">
            Gợi ý nhanh:
          </span>
          {quickPicks.map((province) => {
            const isSelected = String(value) === String(province.id);
            const clean = province.name.replace(/^(Thành phố|Tỉnh)\s+/, "");
            return (
              <button
                type="button"
                key={province.id}
                onClick={() => onChange(String(province.id))}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer border ${
                  isSelected
                    ? "bg-zinc-900 border-zinc-900 text-white font-semibold shadow-2xs"
                    : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:border-zinc-300"
                }`}
              >
                <span>+</span>
                <span>{clean}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
