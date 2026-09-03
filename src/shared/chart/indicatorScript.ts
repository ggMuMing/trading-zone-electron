import type { LineWidth, PlotStyleParams, ScriptParams } from '../types/chartLayout'
import type {
  IndicatorManifest,
  ParamField,
  ParamWidget,
  PlotKind,
  PlotStyleField
} from '../types/indicatorScript'

const PARAM_WIDGETS: ReadonlySet<ParamWidget> = new Set(['int', 'float', 'bool'])
const PLOT_KINDS: ReadonlySet<PlotKind> = new Set(['line', 'histogram'])

export const DEFAULT_SCRIPT_TITLE = '未命名'

export function emptyScriptManifest(title: string, key = ''): IndicatorManifest {
  return {
    key,
    title,
    overlay: true,
    fields: [],
    plots: [],
    defaultParams: {}
  }
}

export function emptyScriptParams(): ScriptParams {
  return { inputs: {}, styles: {} }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isParamWidget(value: unknown): value is ParamWidget {
  return typeof value === 'string' && PARAM_WIDGETS.has(value as ParamWidget)
}

function isPlotKind(value: unknown): value is PlotKind {
  return typeof value === 'string' && PLOT_KINDS.has(value as PlotKind)
}

function parseBound(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('field min/max must be a finite number')
  }
  return value
}

function parseParamDefault(widget: ParamWidget, value: unknown, index: number): number | boolean {
  if (widget === 'bool') {
    if (typeof value !== 'boolean') {
      throw new Error(`fields[${index}].default must be a boolean`)
    }
    return value
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`fields[${index}].default must be a number`)
  }
  if (widget === 'int' && !Number.isInteger(value)) {
    throw new Error(`fields[${index}].default must be an integer`)
  }
  return value
}

function parseParamField(raw: unknown, index: number): ParamField {
  if (!isRecord(raw)) {
    throw new Error(`fields[${index}] must be an object`)
  }
  const name = raw.name
  const widget = raw.widget
  const title = raw.title
  if (typeof name !== 'string' || !name) {
    throw new Error(`fields[${index}].name must be a non-empty string`)
  }
  if (!isParamWidget(widget)) {
    throw new Error(`fields[${index}].widget must be one of int, float, bool`)
  }
  if (typeof title !== 'string' || !title) {
    throw new Error(`fields[${index}].title must be a non-empty string`)
  }
  const field: ParamField = {
    name,
    widget,
    title,
    default: parseParamDefault(widget, raw.default, index)
  }
  const minimum = parseBound(raw.min)
  const maximum = parseBound(raw.max)
  if (minimum !== undefined) {
    field.min = minimum
  }
  if (maximum !== undefined) {
    field.max = maximum
  }
  return field
}

function isLineWidth(value: unknown): value is LineWidth {
  return value === 1 || value === 2 || value === 3 || value === 4
}

function parseOptionalColor(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

function parsePlotStyleField(raw: unknown, index: number): PlotStyleField {
  if (!isRecord(raw)) {
    throw new Error(`plots[${index}] must be an object`)
  }
  const id = raw.id
  const title = raw.title
  const kind = raw.kind
  if (typeof id !== 'string' || !id) {
    throw new Error(`plots[${index}].id must be a non-empty string`)
  }
  if (typeof title !== 'string' || !title) {
    throw new Error(`plots[${index}].title must be a non-empty string`)
  }
  if (!isPlotKind(kind)) {
    throw new Error(`plots[${index}].kind must be line or histogram`)
  }
  const plot: PlotStyleField = { id, title, kind }
  const color = parseOptionalColor(raw.color, `plots[${index}].color`)
  if (color !== undefined) {
    plot.color = color
  }
  if (raw.lineWidth !== undefined && raw.lineWidth !== null) {
    if (!isLineWidth(raw.lineWidth)) {
      throw new Error(`plots[${index}].lineWidth must be an integer from 1 to 4`)
    }
    plot.lineWidth = raw.lineWidth
  }
  const colorUp = parseOptionalColor(raw.colorUp, `plots[${index}].colorUp`)
  if (colorUp !== undefined) {
    plot.colorUp = colorUp
  }
  const colorDown = parseOptionalColor(raw.colorDown, `plots[${index}].colorDown`)
  if (colorDown !== undefined) {
    plot.colorDown = colorDown
  }
  return plot
}

function parseInputValue(field: ParamField, value: unknown, label: string): number | boolean {
  if (field.widget === 'bool') {
    if (typeof value !== 'boolean') {
      throw new Error(`${label} must be a boolean`)
    }
    return value
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`)
  }
  if (field.widget === 'int' && !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`)
  }
  if (field.min !== undefined && value < field.min) {
    throw new Error(`${label} is below min`)
  }
  if (field.max !== undefined && value > field.max) {
    throw new Error(`${label} is above max`)
  }
  return value
}

export function parseIndicatorManifest(value: unknown): IndicatorManifest {
  if (!isRecord(value)) {
    throw new Error('script manifest must be a JSON object')
  }
  const key = typeof value.key === 'string' ? value.key : ''
  const title = typeof value.title === 'string' ? value.title : ''
  const overlay = value.overlay === undefined ? true : value.overlay
  if (typeof overlay !== 'boolean') {
    throw new Error('manifest.overlay must be a boolean')
  }
  if (!Array.isArray(value.fields)) {
    throw new Error('manifest.fields must be an array')
  }
  if (!Array.isArray(value.plots)) {
    throw new Error('manifest.plots must be an array')
  }
  const fields = value.fields.map((item, index) => parseParamField(item, index))
  const plots = value.plots.map((item, index) => parsePlotStyleField(item, index))
  if (!isRecord(value.defaultParams)) {
    throw new Error('manifest.defaultParams must be an object')
  }
  const defaultParams: Record<string, number | boolean> = {}
  const expected = fields.map((field) => field.name)
  for (const name of expected) {
    const item = value.defaultParams[name]
    const field = fields.find((entry) => entry.name === name)
    if (!field) {
      continue
    }
    defaultParams[name] = parseInputValue(field, item, `manifest.defaultParams.${name}`)
  }
  const extra = Object.keys(value.defaultParams).filter((name) => !expected.includes(name))
  if (extra.length > 0) {
    throw new Error(`manifest.defaultParams has unknown keys ${extra.join(', ')}`)
  }
  if (Object.keys(defaultParams).length !== expected.length) {
    throw new Error('manifest.defaultParams keys must match fields')
  }
  return { key, title, overlay, fields, plots, defaultParams }
}

export function readIndicatorManifest(value: unknown): IndicatorManifest {
  try {
    return parseIndicatorManifest(value)
  } catch {
    const record = isRecord(value) ? value : {}
    return emptyScriptManifest(
      typeof record.title === 'string' ? record.title : '',
      typeof record.key === 'string' ? record.key : ''
    )
  }
}

/** Best-effort ClassVar key from source; empty if not declared. */
export function extractScriptKey(source: string): string {
  const patterns = [
    /key\s*:\s*ClassVar\[[^\]]+\]\s*=\s*["']([^"']+)["']/,
    /key\s*=\s*["']([^"']+)["']/
  ]
  for (const pattern of patterns) {
    const match = source.match(pattern)
    const key = match?.[1]?.trim()
    if (key) {
      return key
    }
  }
  return ''
}

export function scriptDisplayKey(script: { manifest: Pick<IndicatorManifest, 'key'>; source: string }): string {
  const stored = script.manifest.key.trim()
  return stored || extractScriptKey(script.source)
}

export function formatIndicatorCaption(key: string, title: string): string {
  const trimmedKey = key.trim()
  const trimmedTitle = title.trim()
  if (trimmedKey && trimmedTitle) {
    return `${trimmedKey} · ${trimmedTitle}`
  }
  return trimmedTitle || trimmedKey || '用户脚本'
}

function extraKeys(raw: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(raw).filter((key) => !allowed.includes(key))
}

function pickKnown(raw: Record<string, unknown>, allowed: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of allowed) {
    if (raw[key] !== undefined) {
      picked[key] = raw[key]
    }
  }
  return picked
}

function defaultPlotStyle(plot: PlotStyleField): PlotStyleParams {
  const style: PlotStyleParams = {}
  if (plot.color !== undefined) {
    style.color = plot.color
  }
  if (plot.lineWidth !== undefined) {
    style.lineWidth = plot.lineWidth
  }
  if (plot.colorUp !== undefined) {
    style.colorUp = plot.colorUp
  }
  if (plot.colorDown !== undefined) {
    style.colorDown = plot.colorDown
  }
  return style
}

export function defaultScriptParams(manifest: IndicatorManifest): ScriptParams {
  const styles: Record<string, PlotStyleParams> = {}
  for (const plot of manifest.plots) {
    styles[plot.id] = defaultPlotStyle(plot)
  }
  return {
    inputs: { ...manifest.defaultParams },
    styles
  }
}

function assertPlotStyle(plot: PlotStyleField, raw: unknown): PlotStyleParams {
  if (!isRecord(raw)) {
    throw new Error(`invalid params: styles.${plot.id} must be an object`)
  }
  const allowed = ['color', 'lineWidth', 'colorUp', 'colorDown']
  const extra = extraKeys(raw, allowed)
  if (extra.length > 0) {
    throw new Error(`invalid params: styles.${plot.id} has unknown keys ${extra.join(', ')}`)
  }
  const next: PlotStyleParams = {}
  if (plot.kind === 'line') {
    const color = raw.color ?? plot.color
    if (typeof color !== 'string' || !color.trim()) {
      throw new Error(`invalid params: styles.${plot.id}.color must be a non-empty string`)
    }
    next.color = color
    const width = raw.lineWidth ?? plot.lineWidth ?? 1
    if (!isLineWidth(width)) {
      throw new Error(`invalid params: styles.${plot.id}.lineWidth must be an integer from 1 to 4`)
    }
    next.lineWidth = width
    return next
  }
  const colorUp = raw.colorUp ?? plot.colorUp
  const colorDown = raw.colorDown ?? plot.colorDown
  if (typeof colorUp !== 'string' || !colorUp.trim()) {
    throw new Error(`invalid params: styles.${plot.id}.colorUp must be a non-empty string`)
  }
  if (typeof colorDown !== 'string' || !colorDown.trim()) {
    throw new Error(`invalid params: styles.${plot.id}.colorDown must be a non-empty string`)
  }
  next.colorUp = colorUp
  next.colorDown = colorDown
  return next
}

function inputsRecord(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new Error('params.inputs must be an object')
  }
  return raw
}

function stylesRecord(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new Error('params.styles must be an object')
  }
  return raw
}

/** Require a complete params object (no fill). Extra keys forbidden. */
export function assertParams(manifest: IndicatorManifest, raw: unknown): ScriptParams {
  if (!isRecord(raw)) {
    throw new Error('params must be an object')
  }
  const extra = extraKeys(raw, ['inputs', 'styles'])
  if (extra.length > 0) {
    throw new Error(`invalid params: unknown keys ${extra.join(', ')}`)
  }
  const inputsRaw = inputsRecord(raw.inputs)
  const stylesRaw = stylesRecord(raw.styles)
  const allowedInputs = manifest.fields.map((field) => field.name)
  const extraInputs = extraKeys(inputsRaw, allowedInputs)
  if (extraInputs.length > 0) {
    throw new Error(`invalid params: unknown keys ${extraInputs.join(', ')}`)
  }
  const inputs: Record<string, number | boolean> = {}
  for (const field of manifest.fields) {
    if (inputsRaw[field.name] === undefined) {
      throw new Error(`invalid params: ${field.name} is required`)
    }
    inputs[field.name] = parseInputValue(field, inputsRaw[field.name], `invalid params: ${field.name}`)
  }
  const allowedPlots = manifest.plots.map((plot) => plot.id)
  const extraStyles = extraKeys(stylesRaw, allowedPlots)
  if (extraStyles.length > 0) {
    throw new Error(`invalid params: unknown style keys ${extraStyles.join(', ')}`)
  }
  const styles: Record<string, PlotStyleParams> = {}
  for (const plot of manifest.plots) {
    if (stylesRaw[plot.id] === undefined) {
      throw new Error(`invalid params: styles.${plot.id} is required`)
    }
    styles[plot.id] = assertPlotStyle(plot, stylesRaw[plot.id])
  }
  return { inputs, styles }
}

/** Merge defaults for missing fields, drop unknown keys, then validate. */
export function normalizeParams(manifest: IndicatorManifest, raw: unknown): ScriptParams {
  const defaults = defaultScriptParams(manifest)
  if (!isRecord(raw)) {
    throw new Error('params must be an object')
  }
  const inputsRaw = isRecord(raw.inputs) ? raw.inputs : {}
  const stylesRaw = isRecord(raw.styles) ? raw.styles : {}
  const allowedInputs = manifest.fields.map((field) => field.name)
  const allowedPlots = manifest.plots.map((plot) => plot.id)
  const mergedInputs = {
    ...defaults.inputs,
    ...pickKnown(inputsRaw, allowedInputs)
  }
  const mergedStyles: Record<string, unknown> = { ...defaults.styles }
  for (const plotId of allowedPlots) {
    const incoming = stylesRaw[plotId]
    const fallback = defaults.styles[plotId] ?? {}
    mergedStyles[plotId] = isRecord(incoming) ? { ...fallback, ...incoming } : fallback
  }
  return assertParams(manifest, { inputs: mergedInputs, styles: mergedStyles })
}

export function isLegacyIndicatorSource(source: string): boolean {
  return source.includes('json_schema_extra') || /\bField\s*\(/.test(source)
}
