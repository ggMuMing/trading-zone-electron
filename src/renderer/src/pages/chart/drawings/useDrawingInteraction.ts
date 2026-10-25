import { useEffect, useRef, type RefObject } from 'react'
import type { IChartApi, ISeriesApi, Logical, MouseEventParams, Time } from 'lightweight-charts'
import { ISO_DATE_PATTERN, type CandlePoint } from '../../../../../shared/types/chart'
import {
  DRAWING_PREVIEW_ID,
  parseDrawingHit,
  type ChartDrawing,
  type DrawingPoint,
  type DrawingStroke,
  type DrawingTool
} from '../../../../../shared/types/chartDrawing'
import type { DrawingPrimitive } from './DrawingPrimitive'

interface DragSession {
  id: string
  handle: 'line' | 'a' | 'b' | 'body'
  originX: number
  originY: number
  originPoint: DrawingPoint | null
  originDrawing: ChartDrawing
  moved: boolean
}

interface DraftSession {
  tool: 'trend' | 'hsegment' | 'xline' | 'rect'
  origin: DrawingPoint
  cursor: DrawingPoint
}

const DRAG_START_DISTANCE = 5
/** 光标离某根 K 线开高低收的屏幕距离不超过这个值时，落点吸过去。 */
const OHLC_SNAP_PX = 8

export interface DrawingInteractionArgs {
  chartRef: RefObject<IChartApi | null>
  candleRef: RefObject<ISeriesApi<'Candlestick'> | null>
  containerRef: RefObject<HTMLDivElement | null>
  candlesRef: RefObject<Map<string, CandlePoint>>
  primitiveRef: RefObject<DrawingPrimitive | null>
  tsCode: string | null
  drawings: ChartDrawing[]
  stroke: DrawingStroke
  tool: DrawingTool | null
  selectedId: string | null
  snapEnabled: boolean
  onDrawingsChange: (next: ChartDrawing[]) => void
  onToolChange: (tool: DrawingTool | null) => void
  onSelectedChange: (id: string | null) => void
}

function barTimeAt(chart: IChartApi, x: number): string | null {
  const scale = chart.timeScale()
  const direct = scale.coordinateToTime(x)
  if (typeof direct === 'string' && ISO_DATE_PATTERN.test(direct)) {
    return direct
  }
  const logical = scale.coordinateToLogical(x)
  if (logical === null || !Number.isFinite(logical)) {
    return null
  }
  const index = Math.round(logical)
  for (let step = 0; step <= 40; step += 1) {
    const candidates = step === 0 ? [index] : [index - step, index + step]
    for (const candidate of candidates) {
      const coord = scale.logicalToCoordinate(candidate as Logical)
      if (coord === null) {
        continue
      }
      const time = scale.coordinateToTime(coord)
      if (typeof time === 'string' && ISO_DATE_PATTERN.test(time)) {
        return time
      }
    }
  }
  return null
}

function barLogical(chart: IChartApi, time: string): number | null {
  const index = chart.timeScale().timeToIndex(time as Time, true)
  if (index === null) {
    return null
  }
  return Number(index)
}

function logicalToBarTime(chart: IChartApi, logical: number): string | null {
  const coord = chart.timeScale().logicalToCoordinate(Math.round(logical) as Logical)
  if (coord === null) {
    return null
  }
  return barTimeAt(chart, coord)
}

function shiftPoint(
  chart: IChartApi,
  point: DrawingPoint,
  deltaIndex: number,
  deltaPrice: number
): DrawingPoint | null {
  const logical = barLogical(chart, point.time)
  if (logical === null) {
    return null
  }
  const time = logicalToBarTime(chart, logical + deltaIndex)
  if (!time) {
    return null
  }
  return { time, price: point.price + deltaPrice }
}

/** 相对按下时的图形计算当前位置，避免一帧一帧累加。 */
function applyDrag(chart: IChartApi, drag: DragSession, point: DrawingPoint): ChartDrawing | null {
  const origin = drag.originDrawing
  if (drag.handle === 'line') {
    if (origin.kind !== 'hline') {
      return null
    }
    return { ...origin, price: point.price }
  }
  if (origin.kind !== 'trend' && origin.kind !== 'hsegment' && origin.kind !== 'xline' && origin.kind !== 'rect') {
    return null
  }
  if (origin.kind === 'hsegment' && (drag.handle === 'a' || drag.handle === 'b')) {
    const price = point.price
    if (drag.handle === 'a') {
      return { ...origin, a: { time: point.time, price }, b: { ...origin.b, price } }
    }
    return { ...origin, a: { ...origin.a, price }, b: { time: point.time, price } }
  }
  if (drag.handle === 'a') {
    return { ...origin, a: point }
  }
  if (drag.handle === 'b') {
    return { ...origin, b: point }
  }
  if (!drag.originPoint) {
    return null
  }
  const originLogical = barLogical(chart, drag.originPoint.time)
  const currentLogical = barLogical(chart, point.time)
  if (originLogical === null || currentLogical === null) {
    return null
  }
  const deltaIndex = Math.round(currentLogical - originLogical)
  const deltaPrice = point.price - drag.originPoint.price
  const a = shiftPoint(chart, origin.a, deltaIndex, deltaPrice)
  const b = shiftPoint(chart, origin.b, deltaIndex, deltaPrice)
  if (!a || !b) {
    return null
  }
  return { ...origin, a, b }
}

function replaceDrawing(drawings: readonly ChartDrawing[], next: ChartDrawing): ChartDrawing[] {
  return drawings.map((drawing) => (drawing.id === next.id ? next : drawing))
}

function priceAt(series: ISeriesApi<'Candlestick'>, y: number): number | null {
  const price = series.coordinateToPrice(y)
  if (price === null || !Number.isFinite(price)) {
    return null
  }
  return price
}

/** 主图绘图区里的坐标。价格轴、时间轴和副图返回 null。 */
function mainPaneOffset(
  chart: IChartApi,
  container: HTMLElement,
  event: PointerEvent
): { x: number; y: number } | null {
  const pane = chart.panes()[0]
  if (!pane) {
    return null
  }
  const width = chart.timeScale().width()
  const height = pane.getHeight()
  const target = event.target
  if (!(target instanceof Element)) {
    return null
  }
  const rect = target.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  if (rect.top - containerRect.top > 2 || rect.width < width - 1) {
    return null
  }
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  if (x < 0 || y < 0 || x > width || y > height) {
    return null
  }
  return { x, y }
}

function readPoint(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  param: MouseEventParams<Time>,
  candles: ReadonlyMap<string, CandlePoint>,
  snap: boolean
): DrawingPoint | null {
  if (param.paneIndex !== 0 || !param.point) {
    return null
  }
  const price = priceAt(series, param.point.y)
  if (price === null) {
    return null
  }
  const rawTime = param.time === undefined ? null : String(param.time)
  const time =
    rawTime && ISO_DATE_PATTERN.test(rawTime) ? rawTime : barTimeAt(chart, param.point.x)
  if (!time) {
    return null
  }
  const point = { time, price }
  return snap ? snapToOhlc(chart, series, candles, param.point, point) : point
}

function readPointerPoint(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  container: HTMLElement,
  candles: ReadonlyMap<string, CandlePoint>,
  event: PointerEvent,
  snap: boolean
): DrawingPoint | null {
  const offset = mainPaneOffset(chart, container, event)
  if (!offset) {
    return null
  }
  return pointFromOffset(chart, series, offset, candles, snap)
}

/** 拖动中指针离开绘图区时，仍按主图边缘换算，图形继续跟着走。 */
function readDragPoint(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  container: HTMLElement,
  candles: ReadonlyMap<string, CandlePoint>,
  event: PointerEvent,
  snap: boolean
): DrawingPoint | null {
  const direct = mainPaneOffset(chart, container, event)
  if (direct) {
    return pointFromOffset(chart, series, direct, candles, snap)
  }
  const pane = chart.panes()[0]
  if (!pane) {
    return null
  }
  const width = chart.timeScale().width()
  const height = pane.getHeight()
  const rect = container.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  if (x < -width || x > width * 2 || y < -height || y > height * 2) {
    return null
  }
  return pointFromOffset(
    chart,
    series,
    {
      x: Math.min(width, Math.max(0, x)),
      y: Math.min(height, Math.max(0, y))
    },
    candles,
    snap
  )
}

function pointFromOffset(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  offset: { x: number; y: number },
  candles: ReadonlyMap<string, CandlePoint>,
  snap: boolean
): DrawingPoint | null {
  const price = priceAt(series, offset.y)
  const time = barTimeAt(chart, offset.x)
  if (price === null || !time) {
    return null
  }
  const point = { time, price }
  return snap ? snapToOhlc(chart, series, candles, offset, point) : point
}

/** 在光标附近的 K 线里，挑离光标最近的开高低收。 */
function snapToOhlc(
  chart: IChartApi,
  series: ISeriesApi<'Candlestick'>,
  candles: ReadonlyMap<string, CandlePoint>,
  offset: { x: number; y: number },
  point: DrawingPoint
): DrawingPoint {
  const logical = barLogical(chart, point.time)
  const times = logical === null ? [point.time] : neighborTimes(chart, logical, point.time)
  let best: { time: string; price: number; dist: number } | null = null
  for (const time of times) {
    const bar = candles.get(time)
    const x = chart.timeScale().timeToCoordinate(time as Time)
    if (!bar || x === null) {
      continue
    }
    for (const price of [bar.open, bar.high, bar.low, bar.close]) {
      const y = series.priceToCoordinate(price)
      if (y === null) {
        continue
      }
      const dist = Math.hypot(x - offset.x, y - offset.y)
      const nearer = best === null || dist < best.dist
      const sameBarTie = best !== null && dist === best.dist && time === point.time && best.time !== point.time
      if (dist <= OHLC_SNAP_PX && (nearer || sameBarTie)) {
        best = { time, price, dist }
      }
    }
  }
  if (!best) {
    return point
  }
  return { time: best.time, price: best.price }
}

function neighborTimes(chart: IChartApi, logical: number, fallback: string): string[] {
  const times: string[] = []
  for (const delta of [-1, 0, 1]) {
    const time = logicalToBarTime(chart, logical + delta)
    if (time && !times.includes(time)) {
      times.push(time)
    }
  }
  if (times.length === 0) {
    times.push(fallback)
  }
  return times
}

function cursorForDraft(draft: DraftSession, point: DrawingPoint): DrawingPoint {
  if (draft.tool === 'hsegment') {
    return { time: point.time, price: draft.origin.price }
  }
  return point
}

function previewDrawing(
  tool: DrawingTool | null,
  draft: DraftSession | null,
  guide: DrawingPoint | null,
  stroke: DrawingStroke
): ChartDrawing | null {
  if (draft) {
    return {
      id: DRAWING_PREVIEW_ID,
      kind: draft.tool,
      a: draft.origin,
      b: draft.cursor,
      color: stroke.color,
      lineStyle: stroke.lineStyle,
      lineWidth: stroke.lineWidth
    }
  }
  if (tool === 'hline' && guide) {
    return {
      id: DRAWING_PREVIEW_ID,
      kind: 'hline',
      price: guide.price,
      time: guide.time,
      color: stroke.color,
      lineStyle: stroke.lineStyle,
      lineWidth: stroke.lineWidth
    }
  }
  return null
}

function applyScrollLock(chart: IChartApi, locked: boolean): void {
  chart.applyOptions({
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: !locked,
      horzTouchDrag: !locked,
      vertTouchDrag: !locked
    }
  })
}

export function useDrawingInteraction({
  chartRef,
  candleRef,
  containerRef,
  candlesRef,
  primitiveRef,
  tsCode,
  drawings,
  stroke,
  tool,
  selectedId,
  snapEnabled,
  onDrawingsChange,
  onToolChange,
  onSelectedChange
}: DrawingInteractionArgs): void {
  const drawingsRef = useRef(drawings)
  const strokeRef = useRef(stroke)
  const toolRef = useRef(tool)
  const selectedIdRef = useRef(selectedId)
  const snapEnabledRef = useRef(snapEnabled)
  const onDrawingsChangeRef = useRef(onDrawingsChange)
  const onToolChangeRef = useRef(onToolChange)
  const onSelectedChangeRef = useRef(onSelectedChange)
  const hoverRef = useRef<string | null>(null)
  const dragRef = useRef<DragSession | null>(null)
  const draftRef = useRef<DraftSession | null>(null)
  const guideRef = useRef<DrawingPoint | null>(null)
  const dragDrawingsRef = useRef<ChartDrawing[] | null>(null)
  const suppressClickRef = useRef(false)
  const scrollLockedRef = useRef(false)
  const emptyPressRef = useRef<{ x: number; y: number } | null>(null)

  drawingsRef.current = drawings
  strokeRef.current = stroke
  toolRef.current = tool
  selectedIdRef.current = selectedId
  snapEnabledRef.current = snapEnabled
  onDrawingsChangeRef.current = onDrawingsChange
  onToolChangeRef.current = onToolChange
  onSelectedChangeRef.current = onSelectedChange

  const syncScene = (): void => {
    if (!toolRef.current) {
      draftRef.current = null
      guideRef.current = null
    }
    primitiveRef.current?.setScene({
      drawings: dragDrawingsRef.current ?? drawingsRef.current,
      preview: previewDrawing(toolRef.current, draftRef.current, guideRef.current, strokeRef.current),
      selectedId: selectedIdRef.current
    })
  }
  const syncSceneRef = useRef(syncScene)
  syncSceneRef.current = syncScene

  useEffect(() => {
    dragRef.current = null
    dragDrawingsRef.current = null
    draftRef.current = null
    guideRef.current = null
    syncSceneRef.current()
  }, [tsCode])

  useEffect(() => {
    const chart = chartRef.current
    if (!dragRef.current) {
      dragDrawingsRef.current = null
    }
    if (!chart) {
      syncSceneRef.current()
      return
    }
    const locked = tool !== null || dragRef.current !== null
    if (scrollLockedRef.current !== locked) {
      scrollLockedRef.current = locked
      applyScrollLock(chart, locked)
    }
    syncSceneRef.current()
  }, [chartRef, drawings, selectedId, tool, stroke])

  useEffect(() => {
    const chart = chartRef.current
    const series = candleRef.current
    const container = containerRef.current
    if (!chart || !series || !container) {
      return
    }
    const candlesAt = (): Map<string, CandlePoint> => candlesRef.current

    const setLocked = (locked: boolean): void => {
      if (scrollLockedRef.current === locked) {
        return
      }
      scrollLockedRef.current = locked
      applyScrollLock(chart, locked)
    }

    const finishDrawing = (next: ChartDrawing[], id: string): void => {
      toolRef.current = null
      draftRef.current = null
      guideRef.current = null
      suppressClickRef.current = true
      selectedIdRef.current = id
      syncSceneRef.current()
      onDrawingsChangeRef.current(next)
      onSelectedChangeRef.current(id)
      onToolChangeRef.current(null)
    }

    const placePoint = (point: DrawingPoint): void => {
      const currentTool = toolRef.current
      if (!currentTool) {
        return
      }
      if (currentTool === 'hline') {
        const id = crypto.randomUUID()
        finishDrawing(
          [
            ...drawingsRef.current,
            {
              id,
              kind: 'hline',
              price: point.price,
              time: point.time,
              color: strokeRef.current.color,
              lineStyle: strokeRef.current.lineStyle,
              lineWidth: strokeRef.current.lineWidth
            }
          ],
          id
        )
        return
      }
      const currentDraft = draftRef.current
      if (!currentDraft || currentDraft.tool !== currentTool) {
        draftRef.current = { tool: currentTool, origin: point, cursor: point }
        syncSceneRef.current()
        return
      }
      const end = cursorForDraft(currentDraft, point)
      if (
        currentTool === 'xline' &&
        end.time === currentDraft.origin.time &&
        end.price === currentDraft.origin.price
      ) {
        return
      }
      const id = crypto.randomUUID()
      finishDrawing(
        [
          ...drawingsRef.current,
          {
            id,
            kind: currentTool,
            a: currentDraft.origin,
            b: end,
            color: strokeRef.current.color,
            lineStyle: strokeRef.current.lineStyle,
            lineWidth: strokeRef.current.lineWidth
          }
        ],
        id
      )
    }

    const onMove = (param: MouseEventParams<Time>): void => {
      const point = readPoint(
        chart,
        series,
        param,
        candlesAt(),
        snapEnabledRef.current && (toolRef.current !== null || draftRef.current !== null)
      )
      hoverRef.current = typeof param.hoveredObjectId === 'string' ? param.hoveredObjectId : null
      const drag = dragRef.current
      if (drag) {
        setLocked(true)
        return
      }
      if (!point) {
        if (guideRef.current) {
          guideRef.current = null
          syncSceneRef.current()
        }
        setLocked(toolRef.current !== null || draftRef.current !== null)
        return
      }
      const currentDraft = draftRef.current
      if (currentDraft) {
        draftRef.current = { ...currentDraft, cursor: cursorForDraft(currentDraft, point) }
        syncSceneRef.current()
        setLocked(true)
        return
      }
      if (toolRef.current === 'hline') {
        guideRef.current = point
        syncSceneRef.current()
        setLocked(true)
        return
      }
      if (toolRef.current) {
        setLocked(true)
        return
      }
      const hit = hoverRef.current ? parseDrawingHit(hoverRef.current) : null
      setLocked(hit?.handle === 'line' || hit?.handle === 'a' || hit?.handle === 'b' || hit?.handle === 'body')
    }

    const onClick = (param: MouseEventParams<Time>): void => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      const currentTool = toolRef.current
      if (!currentTool) {
        if (param.paneIndex !== 0) {
          return
        }
        const hit = typeof param.hoveredObjectId === 'string' ? parseDrawingHit(param.hoveredObjectId) : null
        onSelectedChangeRef.current(hit?.id ?? null)
        return
      }
      const point = readPoint(chart, series, param, candlesAt(), snapEnabledRef.current)
      if (!point) {
        return
      }
      placePoint(point)
    }

    const cancelDrawing = (): void => {
      if (!toolRef.current && !draftRef.current && !guideRef.current) {
        return
      }
      toolRef.current = null
      draftRef.current = null
      guideRef.current = null
      setLocked(dragRef.current !== null)
      syncSceneRef.current()
      onToolChangeRef.current(null)
    }

    const onPointerDown = (event: PointerEvent): void => {
      suppressClickRef.current = false
      emptyPressRef.current = null
      if (event.button === 2) {
        if (!toolRef.current) {
          return
        }
        event.preventDefault()
        event.stopPropagation()
        cancelDrawing()
        return
      }
      if (event.button !== 0) {
        return
      }
      if (toolRef.current) {
        const point = readPointerPoint(chart, series, container, candlesAt(), event, snapEnabledRef.current)
        if (!point) {
          return
        }
        suppressClickRef.current = true
        placePoint(point)
        return
      }
      const hit = hoverRef.current ? parseDrawingHit(hoverRef.current) : null
      if (!hit || (hit.handle !== 'line' && hit.handle !== 'a' && hit.handle !== 'b' && hit.handle !== 'body')) {
        emptyPressRef.current = { x: event.clientX, y: event.clientY }
        return
      }
      const drawing = drawingsRef.current.find((item) => item.id === hit.id)
      if (!drawing || (hit.handle === 'body' && drawing.kind === 'hline')) {
        emptyPressRef.current = { x: event.clientX, y: event.clientY }
        return
      }
      const point = readPointerPoint(
        chart,
        series,
        container,
        candlesAt(),
        event,
        snapEnabledRef.current && (hit.handle === 'a' || hit.handle === 'b' || hit.handle === 'line')
      )
      if (hit.handle === 'body' && !point) {
        emptyPressRef.current = { x: event.clientX, y: event.clientY }
        return
      }
      let originDrawing = drawing
      if (drawing.kind === 'hline' && point) {
        originDrawing = { ...drawing, time: point.time }
        dragDrawingsRef.current = replaceDrawing(drawingsRef.current, originDrawing)
      }
      dragRef.current = {
        id: hit.id,
        handle: hit.handle,
        originX: event.clientX,
        originY: event.clientY,
        originPoint: point,
        originDrawing,
        moved: false
      }
      suppressClickRef.current = true
      selectedIdRef.current = hit.id
      syncSceneRef.current()
      onSelectedChangeRef.current(hit.id)
      setLocked(true)
      event.preventDefault()
      event.stopPropagation()
    }

    const followDrag = (drag: DragSession, event: PointerEvent): void => {
      const point = readDragPoint(chart, series, container, candlesAt(), event, drag.handle !== 'body' && snapEnabledRef.current)
      if (!point) {
        return
      }
      const next = applyDrag(chart, drag, point)
      if (!next) {
        return
      }
      dragDrawingsRef.current = replaceDrawing(drawingsRef.current, next)
      syncSceneRef.current()
    }

    const onPointerMove = (event: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) {
        return
      }
      if (!drag.moved) {
        const distance = Math.abs(event.clientX - drag.originX) + Math.abs(event.clientY - drag.originY)
        if (distance < DRAG_START_DISTANCE) {
          return
        }
        drag.moved = true
      }
      followDrag(drag, event)
    }

    const onPointerUp = (event: PointerEvent): void => {
      const press = emptyPressRef.current
      emptyPressRef.current = null
      const drag = dragRef.current
      if (drag) {
        dragRef.current = null
        setLocked(toolRef.current !== null)
        if (!drag.moved) {
          const anchorOnly = drag.handle === 'line' ? dragDrawingsRef.current : null
          dragDrawingsRef.current = null
          if (anchorOnly) {
            onDrawingsChangeRef.current(anchorOnly)
            return
          }
          syncSceneRef.current()
          return
        }
        const point = readDragPoint(chart, series, container, candlesAt(), event, drag.handle !== 'body' && snapEnabledRef.current)
        const nextDrawing = point ? applyDrag(chart, drag, point) : null
        const next = nextDrawing ? replaceDrawing(drawingsRef.current, nextDrawing) : dragDrawingsRef.current
        dragDrawingsRef.current = null
        if (next) {
          onDrawingsChangeRef.current(next)
          return
        }
        syncSceneRef.current()
        return
      }
      if (!press || toolRef.current || event.button !== 0) {
        return
      }
      const distance = Math.abs(event.clientX - press.x) + Math.abs(event.clientY - press.y)
      if (distance >= 6 || selectedIdRef.current === null) {
        return
      }
      suppressClickRef.current = true
      selectedIdRef.current = null
      syncSceneRef.current()
      onSelectedChangeRef.current(null)
    }

    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !toolRef.current) {
        return
      }
      const target = event.target
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return
      }
      cancelDrawing()
    }

    const onContextMenu = (event: MouseEvent): void => {
      if (!toolRef.current) {
        return
      }
      event.preventDefault()
      cancelDrawing()
    }

    chart.subscribeCrosshairMove(onMove)
    chart.subscribeClick(onClick)
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('keydown', onKey)
    setLocked(toolRef.current !== null)
    syncSceneRef.current()

    return () => {
      chart.unsubscribeCrosshairMove(onMove)
      chart.unsubscribeClick(onClick)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('keydown', onKey)
      if (scrollLockedRef.current) {
        scrollLockedRef.current = false
        applyScrollLock(chart, false)
      }
    }
  }, [chartRef, candleRef, containerRef, candlesRef])
}
