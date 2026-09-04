import "./PlaceCard.css";

const CATEGORY_FALLBACK_IMAGES = {
  tham_quan: "https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=600&q=80",
  an_uong: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
  vui_choi: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80",
  mua_sam: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=600&q=80",
  luu_tru: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=600&q=80",
  default: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80",
};

export default function PlaceCard({ place, group = "tham_quan", onClick, footer }) {
  const imgSrc = place.anh || CATEGORY_FALLBACK_IMAGES[group] || CATEGORY_FALLBACK_IMAGES.default;
  const categoryName = (place.category || group || "").replace(/_/g, " ");

  return (
    <article onClick={onClick} className="place-card group">
      {/* Image Container with Zoom & Floating Pill */}
      <div className="place-card__image-wrapper">
        <img
          src={imgSrc}
          alt={place.name}
          loading="lazy"
          className="place-card__img"
          onError={(e) => {
            e.target.src = CATEGORY_FALLBACK_IMAGES[group] || CATEGORY_FALLBACK_IMAGES.default;
          }}
        />
        <div className="place-card__overlay" />

        {/* Floating Category Badge */}
        <span className="place-card__badge">
          {categoryName}
        </span>

        {/* Floating Rating Badge if available */}
        {place.rating && (
          <span className="place-card__rating">
            <i className="fa-solid fa-star text-amber-400 text-xs" />
            <span>{place.rating}</span>
          </span>
        )}
      </div>

      {/* Content Area */}
      <div className="place-card__content">
        <h3 className="place-card__title" title={place.name}>
          {place.name}
        </h3>

        {place.dia_chi && (
          <p className="place-card__address">
            <i className="fa-solid fa-location-dot text-emerald-600 text-xs shrink-0" />
            <span className="truncate">{place.dia_chi}</span>
          </p>
        )}

        {place.met != null && (
          <p className="place-card__distance">
            <i className="fa-solid fa-route text-xs" /> Cách {place.met < 1000 ? `${place.met}m` : `${(place.met / 1000).toFixed(1)}km`}
          </p>
        )}
      </div>

      {footer && <div className="place-card__footer">{footer}</div>}
    </article>
  );
}
