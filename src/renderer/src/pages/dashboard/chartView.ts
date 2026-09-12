import type { IChartApi, Time } from 'lightweight-charts'
import { oneYearAgoYyyymmdd } from '../../../../shared/constants/market'
import { yyyymmddToChartTime } from './format'

/** Top pane (lines) vs bottom pane (histogram) stretch. Bottom is taller. */
export const DASHBOARD_PANE_TOP_STRETCH = 1.15
export const DASHBOARD_PANE_BOTTOM_STRETCH = 1.65

function yyyymmddToDate(value: string): Date {
  return new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(4, 6)) - 1,
    Number(value.slice(6, 8))
  )
}

/** Show the last year ending at the latest bar; clamp if the series is shorter. */
export function applyLastYearVisibleRange(chart: IChartApi, tradeDates: string[]): void {
  const dates = tradeDates.filter((value) => value.length === 8)
  if (dates.length === 0) {
    return
  }
  const end = dates[dates.length - 1]
  if (dates.length === 1) {
    chart.timeScale().fitContent()
    return
  }
  const oneYearAgo = oneYearAgoYyyymmdd(yyyymmddToDate(end))
  const start = dates[0] > oneYearAgo ? dates[0] : oneYearAgo
  try {
    chart.timeScale().setVisibleRange({
      from: yyyymmddToChartTime(start) as Time,
      to: yyyymmddToChartTime(end) as Time
    })
  } catch {
    chart.timeScale().fitContent()
  }
}
