import "./PlaceCard.css";

export default function PlaceCard({ place, group = "tham_quan", onClick, footer }) {
  const imgSrc = place.anh;
  const categoryName = (place.category || group || "").replace(/_/g, " ");

  return (
    <article onClick={onClick} className="place-card group">
      {/* Image Container with Zoom & Floating Pill */}
      <div className="place-card__image-wrapper">
        {imgSrc ? <img src={imgSrc} alt={place.name} loading="lazy" className="place-card__img" /> : (
          <div className="place-card__img place-card__img--empty" role="img" aria-label={place.name}>
            <i className="fa-regular fa-image" aria-hidden="true" />
          </div>
        )}
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
