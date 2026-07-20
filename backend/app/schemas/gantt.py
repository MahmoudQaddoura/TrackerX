from __future__ import annotations

"""
schemas/gantt.py
frappe-gantt-shaped task rows for a single project.
"""

from pydantic import BaseModel


class GanttTask(BaseModel):
    id: str
    name: str
    start: str  # ISO date
    end: str  # ISO date
    progress: int  # 0–100
    custom_class: str  # e.g. 'gantt-delayed-bar'
