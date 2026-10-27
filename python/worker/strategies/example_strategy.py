class Breakout(StrategyScript):
    def declare(self):
        self.period = param.int(20, "突破周期", min=2)

    def compute(self, daily):
        high_prev = daily["high"].shift(1).rolling(self.period).max()
        low_prev = daily["low"].shift(1).rolling(self.period).min()
        out = daily.copy()
        out["buy_signal"] = out["close"] > high_prev
        out["sell_signal"] = out["close"] < low_prev
        return out


strategy = Breakout
