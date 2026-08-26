"""Giữ lại để tương thích: nguồn thật là app/research/ir_agent.py."""

from app.research.ir_agent import *  # noqa: F401,F403
from app.research import ir_agent as _mod
import sys as _sys
_sys.modules[__name__] = _mod
