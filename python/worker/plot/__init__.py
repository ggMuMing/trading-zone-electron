"""Plot dialect: build ChartInput primitives + series (not a formula language)."""

from __future__ import annotations

from worker.plot.builders import histogram, line, output, subplot
from worker.plot.models import ChartInput
from worker.plot.validate import ChartInputValidationError, validate_chart_input

__all__ = [
    "ChartInput",
    "ChartInputValidationError",
    "histogram",
    "line",
    "output",
    "subplot",
    "validate_chart_input",
]
