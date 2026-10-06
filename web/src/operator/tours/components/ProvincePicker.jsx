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
    <div className="op-province-picker__div-1" ref={containerRef}>
      {/* Combobox Trigger Box */}
      <div className="op-province-picker__div-2">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => setOpen(!open)}
          className={`op-province-picker__element-6 op-province-picker__element-1  ${
            error
              ? "op-province-picker__element-3--variant-1"
              : open
              ? "op-province-picker__element-4--variant-2"
              : "op-province-picker__element-5--variant-3"
          }`}
        >
          <div className="op-province-picker__div-7">
            <span
              className={`material-symbols-outlined op-province-picker__span-10 op-province-picker__span-2  ${
                selectedProvince ? "op-province-picker__span-8--variant-1" : "op-province-picker__span-9--variant-2"
              }`}
            >
              pin_drop
            </span>
            {selectedProvince ? (
              <div className="op-province-picker__div-11">
                <span className="op-province-picker__span-12">
                  {cleanSelectedName}
                </span>
                <span className="op-province-picker__span-13">
                  ({selectedProvince.name})
                </span>
              </div>
            ) : (
              <span className="op-province-picker__span-14">
                Tìm hoặc chọn tỉnh/thành phố điểm đến...
              </span>
            )}
          </div>

          <div className="op-province-picker__div-15 op-province-picker__div-3">
            {selectedProvince && (
              <button
                type="button"
                onClick={handleClear}
                title="Xóa lựa chọn"
                className="op-province-picker__button-16"
              >
                <span className="material-symbols-outlined op-province-picker__span-17">
                  close
                </span>
              </button>
            )}
            <span className="material-symbols-outlined op-province-picker__icon-18">
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
            className="fade-in op-province-picker__div-19 op-province-picker__div-4"
          >
            {/* Input Search Box */}
            <div className="op-province-picker__div-20">
              <span className="material-symbols-outlined op-province-picker__span-21">
                search
              </span>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Gõ tên tỉnh thành hoặc địa danh (VD: Phú Quốc, Sa Pa, Đà Nẵng...)"
                className="op-province-picker__element-22 op-province-picker__element-5"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="op-province-picker__button-23 op-province-picker__button-6"
                >
                  <span className="material-symbols-outlined op-province-picker__span-24">close</span>
                </button>
              )}
            </div>

            {/* Region Tabs (Ẩn khi đang gõ search) */}
            {!search.trim() && (
              <div className="op-province-picker__div-25">
                {REGIONS.map((region) => {
                  const isActive = activeRegion === region.id;
                  return (
                    <button
                      key={region.id}
                      type="button"
                      onClick={() => setActiveRegion(region.id)}
                      className={`op-province-picker__button-28 op-province-picker__button-7  ${
                        isActive
                          ? "op-province-picker__button-26--variant-1"
                          : "op-province-picker__button-27--variant-2"
                      }`}
                    >
                      {region.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Provinces Results Grid */}
            <div className="op-province-picker__div-29">
              {filteredProvinces.length === 0 ? (
                <div className="op-province-picker__div-30">
                  <span className="material-symbols-outlined op-province-picker__span-31">
                    search_off
                  </span>
                  Không tìm thấy tỉnh thành hoặc địa danh phù hợp
                </div>
              ) : (
                <div className="op-province-picker__div-32">
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
                        className={`op-province-picker__element-35   ${
                          isSelected
                            ? "op-province-picker__element-33--variant-1"
                            : "op-province-picker__element-34--variant-2"
                        }`}
                      >
                        <div className="op-province-picker__div-36">
                          <span className="op-province-picker__span-37">{cleanName}</span>
                          <span
                            className={`op-province-picker__span-40 op-province-picker__span-8  ${
                              isSelected ? "op-province-picker__span-38--variant-1" : "op-province-picker__span-39--variant-2"
                            }`}
                          >
                            {prefix}
                          </span>
                        </div>
                        {isSelected && (
                          <span className="material-symbols-outlined op-province-picker__span-41 op-province-picker__span-9">
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
            <div className="op-province-picker__div-42">
              <span>{filteredProvinces.length} / {provinces.length} tỉnh thành</span>
              <span className="op-province-picker__span-43">Hỗ trợ tìm theo tên thành phố, đảo, thắng cảnh</span>
            </div>
          </div>
        )}
      </div>

      {/* Thanh chọn nhanh (Quick-Pick Chips) */}
      {quickPicks.length > 0 && (
        <div className="op-province-picker__div-44">
          <span className="op-province-picker__span-45">
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
                className={`op-province-picker__button-48 op-province-picker__button-10  ${
                  isSelected
                    ? "op-province-picker__button-46--variant-1"
                    : "op-province-picker__button-47--variant-2"
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
