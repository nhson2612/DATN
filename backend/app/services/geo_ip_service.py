"""Suy vị trí người dùng từ IP, fallback về vị trí mặc định trong cấu hình."""

import requests
from fastapi import Request

from app.core.config import settings

_PRIVATE_PREFIXES = ("192.168.", "10.", "172.16.")
_LOCALHOST = ("127.0.0.1", "localhost", "::1")


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    return request.client.host


def coords_from_ip(ip: str):
    if ip in _LOCALHOST or ip.startswith(_PRIVATE_PREFIXES):
        return settings.default_lon, settings.default_lat
    try:
        res = requests.get(
            f"http://ip-api.com/json/{ip}", timeout=settings.geoip_timeout
        )
        data = res.json()
        if data.get("status") == "success":
            return data["lon"], data["lat"]
    except Exception as e:
        print(f"Error resolving IP geolocation: {e}")
    return settings.default_lon, settings.default_lat
