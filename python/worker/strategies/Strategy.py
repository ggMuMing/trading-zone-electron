from abc import ABC, abstractmethod


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
    def output_result(self):
        pass

    def run(self):
        self.read_data()
        self.compute_algorithm()
        self.analyze_result()
        self.output_result()
