import {
  CHART_INPUT_SCHEMA_VERSION,
  ISO_DATE_PATTERN,
  type CandlePoint,
  type ChartInput,
  type PlotKind,
  type PlotPrimitive,
  type PlotPrimitiveStyle,
  type ValuePoint,
  type VolumePoint
} from '../types/chart'

export interface ChartInputIssue {
  path: string
  message: string
}

export type ChartInputValidation =
  | { ok: true; value: ChartInput }
  | { ok: false; issues: ChartInputIssue[] }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value)
}

function push(issues: ChartInputIssue[], path: string, message: string): void {
  issues.push({ path, message })
}

function assertSortedUniqueTimes(
  issues: ChartInputIssue[],
  path: string,
  times: string[],
  domain: Set<string>
): void {
  for (let i = 0; i < times.length; i += 1) {
    const time = times[i]
    if (!domain.has(time)) {
      push(issues, `${path}[${i}].time`, `time ${time} is not in timeDomain`)
    }
    if (i > 0 && time <= times[i - 1]) {
      push(issues, `${path}[${i}].time`, 'times must be strictly ascending and unique')
    }
  }
}

function readStyle(raw: unknown, path: string, issues: ChartInputIssue[]): PlotPrimitiveStyle | undefined {
  if (raw === undefined) {
    return undefined
  }
  if (!isRecord(raw)) {
    push(issues, path, 'style must be an object')
    return undefined
  }
  const extra = Object.keys(raw).filter((key) => key !== 'color' && key !== 'lineWidth')
  if (extra.length > 0) {
    push(issues, path, `unexpected keys: ${extra.join(', ')}`)
  }
  const style: PlotPrimitiveStyle = {}
  if (raw.color !== undefined) {
    if (typeof raw.color !== 'string' || raw.color.length === 0) {
      push(issues, `${path}.color`, 'must be a non-empty string')
    } else {
      style.color = raw.color
    }
  }
  if (raw.lineWidth !== undefined) {
    if (typeof raw.lineWidth !== 'number' || !Number.isInteger(raw.lineWidth) || raw.lineWidth < 1 || raw.lineWidth > 4) {
      push(issues, `${path}.lineWidth`, 'must be an integer from 1 to 4')
    } else {
      style.lineWidth = raw.lineWidth
    }
  }
  return style
}

function readCandle(raw: unknown, path: string, issues: ChartInputIssue[]): CandlePoint | null {
  if (!isRecord(raw)) {
    push(issues, path, 'must be an object')
    return null
  }
  const extra = Object.keys(raw).filter(
    (key) => !['time', 'open', 'high', 'low', 'close', 'vol', 'amount'].includes(key)
  )
  if (extra.length > 0) {
    push(issues, path, `unexpected keys: ${extra.join(', ')}`)
  }
  if (!isIsoDate(raw.time)) {
    push(issues, `${path}.time`, 'must be YYYY-MM-DD')
  }
  for (const field of ['open', 'high', 'low', 'close'] as const) {
    if (!isFiniteNumber(raw[field])) {
      push(issues, `${path}.${field}`, 'must be a finite number')
    }
  }
  let vol: number | null | undefined
  if (raw.vol !== undefined && raw.vol !== null) {
    if (!isFiniteNumber(raw.vol)) {
      push(issues, `${path}.vol`, 'must be a finite number or null')
    } else {
      vol = raw.vol
    }
  } else {
    vol = raw.vol as null | undefined
  }
  let amount: number | null | undefined
  if (raw.amount !== undefined && raw.amount !== null) {
    if (!isFiniteNumber(raw.amount)) {
      push(issues, `${path}.amount`, 'must be a finite number or null')
    } else {
      amount = raw.amount
    }
  } else {
    amount = raw.amount as null | undefined
  }
  if (!isIsoDate(raw.time) || !isFiniteNumber(raw.open) || !isFiniteNumber(raw.high) || !isFiniteNumber(raw.low) || !isFiniteNumber(raw.close)) {
    return null
  }
  if (raw.high < raw.low) {
    push(issues, `${path}.high`, 'high must be >= low')
  }
  const point: CandlePoint = {
    time: raw.time,
    open: raw.open,
    high: raw.high,
    low: raw.low,
    close: raw.close
  }
  if (vol !== undefined) {
    point.vol = vol
  }
  if (amount !== undefined) {
    point.amount = amount
  }
  return point
}

function readVolume(raw: unknown, path: string, issues: ChartInputIssue[]): VolumePoint | null {
  if (!isRecord(raw)) {
    push(issues, path, 'must be an object')
    return null
  }
  if (!isIsoDate(raw.time)) {
    push(issues, `${path}.time`, 'must be YYYY-MM-DD')
  }
  if (!isFiniteNumber(raw.value)) {
    push(issues, `${path}.value`, 'must be a finite number')
  }
  if (typeof raw.color !== 'string' || raw.color.length === 0) {
    push(issues, `${path}.color`, 'must be a non-empty string')
  }
  if (!isIsoDate(raw.time) || !isFiniteNumber(raw.value) || typeof raw.color !== 'string' || raw.color.length === 0) {
    return null
  }
  return { time: raw.time, value: raw.value, color: raw.color }
}

function readValuePoint(raw: unknown, path: string, issues: ChartInputIssue[]): ValuePoint | null {
  if (!isRecord(raw)) {
    push(issues, path, 'must be an object')
    return null
  }
  if (!isIsoDate(raw.time)) {
    push(issues, `${path}.time`, 'must be YYYY-MM-DD')
  }
  if (!isFiniteNumber(raw.value)) {
    push(issues, `${path}.value`, 'must be a finite number')
  }
  if (raw.color !== undefined && (typeof raw.color !== 'string' || raw.color.length === 0)) {
    push(issues, `${path}.color`, 'must be a non-empty string')
  }
  if (!isIsoDate(raw.time) || !isFiniteNumber(raw.value)) {
    return null
  }
  const point: ValuePoint = { time: raw.time, value: raw.value }
  if (typeof raw.color === 'string' && raw.color.length > 0) {
    point.color = raw.color
  }
  return point
}

function readPrimitive(raw: unknown, path: string, issues: ChartInputIssue[]): PlotPrimitive | null {
  if (!isRecord(raw)) {
    push(issues, path, 'must be an object')
    return null
  }
  const extra = Object.keys(raw).filter((key) => !['id', 'pane', 'kind', 'style'].includes(key))
  if (extra.length > 0) {
    push(issues, path, `unexpected keys: ${extra.join(', ')}`)
  }
  if (typeof raw.id !== 'string' || raw.id.length === 0) {
    push(issues, `${path}.id`, 'must be a non-empty string')
  }
  if (typeof raw.pane !== 'string' || raw.pane.length === 0) {
    push(issues, `${path}.pane`, 'must be a non-empty string')
  }
  if (raw.kind !== 'line' && raw.kind !== 'histogram') {
    push(issues, `${path}.kind`, 'must be line or histogram')
  }
  const style = readStyle(raw.style, `${path}.style`, issues)
  if (typeof raw.id !== 'string' || raw.id.length === 0 || typeof raw.pane !== 'string' || raw.pane.length === 0) {
    return null
  }
  if (raw.kind !== 'line' && raw.kind !== 'histogram') {
    return null
  }
  if (raw.pane === 'main' && raw.kind === 'histogram') {
    push(issues, `${path}.kind`, 'histogram on pane main is reserved for first-class volume')
  }
  const primitive: PlotPrimitive = {
    id: raw.id,
    pane: raw.pane,
    kind: raw.kind as PlotKind
  }
  if (style && Object.keys(style).length > 0) {
    primitive.style = style
  }
  return primitive
}

export function validateChartInput(input: unknown): ChartInputValidation {
  const issues: ChartInputIssue[] = []
  if (!isRecord(input)) {
    return { ok: false, issues: [{ path: '', message: 'ChartInput must be an object' }] }
  }

  const extra = Object.keys(input).filter(
    (key) => !['schemaVersion', 'timeDomain', 'candle', 'volume', 'primitives', 'series'].includes(key)
  )
  if (extra.length > 0) {
    push(issues, '', `unexpected keys: ${extra.join(', ')}`)
  }

  if (input.schemaVersion !== CHART_INPUT_SCHEMA_VERSION) {
    push(issues, 'schemaVersion', `must be ${CHART_INPUT_SCHEMA_VERSION}`)
  }

  if (!Array.isArray(input.timeDomain) || input.timeDomain.length === 0) {
    push(issues, 'timeDomain', 'must be a non-empty array')
    return { ok: false, issues }
  }

  const timeDomain: string[] = []
  for (let i = 0; i < input.timeDomain.length; i += 1) {
    const time = input.timeDomain[i]
    if (!isIsoDate(time)) {
      push(issues, `timeDomain[${i}]`, 'must be YYYY-MM-DD')
      continue
    }
    if (i > 0 && time <= timeDomain[timeDomain.length - 1]) {
      push(issues, `timeDomain[${i}]`, 'must be strictly ascending and unique')
    }
    timeDomain.push(time)
  }
  const domain = new Set(timeDomain)

  if (!Array.isArray(input.candle) || input.candle.length === 0) {
    push(issues, 'candle', 'must be a non-empty array')
    return { ok: false, issues }
  }

  const candle: CandlePoint[] = []
  for (let i = 0; i < input.candle.length; i += 1) {
    const point = readCandle(input.candle[i], `candle[${i}]`, issues)
    if (point) {
      candle.push(point)
    }
  }
  if (candle.length !== timeDomain.length) {
    push(issues, 'candle', 'length must equal timeDomain length')
  } else {
    for (let i = 0; i < candle.length; i += 1) {
      if (candle[i].time !== timeDomain[i]) {
        push(issues, `candle[${i}].time`, 'must match timeDomain at the same index')
      }
    }
  }

  let volume: VolumePoint[] | undefined
  if (input.volume !== undefined) {
    if (!Array.isArray(input.volume)) {
      push(issues, 'volume', 'must be an array')
    } else {
      volume = []
      for (let i = 0; i < input.volume.length; i += 1) {
        const point = readVolume(input.volume[i], `volume[${i}]`, issues)
        if (point) {
          volume.push(point)
        }
      }
      assertSortedUniqueTimes(issues, 'volume', volume.map((point) => point.time), domain)
    }
  }

  if (!Array.isArray(input.primitives)) {
    push(issues, 'primitives', 'must be an array')
    return { ok: false, issues }
  }
  if (!isRecord(input.series)) {
    push(issues, 'series', 'must be an object')
    return { ok: false, issues }
  }

  const primitives: PlotPrimitive[] = []
  const ids = new Set<string>()
  for (let i = 0; i < input.primitives.length; i += 1) {
    const primitive = readPrimitive(input.primitives[i], `primitives[${i}]`, issues)
    if (!primitive) {
      continue
    }
    if (ids.has(primitive.id)) {
      push(issues, `primitives[${i}].id`, `duplicate id ${primitive.id}`)
    }
    ids.add(primitive.id)
    primitives.push(primitive)
  }

  const seriesKeys = Object.keys(input.series)
  for (const key of seriesKeys) {
    if (!ids.has(key)) {
      push(issues, `series.${key}`, 'has no matching primitive id')
    }
  }
  for (const id of ids) {
    if (!Object.prototype.hasOwnProperty.call(input.series, id)) {
      push(issues, `series.${id}`, 'missing series for primitive id')
    }
  }

  const series: Record<string, ValuePoint[]> = {}
  for (const primitive of primitives) {
    const rawPoints = input.series[primitive.id]
    if (!Array.isArray(rawPoints)) {
      if (rawPoints !== undefined) {
        push(issues, `series.${primitive.id}`, 'must be an array')
      }
      continue
    }
    const points: ValuePoint[] = []
    for (let i = 0; i < rawPoints.length; i += 1) {
      const point = readValuePoint(rawPoints[i], `series.${primitive.id}[${i}]`, issues)
      if (point) {
        points.push(point)
      }
    }
    assertSortedUniqueTimes(issues, `series.${primitive.id}`, points.map((point) => point.time), domain)
    series[primitive.id] = points
  }

  if (issues.length > 0) {
    return { ok: false, issues }
  }

  const value: ChartInput = {
    schemaVersion: CHART_INPUT_SCHEMA_VERSION,
    timeDomain,
    candle,
    primitives,
    series
  }
  if (volume !== undefined) {
    value.volume = volume
  }
  return { ok: true, value }
}
