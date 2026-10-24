import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IChartApiBase,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PrimitivePaneViewZOrder,
  SeriesAttachedParameter,
  Time
} from 'lightweight-charts'
import { CHART_CHROME } from '../../theme/chartChrome'
import { DOWN_COLOR, UP_COLOR } from '../dashboard/format'
import type { StrategyHighlightKind } from './strategyOverlay'

const HIGHLIGHT_COLORS: Record<Exclude<StrategyHighlightKind, 'neutral'>, string> = {
  buy: fade(UP_COLOR, 0.18),
  sell: fade(DOWN_COLOR, 0.18)
}

function fade(hex: string, alpha: number): string {
  const n = hex.replace('#', '')
  const r = Number.parseInt(n.slice(0, 2), 16)
  const g = Number.parseInt(n.slice(2, 4), 16)
  const b = Number.parseInt(n.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

class HighlightRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly bands: ReadonlyArray<{ x: number | null; color: string; span: number; shift: number }>,
    private readonly barSpacing: number
  ) {}

  draw(): void {
    // Background only so candles stay on top.
  }

  drawBackground(target: CanvasRenderingTarget2D): void {
    const bands = this.bands
    const spacing = this.barSpacing
    if (bands.length === 0) {
      return
    }
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const ratio = scope.horizontalPixelRatio
      for (const band of bands) {
        if (band.x === null) {
          continue
        }
        const center = (band.x + band.shift * spacing) * ratio
        const width = Math.max(1, spacing * band.span * ratio)
        ctx.fillStyle = band.color
        ctx.fillRect(center - width / 2, 0, width, scope.bitmapSize.height)
      }
    })
  }
}

interface HighlightBand {
  timeIso: string
  kind: StrategyHighlightKind
}

interface DrawnBand {
  x: number | null
  color: string
  span: number
  shift: number
}

export class ReplayHighlightPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null
  private requestUpdate: (() => void) | null = null
  private highlight: HighlightBand | null = null
  private shades: HighlightBand[] = []
  private drawn: DrawnBand[] = []
  private barSpacing = 6
  private neutralColor = CHART_CHROME.light.highlightNeutral
  private readonly views: IPrimitivePaneView[]

  constructor() {
    const owner = this
    this.views = [
      {
        zOrder(): PrimitivePaneViewZOrder {
          return 'bottom'
        },
        renderer(): IPrimitivePaneRenderer | null {
          if (owner.drawn.length === 0) {
            return null
          }
          return new HighlightRenderer(owner.drawn, owner.barSpacing)
        }
      }
    ]
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart
    this.requestUpdate = param.requestUpdate
  }

  detached(): void {
    this.chart = null
    this.requestUpdate = null
  }

  setHighlight(next: HighlightBand | null): void {
    this.highlight = next
    this.requestUpdate?.()
  }

  setShades(next: readonly HighlightBand[]): void {
    this.shades = [...next]
    this.requestUpdate?.()
  }

  setNeutralColor(next: string): void {
    if (this.neutralColor === next) {
      return
    }
    this.neutralColor = next
    this.requestUpdate?.()
  }

  private bandColor(kind: StrategyHighlightKind): string {
    if (kind === 'neutral') {
      return this.neutralColor
    }
    return HIGHLIGHT_COLORS[kind]
  }

  updateAllViews(): void {
    const chart = this.chart
    if (!chart) {
      this.drawn = []
      return
    }
    const timeScale = chart.timeScale()
    this.barSpacing = timeScale.options().barSpacing
    const grouped = new Map<string, StrategyHighlightKind[]>()
    for (const band of [...this.shades, ...(this.highlight ? [this.highlight] : [])]) {
      const kinds = grouped.get(band.timeIso) ?? []
      if (!kinds.includes(band.kind)) {
        kinds.push(band.kind)
        grouped.set(band.timeIso, kinds)
      }
    }
    const drawn: DrawnBand[] = []
    for (const [timeIso, kinds] of grouped) {
      const x = timeScale.timeToCoordinate(timeIso as Time)
      if (kinds.length <= 1) {
        drawn.push({ x, color: this.bandColor(kinds[0] ?? 'neutral'), span: 1, shift: 0 })
        continue
      }
      kinds.forEach((kind, index) => {
        const span = 1 / kinds.length
        drawn.push({
          x,
          color: this.bandColor(kind),
          span,
          shift: (index + 0.5) * span - 0.5
        })
      })
    }
    this.drawn = drawn
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views
  }
}
