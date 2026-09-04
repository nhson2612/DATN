import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import CardSkeleton from "../../components/skeletons/CardSkeleton";
import PlaceCard from "../../components/cards/PlaceCard";
import PlaceListHero from "./components/PlaceListHero";
import PlaceListControls from "./components/PlaceListControls";
import "./PlaceList.css";

const NHOM = {
  tat_ca: { ten: "Tất cả", icon: "fa-compass" },
  tham_quan: { ten: "Tham quan", icon: "fa-landmark" },
  an_uong: { ten: "Ăn uống", icon: "fa-utensils" },
  vui_choi: { ten: "Vui chơi", icon: "fa-masks-theater" },
  mua_sam: { ten: "Mua sắm", icon: "fa-bag-shopping" },
  luu_tru: { ten: "Nơi lưu trú", icon: "fa-bed" },
};

const QUICK_FILTERS = [
  { id: "danh_gia_cao", label: "Đánh giá 4.5+", icon: "fa-star" },
  { id: "co_anh", label: "Có ảnh chụp", icon: "fa-image" },
  { id: "mien_phi", label: "Miễn phí vé", icon: "fa-ticket" },
  { id: "pho_bien", label: "Nổi bật nhất", icon: "fa-fire" },
];

const PAGE_SIZE = 24;

export default function PlaceList() {
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();

  const destination = sp.get("destination") || "";
  const nhom = sp.get("nhom") || "tat_ca";
  const searchParam = sp.get("q") || "";

  const [destinationsList, setDestinationsList] = useState([]);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [dangTai, setDangTai] = useState(true);
  const [loi, setLoi] = useState("");

  const [timKiemInput, setTimKiemInput] = useState(searchParam);
  const [selectedQuickFilters, setSelectedQuickFilters] = useState([]);

  // Load provinces list for destination selector
  useEffect(() => {
    api
      .destinations(100)
      .then((res) => {
        if (res?.destinations) {
          setDestinationsList(res.destinations);
        }
      })
      .catch((err) => console.error("Không thể tải danh sách điểm đến:", err));
  }, []);

  // Sync internal search input with URL search param
  useEffect(() => {
    setTimKiemInput(searchParam);
  }, [searchParam]);

  // Debounce search input update to URL params
  useEffect(() => {
    const handler = setTimeout(() => {
      if (timKiemInput !== searchParam) {
        const nextSp = new URLSearchParams(sp);
        if (timKiemInput.trim()) {
          nextSp.set("q", timKiemInput.trim());
        } else {
          nextSp.delete("q");
        }
        setSp(nextSp, { replace: true });
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [timKiemInput, searchParam, sp, setSp]);

  // Reset pagination when primary filter controls change
  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [destination, nhom, searchParam]);

  // Fetch places from backend API
  useEffect(() => {
    let active = true;
    setDangTai(true);
    setLoi("");

    const isAccommodation = nhom === "luu_tru";
    const placeType = isAccommodation ? "accommodation" : "poi";
    const nhomQuery = isAccommodation || nhom === "tat_ca" ? null : nhom;
    const hasPhoto = selectedQuickFilters.some((f) => f.id === "co_anh");

    const params = {
      destination: destination || undefined,
      nhom: nhomQuery,
      q: searchParam || undefined,
      place_type: placeType,
      has_photo: hasPhoto ? true : undefined,
      page,
      page_size: PAGE_SIZE,
    };

    api
      .searchPlaces(params)
      .then((d) => {
        if (!active) return;
        setItems((prev) => (page === 1 ? d.items || [] : [...prev, ...(d.items || [])]));
        setTotal(d.total || (d.items ? d.items.length : 0));
        if (d.error) setLoi(d.error);
      })
      .catch((e) => {
        if (active) setLoi(e.message || "Không thể tải danh sách địa điểm.");
      })
      .finally(() => {
        if (active) setDangTai(false);
      });

    return () => {
      active = false;
    };
  }, [destination, nhom, searchParam, page, selectedQuickFilters]);

  const toggleQuickFilter = (filterObj) => {
    if (selectedQuickFilters.some((f) => f.id === filterObj.id)) {
      setSelectedQuickFilters(selectedQuickFilters.filter((f) => f.id !== filterObj.id));
    } else {
      setSelectedQuickFilters([...selectedQuickFilters, filterObj]);
    }
  };

  const itemsHienThi = items.filter((item) => {
    if (selectedQuickFilters.some((f) => f.id === "danh_gia_cao")) {
      if (item.rating && item.rating < 4.5) return false;
    }
    return true;
  });

  const handleDestinationChange = (e) => {
    const val = e.target.value;
    const nextSp = new URLSearchParams(sp);
    if (val) {
      nextSp.set("destination", val);
    } else {
      nextSp.delete("destination");
    }
    setSp(nextSp);
  };

  const handleCategoryChange = (key) => {
    const nextSp = new URLSearchParams(sp);
    if (key === "tat_ca") {
      nextSp.delete("nhom");
    } else {
      nextSp.set("nhom", key);
    }
    setSp(nextSp);
  };

  const clearAllFilters = () => {
    setTimKiemInput("");
    setSelectedQuickFilters([]);
    setSp({});
  };

  const selectedDestObj = destinationsList.find((d) => d.slug === destination);
  const selectedDestName = selectedDestObj ? selectedDestObj.name : destination || "Toàn quốc";
  const hasActiveFilters = Boolean(destination || nhom !== "tat_ca" || searchParam || selectedQuickFilters.length > 0);

  return (
    <main className="place-list-page">
      {/* Hero Header Section */}
      <PlaceListHero
        destination={destination}
        destinationsList={destinationsList}
        selectedDestName={selectedDestName}
        nhomName={NHOM[nhom]?.ten}
        timKiemInput={timKiemInput}
        onSearchChange={setTimKiemInput}
        onSearchClear={() => setTimKiemInput("")}
        onDestinationChange={handleDestinationChange}
        onBackClick={() => nav(destination ? `/diem-den/${destination}` : "/")}
      />

      {/* Category Tabs & Quick Filters */}
      <PlaceListControls
        categories={NHOM}
        activeCategory={nhom}
        onCategoryChange={handleCategoryChange}
        quickFilters={QUICK_FILTERS}
        selectedQuickFilters={selectedQuickFilters}
        onToggleQuickFilter={toggleQuickFilter}
        onClearAllFilters={clearAllFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Stats Bar */}
      <div className="place-list-stats">
        <div className="place-list-stats__count">
          {dangTai && items.length === 0 ? (
            <span>Đang tìm kiếm địa điểm...</span>
          ) : (
            <span>
              Tìm thấy <strong className="text-emerald-700 dark:text-emerald-400">{total.toLocaleString("vi-VN")}</strong> địa điểm phù hợp
            </span>
          )}
        </div>
      </div>

      {loi && <p className="place-list-page__error text-rose-500 text-sm mb-4">{loi}</p>}

      {/* Place Cards Grid */}
      <div className="place-list-grid">
        {dangTai && items.length === 0 && <CardSkeleton count={8} />}

        {itemsHienThi.map((p) => (
          <PlaceCard
            key={`${p.type}-${p.id}`}
            place={p}
            group={nhom === "tat_ca" ? "tham_quan" : nhom}
            onClick={() => nav(`/dia-diem/${p.type}/${p.id}`)}
          />
        ))}
      </div>

      {/* Empty State */}
      {!dangTai && itemsHienThi.length === 0 && (
        <div className="place-list-empty">
          <div className="place-list-empty__icon">
            <i className="fa-solid fa-map-location-dot" />
          </div>
          <h3 className="place-list-empty__title">Không tìm thấy địa điểm phù hợp</h3>
          <p className="place-list-empty__desc">
            Hãy thử thay đổi từ khoá tìm kiếm, chọn lại điểm đến hoặc xoá bớt bộ lọc để có kết quả tốt hơn.
          </p>
          <button type="button" onClick={clearAllFilters} className="place-list-empty__btn">
            <i className="fa-solid fa-filter-circle-xmark mr-2" /> Xoá toàn bộ bộ lọc
          </button>
        </div>
      )}

      {/* Load More Pagination */}
      {!dangTai && total > items.length && (
        <div className="place-list-page__load-more">
          <button type="button" onClick={() => setPage((p) => p + 1)} className="place-list-load-more-btn">
            <i className="fa-solid fa-angles-down mr-2" />
            Xem thêm địa điểm (Còn {(total - items.length).toLocaleString("vi-VN")})
          </button>
        </div>
      )}

      {!dangTai && items.length > 0 && total <= items.length && (
        <p className="place-list-page__end-message">
          <i className="fa-solid fa-circle-check text-emerald-500 mr-1.5" />
          Đã hiển thị toàn bộ {total.toLocaleString("vi-VN")} địa điểm.
        </p>
      )}
    </main>
  );
}
