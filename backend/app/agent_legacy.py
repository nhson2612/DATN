"""Giữ lại để tương thích: nguồn thật là app/research/agent_legacy.py."""

from app.research.agent_legacy import *  # noqa: F401,F403
from app.research import agent_legacy as _mod
import sys as _sys
_sys.modules[__name__] = _mod
