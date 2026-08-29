import { scriptDisplayKey } from './indicatorScript'
import type { ChartLayout, ChartLayoutItem } from '../types/chartLayout'
import type { IndicatorScript } from '../types/indicatorScript'

/** Display localName after instance prefix; series id stays `{instanceId}:{localName}`. */
export function localNameOf(primitiveId: string): string {
  const index = primitiveId.lastIndexOf(':')
  return index >= 0 ? primitiveId.slice(index + 1) : primitiveId
}

export function instanceIdOf(primitiveId: string): string {
  const index = primitiveId.lastIndexOf(':')
  return index >= 0 ? primitiveId.slice(0, index) : primitiveId
}

function findLayoutItem(layout: ChartLayout | null | undefined, primitiveId: string): ChartLayoutItem | undefined {
  const instanceId = instanceIdOf(primitiveId)
  return layout?.items.find((item) => item.id === instanceId)
}

/** Overlay / series label. Never uses the uuid prefix as display text. */
export function legendLabel(primitiveId: string, _layout?: ChartLayout | null): string {
  return localNameOf(primitiveId).toUpperCase()
}

/** Subpane title: scripts use class key, never title. */
export function subplotLegendTitle(
  panePrimitives: Array<{ id: string; kind: string }>,
  layout?: ChartLayout | null,
  scripts?: IndicatorScript[]
): string {
  const source = panePrimitives.find((item) => item.kind === 'histogram') ?? panePrimitives[0]
  if (!source) {
    return ''
  }
  const item = findLayoutItem(layout, source.id)
  if (item?.kind === 'script') {
    const script = scripts?.find((entry) => entry.id === item.ref)
    const key = script ? scriptDisplayKey(script) : ''
    return key || localNameOf(source.id)
  }
  return legendLabel(source.id, layout)
}
