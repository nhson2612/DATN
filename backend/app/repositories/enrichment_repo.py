"""Truy vấn bảng place_enrichments (cache Tavily). Chỉ SQL, không business logic.

Một dòng cho mỗi (place_type, place_id):
  - `fetching`: một request đang chạy Tavily. Cũ quá `stale_seconds` thì request
    khác được chiếm lại (lần chạy trước chết giữa chừng).
  - `success` / `not_found`: kết quả cuối, đọc lại mãi mãi, không gọi Tavily nữa.
Chiếm job bằng INSERT ... ON CONFLICT để PostgreSQL làm trọng tài — hai backend
worker cùng mở một địa điểm lần đầu chỉ một request thắng race.
"""

import json

from app.core.database import execute_query

_PLACE_TYPES = ("poi", "accommodation")

# Mọi cột cần trả về service — gồm raw_response để debug cách field được tạo ra.
_COT = ("id, place_type, place_id, provider, status, summary, opening_hours, "
        "rating, review_highlights, images, sources, raw_response, fetched_at, "
        "started_at")


def _check_type(place_type: str) -> str:
    if place_type not in _PLACE_TYPES:
        raise ValueError(
            f"place_type '{place_type}' không hợp lệ, chỉ nhận {_PLACE_TYPES}")
    return place_type


def _json(gia_tri):
    """Nối dict/list thành chuỗi JSON giữ nguyên ký tự tiếng Việt."""
    if gia_tri is None:
        return None
    return json.dumps(gia_tri, ensure_ascii=False)


def get(place_type: str, place_id: int) -> dict | None:
    _check_type(place_type)
    rows = execute_query(
        f"SELECT {_COT} FROM place_enrichments "
        "WHERE place_type = %s AND place_id = %s",
        (place_type, place_id),
    )
    return rows[0] if rows else None


def claim(place_type: str, place_id: int, stale_seconds: int = 90) -> bool:
    """Chiếm job: chèn dòng 'fetching' hoặc chiếm lại dòng fetching đã cũ.

    Trả True khi request này được phép gọi Tavily. Trả False khi một request
    khác đang chạy (fetching mới) hoặc đã có kết quả cuối — lúc đó request này
    phải trả 202 để frontend poll.
    """
    _check_type(place_type)
    rows = execute_query(
        """
        INSERT INTO place_enrichments (place_type, place_id, status)
        VALUES (%s, %s, 'fetching')
        ON CONFLICT (place_type, place_id) DO UPDATE
        SET status = 'fetching', started_at = CURRENT_TIMESTAMP,
            summary = NULL, opening_hours = NULL, rating = NULL,
            review_highlights = '[]'::jsonb, images = '[]'::jsonb,
            sources = '[]'::jsonb, raw_response = NULL
        WHERE place_enrichments.status = 'fetching'
          AND place_enrichments.started_at
              < CURRENT_TIMESTAMP - (%s * INTERVAL '1 second')
        RETURNING id
        """,
        (place_type, place_id, stale_seconds),
    )
    return bool(rows)


def save_success(place_type: str, place_id: int, data: dict,
                 raw_response: dict) -> None:
    """Lưu kết quả có ích. `data` là shape đã chuẩn hoá từ normalizer."""
    _check_type(place_type)
    execute_query(
        """
        UPDATE place_enrichments
        SET status = 'success',
            summary = %s,
            opening_hours = %s::jsonb,
            rating = %s::jsonb,
            review_highlights = %s::jsonb,
            images = %s::jsonb,
            sources = %s::jsonb,
            raw_response = %s::jsonb,
            fetched_at = CURRENT_TIMESTAMP
        WHERE place_type = %s AND place_id = %s
        """,
        (data.get("summary"),
         _json(data.get("opening_hours")),
         _json(data.get("rating")),
         _json(data.get("review_highlights") or []),
         _json(data.get("images") or []),
         _json(data.get("sources") or []),
         _json(raw_response),
         place_type, place_id),
    )


def save_not_found(place_type: str, place_id: int, raw_response: dict) -> None:
    """Lưu xác nhận không tìm thấy thông tin bổ sung.

    Xoá mọi field chuẩn hoá nhưng GIỮ raw_response để sau này kiểm tra vì sao
    không trích được field nào.
    """
    _check_type(place_type)
    execute_query(
        """
        UPDATE place_enrichments
        SET status = 'not_found',
            summary = NULL,
            opening_hours = NULL,
            rating = NULL,
            review_highlights = '[]'::jsonb,
            images = '[]'::jsonb,
            sources = '[]'::jsonb,
            raw_response = %s::jsonb,
            fetched_at = CURRENT_TIMESTAMP
        WHERE place_type = %s AND place_id = %s
        """,
        (_json(raw_response), place_type, place_id),
    )


def release_transient(place_type: str, place_id: int) -> None:
    """Xoá job khi lỗi tạm thời (timeout, 429, 5xx) để lần mở sau thử lại.

    Chỉ xoá khi trạng thái CÒN fetching — nếu đã có kết quả cuối thì giữ nguyên.
    """
    _check_type(place_type)
    execute_query(
        "DELETE FROM place_enrichments "
        "WHERE place_type = %s AND place_id = %s AND status = 'fetching'",
        (place_type, place_id),
    )


def ensure_schema() -> None:
    """Tạo bảng nếu chưa có (idempotent). Bản sao của db/init.sql."""
    execute_query(
        """
        CREATE TABLE IF NOT EXISTS place_enrichments (
            id           BIGSERIAL PRIMARY KEY,
            place_type   VARCHAR(20) NOT NULL,
            place_id     INTEGER NOT NULL,
            provider     VARCHAR(30) NOT NULL DEFAULT 'tavily',
            status       VARCHAR(20) NOT NULL,
            summary      TEXT,
            opening_hours JSONB,
            rating       JSONB,
            review_highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
            images       JSONB NOT NULL DEFAULT '[]'::jsonb,
            sources      JSONB NOT NULL DEFAULT '[]'::jsonb,
            raw_response JSONB,
            fetched_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            started_at   TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (place_type, place_id),
            CHECK (place_type IN ('poi', 'accommodation')),
            CHECK (status IN ('fetching', 'success', 'not_found'))
        )
        """
    )
