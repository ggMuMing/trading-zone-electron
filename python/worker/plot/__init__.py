"""Plot dialect: build ChartInput primitives + series (not a formula language)."""

from __future__ import annotations

from worker.plot.builders import PlotFragment, histogram, line, output, overlay, subplot
from worker.plot.models import ChartInput
from worker.plot.validate import ChartInputValidationError, validate_chart_input

__all__ = [
    "ChartInput",
    "ChartInputValidationError",
    "PlotFragment",
    "histogram",
    "line",
    "output",
    "overlay",
    "subplot",
    "validate_chart_input",
]
