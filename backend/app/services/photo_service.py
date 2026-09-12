"""Service xử lý tự động tìm và lưu ảnh ở phía Backend (server-side)."""

import json
import re
import subprocess
import unicodedata
import urllib.parse
from app.core.database import execute_query
from app.core.logging import get_logger

logger = get_logger(__name__)

def _norm(t: str) -> str:
    t = str(t or "").lower().replace("đ", "d")
    t = unicodedata.normalize("NFD", t)
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


def _is_matching_title(place_name: str, wiki_title: str) -> bool:
    """Chỉ nhận tiêu đề Wikipedia chứa đủ toàn bộ từ của tên địa điểm."""
    p_words = [w for w in _norm(place_name).split() if len(w) >= 2]
    if len(p_words) < 2:
        return False
    t_words = set(_norm(wiki_title).split())
    return all(word in t_words for word in p_words)


def fetch_wikipedia_photo_server(place_name: str):
    """Tìm ảnh chính xác trên Wikipedia từ Server."""
    url = f"https://vi.wikipedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch={urllib.parse.quote(place_name)}&gsrlimit=3&prop=pageimages&piprop=thumbnail&pithumbsize=600"
    try:
        out = subprocess.run(
            ["curl", "-s", "--max-time", "5", "-H", "User-Agent: DATN-Tourism/1.0", url],
            capture_output=True, timeout=6
        ).stdout
        if not out or out[:1] != b"{":
            return None
        data = json.loads(out)
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            src = (page.get("thumbnail") or {}).get("source")
            title = page.get("title", "")
            if src and _is_matching_title(place_name, title):
                return src, f"Wikipedia — {title}"
    except Exception as e:
        logger.debug(f"Wiki lookup error for {place_name}: {e}")
    return None


def get_fallback_image(category: str) -> str:
    return None


def ensure_place_photo(place: dict):
    """Nếu địa điểm chưa có ảnh trong DB, tự động tìm và gán ảnh + lưu DB."""
    if not place:
        return place

    p_type = place.get("type") or "poi"
    p_id = place.get("id")
    p_name = place.get("name", "")
    p_cat = place.get("category", "")

    social_link = place.get("social") or (place.get("tags") or {}).get("social")
    if social_link:
        import re
        fb_match = re.search(r"facebook\.com/(?:profile\.php\?id=)?(\d+|[A-Za-z0-9\.\_]+)", social_link)
        if fb_match:
            fb_id = fb_match.group(1)
            fb_photo = f"https://graph.facebook.com/{fb_id}/picture?type=large"
            place["anh"] = fb_photo
            place["anh_nguon"] = "Facebook Fanpage"
            return place

    if place.get("anh"):
        return place

    # 2. Kiểm tra lại DB
    if p_id:
        rows = execute_query(
            "SELECT url, attribution FROM place_photos WHERE place_type = %s AND place_id = %s",
            (p_type, p_id)
        )
        if rows and rows[0].get("url"):
            place["anh"] = rows[0]["url"]
            place["anh_nguon"] = rows[0].get("attribution")
            return place

    # 3. Tìm qua Wikipedia trên Server
    wiki_res = fetch_wikipedia_photo_server(p_name)
    if wiki_res:
        photo_url, attribution = wiki_res
        if p_id:
            try:
                execute_query(
                    """
                    INSERT INTO place_photos (place_type, place_id, url, attribution)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (place_type, place_id) DO UPDATE SET url = EXCLUDED.url
                    """,
                    (p_type, p_id, photo_url, attribution)
                )
            except Exception:
                pass
        place["anh"] = photo_url
        place["anh_nguon"] = attribution
    if not place.get("anh"):
        # 4. Ảnh kho theo danh mục — chỉ khi mọi nguồn thật đều không có.
        #    Để cuối cùng, sau cả meta_service.bo_sung (gọi ở destination_service):
        #    ảnh Unsplash gán sớm sẽ chặn mọi nguồn ảnh THẬT phía sau.
        place["anh"] = get_fallback_image(p_cat)

    return place


def ensure_places_photos(places: list):
    """Enrich ảnh cho danh sách địa điểm."""
    if not places:
        return places
    for p in places:
        ensure_place_photo(p)
    return places
