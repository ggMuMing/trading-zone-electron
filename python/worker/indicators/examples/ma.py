class MA(Indicator):
    key: ClassVar[str] = "ma"
    title: ClassVar[str] = "均线"
    period1: int = Field(default=5, ge=1, json_schema_extra={"widget": "int", "title": "周期1"})
    color1: str = Field(
        default="#FF9800",
        min_length=1,
        json_schema_extra={"widget": "color", "title": "颜色1"},
    )
    lineWidth1: int = Field(
        default=1,
        ge=1,
        le=4,
        json_schema_extra={"widget": "lineWidth", "title": "线宽1"},
    )
    period2: int = Field(default=10, ge=1, json_schema_extra={"widget": "int", "title": "周期2"})
    color2: str = Field(
        default="#26A69A",
        min_length=1,
        json_schema_extra={"widget": "color", "title": "颜色2"},
    )
    lineWidth2: int = Field(
        default=1,
        ge=1,
        le=4,
        json_schema_extra={"widget": "lineWidth", "title": "线宽2"},
    )
    period3: int = Field(default=20, ge=1, json_schema_extra={"widget": "int", "title": "周期3"})
    color3: str = Field(
        default="#2962FF",
        min_length=1,
        json_schema_extra={"widget": "color", "title": "颜色3"},
    )
    lineWidth3: int = Field(
        default=2,
        ge=1,
        le=4,
        json_schema_extra={"widget": "lineWidth", "title": "线宽3"},
    )
    period4: int = Field(default=60, ge=1, json_schema_extra={"widget": "int", "title": "周期4"})
    color4: str = Field(
        default="#AB47BC",
        min_length=1,
        json_schema_extra={"widget": "color", "title": "颜色4"},
    )
    lineWidth4: int = Field(
        default=1,
        ge=1,
        le=4,
        json_schema_extra={"widget": "lineWidth", "title": "线宽4"},
    )
    period5: int = Field(default=250, ge=1, json_schema_extra={"widget": "int", "title": "周期5"})
    color5: str = Field(
        default="#7E57C2",
        min_length=1,
        json_schema_extra={"widget": "color", "title": "颜色5"},
    )
    lineWidth5: int = Field(
        default=1,
        ge=1,
        le=4,
        json_schema_extra={"widget": "lineWidth", "title": "线宽5"},
    )

    def compute(self, ohlcv: Ohlcv) -> PlotFragment:
        return overlay(
            line(
                f"ma{self.period1}",
                sma(ohlcv.close, self.period1),
                times=ohlcv.time,
                color=self.color1,
                line_width=self.lineWidth1,
            ),
            line(
                f"ma{self.period2}",
                sma(ohlcv.close, self.period2),
                times=ohlcv.time,
                color=self.color2,
                line_width=self.lineWidth2,
            ),
            line(
                f"ma{self.period3}",
                sma(ohlcv.close, self.period3),
                times=ohlcv.time,
                color=self.color3,
                line_width=self.lineWidth3,
            ),
            line(
                f"ma{self.period4}",
                sma(ohlcv.close, self.period4),
                times=ohlcv.time,
                color=self.color4,
                line_width=self.lineWidth4,
            ),
            line(
                f"ma{self.period5}",
                sma(ohlcv.close, self.period5),
                times=ohlcv.time,
                color=self.color5,
                line_width=self.lineWidth5,
            ),
        )


indicator = MA
