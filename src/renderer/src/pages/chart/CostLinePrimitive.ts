import type { CanvasRenderingTarget2D } from 'fancy-canvas'
import type {
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time
} from 'lightweight-charts'
import { APP_FONT_STACK } from '../../theme/lwcFont'

const COST_LINE_COLOR = '#9e9e9e'
const LABEL_PX = 12

class CostLabelRenderer implements IPrimitivePaneRenderer {
  constructor(
    private readonly y: number | null,
    private readonly label: string
  ) {}

  draw(target: CanvasRenderingTarget2D): void {
    const yMedia = this.y
    const label = this.label
    if (yMedia === null || label === '') {
      return
    }
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hr = scope.horizontalPixelRatio
      const vr = scope.verticalPixelRatio
      const y = Math.round(yMedia * vr)
      ctx.save()
      ctx.fillStyle = COST_LINE_COLOR
      ctx.font = `${LABEL_PX * vr}px ${APP_FONT_STACK}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'top'
      ctx.fillText(label, scope.bitmapSize.width - 8 * hr, y + 3 * vr)
      ctx.restore()
    })
  }
}

/** 在持仓成本价的水平线右下角标出价格。线条本身由价格线画出。 */
export class CostLinePrimitive implements ISeriesPrimitive<Time> {
  private series: ISeriesApi<SeriesType, Time> | null = null
  private requestUpdate: (() => void) | null = null
  private price: number | null = null
  private label = ''
  private y: number | null = null
  private readonly views: IPrimitivePaneView[]

  constructor() {
    const owner = this
    this.views = [
      {
        zOrder() {
          return 'top'
        },
        renderer(): IPrimitivePaneRenderer | null {
          if (owner.y === null || owner.label === '') {
            return null
          }
          return new CostLabelRenderer(owner.y, owner.label)
        }
      }
    ]
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.series = param.series
    this.requestUpdate = param.requestUpdate
  }

  detached(): void {
    this.series = null
    this.requestUpdate = null
  }

  setCost(price: number | null, label: string): void {
    this.price = price
    this.label = label
    this.updateAllViews()
    this.requestUpdate?.()
  }

  updateAllViews(): void {
    const series = this.series
    if (!series || this.price === null || !Number.isFinite(this.price)) {
      this.y = null
      return
    }
    this.y = series.priceToCoordinate(this.price)
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views
  }
}
