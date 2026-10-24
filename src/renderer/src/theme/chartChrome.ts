import { useColorMode, type ColorMode } from './colorMode'
import { LWC_FONT_STACK } from './lwcFont'
import type { ChartOptions, DeepPartial } from 'lightweight-charts'

/** 图表图标悬停色，两种模式共用。 */
export const CHART_ICON_HOVER = '#ed6c02'

export interface ChartChrome {
  background: string
  text: string
  grid: string
  scaleBorder: string
  crosshair: string
  crosshairLabel: string
  legendBg: string
  legendLabel: string
  legendHoverBg: string
  legendHoverBorder: string
  icon: string
  iconBg: string
  iconBorder: string
  iconHoverBg: string
  highlightNeutral: string
  seriesBlue: string
}

export const CHART_CHROME: Record<ColorMode, ChartChrome> = {
  light: {
    background: '#ffffff',
    text: '#333333',
    grid: '#eeeeee',
    scaleBorder: '#e0e0e0',
    crosshair: '#9e9e9e',
    crosshairLabel: '#333333',
    legendBg: 'rgba(255, 255, 255, 0.85)',
    legendLabel: 'rgba(0, 0, 0, 0.55)',
    legendHoverBg: 'rgba(255, 255, 255, 0.96)',
    legendHoverBorder: 'rgba(0, 0, 0, 0.16)',
    icon: 'rgba(0, 0, 0, 0.45)',
    iconBg: 'rgba(255, 255, 255, 0.92)',
    iconBorder: 'rgba(0, 0, 0, 0.22)',
    iconHoverBg: 'rgba(0, 0, 0, 0.06)',
    highlightNeutral: 'rgba(0, 0, 0, 0.08)',
    seriesBlue: '#1976d2'
  },
  dark: {
    background: '#1c1f24',
    text: '#d0cdc8',
    grid: '#2a2e34',
    scaleBorder: '#3a3f46',
    crosshair: '#6b7078',
    crosshairLabel: '#e8e6e3',
    legendBg: 'rgba(28, 31, 36, 0.88)',
    legendLabel: 'rgba(255, 255, 255, 0.62)',
    legendHoverBg: 'rgba(28, 31, 36, 0.96)',
    legendHoverBorder: 'rgba(255, 255, 255, 0.16)',
    icon: 'rgba(255, 255, 255, 0.55)',
    iconBg: 'rgba(28, 31, 36, 0.92)',
    iconBorder: 'rgba(255, 255, 255, 0.22)',
    iconHoverBg: 'rgba(255, 255, 255, 0.08)',
    highlightNeutral: 'rgba(255, 255, 255, 0.10)',
    seriesBlue: '#64b5f6'
  }
}

export function useChartChrome(): ChartChrome {
  const { mode } = useColorMode()
  return CHART_CHROME[mode]
}

/** 只含外壳色。调用方继续传宽度、偏移、坐标轴是否可见。 */
export function lwcChromeOptions(chrome: ChartChrome): DeepPartial<ChartOptions> {
  return {
    layout: {
      background: { color: chrome.background },
      textColor: chrome.text,
      fontFamily: LWC_FONT_STACK
    },
    grid: {
      vertLines: { color: chrome.grid },
      horzLines: { color: chrome.grid }
    },
    leftPriceScale: { borderColor: chrome.scaleBorder },
    rightPriceScale: { borderColor: chrome.scaleBorder },
    timeScale: { borderColor: chrome.scaleBorder },
    crosshair: {
      vertLine: { color: chrome.crosshair, labelBackgroundColor: chrome.crosshairLabel },
      horzLine: { color: chrome.crosshair, labelBackgroundColor: chrome.crosshairLabel }
    }
  }
}
