import { ISO_DATE_PATTERN } from './chart'

export const DRAWING_COLOR = '#2962FF'
export const DRAWING_LINE_WIDTH = 1
export const DRAWING_LINE_STYLE = 'solid' as const
export const DRAWING_PREVIEW_ID = '__preview__'

export type DrawingLineWidth = 1 | 2 | 3 | 4
export type DrawingLineStyle = 'solid' | 'dashed' | 'dotted'

export interface DrawingStroke {
  color: string
  lineStyle: DrawingLineStyle
  lineWidth: DrawingLineWidth
}

export const DEFAULT_DRAWING_STROKE: DrawingStroke = {
  color: DRAWING_COLOR,
  lineStyle: DRAWING_LINE_STYLE,
  lineWidth: DRAWING_LINE_WIDTH
}
export type DrawingTool = 'hline' | 'trend' | 'hsegment' | 'xline' | 'rect'
export type DrawingHandle = 'line' | 'a' | 'b'
export type TwoPointKind = 'trend' | 'hsegment' | 'xline' | 'rect'

export interface DrawingPoint {
  time: string
  price: number
}

export interface HLineDrawing {
  id: string
  kind: 'hline'
  price: number
  /** 最近一次点击所在的 K 线日期，选中时用来画圆点。旧数据可以没有。 */
  time?: string
  color: string
  lineStyle: DrawingLineStyle
  lineWidth: DrawingLineWidth
}

export interface TwoPointDrawing {
  id: string
  kind: TwoPointKind
  a: DrawingPoint
  b: DrawingPoint
  color: string
  lineStyle: DrawingLineStyle
  lineWidth: DrawingLineWidth
}

export type ChartDrawing = HLineDrawing | TwoPointDrawing

export interface DrawingHit {
  id: string
  handle: DrawingHandle | 'body'
}

const LINE_WIDTHS: readonly DrawingLineWidth[] = [1, 2, 3, 4]
const LINE_STYLES: readonly DrawingLineStyle[] = ['solid', 'dashed', 'dotted']
const TWO_POINT_KINDS: readonly TwoPointKind[] = ['trend', 'hsegment', 'xline', 'rect']

export function parseDrawingLineStyle(value: unknown): DrawingLineStyle {
  return typeof value === 'string' && LINE_STYLES.includes(value as DrawingLineStyle)
    ? (value as DrawingLineStyle)
    : DRAWING_LINE_STYLE
}

export function parseDrawingStroke(raw: unknown): DrawingStroke {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    color: typeof value.color === 'string' && value.color.length > 0 ? value.color : DRAWING_COLOR,
    lineStyle: parseDrawingLineStyle(value.lineStyle),
    lineWidth: isLineWidth(value.lineWidth) ? value.lineWidth : DRAWING_LINE_WIDTH
  }
}

export function drawingStrokeOf(drawing: ChartDrawing): DrawingStroke {
  return {
    color: drawing.color,
    lineStyle: drawing.lineStyle,
    lineWidth: drawing.lineWidth
  }
}

export function withDrawingStroke(drawing: ChartDrawing, stroke: DrawingStroke): ChartDrawing {
  return {
    ...drawing,
    color: stroke.color,
    lineStyle: stroke.lineStyle,
    lineWidth: stroke.lineWidth
  }
}

export function isTwoPointKind(kind: string): kind is TwoPointKind {
  return TWO_POINT_KINDS.includes(kind as TwoPointKind)
}

function isLineWidth(value: unknown): value is DrawingLineWidth {
  return typeof value === 'number' && LINE_WIDTHS.includes(value as DrawingLineWidth)
}

function parsePoint(raw: unknown): DrawingPoint | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const point = raw as Record<string, unknown>
  if (typeof point.time !== 'string' || !ISO_DATE_PATTERN.test(point.time)) {
    return null
  }
  if (typeof point.price !== 'number' || !Number.isFinite(point.price)) {
    return null
  }
  return { time: point.time, price: point.price }
}

export function parseChartDrawing(raw: unknown): ChartDrawing | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null
  }
  const value = raw as Record<string, unknown>
  if (typeof value.id !== 'string' || value.id.length === 0 || value.id === DRAWING_PREVIEW_ID) {
    return null
  }
  if (typeof value.color !== 'string' || value.color.length === 0) {
    return null
  }
  if (!isLineWidth(value.lineWidth)) {
    return null
  }
  if (value.kind === 'hline') {
    if (typeof value.price !== 'number' || !Number.isFinite(value.price)) {
      return null
    }
    const time =
      typeof value.time === 'string' && ISO_DATE_PATTERN.test(value.time) ? value.time : undefined
    return {
      id: value.id,
      kind: 'hline',
      price: value.price,
      ...(time ? { time } : {}),
      color: value.color,
      lineStyle: parseDrawingLineStyle(value.lineStyle),
      lineWidth: value.lineWidth
    }
  }
  if (typeof value.kind === 'string' && isTwoPointKind(value.kind)) {
    const a = parsePoint(value.a)
    const b = parsePoint(value.b)
    if (!a || !b) {
      return null
    }
    return {
      id: value.id,
      kind: value.kind,
      a,
      b: value.kind === 'hsegment' ? { time: b.time, price: a.price } : b,
      color: value.color,
      lineStyle: parseDrawingLineStyle(value.lineStyle),
      lineWidth: value.lineWidth
    }
  }
  return null
}

export function parseChartDrawings(raw: unknown): ChartDrawing[] {
  if (!Array.isArray(raw)) {
    throw new Error('drawings must be an array')
  }
  const drawings: ChartDrawing[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const drawing = parseChartDrawing(item)
    if (!drawing) {
      throw new Error('drawings contain an invalid shape')
    }
    if (seen.has(drawing.id)) {
      throw new Error(`duplicate drawing id ${drawing.id}`)
    }
    seen.add(drawing.id)
    drawings.push(drawing)
  }
  return drawings
}

export function drawingHitId(id: string, handle: DrawingHit['handle']): string {
  return `${id}::${handle}`
}

export function parseDrawingHit(externalId: string): DrawingHit | null {
  const splitAt = externalId.lastIndexOf('::')
  if (splitAt <= 0) {
    return null
  }
  const id = externalId.slice(0, splitAt)
  const handle = externalId.slice(splitAt + 2)
  if (handle !== 'body' && handle !== 'line' && handle !== 'a' && handle !== 'b') {
    return null
  }
  if (!id || id === DRAWING_PREVIEW_ID) {
    return null
  }
  return { id, handle }
}

export function horizontalPrice(drawing: ChartDrawing): number | null {
  if (drawing.kind === 'hline') {
    return drawing.price
  }
  if (drawing.kind === 'hsegment') {
    return drawing.a.price
  }
  return null
}

/** 水平线改价格；水平线段两端价格一起改，时间端点不动。 */
export function withHorizontalPrice(drawing: ChartDrawing, price: number): ChartDrawing {
  if (drawing.kind === 'hline') {
    return { ...drawing, price }
  }
  if (drawing.kind === 'hsegment') {
    return {
      ...drawing,
      a: { ...drawing.a, price },
      b: { ...drawing.b, price }
    }
  }
  return drawing
}

export function moveDrawing(drawing: ChartDrawing, handle: DrawingHandle, point: DrawingPoint): ChartDrawing {
  if (drawing.kind === 'hline') {
    return { ...drawing, price: point.price }
  }
  if (drawing.kind === 'hsegment') {
    if (handle === 'a') {
      return { ...drawing, a: point, b: { ...drawing.b, price: point.price } }
    }
    if (handle === 'b') {
      return { ...drawing, a: { ...drawing.a, price: point.price }, b: point }
    }
    return drawing
  }
  if (handle === 'a') {
    return { ...drawing, a: point }
  }
  if (handle === 'b') {
    return { ...drawing, b: point }
  }
  return drawing
}
