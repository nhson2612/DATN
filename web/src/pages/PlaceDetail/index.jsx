import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import DetailSkeleton from "../../components/skeletons/DetailSkeleton";
import ErrorBoundary from "../../components/common/ErrorBoundary";
import MiniMap from "../../components/map/MiniMap";
import BookingForm from "../../components/modals/BookingForm";
import "./PlaceDetail.css";

const CATEGORY_FALLBACK_IMAGES = {
  tham_quan: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1200&q=80",
  an_uong: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80",
  vui_choi: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
  mua_sam: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
  luu_tru: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80",
};

export default function PlaceDetail({ user, onNeedAuth }) {
  const { type, id } = useParams();
  const nav = useNavigate();

  const [p, setP] = useState(null);
  const [loi, setLoi] = useState("");
  const [daLuu, setDaLuu] = useState(false);
  const [moForm, setMoForm] = useState(false);

  useEffect(() => {
    setP(null);
    setDaLuu(false);
    setLoi("");

    api
      .place(type, id)
      .then((d) => {
        if (d?.place) {
          setP(d.place);
        } else {
          setLoi("Không tìm thấy thông tin địa điểm.");
        }
      })
      .catch((e) => setLoi(e.message || "Lỗi khi tải thông tin địa điểm."));
  }, [type, id]);

  async function luuYeuThich() {
    if (!user) return onNeedAuth();
    try {
      await api.addFavorite(type, Number(id));
      setDaLuu(true);
    } catch (e) {
      alert(e.message || "Không thể lưu vào danh sách yêu thích.");
    }
  }

  if (loi) {
    return (
      <main className="place-detail-page py-16 text-center">
        <div className="max-w-md mx-auto bg-rose-50 dark:bg-rose-950/40 p-6 rounded-3xl border border-rose-200 dark:border-rose-900">
          <i className="fa-solid fa-circle-exclamation text-3xl text-rose-500 mb-3 block" />
          <h2 className="text-lg font-bold text-rose-800 dark:text-rose-200 mb-2">Đã xảy ra lỗi</h2>
          <p className="text-sm text-rose-600 dark:text-rose-300 mb-4">{loi}</p>
          <button
            type="button"
            onClick={() => nav(-1)}
            className="px-5 py-2 rounded-full bg-slate-900 text-white font-semibold text-xs hover:bg-slate-800 transition"
          >
            Quay lại trang trước
          </button>
        </div>
      </main>
    );
  }

  if (!p) return <DetailSkeleton />;

  const categoryName = (p.category || type || "").replace(/_/g, " ");
  const heroImage = p.anh || CATEGORY_FALLBACK_IMAGES[type] || CATEGORY_FALLBACK_IMAGES.default;

  const socialUrl = p.social || p.tags?.social;
  const emailVal = p.email || p.tags?.email;

  return (
    <main className="place-detail-page">
      {/* Top Back Navigation Button */}
      <button type="button" onClick={() => nav(-1)} className="place-detail-page__back-btn">
        <i className="fa-solid fa-arrow-left" /> Quay lại
      </button>

      {/* Hero Header Banner */}
      <section className="place-detail-page__hero">
        {heroImage ? (
          <>
            <img
              src={heroImage}
              alt={p.name}
              className="place-detail-page__hero-img"
              onError={(e) => {
                e.target.src = CATEGORY_FALLBACK_IMAGES.default;
              }}
            />
            <div className="place-detail-page__hero-overlay" />
          </>
        ) : (
          <div className="place-detail-page__hero-placeholder">
            <i className="fa-solid fa-image text-4xl" />
            <span>Không có hình ảnh</span>
          </div>
        )}

        <div className="place-detail-page__hero-content">
          <div className="place-detail-page__badges">
            <span className="place-detail-page__badge">
              <i className="fa-solid fa-layer-group text-xs mr-1" />
              {categoryName}
            </span>
            {p.rating && (
              <span className="place-detail-page__rating-badge">
                <i className="fa-solid fa-star text-xs" />
                <span>{p.rating}</span>
              </span>
            )}
          </div>

          <h1 className="place-detail-page__hero-title">{p.name}</h1>

          {p.anh_nguon && (
            <p className="place-detail-page__hero-credit">
              <i className="fa-solid fa-camera mr-1" /> Nguồn ảnh: {p.anh_nguon}
            </p>
          )}
        </div>
      </section>

      {/* Main Details & Sidebar Grid */}
      <div className="place-detail-page__grid">
        {/* Left Column: Info & Map */}
        <div className="place-detail-page__main">
          {/* Main Info Card */}
          <div className="place-detail-page__section-card">
            <h2 className="place-detail-page__section-title">
              <i className="fa-solid fa-circle-info text-emerald-600" />
              Thông tin chi tiết
            </h2>

            {p.description && <p className="place-detail-page__desc">{p.description}</p>}

            <div className="place-detail-page__info-grid">
              {p.dia_chi && (
                <div className="place-detail-page__info-item">
                  <i className="fa-solid fa-location-dot place-detail-page__info-icon" />
                  <div>
                    <span className="text-xs text-slate-400 block font-normal">Địa chỉ</span>
                    <span className="place-detail-page__info-text">{p.dia_chi}</span>
                  </div>
                </div>
              )}

              {p.dien_thoai && (
                <div className="place-detail-page__info-item">
                  <i className="fa-solid fa-phone place-detail-page__info-icon" />
                  <div>
                    <span className="text-xs text-slate-400 block font-normal">Điện thoại</span>
                    <a
                      href={`tel:${p.dien_thoai}`}
                      className="place-detail-page__info-text text-emerald-700 hover:underline"
                    >
                      {p.dien_thoai}
                    </a>
                  </div>
                </div>
              )}

              {emailVal && (
                <div className="place-detail-page__info-item">
                  <i className="fa-solid fa-envelope place-detail-page__info-icon" />
                  <div>
                    <span className="text-xs text-slate-400 block font-normal">Email liên hệ</span>
                    <a
                      href={`mailto:${emailVal}`}
                      className="place-detail-page__info-text text-emerald-700 hover:underline"
                    >
                      {emailVal}
                    </a>
                  </div>
                </div>
              )}

              {p.stars && (
                <div className="place-detail-page__info-item">
                  <i className="fa-solid fa-hotel place-detail-page__info-icon" />
                  <div>
                    <span className="text-xs text-slate-400 block font-normal">Hạng sao</span>
                    <span className="place-detail-page__info-text">{p.stars} sao</span>
                  </div>
                </div>
              )}

              {p.price_range && (
                <div className="place-detail-page__info-item">
                  <i className="fa-solid fa-tag place-detail-page__info-icon" />
                  <div>
                    <span className="text-xs text-slate-400 block font-normal">Mức giá</span>
                    <span className="place-detail-page__info-text">{p.price_range}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Map Section */}
          {p.lon && p.lat && (
            <div className="place-detail-page__section-card">
              <h2 className="place-detail-page__section-title">
                <i className="fa-solid fa-map-location-dot text-emerald-600" />
                Vị trí trên bản đồ
              </h2>
              <div className="rounded-2xl overflow-hidden border border-slate-200">
                <ErrorBoundary ten="Bản đồ">
                  <MiniMap lon={p.lon} lat={p.lat} />
                </ErrorBoundary>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Actions Sidebar */}
        <aside className="place-detail-page__sidebar">
          <div className="place-detail-page__action-card">
            <h3 className="place-detail-page__action-title">Hành động nhanh</h3>

            <button
              type="button"
              onClick={luuYeuThich}
              disabled={daLuu}
              className={`place-detail-page__fav-btn ${daLuu ? "place-detail-page__fav-btn--active" : "place-detail-page__fav-btn--inactive"
                }`}
            >
              <i className={`fa-${daLuu ? "solid" : "regular"} fa-heart ${daLuu ? "text-rose-600" : ""}`} />
              <span>{daLuu ? "Đã lưu yêu thích" : "Lưu vào yêu thích"}</span>
            </button>

            <button
              type="button"
              onClick={() => (user ? setMoForm(true) : onNeedAuth())}
              className="place-detail-page__book-btn"
            >
              <i className="fa-solid fa-paper-plane" />
              <span>Gửi yêu cầu đặt chỗ</span>
            </button>

            {socialUrl && (
              <a
                href={socialUrl.startsWith("http") ? socialUrl : `https://${socialUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="place-detail-page__website-btn !bg-blue-50 !text-blue-700 !border-blue-200 hover:!bg-blue-100"
              >
                <i className="fa-brands fa-facebook text-blue-600 text-base" />
                <span>Trang Fanpage / Mạng xã hội</span>
              </a>
            )}

            {p.website && (
              <a
                href={
                  p.website.startsWith("http://") || p.website.startsWith("https://")
                    ? p.website.replace("http:/", "http://").replace("http:///", "http://")
                    : `https://${p.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="place-detail-page__website-btn"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" />
                <span>Trang web chính thức</span>
              </a>
            )}

            <p className="place-detail-page__disclaimer">
              <i className="fa-solid fa-shield-halved mr-1" />
              Thông tin địa điểm được xác thực trực tiếp từ nhà cung cấp dịch vụ.
            </p>
          </div>
        </aside>
      </div>

      {/* Nearby Places Section */}
      {p.nearby?.length > 0 && (
        <section className="place-detail-page__nearby-section">
          <h2 className="place-detail-page__nearby-title">
            <i className="fa-solid fa-location-crosshairs text-emerald-600" />
            Địa điểm lân cận hấp dẫn
          </h2>
          <div className="place-detail-page__nearby-grid">
            {p.nearby.map((n) => (
              <article
                key={n.id}
                onClick={() => nav(`/dia-diem/poi/${n.id}`)}
                className="place-detail-page__nearby-card"
              >
                <h3 className="place-detail-page__nearby-name">{n.name}</h3>
                <p className="place-detail-page__nearby-dist">
                  <i className="fa-solid fa-route text-emerald-600 text-xs" />
                  cách {n.met < 1000 ? `${n.met} m` : `${(n.met / 1000).toFixed(1)} km`}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Booking Form Modal */}
      <BookingForm
        open={moForm}
        onClose={() => setMoForm(false)}
        placeType={type}
        placeId={Number(id)}
        placeName={p.name}
      />
    </main>
  );
}
