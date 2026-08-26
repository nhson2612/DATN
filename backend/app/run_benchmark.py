"""Giữ lại để tương thích: nguồn thật là app/research/run_benchmark.py."""

from app.research.run_benchmark import *  # noqa: F401,F403
from app.research import run_benchmark as _mod
import sys as _sys
_sys.modules[__name__] = _mod
