from abc import ABC, abstractmethod
from typing import Any


class StrategyClass(ABC):
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
