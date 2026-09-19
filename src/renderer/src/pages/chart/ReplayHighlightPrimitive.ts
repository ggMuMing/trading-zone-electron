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
import type { StrategyHighlightKind } from './strategyOverlay'

const HIGHLIGHT_COLORS: Record<StrategyHighlightKind, string> = {
  buy: 'rgba(239,83,80,0.18)',
  sell: 'rgba(38,166,154,0.18)',
  neutral: 'rgba(0,0,0,0.08)'
}

class HighlightRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly x: number | null,
    private readonly barSpacing: number,
    private readonly color: string
  ) {}

  draw(): void {
    // Background only so candles stay on top.
  }

  drawBackground(target: CanvasRenderingTarget2D): void {
    if (this.x === null) {
      return
    }
    const xMedia = this.x
    const spacing = this.barSpacing
    const color = this.color
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const x = xMedia * scope.horizontalPixelRatio
      const width = Math.max(1, spacing * scope.horizontalPixelRatio)
      ctx.fillStyle = color
      ctx.fillRect(x - width / 2, 0, width, scope.bitmapSize.height)
    })
  }
}

export class ReplayHighlightPrimitive implements ISeriesPrimitive<Time> {
  private chart: IChartApiBase<Time> | null = null
  private requestUpdate: (() => void) | null = null
  private timeIso: string | null = null
  private kind: StrategyHighlightKind = 'neutral'
  private x: number | null = null
  private barSpacing = 6
  private readonly views: IPrimitivePaneView[]

  constructor() {
    const owner = this
    this.views = [
      {
        zOrder(): PrimitivePaneViewZOrder {
          return 'bottom'
        },
        renderer(): IPrimitivePaneRenderer | null {
          if (!owner.timeIso) {
            return null
          }
          return new HighlightRenderer(owner.x, owner.barSpacing, HIGHLIGHT_COLORS[owner.kind])
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

  setHighlight(next: { timeIso: string; kind: StrategyHighlightKind } | null): void {
    this.timeIso = next?.timeIso ?? null
    this.kind = next?.kind ?? 'neutral'
    this.requestUpdate?.()
  }

  updateAllViews(): void {
    const chart = this.chart
    const timeIso = this.timeIso
    if (!chart || !timeIso) {
      this.x = null
      return
    }
    const timeScale = chart.timeScale()
    this.x = timeScale.timeToCoordinate(timeIso as Time)
    this.barSpacing = timeScale.options().barSpacing
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views
  }
}
