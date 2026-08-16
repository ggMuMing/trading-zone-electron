export interface BacktestInterval {
  entry_date: string
  exit_date: string
  entry_price: number
  exit_price: number
  duration: number
  max_gain_pct: number
  max_drawdown_pct: number
  return_pct: number
}

export interface BacktestResult {
  symbol: string
  adjust: 'qfq' | 'hfq' | 'standard'
  data_range?: {
    start: string
    end: string
  }
  params?: Record<string, unknown>
  interval_count?: number
  summary?: {
    avg_duration: number
    avg_max_gain_pct: number
    avg_max_drawdown_pct: number
    avg_return_pct: number
  }
  intervals: BacktestInterval[]
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isValidInterval(value: unknown): value is BacktestInterval {
  if (!isRecord(value)) return false
  return (
    typeof value.entry_date === 'string'
    && DATE_PATTERN.test(value.entry_date)
    && typeof value.exit_date === 'string'
    && DATE_PATTERN.test(value.exit_date)
    && isNumber(value.entry_price)
    && isNumber(value.exit_price)
    && isNumber(value.duration)
    && isNumber(value.max_gain_pct)
    && isNumber(value.max_drawdown_pct)
    && isNumber(value.return_pct)
  )
}

export function parseBacktestResultJson(raw: unknown): { data: BacktestResult } | { error: string } {
  if (!isRecord(raw)) {
    return { error: 'JSON 根节点必须是对象' }
  }

  if (typeof raw.symbol !== 'string' || !raw.symbol.trim()) {
    return { error: '缺少有效的 symbol 字段' }
  }

  const adjustRaw = typeof raw.adjust === 'string' ? raw.adjust : 'qfq'
  if (adjustRaw !== 'qfq' && adjustRaw !== 'hfq' && adjustRaw !== 'standard') {
    return { error: 'adjust 必须是 qfq、hfq 或 standard' }
  }

  if (!Array.isArray(raw.intervals)) {
    return { error: '缺少 intervals 数组' }
  }

  if (raw.intervals.length === 0) {
    return { error: 'intervals 不能为空' }
  }

  for (let i = 0; i < raw.intervals.length; i += 1) {
    if (!isValidInterval(raw.intervals[i])) {
      return { error: `intervals[${i}] 格式不正确，请检查日期与数值字段` }
    }
  }

  const result: BacktestResult = {
    symbol: raw.symbol.trim(),
    adjust: adjustRaw,
    intervals: raw.intervals as BacktestInterval[],
  }

  if (isRecord(raw.data_range)) {
    result.data_range = {
      start: String(raw.data_range.start ?? ''),
      end: String(raw.data_range.end ?? ''),
    }
  }

  if (isRecord(raw.params)) {
    result.params = raw.params
  }

  if (typeof raw.interval_count === 'number') {
    result.interval_count = raw.interval_count
  }

  if (isRecord(raw.summary)) {
    const summary = raw.summary
    if (
      isNumber(summary.avg_duration)
      && isNumber(summary.avg_max_gain_pct)
      && isNumber(summary.avg_max_drawdown_pct)
      && isNumber(summary.avg_return_pct)
    ) {
      result.summary = {
        avg_duration: summary.avg_duration,
        avg_max_gain_pct: summary.avg_max_gain_pct,
        avg_max_drawdown_pct: summary.avg_max_drawdown_pct,
        avg_return_pct: summary.avg_return_pct,
      }
    }
  }

  return { data: result }
}
