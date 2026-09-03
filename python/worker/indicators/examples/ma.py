class MA(Indicator):
    key = "ma"
    title = "均线"
    overlay = True

    def inputs(self):
        self.period1 = input.int(5, "周期1", min=1)
        self.period2 = input.int(10, "周期2", min=1)
        self.period3 = input.int(20, "周期3", min=1)
        self.period4 = input.int(60, "周期4", min=1)
        self.period5 = input.int(250, "周期5", min=1)

    def compute(self, ohlcv: Ohlcv) -> None:
        plot(sma(ohlcv.close, self.period1), "MA1", color="#FF9800", linewidth=1)
        plot(sma(ohlcv.close, self.period2), "MA2", color="#26A69A", linewidth=1)
        plot(sma(ohlcv.close, self.period3), "MA3", color="#2962FF", linewidth=2)
        plot(sma(ohlcv.close, self.period4), "MA4", color="#AB47BC", linewidth=1)
        plot(sma(ohlcv.close, self.period5), "MA5", color="#7E57C2", linewidth=1)


indicator = MA
