import { useEffect, useState } from "react";
import { api } from "../../api/client";

export default function MapOverlayImage({ place, onDetails }) {
  const initialImg = place?.anh || place?.photo || place?.url || place?.image || place?.hinh_anh || null;
  const [imgUrl, setImgUrl] = useState(initialImg);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    const srcImg = place?.anh || place?.photo || place?.url || place?.image || place?.hinh_anh || null;
    
    // 1. Ưu tiên lấy ảnh từ Facebook Fanpage nếu có link social
    const socialUrl = place?.social || place?.tags?.social;
    let fbImg = null;
    if (socialUrl && socialUrl.includes("facebook.com")) {
      const match = socialUrl.match(/facebook\.com\/(?:profile\.php\?id=)?([a-zA-Z0-9\.\_]+)/);
      if (match && match[1]) {
        fbImg = `https://graph.facebook.com/${match[1]}/picture?type=large`;
      }
    }

    if (fbImg) {
      setImgUrl(fbImg);
      return;
    }

    if (srcImg) {
      setImgUrl(srcImg);
    }

    if (srcImg && place?.cached_details) {
      if (onDetails) onDetails(place.cached_details);
      return;
    }

    let isMounted = true;

    const fetchWikiFallback = () => {
      if (!place?.name) {
        if (isMounted) setFailed(true);
        return;
      }
      fetch(
        `https://vi.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
          place.name
        )}&gsrlimit=1&prop=pageimages&piprop=thumbnail&pithumbsize=400&format=json&origin=*`
      )
        .then((res) => res.json())
        .then((data) => {
          if (!isMounted) return;
          const pages = data?.query?.pages;
          if (pages) {
            const firstPage = Object.values(pages)[0];
            const src = firstPage?.thumbnail?.source;
            if (src) {
              setImgUrl(src);
              if (place?.id) {
                api.cachePlaceDetails({
                  place_type: place.type || "poi",
                  place_id: place.id,
                  url: src,
                  attribution: "Wikipedia",
                  details: place.cached_details || null,
                }).catch(() => {});
              }
            } else {
              setFailed(true);
            }
          } else {
            setFailed(true);
          }
        })
        .catch(() => {
          if (isMounted) setFailed(true);
        });
    };

    if (window.google?.maps?.places && place?.name) {
      const service = new window.google.maps.places.PlacesService(document.createElement("div"));
      service.findPlaceFromQuery(
        {
          query: place.name,
          fields: ["photos", "rating", "user_ratings_total", "formatted_address", "opening_hours", "reviews"],
          locationBias: place.lat && place.lon ? new window.google.maps.LatLng(place.lat, place.lon) : undefined,
        },
        (results, status) => {
          if (!isMounted) return;
          if (status === window.google.maps.places.PlacesServiceStatus.OK && results?.[0]) {
            const gPlace = results[0];
            const photoUrl = gPlace.photos?.[0]?.getUrl({ maxWidth: 400, maxHeight: 400 });
            if (photoUrl) setImgUrl(photoUrl);

            const reviewsList = (gPlace.reviews || []).slice(0, 5).map((r) => ({
              author: r.author_name,
              rating: r.rating,
              text: r.text,
              time: r.relative_time_description,
            }));

            const detailsObj = {
              rating: gPlace.rating || null,
              ratingsCount: gPlace.user_ratings_total || null,
              isOpen: gPlace.opening_hours?.isOpen?.(),
              address: gPlace.formatted_address || null,
              reviews: reviewsList.length > 0 ? reviewsList : (place?.cached_details?.reviews || null),
            };

            if (onDetails) onDetails(detailsObj);

            if (place?.id) {
              api.cachePlaceDetails({
                place_type: place.type || "poi",
                place_id: place.id,
                url: photoUrl || srcImg || "",
                attribution: "Google Maps",
                details: detailsObj,
              }).catch(() => {});
            }

            if (!photoUrl && !srcImg) {
              fetchWikiFallback();
            }
          } else {
            if (!srcImg) fetchWikiFallback();
          }
        }
      );
    } else {
      if (!srcImg) fetchWikiFallback();
    }

    return () => {
      isMounted = false;
    };
  }, [place?.name, place?.anh, place?.photo, place?.url, place?.image, place?.id, place?.type, place?.lat, place?.lon]);

  if (imgUrl && !failed) {
    return (
      <img
        src={imgUrl}
        alt={place?.name || ""}
        onError={() => {
          if (imgUrl.includes("facebook.com")) {
            const fallback = place?.anh || place?.photo || place?.url || place?.image || place?.hinh_anh || null;
            if (fallback && fallback !== imgUrl) {
              setImgUrl(fallback);
              return;
            }
          }
          setFailed(true);
        }}
        className="w-full h-full object-cover rounded-xl"
      />
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 rounded-xl">
      <i className="fa-solid fa-location-dot text-xl text-emerald-500" />
    </div>
  );
}
