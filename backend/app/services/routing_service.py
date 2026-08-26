"""Định tuyến: snap hai đầu, tìm đường, xử lý chiều lưu thông."""

from app.core.config import settings
from app.repositories import road_repo


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
        raise SnapTooFarError(which, node["dist_m"])
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

    path = road_repo.shortest_path(start["id"], end["id"], directed=True)
    may_violate_oneway = False
    if not path:
        path = road_repo.shortest_path(start["id"], end["id"], directed=False)
        may_violate_oneway = bool(path)
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
