import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  DrawingUtils,
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  PrimitiveHoveredItem,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time
} from 'lightweight-charts'
import { LineStyle } from 'lightweight-charts'
import { APP_FONT_STACK } from '../../../theme/lwcFont'
import {
  DRAWING_PREVIEW_ID,
  drawingHitId,
  type ChartDrawing,
  type DrawingLineStyle,
  type DrawingPoint
} from '../../../../../shared/types/chartDrawing'

const HIT_SLOP = 6
const HANDLE = 5
const ANCHOR_RADIUS = 4.5

function canvasLineStyle(style: DrawingLineStyle): LineStyle {
  if (style === 'dashed') {
    return LineStyle.Dashed
  }
  if (style === 'dotted') {
    return LineStyle.Dotted
  }
  return LineStyle.Solid
}

interface ScreenPoint {
  x: number
  y: number
}

interface ScreenItem {
  drawing: ChartDrawing
  preview: boolean
  selected: boolean
  a: ScreenPoint | null
  b: ScreenPoint | null
  anchor: ScreenPoint | null
  y: number | null
}

export interface DrawingScene {
  drawings: ChartDrawing[]
  preview: ChartDrawing | null
  selectedId: string | null
}

class DrawingRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly items: readonly ScreenItem[]) {}

  draw(target: CanvasRenderingTarget2D, utils?: DrawingUtils): void {
    const items = this.items
    if (items.length === 0) {
      return
    }
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hr = scope.horizontalPixelRatio
      const vr = scope.verticalPixelRatio
      for (const item of items) {
        ctx.save()
        ctx.strokeStyle = item.drawing.color
        ctx.fillStyle = item.drawing.color
        ctx.lineWidth = Math.max(1, item.drawing.lineWidth * hr)
        ctx.globalAlpha = item.preview ? 0.55 : 1
        utils?.setLineStyle(ctx, canvasLineStyle(item.drawing.lineStyle))
        strokeItem(ctx, item, hr, vr, scope.bitmapSize.width, scope.bitmapSize.height)
        if (item.selected) {
          utils?.setLineStyle(ctx, LineStyle.Solid)
          ctx.globalAlpha = 1
          strokeHandles(ctx, item, hr, vr)
          strokeAnchor(ctx, item, hr, vr)
        }
        ctx.restore()
      }
    })
  }
}

function strokeItem(
  ctx: CanvasRenderingContext2D,
  item: ScreenItem,
  hr: number,
  vr: number,
  width: number,
  height: number
): void {
  if (item.drawing.kind === 'hline') {
    if (item.y === null) {
      return
    }
    const y = Math.round(item.y * vr)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
    strokePriceTag(ctx, item.drawing.price, 4 * hr, y, vr)
    return
  }
  if (!item.a || !item.b) {
    return
  }
  const x1 = item.a.x * hr
  const y1 = item.a.y * vr
  const x2 = item.b.x * hr
  const y2 = item.b.y * vr
  if (item.drawing.kind === 'trend' || item.drawing.kind === 'hsegment') {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    if (item.drawing.kind === 'hsegment') {
      const leftX = x1 <= x2 ? x1 : x2
      const leftY = x1 <= x2 ? y1 : y2
      strokePriceTag(ctx, item.drawing.a.price, leftX, leftY, vr)
    }
    return
  }
  if (item.drawing.kind === 'xline') {
    const extended = extendLine(x1, y1, x2, y2, width, height)
    if (!extended) {
      return
    }
    ctx.beginPath()
    ctx.moveTo(extended.x1, extended.y1)
    ctx.lineTo(extended.x2, extended.y2)
    ctx.stroke()
    return
  }
  ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
}

const PRICE_TAG_PX = 12

function formatDrawingPrice(price: number): string {
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 水平价格标在线的左下方。坐标已经是画布像素。 */
function strokePriceTag(
  ctx: CanvasRenderingContext2D,
  price: number,
  x: number,
  y: number,
  vr: number
): void {
  ctx.font = `${PRICE_TAG_PX * vr}px ${APP_FONT_STACK}`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(formatDrawingPrice(price), x, y + 3 * vr)
}

/** 把两点决定的直线延到画布矩形的边界。两点重合时没有方向。 */
function extendLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width: number,
  height: number
): { x1: number; y1: number; x2: number; y2: number } | null {
  const dx = x2 - x1
  const dy = y2 - y1
  if (dx === 0 && dy === 0) {
    return null
  }
  let t0 = -1e9
  let t1 = 1e9
  const edges: Array<[number, number]> = [
    [-dx, x1],
    [dx, width - x1],
    [-dy, y1],
    [dy, height - y1]
  ]
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) {
        return null
      }
      continue
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) {
        return null
      }
      if (t > t0) {
        t0 = t
      }
    } else {
      if (t < t0) {
        return null
      }
      if (t < t1) {
        t1 = t
      }
    }
  }
  if (t0 > t1) {
    return null
  }
  return { x1: x1 + t0 * dx, y1: y1 + t0 * dy, x2: x1 + t1 * dx, y2: y1 + t1 * dy }
}

function strokeAnchor(ctx: CanvasRenderingContext2D, item: ScreenItem, hr: number, vr: number): void {
  if (item.drawing.kind !== 'hline' || !item.anchor) {
    return
  }
  const radius = ANCHOR_RADIUS * Math.max(hr, vr)
  ctx.beginPath()
  ctx.arc(item.anchor.x * hr, item.anchor.y * vr, radius, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.stroke()
}

function strokeHandles(ctx: CanvasRenderingContext2D, item: ScreenItem, hr: number, vr: number): void {
  const points = handlePoints(item)
  const size = HANDLE * hr
  ctx.fillStyle = '#ffffff'
  for (const point of points) {
    const x = point.x * hr - size
    const y = point.y * vr - size
    ctx.fillRect(x, y, size * 2, size * 2)
    ctx.strokeRect(x, y, size * 2, size * 2)
  }
}

function handlePoints(item: ScreenItem): ScreenPoint[] {
  if (item.drawing.kind === 'hline') {
    return []
  }
  return [item.a, item.b].filter((point): point is ScreenPoint => point !== null)
}

function projectPoint(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<SeriesType, Time>,
  point: DrawingPoint
): ScreenPoint | null {
  const x = chart.timeScale().timeToCoordinate(point.time as Time)
  const y = series.priceToCoordinate(point.price)
  if (x === null || y === null) {
    return null
  }
  return { x, y }
}

export class DrawingPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null
  private series: ISeriesApi<SeriesType, Time> | null = null
  private requestUpdate: (() => void) | null = null
  private scene: DrawingScene = { drawings: [], preview: null, selectedId: null }
  private screen: ScreenItem[] = []
  private readonly views: IPrimitivePaneView[]

  constructor() {
    const owner = this
    this.views = [
      {
        zOrder() {
          return 'top'
        },
        renderer(): IPrimitivePaneRenderer | null {
          if (owner.screen.length === 0) {
            return null
          }
          return new DrawingRenderer(owner.screen)
        }
      }
    ]
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart
    this.series = param.series
    this.requestUpdate = param.requestUpdate
    this.rebuild()
    this.requestUpdate()
  }

  detached(): void {
    this.chart = null
    this.series = null
    this.requestUpdate = null
    this.screen = []
  }

  setScene(next: DrawingScene): void {
    this.scene = next
    this.rebuild()
    this.requestUpdate?.()
  }

  updateAllViews(): void {
    this.rebuild()
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views
  }

  hitTest(x: number, y: number): PrimitiveHoveredItem | null {
    for (let index = this.screen.length - 1; index >= 0; index -= 1) {
      const item = this.screen[index]
      if (item.preview || item.drawing.id === DRAWING_PREVIEW_ID) {
        continue
      }
      const handle = hitHandle(item, x, y)
      if (handle) {
        return { externalId: drawingHitId(item.drawing.id, handle), zOrder: 'top', cursorStyle: 'pointer' }
      }
      if (hitBody(item, x, y)) {
        const handleName = item.drawing.kind === 'hline' ? 'line' : 'body'
        return {
          externalId: drawingHitId(item.drawing.id, handleName),
          zOrder: 'top',
          cursorStyle: 'pointer'
        }
      }
    }
    return null
  }

  private rebuild(): void {
    const chart = this.chart
    const series = this.series
    if (!chart || !series) {
      this.screen = []
      return
    }
    const items = this.scene.preview ? [...this.scene.drawings, this.scene.preview] : this.scene.drawings
    this.screen = items.map((drawing) => toScreen(chart, series, drawing, drawing.id === this.scene.selectedId))
  }
}

function toScreen(
  chart: IChartApiBase<Time>,
  series: ISeriesApi<SeriesType, Time>,
  drawing: ChartDrawing,
  selected: boolean
): ScreenItem {
  if (drawing.kind === 'hline') {
    const y = series.priceToCoordinate(drawing.price)
    const anchor =
      drawing.time && y !== null
        ? projectPoint(chart, series, { time: drawing.time, price: drawing.price })
        : null
    return {
      drawing,
      preview: drawing.id === DRAWING_PREVIEW_ID,
      selected,
      a: null,
      b: null,
      anchor,
      y
    }
  }
  return {
    drawing,
    preview: drawing.id === DRAWING_PREVIEW_ID,
    selected,
    a: projectPoint(chart, series, drawing.a),
    b: projectPoint(chart, series, drawing.b),
    anchor: null,
    y: null
  }
}

function hitHandle(item: ScreenItem, x: number, y: number): 'a' | 'b' | null {
  if (!item.selected || item.drawing.kind === 'hline') {
    return null
  }
  if (item.a && near(x, y, item.a)) {
    return 'a'
  }
  if (item.b && near(x, y, item.b)) {
    return 'b'
  }
  return null
}

function hitBody(item: ScreenItem, x: number, y: number): boolean {
  if (item.drawing.kind === 'hline') {
    return item.y !== null && Math.abs(y - item.y) <= HIT_SLOP
  }
  if (!item.a || !item.b) {
    return false
  }
  if (item.drawing.kind === 'trend' || item.drawing.kind === 'hsegment') {
    return distanceToSegment(x, y, item.a, item.b) <= HIT_SLOP
  }
  if (item.drawing.kind === 'xline') {
    return distanceToLine(x, y, item.a, item.b) <= HIT_SLOP
  }
  if (item.drawing.kind === 'rect' && item.selected && pointInRect(x, y, item.a, item.b)) {
    return true
  }
  return hitRectBorder(x, y, item.a, item.b, HIT_SLOP)
}

function near(x: number, y: number, point: ScreenPoint): boolean {
  return Math.abs(x - point.x) <= HANDLE + 2 && Math.abs(y - point.y) <= HANDLE + 2
}

function distanceToLine(x: number, y: number, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length = Math.hypot(dx, dy)
  if (length === 0) {
    return Math.hypot(x - a.x, y - a.y)
  }
  return Math.abs((x - a.x) * dy - (y - a.y) * dx) / length
}

function distanceToSegment(x: number, y: number, a: ScreenPoint, b: ScreenPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const length2 = dx * dx + dy * dy
  if (length2 === 0) {
    return Math.hypot(x - a.x, y - a.y)
  }
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / length2))
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy))
}

function pointInRect(x: number, y: number, a: ScreenPoint, b: ScreenPoint): boolean {
  const left = Math.min(a.x, b.x)
  const right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const bottom = Math.max(a.y, b.y)
  return x >= left && x <= right && y >= top && y <= bottom
}

function hitRectBorder(x: number, y: number, a: ScreenPoint, b: ScreenPoint, slop: number): boolean {
  const left = Math.min(a.x, b.x)
  const right = Math.max(a.x, b.x)
  const top = Math.min(a.y, b.y)
  const bottom = Math.max(a.y, b.y)
  const insideOuter = x >= left - slop && x <= right + slop && y >= top - slop && y <= bottom + slop
  if (!insideOuter) {
    return false
  }
  const insideInner = x > left + slop && x < right - slop && y > top + slop && y < bottom - slop
  return !insideInner
}
