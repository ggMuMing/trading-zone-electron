import { scriptDisplayKey } from './indicatorScript'
import type { ChartLayout, ChartLayoutItem } from '../types/chartLayout'
import type { IndicatorScript, ParamField } from '../types/indicatorScript'

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

function formatLegendInputValues(item: ChartLayoutItem, fields: ParamField[]): string {
  return fields
    .filter((field) => field.widget === 'int' || field.widget === 'float')
    .map((field) => item.params.inputs[field.name])
    .filter((value) => value !== undefined && value !== null)
    .map((value) => String(value))
    .join(' ')
}

/** Script legend title: `MACD (9 26 9)` — key plus current numeric inputs. */
export function legendScriptTitle(item: ChartLayoutItem, scripts?: IndicatorScript[]): string {
  const script = scripts?.find((entry) => entry.id === item.ref)
  const key = script ? scriptDisplayKey(script) : ''
  const displayKey = key ? key.toUpperCase() : ''
  const values = formatLegendInputValues(item, script?.manifest.fields ?? [])
  if (displayKey && values) {
    return `${displayKey} (${values})`
  }
  return displayKey || values || item.id
}

/** Subpane title: scripts use class key plus params, never title. */
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
    return legendScriptTitle(item, scripts) || localNameOf(source.id)
  }
  return legendLabel(source.id, layout)
}
