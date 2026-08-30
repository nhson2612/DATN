"""Định tuyến: snap hai đầu, tìm đường, xử lý chiều lưu thông."""

from app.core.config import settings
from app.core.logging import get_logger, log_duration
from app.repositories import road_repo

logger = get_logger(__name__)


class SnapTooFarError(Exception):
    """Điểm nằm quá xa mạng lưới đường bộ."""

    def __init__(self, which: str, distance_m: float):
        self.which = which
        self.distance_m = distance_m
        super().__init__(f"{which} cách mạng lưới {distance_m:.0f}m")


class NoRouteError(Exception):
    """Không tìm được tuyến, kể cả khi bỏ qua chiều lưu thông."""


def _snap(lon: float, lat: float, which: str):
    node = road_repo.snap_to_network(lon, lat)
    if not node:
        raise NoRouteError(f"Không tìm được đỉnh mạng lưới gần {which}")
    if node["dist_m"] > settings.max_snap_distance_meters:
        logger.info(
            "%s cách mạng lưới %.0fm, vượt ngưỡng %dm",
            which, node["dist_m"], settings.max_snap_distance_meters,
        )
        raise SnapTooFarError(which, node["dist_m"])
    logger.debug("%s snap vào đỉnh %s, cách %.0fm", which, node["id"], node["dist_m"])
    return node


def find_route(start_lon, start_lat, end_lon, end_lat):
    """Tuyến giữa hai toạ độ, ưu tiên tuyến HỢP PHÁP.

    directed=True tôn trọng cost/reverse_cost = -1 (đường một chiều). Chỉ khi
    không có tuyến đúng chiều mới bỏ qua chiều, và khi đó đánh dấu
    may_violate_oneway để phía gọi cảnh báo được — thay vì im lặng trả tuyến sai.

    Tỉ lệ một chiều: gis_tourism 49%, gis_vietnam 25,7%. Đo 2026-08-25, tỉ lệ
    CHỈ directed thất bại: liên tỉnh 0/20, nội thành 1/12, gis_tourism 1/20.
    """
    start = _snap(start_lon, start_lat, "Điểm bắt đầu")
    end = _snap(end_lon, end_lat, "Điểm kết thúc")

    # Hai điểm snap vào CÙNG một đỉnh: pgr_dijkstra trả rỗng và trước đây bị coi
    # là "không có đường", ném 404. Nhưng đây là chuyện rất thường trong lịch
    # trình — hai quán cùng một đoạn phố — và câu trả lời đúng là "đi bộ thẳng",
    # không phải lỗi. Trình lên lịch nối 5 điểm gần nhau thì gặp ngay.
    if start["id"] == end["id"]:
        logger.info("Hai điểm cùng snap vào đỉnh %s — trả đoạn nối thẳng",
                    start["id"])
        return {
            "path": [],
            "total_distance_meters": 0.0,
            "start_snap_lon": start_lon, "start_snap_lat": start_lat,
            "end_snap_lon": end_lon, "end_snap_lat": end_lat,
            "may_violate_oneway": False,
            "cung_mot_dinh": True,
        }

    with log_duration(logger, "pgr_dijkstra directed=true",
                      start=start["id"], end=end["id"]):
        path = road_repo.shortest_path(start["id"], end["id"], directed=True)
    may_violate_oneway = False
    if not path:
        # Không có tuyến hợp pháp -> bỏ qua chiều. Phải ghi WARNING: tuyến trả
        # về có thể đi ngược chiều đường một chiều.
        logger.warning(
            "Không có tuyến đúng chiều %s->%s, thử lại không xét chiều",
            start["id"], end["id"],
        )
        with log_duration(logger, "pgr_dijkstra directed=false",
                          start=start["id"], end=end["id"]):
            path = road_repo.shortest_path(start["id"], end["id"], directed=False)
        may_violate_oneway = bool(path)
        if path:
            logger.warning(
                "Tuyến %s->%s CÓ THỂ đi ngược chiều (%d đoạn)",
                start["id"], end["id"], len(path),
            )
    if not path:
        raise NoRouteError(
            "Không tìm được tuyến đường giữa hai điểm này trong mạng lưới đường bộ."
        )

    network_distance = sum(row["segment_length_m"] for row in path)
    return {
        "start_node": start["id"],
        "end_node": end["id"],
        "start_snap_lon": start["lon"],
        "start_snap_lat": start["lat"],
        "end_snap_lon": end["lon"],
        "end_snap_lat": end["lat"],
        # Tổng gồm cả hai quãng đi bộ tới điểm snap.
        "total_distance_meters": network_distance + start["dist_m"] + end["dist_m"],
        "may_violate_oneway": may_violate_oneway,
        "path": path,
    }


def leg_geometry(start_lon, start_lat, end_lon, end_lat):
    """Hình học một chặng cho lịch trình. Trả (rows, may_violate_oneway)."""
    start = road_repo.snap_to_network(start_lon, start_lat)
    end = road_repo.snap_to_network(end_lon, end_lat)
    if not (start and end):
        return [], False
    rows = road_repo.geometry_only(start["id"], end["id"], directed=True)
    if rows:
        return rows, False
    rows = road_repo.geometry_only(start["id"], end["id"], directed=False)
    return rows, bool(rows)
