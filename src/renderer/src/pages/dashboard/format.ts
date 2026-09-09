export const UP_COLOR = '#ef5350'
export const DOWN_COLOR = '#26a69a'

export function yyyymmddToChartTime(value: string): string {
  if (value.length !== 8) {
    return value
  }
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`
}

export function formatYi(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  })
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

export function formatSignedYi(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

export function signedColor(value: number | null | undefined): string {
  if (value == null || value === 0) {
    return 'inherit'
  }
  return value > 0 ? UP_COLOR : DOWN_COLOR
}
