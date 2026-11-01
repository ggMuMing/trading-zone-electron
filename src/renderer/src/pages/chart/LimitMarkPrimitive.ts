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

const LIMIT_LABEL_COLOR = '#87CEEB'
const LABEL_PX = 12

export interface ChartLimitMark {
  price: number
  label: string
}

interface DrawnLimit {
  y: number
  label: string
  /** 同一价位多条说明时，从线的上方依次往上排。 */
  stack: number
}

class LimitMarkRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly items: readonly DrawnLimit[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    const items = this.items
    if (items.length === 0) {
      return
    }
    target.useBitmapCoordinateSpace((scope) => {
      const ctx = scope.context
      const hr = scope.horizontalPixelRatio
      const vr = scope.verticalPixelRatio
      const lineHeight = (LABEL_PX + 2) * vr
      ctx.save()
      ctx.fillStyle = LIMIT_LABEL_COLOR
      ctx.font = `${LABEL_PX * vr}px ${APP_FONT_STACK}`
      ctx.textAlign = 'right'
      ctx.textBaseline = 'bottom'
      const x = scope.bitmapSize.width - 8 * hr
      for (const item of items) {
        const y = Math.round(item.y * vr) - 3 * vr - item.stack * lineHeight
        ctx.fillText(item.label, x, y)
      }
      ctx.restore()
    })
  }
}

/** 在条件限价虚线右上方标出说明。线条本身由价格线画出。 */
export class LimitMarkPrimitive implements ISeriesPrimitive<Time> {
  private series: ISeriesApi<SeriesType, Time> | null = null
  private requestUpdate: (() => void) | null = null
  private marks: ChartLimitMark[] = []
  private drawn: DrawnLimit[] = []
  private readonly views: IPrimitivePaneView[]

  constructor() {
    const owner = this
    this.views = [
      {
        zOrder() {
          return 'top'
        },
        renderer(): IPrimitivePaneRenderer | null {
          if (owner.drawn.length === 0) {
            return null
          }
          return new LimitMarkRenderer(owner.drawn)
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

  setMarks(marks: readonly ChartLimitMark[]): void {
    this.marks = marks.map((mark) => ({ price: mark.price, label: mark.label }))
    this.updateAllViews()
    this.requestUpdate?.()
  }

  updateAllViews(): void {
    const series = this.series
    if (!series || this.marks.length === 0) {
      this.drawn = []
      return
    }
    const grouped = new Map<number, DrawnLimit[]>()
    for (const mark of this.marks) {
      if (!Number.isFinite(mark.price) || mark.label === '') {
        continue
      }
      const y = series.priceToCoordinate(mark.price)
      if (y === null) {
        continue
      }
      const key = Math.round(y)
      const stack = grouped.get(key) ?? []
      const item = { y, label: mark.label, stack: stack.length }
      stack.push(item)
      grouped.set(key, stack)
    }
    this.drawn = [...grouped.values()].flat()
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views
  }
}
