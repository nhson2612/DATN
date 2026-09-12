"""Compatibility entry point for place search.

POI search is provided by Serper Places. This module intentionally contains no
local taxonomy, stop-word list, place-name list, or GIS-table fallback.
"""

from app.services.serper_service import search_places

DEFAULT_LIMIT = 20


def search(question: str, lon: float, lat: float, limit: int = DEFAULT_LIMIT):
    rows = search_places(question, lat, lon, limit)
    return {
        "results": rows,
        "anchor": None,
        "keywords": question,
        "che_do": "serper",
    }
