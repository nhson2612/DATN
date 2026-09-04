/* Gallery bất đối xứng: ảnh chính Wikimedia (baseImage) + ảnh web (Tavily).

Quy tắc:
- Dedupe theo URL — ảnh Tavily trùng ảnh chính không hiện hai lần.
- Ảnh tải lỗi bị loại khỏi danh sách cục bộ; hỏng hết thì về fallback thể loại.
- Desktop: 1 ảnh chính + tối đa 2 ảnh phụ (CSS ẩn rail). Mobile: rail ngang
  scroll-snap hiện tất cả ảnh (CSS ẩn ảnh phụ).
- Ảnh web nào cũng ghi host làm chú thích nguồn nhỏ.
*/

import { useEffect, useMemo, useState } from "react";

export default function PlaceGallery({
  name,
  baseImage,
  fallbackImage,
  images = [],
}) {
  const [hong, setHong] = useState(() => new Set());
  const [chon, setChon] = useState(0);

  // Danh sách {url, host} đã dedupe — baseImage trước, ảnh web sau.
  const items = useMemo(() => {
    const list = [];
    const daThay = new Set();
    const them = (url, host) => {
      if (!url || daThay.has(url)) return;
      daThay.add(url);
      list.push({ url, host });
    };
    them(baseImage, null);
    (images || []).forEach((img) => them(img?.url, img?.host || null));
    return list;
  }, [baseImage, images]);

  const conSong = items.filter((it) => !hong.has(it.url));
  const hero = conSong[chon] || conSong[0] || null;
  const phu = conSong.filter((it) => it !== hero).slice(0, 2);

  // Danh sách co lại (ảnh hỏng) thì kéo con trỏ về ảnh đầu còn sống.
  useEffect(() => {
    if (chon >= conSong.length) setChon(0);
  }, [chon, conSong.length]);

  const danhDauHong = (url) => setHong((truoc) => new Set([...truoc, url]));

  // Mọi ảnh hỏng — kể cả ảnh chính — thì dùng fallback thể loại.
  if (!hero) {
    return (
      <figure className="place-field-guide__gallery">
        {fallbackImage ? (
          <img
            src={fallbackImage}
            alt={name}
            className="place-field-guide__gallery-fallback-img"
            onError={() => danhDauHong(fallbackImage)}
          />
        ) : (
          <div
            className="place-field-guide__gallery-fallback-img"
            role="img"
            aria-label={name}
          >
            <i className="fa-solid fa-image" aria-hidden="true" />
          </div>
        )}
      </figure>
    );
  }

  return (
    <figure
      className="place-field-guide__gallery"
      aria-label={`Hình ảnh ${name}`}
    >
      <div className="place-field-guide__gallery-hero">
        <img
          src={hero.url}
          alt={name}
          className="place-field-guide__gallery-hero-img"
          onError={() => danhDauHong(hero.url)}
        />
        {hero.host && (
          <figcaption className="place-field-guide__gallery-caption">
            <i className="fa-solid fa-camera" aria-hidden="true" /> Nguồn: {hero.host}
          </figcaption>
        )}
      </div>

      {/* Ảnh phụ — desktop: lưới 2 ô bên phải ảnh chính (CSS ẩn trên mobile). */}
      {phu.length > 0 && (
        <div className="place-field-guide__gallery-phu">
          {phu.map((it) => (
            <button
              type="button"
              key={it.url}
              onClick={() => setChon(conSong.indexOf(it))}
              className="place-field-guide__gallery-phu-btn"
              aria-label={`Xem ảnh phụ của ${name}`}
            >
              <img src={it.url} alt="" loading="lazy" onError={() => danhDauHong(it.url)} />
              {it.host && (
                <span className="place-field-guide__gallery-thumb-host">{it.host}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Rail ngang — mobile: mọi ảnh cuộn snap (CSS ẩn trên desktop). */}
      {conSong.length > 1 && (
        <div className="place-field-guide__gallery-rail" role="list">
          {conSong.map((it, i) => (
            <button
              type="button"
              role="listitem"
              key={it.url}
              onClick={() => setChon(i)}
              className={`place-field-guide__gallery-rail-item${
                it === hero ? " place-field-guide__gallery-rail-item--active" : ""
              }`}
              aria-label={`Xem ảnh ${i + 1} của ${name}`}
              aria-pressed={it === hero}
            >
              <img src={it.url} alt="" loading="lazy" onError={() => danhDauHong(it.url)} />
              {it.host && (
                <span className="place-field-guide__gallery-thumb-host">{it.host}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}
