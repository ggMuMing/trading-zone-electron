import {
  nextHeatmapLevel,
  type HeatmapFocus,
  type HeatmapIndustryLevel,
  type HeatmapSector,
  type HeatmapStockTile
} from '../../../../../shared/types/heatmap'
import { DOWN_COLOR, UP_COLOR } from '../format'
import { binaryTreemap } from './treemap'

type DisplayMode = 'light' | 'dark'

interface Rgb {
  r: number
  g: number
  b: number
}

interface HeatStops {
  flat: Rgb
  positiveSoft: Rgb
  positiveStrong: Rgb
  negativeSoft: Rgb
  negativeStrong: Rgb
}

const CLASSIC: Record<DisplayMode, HeatStops> = {
  dark: {
    flat: { r: 72, g: 79, b: 92 },
    positiveSoft: { r: 140, g: 72, b: 76 },
    positiveStrong: { r: 255, g: 30, b: 34 },
    negativeSoft: { r: 40, g: 126, b: 76 },
    negativeStrong: { r: 26, g: 214, b: 66 }
  },
  light: {
    flat: { r: 120, g: 132, b: 148 },
    positiveSoft: { r: 190, g: 78, b: 82 },
    positiveStrong: { r: 245, g: 42, b: 48 },
    negativeSoft: { r: 42, g: 148, b: 98 },
    negativeStrong: { r: 30, g: 220, b: 80 }
  }
}

const CANVAS_THEME: Record<
  DisplayMode,
  { backgroundStart: string; backgroundEnd: string; boardFill: string; boardBorder: string }
> = {
  dark: {
    backgroundStart: '#171b22',
    backgroundEnd: '#10141b',
    boardFill: '#20252d',
    boardBorder: 'rgba(148, 163, 184, 0.48)'
  },
  light: {
    backgroundStart: '#f6f8fb',
    backgroundEnd: '#e8eef6',
    boardFill: '#d8e0eb',
    boardBorder: 'rgba(71, 85, 105, 0.34)'
  }
}

const FONT_STACK = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif'
const FLAT_THRESHOLD = 0.1

interface TrendCounts {
  rise: number
  fall: number
  flat: number
}

interface TitleButton {
  label: string
  direction: HeatmapNavDirection
  code: string
  level: HeatmapIndustryLevel
  x: number
  y: number
  width: number
  height: number
}

interface LaidBoard {
  kind: 'major' | 'mid'
  name: string
  pct: number | null
  x: number
  y: number
  width: number
  height: number
  titleHeight: number
  forward: TitleButton | null
}

interface LaidHeader {
  name: string
  pct: number | null
  counts: TrendCounts
  x: number
  y: number
  width: number
  height: number
  buttons: TitleButton[]
}

export type HeatmapNavDirection = 'forward' | 'back-parent' | 'back-all'

export interface HeatmapTitleAction {
  direction: HeatmapNavDirection
  code: string
  level: HeatmapIndustryLevel
  x: number
  y: number
  width: number
  height: number
}

export interface HeatmapPaintResult {
  stocks: HeatmapLayoutStock[]
  actions: HeatmapTitleAction[]
}

export interface HeatmapLayoutStock {
  tsCode: string
  name: string
  close: number | null
  pct: number | null
  sectorCode: string
  sectorName: string
  x: number
  y: number
  width: number
  height: number
}

const MAP_HEADER_HEIGHT = 28

export function paintHeatmap(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  sectors: HeatmapSector[],
  focus: HeatmapFocus | null,
  industryLevel: HeatmapIndustryLevel,
  mode: DisplayMode
): HeatmapPaintResult {
  const context = canvas.getContext('2d')
  if (!context) {
    return { stocks: [], actions: [] }
  }
  const pixelRatio = Math.max(1, Math.min(window.devicePixelRatio || 1, 2))
  canvas.width = Math.floor(width * pixelRatio)
  canvas.height = Math.floor(height * pixelRatio)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const theme = CANVAS_THEME[mode]
  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  background.addColorStop(0, theme.backgroundStart)
  background.addColorStop(1, theme.backgroundEnd)
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, width, height)
  context.fillStyle = background
  context.fillRect(0, 0, width, height)

  const { header, boards, stocks } = layoutHeatmap(sectors, focus, industryLevel, width, height)
  for (const board of boards) {
    context.fillStyle = theme.boardFill
    context.fillRect(board.x, board.y, board.width, board.height)
  }
  for (const stock of stocks) {
    context.fillStyle = heatColor(stock.pct ?? 0, mode)
    context.fillRect(stock.x, stock.y, stock.width, stock.height)
    drawStockLabel(context, stock)
  }
  for (const board of boards) {
    if (board.titleHeight > 0) {
      context.fillStyle = headerColor(board.pct ?? 0, mode)
      context.fillRect(board.x, board.y, board.width, board.titleHeight)
    }
    context.strokeStyle = theme.boardBorder
    context.lineWidth = board.kind === 'major' ? 1.5 : 1
    context.strokeRect(
      board.x + 0.5,
      board.y + 0.5,
      Math.max(0, board.width - 1),
      Math.max(0, board.height - 1)
    )
    drawBoardTitle(context, board)
  }
  if (header) {
    context.fillStyle = headerColor(header.pct ?? 0, mode)
    context.fillRect(header.x, header.y, header.width, header.height)
    drawMapHeader(context, header)
  }
  return { stocks, actions: titleActions(header, boards) }
}

function layoutHeatmap(
  sectors: HeatmapSector[],
  focus: HeatmapFocus | null,
  industryLevel: HeatmapIndustryLevel,
  width: number,
  height: number
): { header: LaidHeader | null; boards: LaidBoard[]; stocks: HeatmapLayoutStock[] } {
  const boards: LaidBoard[] = []
  const stocks: HeatmapLayoutStock[] = []
  const header = focus ? layoutHeader(focus, sectors, width) : null
  const top = header ? header.height : 0
  const contentHeight = Math.max(0, height - top)
  const forwardLevel = focus ? nextHeatmapLevel(focus.level) : industryLevel
  if (sectors.length > 0) {
    const boxes = binaryTreemap(
      sectors.map((sector) => ({ item: sector, value: sector.value })),
      0,
      top,
      width,
      contentHeight,
      5
    )
    for (const box of boxes) {
      layoutMajor(box.item, box, forwardLevel, boards, stocks)
    }
  } else if (focus && focus.stocks.length > 0) {
    layStocks(focus.stocks, 0, top, width, contentHeight, focus.code, focus.name, stocks)
  }
  return { header, boards, stocks }
}

function layoutHeader(focus: HeatmapFocus, sectors: HeatmapSector[], width: number): LaidHeader {
  const buttonY = 3
  const buttonHeight = MAP_HEADER_HEIGHT - 6
  const specs: Array<Omit<TitleButton, 'x' | 'y' | 'height'>> = []
  if (focus.parent) {
    specs.push({
      label: '‹上级',
      direction: 'back-parent',
      code: focus.parent.code,
      level: focus.parent.level,
      width: 52
    })
  }
  specs.push({
    label: '‹所有',
    direction: 'back-all',
    code: '',
    level: focus.level,
    width: 52
  })
  const buttons: TitleButton[] = []
  let cursor = width - 6
  for (let index = specs.length - 1; index >= 0; index -= 1) {
    const spec = specs[index]
    cursor -= spec.width
    buttons.unshift({ ...spec, x: cursor, y: buttonY, height: buttonHeight })
    cursor -= 4
  }
  const counted = focus.stocks.length > 0 ? focus.stocks : flattenSectorStocks(sectors)
  return {
    name: focus.name,
    pct: focus.pct_chg,
    counts: countTrends(counted),
    x: 0,
    y: 0,
    width,
    height: MAP_HEADER_HEIGHT,
    buttons
  }
}

function layoutMajor(
  sector: HeatmapSector,
  box: { x: number; y: number; width: number; height: number },
  forwardLevel: HeatmapIndustryLevel | null,
  boards: LaidBoard[],
  stocks: HeatmapLayoutStock[]
): void {
  const titleHeight = barHeight(box.width, box.height, 'major')
  const showTitle = titleHeight > 10 && box.width > 72
  boards.push({
    kind: 'major',
    name: sector.name,
    pct: sector.pct_chg,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    titleHeight,
    forward:
      showTitle && forwardLevel
        ? {
            label: '›',
            direction: 'forward',
            code: sector.code,
            level: forwardLevel,
            x: box.x + box.width - 20,
            y: box.y + 1,
            width: 16,
            height: Math.max(10, titleHeight - 2)
          }
        : null
  })
  const padding = box.width > 110 && box.height > 90 ? 3 : 2
  const innerX = box.x + padding
  const innerY = box.y + titleHeight + padding
  const innerWidth = Math.max(0, box.width - padding * 2)
  const innerHeight = Math.max(0, box.height - titleHeight - padding * 2)
  if (sector.children.length > 0) {
    const childBoxes = binaryTreemap(
      sector.children.map((child) => ({ item: child, value: child.value })),
      innerX,
      innerY,
      innerWidth,
      innerHeight,
      3
    )
    for (const childBox of childBoxes) {
      layoutMid(childBox.item, childBox, boards, stocks)
    }
    return
  }
  layStocks(
    sector.stocks,
    innerX,
    innerY,
    innerWidth,
    innerHeight,
    sector.code,
    sector.name,
    stocks
  )
}

function layoutMid(
  sector: HeatmapSector,
  box: { x: number; y: number; width: number; height: number },
  boards: LaidBoard[],
  stocks: HeatmapLayoutStock[]
): void {
  const titleHeight = barHeight(box.width, box.height, 'mid')
  boards.push({
    kind: 'mid',
    name: sector.name,
    pct: sector.pct_chg,
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    titleHeight,
    forward: null
  })
  const padding = 2
  layStocks(
    sector.stocks,
    box.x + padding,
    box.y + titleHeight + padding,
    Math.max(0, box.width - padding * 2),
    Math.max(0, box.height - titleHeight - padding * 2),
    sector.code,
    sector.name,
    stocks
  )
}

function layStocks(
  tiles: HeatmapStockTile[],
  x: number,
  y: number,
  width: number,
  height: number,
  sectorCode: string,
  sectorName: string,
  stocks: HeatmapLayoutStock[]
): void {
  if (width <= 2 || height <= 2) {
    return
  }
  const boxes = binaryTreemap(
    tiles.map((stock) => ({ item: stock, value: stock.value })),
    x,
    y,
    width,
    height,
    1.5
  )
  for (const box of boxes) {
    stocks.push(layStock(box.item, box, sectorCode, sectorName))
  }
}

function barHeight(width: number, height: number, kind: 'major' | 'mid'): number {
  if (kind === 'major') {
    if (width < 84 || height < 48) {
      return 0
    }
    return clamp(Math.round(Math.min(Math.max(height * 0.08, 14), 22)), 12, 22)
  }
  if (width < 68 || height < 36) {
    return 0
  }
  return clamp(Math.round(Math.min(Math.max(height * 0.16, 12), 16)), 11, 16)
}

function flattenSectorStocks(sectors: HeatmapSector[]): HeatmapStockTile[] {
  const stocks: HeatmapStockTile[] = []
  for (const sector of sectors) {
    if (sector.children.length > 0) {
      stocks.push(...flattenSectorStocks(sector.children))
    } else {
      stocks.push(...sector.stocks)
    }
  }
  return stocks
}

function layStock(
  stock: HeatmapStockTile,
  bounds: { x: number; y: number; width: number; height: number },
  sectorCode: string,
  sectorName: string
): HeatmapLayoutStock {
  return {
    tsCode: stock.ts_code,
    name: stock.name,
    close: stock.close,
    pct: stock.pct_chg,
    sectorCode,
    sectorName,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height
  }
}

function titleActions(header: LaidHeader | null, boards: LaidBoard[]): HeatmapTitleAction[] {
  const actions: HeatmapTitleAction[] = []
  for (const button of header?.buttons ?? []) {
    actions.push(button)
  }
  for (const board of boards) {
    if (board.forward) {
      actions.push(board.forward)
    }
  }
  return actions
}

function drawMapHeader(context: CanvasRenderingContext2D, header: LaidHeader): void {
  const fontSize = 12
  const textY = header.y + header.height / 2 + 0.5
  const left = header.x + 8
  const firstButton = header.buttons[0]
  const rightEdge = firstButton ? firstButton.x - 8 : header.x + header.width - 8
  context.textBaseline = 'middle'
  context.font = `700 ${fontSize}px ${FONT_STACK}`
  const pctText = formatChange(header.pct)
  const pctWidth = context.measureText(pctText).width + 10
  const countsWidth = measureTrendCounts(context, header.counts, fontSize) + 12
  const nameMax = Math.max(0, rightEdge - pctWidth - countsWidth - left)
  context.fillStyle = 'rgba(247, 250, 252, 0.96)'
  context.textAlign = 'left'
  drawClippedText(
    context,
    fitText(context, header.name, nameMax),
    left,
    textY,
    left,
    header.y + 2,
    nameMax,
    Math.max(0, header.height - 4)
  )
  for (const button of header.buttons) {
    drawNavButton(context, button, fontSize)
  }
  drawTrendCounts(context, header.counts, rightEdge - pctWidth, textY, fontSize)
  context.fillStyle = 'rgba(247, 250, 252, 0.96)'
  context.textAlign = 'right'
  context.font = `700 ${fontSize}px ${FONT_STACK}`
  context.fillText(pctText, rightEdge, textY)
}

function drawBoardTitle(context: CanvasRenderingContext2D, board: LaidBoard): void {
  if (board.width <= 48 || board.titleHeight <= 10) {
    return
  }
  const fontSize = clamp(Math.floor(board.titleHeight * 0.52), 10, 14)
  const pctText = formatChange(board.pct)
  const showPct = board.width > (board.kind === 'mid' ? 96 : 120) && pctText !== '—'
  const textY = board.y + board.titleHeight / 2 + fontSize * 0.08
  const left = board.x + 6
  const rightEdge = board.forward ? board.forward.x - 2 : board.x + board.width - 6
  context.textBaseline = 'middle'
  context.font = `700 ${fontSize}px ${FONT_STACK}`
  const pctWidth = showPct ? context.measureText(pctText).width + 6 : 0
  const nameMax = Math.max(0, rightEdge - pctWidth - left)
  context.fillStyle = 'rgba(247, 250, 252, 0.96)'
  context.textAlign = 'left'
  drawClippedText(
    context,
    fitText(context, board.name, nameMax),
    left,
    textY,
    left,
    board.y + 1,
    nameMax,
    Math.max(0, board.titleHeight - 2)
  )
  if (showPct) {
    context.fillStyle = 'rgba(247, 250, 252, 0.96)'
    context.textAlign = 'right'
    drawClippedText(
      context,
      pctText,
      rightEdge,
      textY,
      board.x + 4,
      board.y + 1,
      Math.max(0, rightEdge - board.x - 4),
      Math.max(0, board.titleHeight - 2)
    )
  }
  if (board.forward) {
    drawNavButton(context, board.forward, Math.max(fontSize, 12))
  }
}

function drawNavButton(
  context: CanvasRenderingContext2D,
  button: TitleButton,
  fontSize: number
): void {
  context.save()
  context.beginPath()
  context.roundRect(button.x, button.y, button.width, button.height, 3)
  context.fillStyle = 'rgba(255, 255, 255, 0.16)'
  context.fill()
  context.fillStyle = 'rgba(247, 250, 252, 0.96)'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `700 ${fontSize}px ${FONT_STACK}`
  context.fillText(button.label, button.x + button.width / 2, button.y + button.height / 2 + 0.5)
  context.restore()
}

function countTrends(stocks: HeatmapStockTile[]): TrendCounts {
  const counts: TrendCounts = { rise: 0, fall: 0, flat: 0 }
  for (const stock of stocks) {
    if (stock.pct_chg == null || Math.abs(stock.pct_chg) < FLAT_THRESHOLD) {
      counts.flat += 1
    } else if (stock.pct_chg > 0) {
      counts.rise += 1
    } else {
      counts.fall += 1
    }
  }
  return counts
}

function trendParts(counts: TrendCounts): Array<{ text: string; color: string }> {
  return [
    { text: `涨 ${counts.rise}`, color: UP_COLOR },
    { text: `跌 ${counts.fall}`, color: DOWN_COLOR },
    { text: `平 ${counts.flat}`, color: 'rgba(247, 250, 252, 0.8)' }
  ]
}

function measureTrendCounts(
  context: CanvasRenderingContext2D,
  counts: TrendCounts,
  fontSize: number
): number {
  context.font = `700 ${fontSize}px ${FONT_STACK}`
  const parts = trendParts(counts)
  let width = 10 * (parts.length - 1)
  for (const part of parts) {
    width += context.measureText(part.text).width
  }
  return width
}

function drawTrendCounts(
  context: CanvasRenderingContext2D,
  counts: TrendCounts,
  right: number,
  textY: number,
  fontSize: number
): void {
  const parts = trendParts(counts)
  context.font = `700 ${fontSize}px ${FONT_STACK}`
  context.textAlign = 'right'
  context.textBaseline = 'middle'
  let cursor = right
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index]
    context.fillStyle = part.color
    context.fillText(part.text, cursor, textY)
    cursor -= context.measureText(part.text).width + 10
  }
}

function drawStockLabel(context: CanvasRenderingContext2D, stock: HeatmapLayoutStock): void {
  if (stock.width < 16 || stock.height < 8) {
    return
  }
  const clipPadding = stock.width > 110 ? 5 : stock.width > 54 ? 3 : 2
  const textInsetX = stock.width > 110 ? 6 : stock.width > 54 ? 4 : 3
  const textInsetY = stock.height > 56 ? 4.5 : stock.height > 26 ? 3 : 2
  const clipWidth = Math.max(0, stock.width - clipPadding * 2)
  const clipHeight = Math.max(0, stock.height - clipPadding * 2)
  if (clipWidth <= 2 || clipHeight <= 2) {
    return
  }

  context.save()
  context.fillStyle = 'rgba(247, 250, 252, 0.96)'
  context.shadowColor = 'rgba(0, 0, 0, 0.42)'
  context.shadowBlur = stock.height < 14 ? 0.45 : 1.2
  context.shadowOffsetY = 0.6

  if (stock.width >= 108 && stock.height >= 58) {
    const titleSize = fitFontSize(
      context,
      stock.name,
      700,
      clamp(Math.floor(Math.min(stock.width, stock.height) * 0.26), 15, 30),
      12,
      clipWidth
    )
    const detailSize = Math.min(
      clamp(Math.floor(Math.min(stock.width, stock.height) * 0.19), 11, 23),
      titleSize * 1.08
    )
    const centerX = stock.x + stock.width / 2
    const centerY = stock.y + stock.height / 2
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.font = `700 ${titleSize}px ${FONT_STACK}`
    drawClippedText(
      context,
      fitText(context, stock.name, clipWidth),
      centerX,
      centerY - titleSize * 0.62,
      stock.x + clipPadding,
      stock.y + clipPadding,
      clipWidth,
      clipHeight
    )
    context.font = `600 ${detailSize}px ${FONT_STACK}`
    drawClippedText(
      context,
      formatChange(stock.pct),
      centerX,
      centerY + detailSize * 0.3,
      stock.x + clipPadding,
      stock.y + clipPadding,
      clipWidth,
      clipHeight
    )
    context.restore()
    return
  }

  if (stock.width >= 28 && stock.height >= 20) {
    const titleSize = fitFontSize(
      context,
      stock.name,
      700,
      clamp(Math.floor(Math.min(stock.width * 0.19, stock.height * 0.43)), 8, 16),
      7,
      clipWidth - (textInsetX - clipPadding)
    )
    const detailSize = Math.min(clamp(Math.floor(stock.height * 0.33), 7, 13), titleSize * 1.08)
    context.textAlign = 'left'
    context.textBaseline = 'alphabetic'
    context.font = `700 ${titleSize}px ${FONT_STACK}`
    drawClippedText(
      context,
      fitText(context, stock.name, clipWidth - (textInsetX - clipPadding)),
      stock.x + textInsetX,
      stock.y + textInsetY + titleSize,
      stock.x + clipPadding,
      stock.y + clipPadding,
      clipWidth,
      clipHeight
    )
    context.font = `600 ${detailSize}px ${FONT_STACK}`
    drawClippedText(
      context,
      stock.width >= 58 ? formatChange(stock.pct) : formatCompactChange(stock.pct),
      stock.x + textInsetX,
      stock.y + textInsetY + titleSize + detailSize + 1.5,
      stock.x + clipPadding,
      stock.y + clipPadding,
      clipWidth,
      clipHeight
    )
    context.restore()
    return
  }

  if (stock.width >= 24 && stock.height >= 10) {
    const fontSize = clamp(Math.floor(Math.min(stock.width * 0.18, stock.height * 0.68)), 7, 11)
    const changeText = formatCompactChange(stock.pct)
    context.textAlign = 'left'
    context.textBaseline = 'middle'
    context.font = `600 ${fontSize}px ${FONT_STACK}`
    const changeWidth = context.measureText(changeText).width
    const canShowChange =
      stock.width >= 32 && changeText !== '—' && changeWidth + 3 < clipWidth * 0.72
    const nameMaxWidth = canShowChange ? Math.max(0, clipWidth - changeWidth - 3) : clipWidth
    const fittedName = fitText(context, stock.name, nameMaxWidth)
    const labelY = stock.y + stock.height / 2 + fontSize * 0.06
    if (fittedName) {
      drawClippedText(
        context,
        fittedName,
        stock.x + textInsetX,
        labelY,
        stock.x + clipPadding,
        stock.y + clipPadding,
        clipWidth,
        clipHeight
      )
    }
    if (canShowChange) {
      context.textAlign = 'right'
      drawClippedText(
        context,
        changeText,
        stock.x + stock.width - textInsetX,
        labelY,
        stock.x + clipPadding,
        stock.y + clipPadding,
        clipWidth,
        clipHeight
      )
    }
    context.restore()
    return
  }

  const fontSize = clamp(Math.floor(stock.height * 0.72), 6, 9)
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  context.font = `600 ${fontSize}px ${FONT_STACK}`
  const fittedName = fitText(context, stock.name, clipWidth)
  if (fittedName) {
    drawClippedText(
      context,
      fittedName,
      stock.x + textInsetX,
      stock.y + stock.height / 2,
      stock.x + clipPadding,
      stock.y + clipPadding,
      clipWidth,
      clipHeight
    )
  }
  context.restore()
}

function heatColor(changePct: number, mode: DisplayMode): string {
  const stops = CLASSIC[mode]
  if (Math.abs(changePct) < FLAT_THRESHOLD) {
    return rgbCss(stops.flat)
  }
  return rgbCss(heatRgb(stops, changePct))
}

function headerColor(changePct: number, mode: DisplayMode): string {
  const stops = CLASSIC[mode]
  if (Math.abs(changePct) < FLAT_THRESHOLD) {
    return rgbCss(scaleRgb(stops.flat, 1 - (mode === 'light' ? 0.18 : 0.12)))
  }
  return rgbCss(scaleRgb(heatRgb(stops, changePct), 1 - (mode === 'light' ? 0.12 : 0.08)))
}

function heatRgb(stops: HeatStops, changePct: number): Rgb {
  const strength = Math.pow(Math.min(1, Math.abs(changePct) / 10), 0.82)
  const rise = changePct > 0
  const soft = rise ? stops.positiveSoft : stops.negativeSoft
  const strong = rise ? stops.positiveStrong : stops.negativeStrong
  return mixRgb(soft, strong, strength)
}

function mixRgb(from: Rgb, to: Rgb, amount: number): Rgb {
  const t = clamp(amount, 0, 1)
  return {
    r: from.r + (to.r - from.r) * t,
    g: from.g + (to.g - from.g) * t,
    b: from.b + (to.b - from.b) * t
  }
}

function scaleRgb(color: Rgb, factor: number): Rgb {
  return { r: color.r * factor, g: color.g * factor, b: color.b * factor }
}

function rgbCss(color: Rgb): string {
  const channel = (value: number): number => Math.min(255, Math.max(0, Math.round(value)))
  return `rgb(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)})`
}

function formatChange(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  if (value > 0) {
    return `+${value.toFixed(2)}%`
  }
  return `${value.toFixed(2)}%`
}

function formatCompactChange(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return '—'
  }
  const digits = Math.abs(value) >= 10 ? 1 : 2
  const text = value
    .toFixed(digits)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')
  return value > 0 ? `+${text}%` : `${text}%`
}

function drawClippedText(
  context: CanvasRenderingContext2D,
  text: string,
  textX: number,
  textY: number,
  clipX: number,
  clipY: number,
  clipWidth: number,
  clipHeight: number
): void {
  if (!text || clipWidth <= 0 || clipHeight <= 0) {
    return
  }
  context.save()
  context.beginPath()
  context.rect(clipX, clipY, clipWidth, clipHeight)
  context.clip()
  context.fillText(text, textX, textY)
  context.restore()
}

function fitText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (maxWidth <= 0 || text.length === 0) {
    return ''
  }
  if (context.measureText(text).width <= maxWidth) {
    return text
  }
  let low = 1
  let high = text.length
  let best = ''
  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = text.slice(0, mid)
    if (context.measureText(candidate).width <= maxWidth) {
      best = candidate
      low = mid + 1
    } else {
      high = mid - 1
    }
  }
  return best
}

function fitFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  weight: number,
  preferred: number,
  min: number,
  maxWidth: number
): number {
  context.font = `${weight} ${preferred}px ${FONT_STACK}`
  const width = context.measureText(text).width
  if (maxWidth <= 0 || width <= maxWidth) {
    return preferred
  }
  return clamp((preferred * maxWidth) / width, min, preferred)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
