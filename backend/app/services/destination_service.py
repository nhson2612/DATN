"""Điểm đến: trang trung tâm của website du lịch.

Người dùng vào trang du lịch để xem "Đà Nẵng có gì", không phải để hỏi "quán
karaoke gần đây" — nên nội dung được tổ chức quanh ĐIỂM ĐẾN, không quanh vị trí
hiện tại. Mỗi tỉnh/thành một trang, địa điểm gom theo 4 nhóm nhu cầu.
"""

import re
import unicodedata

from app.core.logging import get_logger
from app.repositories import destination_repo
from app.services import meta_service, photo_service

logger = get_logger(__name__)


def slugify(ten: str) -> str:
    """"Thành phố Đà Nẵng" -> "da-nang". Dùng làm URL của trang điểm đến."""
    t = str(ten).lower().replace("đ", "d")
    t = unicodedata.normalize("NFD", t)
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"^(thanh pho|tinh)\s+", "", t)
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


def list_destinations(limit: int = 100):
    return [
        {
            "slug": slugify(r["name"]),
            "name": r["name"],
            "so_dia_diem": r["so_dia_diem"],
            "so_luu_tru": r["so_luu_tru"],
            "lon": r["lon"],
            "lat": r["lat"],
        }
        for r in destination_repo.list_provinces(limit)
    ]


def get_destination(slug: str, limit_moi_nhom: int = 12):
    """Chi tiết một điểm đến: thông tin + địa điểm nổi bật theo từng nhóm."""
    tinh = destination_repo.find_province(slugify(slug))
    if not tinh:
        return None

    nhom = []
    for key, cfg in destination_repo.NHOM_HIEN_THI.items():
        items = destination_repo.places_by_group(
            tinh["id"], cfg["roots"], limit_moi_nhom)
        if items:
            photo_service.ensure_places_photos(items)
            nhom.append({"key": key, "ten": cfg["ten"], "items": items})

    luu_tru = destination_repo.accommodations(tinh["id"], limit_moi_nhom)
    if luu_tru:
        photo_service.ensure_places_photos(luu_tru)
        nhom.append({"key": "luu_tru", "ten": "Nơi lưu trú", "items": luu_tru})

    logger.info("Điểm đến %r: %d nhóm, %d địa điểm",
                tinh["name"], len(nhom), sum(len(g["items"]) for g in nhom))

    return {
        "slug": slugify(tinh["name"]),
        "name": tinh["name"],
        "lon": tinh["lon"],
        "lat": tinh["lat"],
        "groups": nhom,
    }


def search_places(destination=None, nhom=None, category=None, q=None,
                  has_photo=False, page=1, page_size=24, bang="poi"):
    """Danh sách địa điểm có lọc, dùng cho view lưới."""
    province_id = None
    if destination:
        tinh = destination_repo.find_province(slugify(destination))
        if not tinh:
            return {"items": [], "total": 0, "page": page,
                    "error": f"Không tìm thấy điểm đến '{destination}'."}
        province_id = tinh["id"]

    roots = destination_repo.NHOM_HIEN_THI[nhom]["roots"] if nhom in destination_repo.NHOM_HIEN_THI else None

    items, tong = destination_repo.search_places(
        province_id=province_id, roots=roots, category=category, q=q,
        has_photo=has_photo, page=page, page_size=page_size, bang=bang)
    photo_service.ensure_places_photos(items)
    return {"items": items, "total": tong, "page": page, "page_size": page_size}


def place_detail(place_type: str, place_id: int):
    """Chi tiết địa điểm + địa điểm lân cận."""
    place = destination_repo.get_place_detail(place_type, place_id)
    if not place:
        return None
    # Đọc thẻ OpenGraph của website địa điểm tự khai: lấy mô tả, và lấy ảnh nếu
    # các nguồn trước chưa có. Gọi ở đây chứ không lồng trong ensure_place_photo
    # vì hàm đó return sớm ở nhánh ảnh Facebook — mô tả sẽ không bao giờ tới.
    meta_service.bo_sung(place)
    photo_service.ensure_place_photo(place)
    place["nearby"] = destination_repo.nearby(
        place["lon"], place["lat"], place_id if place_type == "poi" else -1)
    photo_service.ensure_places_photos(place.get("nearby", []))
    return place

