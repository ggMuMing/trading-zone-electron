def _hhv(values, period):
    out = [None] * len(values)
    for i in range(len(values)):
        if i < period - 1:
            continue
        out[i] = max(values[i - period + 1 : i + 1])
    return out


def _llv(values, period):
    out = [None] * len(values)
    for i in range(len(values)):
        if i < period - 1:
            continue
        out[i] = min(values[i - period + 1 : i + 1])
    return out


def _sma_aligned(values, period):
    compact = []
    index = []
    for i, value in enumerate(values):
        if value is not None:
            compact.append(value)
            index.append(i)
    smoothed = sma(compact, period)
    out = [None] * len(values)
    for j, idx in enumerate(index):
        out[idx] = smoothed[j]
    return out


class KDJ(Indicator):
    key = "kdj"
    title = "KDJ"
    overlay = False

    def inputs(self):
        self.n = input.int(9, "周期", min=1)
        self.m1 = input.int(3, "K平滑", min=1)
        self.m2 = input.int(3, "D平滑", min=1)

    def compute(self, ohlcv: Ohlcv) -> None:
        highest = _hhv(ohlcv.high, self.n)
        lowest = _llv(ohlcv.low, self.n)
        rsv = []
        for close, high_n, low_n in zip(ohlcv.close, highest, lowest, strict=True):
            if high_n is None or low_n is None:
                rsv.append(None)
                continue
            span = high_n - low_n
            rsv.append(50.0 if span == 0 else (close - low_n) / span * 100.0)

        k = _sma_aligned(rsv, self.m1)
        d = _sma_aligned(k, self.m2)
        j = [
            None if k_v is None or d_v is None else 3.0 * k_v - 2.0 * d_v
            for k_v, d_v in zip(k, d, strict=True)
        ]

        plot(k, "K", color="#f5a623", linewidth=1)
        plot(d, "D", color="#4a90d9", linewidth=1)
        plot(j, "J", color="#e040fb", linewidth=1)


indicator = KDJ
