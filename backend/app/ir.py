"""Giữ lại để tương thích: nguồn thật là app/research/ir.py."""

from app.research.ir import *  # noqa: F401,F403
from app.research import ir as _mod
import sys as _sys
_sys.modules[__name__] = _mod
