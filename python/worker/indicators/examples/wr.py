def _window_extreme(values, period, pick):
    out = [None] * len(values)
    for i in range(len(values)):
        if i < period - 1:
            continue
        out[i] = pick(values[i - period + 1 : i + 1])
    return out


class WR(Indicator):
    key = "wr"
    title = "WR"
    overlay = False

    def inputs(self):
        self.n = input.int(14, "周期", min=1)

    def compute(self, ohlcv: Ohlcv) -> None:
        highest = _window_extreme(ohlcv.high, self.n, max)
        lowest = _window_extreme(ohlcv.low, self.n, min)
        wr = []
        for close, high_n, low_n in zip(ohlcv.close, highest, lowest, strict=True):
            if high_n is None or low_n is None:
                wr.append(None)
                continue
            span = high_n - low_n
            wr.append(0.0 if span == 0 else (high_n - close) / span * -100.0)
        yrange(-100, 0)
        plot(wr, "WR", color="#2962FF", linewidth=1)


indicator = WR
