from abc import ABC, abstractmethod
from typing import Any

from worker.strategies.params import StrategyParam, coerce_parameters


class StrategyClass(ABC):
    parameters: tuple[StrategyParam, ...] = ()

    def apply_parameters(self, params: dict[str, Any] | None = None) -> None:
        resolved = coerce_parameters(self.parameters, params)
        for name, value in resolved.items():
            setattr(self, name, value)

    @abstractmethod
    def read_data(self):
        pass

    @abstractmethod
    def compute_algorithm(self):
        pass

    @abstractmethod
    def analyze_result(self):
        pass

    @abstractmethod
    def output_result(self) -> dict[str, Any]:
        pass

    def run(self) -> dict[str, Any]:
        self.read_data()
        self.compute_algorithm()
        self.analyze_result()
        return self.output_result()
