"""Giữ lại để tương thích: nguồn thật là app/research/gold_templates.py."""

from app.research.gold_templates import *  # noqa: F401,F403
from app.research import gold_templates as _mod
import sys as _sys
_sys.modules[__name__] = _mod
