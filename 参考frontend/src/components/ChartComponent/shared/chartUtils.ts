import type { IChartApi } from 'lightweight-charts'
import type { ChartIndicatorSeriesSpec, ChartLayoutIndicatorInstance, StockDailyData } from '../../../api/apiType'
import { downColor, upColor } from '../../../static'

/** 主图（K 线+成交量）相对副图的垂直占比权重 */
export const MAIN_PANE_STRETCH_FACTOR = 3
/** 各副图之间等高比例 */
export const SUB_PANE_STRETCH_FACTOR = 1
/** 最新 K 线右侧预留的空白柱数 */
export const TIME_SCALE_RIGHT_OFFSET_BARS = 12

export function applyPaneStretchLayout(chart: IChartApi) {
    const panes = chart.panes()
    if (panes.length === 0) return
    panes[0].setStretchFactor(MAIN_PANE_STRETCH_FACTOR)
    for (let i = 1; i < panes.length; i++) {
        panes[i].setStretchFactor(SUB_PANE_STRETCH_FACTOR)
    }
}

export function getIndicatorTargetPaneIndex(panelIndex: number, indicator: ChartLayoutIndicatorInstance) {
    return panelIndex === 0 || indicator.panel_index === 0 ? 0 : panelIndex
}

export function normalizeChartDisplayDate(date: string): string {
    const raw = String(date).trim().replace(/-/g, '')
    if (raw.length !== 8) return String(date).trim()
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}

export function buildChartDateSet(chartData: StockDailyData[]): Set<string> {
    return new Set(chartData.map(item => normalizeChartDisplayDate(item.trade_date)))
}

export function filterIndicatorRowsToChartData(
    rows: Record<string, string | number | null>[],
    chartData: StockDailyData[],
): Record<string, string | number | null>[] {
    if (chartData.length === 0) return []
    const dateSet = buildChartDateSet(chartData)
    return rows.filter(row => dateSet.has(normalizeChartDisplayDate(String(row.date ?? ''))))
}

export function mapRowsToSeriesData(
    rows: Record<string, string | number | null>[],
    seriesSpec: ChartIndicatorSeriesSpec,
    indicator: ChartLayoutIndicatorInstance,
) {
    if (seriesSpec.plot_type === 'candlestick') {
        return rows
            .map(row => {
                const open = row[`${seriesSpec.key}_open`]
                const high = row[`${seriesSpec.key}_high`]
                const low = row[`${seriesSpec.key}_low`]
                const close = row[`${seriesSpec.key}_close`]
                const color = row[`${seriesSpec.key}_color`]
                if (
                    typeof open !== 'number'
                    || typeof high !== 'number'
                    || typeof low !== 'number'
                    || typeof close !== 'number'
                ) return null
                const candleColor = typeof color === 'string' ? color : close >= open ? upColor : downColor
                return {
                    time: String(row.date),
                    open,
                    high,
                    low,
                    close,
                    color: candleColor,
                    borderColor: candleColor,
                    wickColor: candleColor,
                }
            })
            .filter((item): item is {
                time: string,
                open: number,
                high: number,
                low: number,
                close: number,
                color: string,
                borderColor: string,
                wickColor: string,
            } => item !== null)
    }

    return rows
        .map(row => {
            const value = row[seriesSpec.key]
            if (typeof value !== 'number') return null
            const isMacdHistogram =
                indicator.indicator_id === 'macd'
                && seriesSpec.plot_type === 'histogram'
                && (seriesSpec.key === 'MACD' || seriesSpec.key === 'macd')
            return {
                time: String(row.date),
                value,
                ...(isMacdHistogram ? { color: value >= 0 ? upColor : downColor } : {}),
            }
        })
        .filter((item): item is { time: string, value: number, color?: string } => item !== null)
}
