import type { LineWidth, ScriptParams } from '../types/chartLayout'
import type { IndicatorManifest, ParamField, ParamWidget } from '../types/indicatorScript'

const PARAM_WIDGETS: ReadonlySet<ParamWidget> = new Set(['int', 'float', 'color', 'lineWidth'])

export const DEFAULT_SCRIPT_TITLE = '未命名'

export function emptyScriptManifest(title: string, key = ''): IndicatorManifest {
  return {
    key,
    title,
    fields: [],
    defaultParams: {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isParamWidget(value: unknown): value is ParamWidget {
  return typeof value === 'string' && PARAM_WIDGETS.has(value as ParamWidget)
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

function parseParamField(raw: unknown, index: number): ParamField {
  if (!isRecord(raw)) {
    throw new Error(`fields[${index}] must be an object`)
  }
  const name = raw.name
  const widget = raw.widget
  const title = raw.title
  const defaultValue = raw.default
  if (typeof name !== 'string' || !name) {
    throw new Error(`fields[${index}].name must be a non-empty string`)
  }
  if (!isParamWidget(widget)) {
    throw new Error(`fields[${index}].widget must be one of int, float, color, lineWidth`)
  }
  if (typeof title !== 'string' || !title) {
    throw new Error(`fields[${index}].title must be a non-empty string`)
  }
  if (typeof defaultValue !== 'number' && typeof defaultValue !== 'string') {
    throw new Error(`fields[${index}].default must be a number or string`)
  }
  const field: ParamField = { name, widget, title, default: defaultValue }
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

export function parseIndicatorManifest(value: unknown): IndicatorManifest {
  if (!isRecord(value)) {
    throw new Error('script manifest must be a JSON object')
  }
  const key = typeof value.key === 'string' ? value.key : ''
  const title = typeof value.title === 'string' ? value.title : ''
  if (!Array.isArray(value.fields)) {
    throw new Error('manifest.fields must be an array')
  }
  const fields = value.fields.map((item, index) => parseParamField(item, index))
  if (!isRecord(value.defaultParams)) {
    throw new Error('manifest.defaultParams must be an object')
  }
  const defaultParams: Record<string, number | string> = {}
  const expected = fields.map((field) => field.name)
  for (const name of expected) {
    const item = value.defaultParams[name]
    if (typeof item !== 'number' && typeof item !== 'string') {
      throw new Error(`manifest.defaultParams.${name} must be a number or string`)
    }
    defaultParams[name] = item
  }
  const extra = Object.keys(value.defaultParams).filter((name) => !expected.includes(name))
  if (extra.length > 0) {
    throw new Error(`manifest.defaultParams has unknown keys ${extra.join(', ')}`)
  }
  if (Object.keys(defaultParams).length !== expected.length) {
    throw new Error('manifest.defaultParams keys must match fields')
  }
  return { key, title, fields, defaultParams }
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

function isLineWidth(value: unknown): value is LineWidth {
  return value === 1 || value === 2 || value === 3 || value === 4
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

function inBounds(value: number, field: ParamField): boolean {
  if (field.min !== undefined && value < field.min) {
    return false
  }
  if (field.max !== undefined && value > field.max) {
    return false
  }
  return true
}

function assertFieldValue(field: ParamField, value: unknown): number | string {
  if (field.widget === 'int') {
    if (typeof value !== 'number' || !Number.isInteger(value) || !inBounds(value, field)) {
      throw new Error(`invalid params: ${field.name} must be an integer within bounds`)
    }
    return value
  }
  if (field.widget === 'float') {
    if (typeof value !== 'number' || !Number.isFinite(value) || !inBounds(value, field)) {
      throw new Error(`invalid params: ${field.name} must be a finite number within bounds`)
    }
    return value
  }
  if (field.widget === 'lineWidth') {
    if (!isLineWidth(value)) {
      throw new Error(`invalid params: ${field.name} must be an integer from 1 to 4`)
    }
    return value
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`invalid params: ${field.name} must be a non-empty string`)
  }
  return value
}

/** Require a complete params object (no fill). Extra keys forbidden. */
export function assertParams(fields: readonly ParamField[], raw: unknown): ScriptParams {
  if (!isRecord(raw)) {
    throw new Error('params must be an object')
  }
  const allowed = fields.map((field) => field.name)
  const extra = extraKeys(raw, allowed)
  if (extra.length > 0) {
    throw new Error(`invalid params: unknown keys ${extra.join(', ')}`)
  }
  const next: ScriptParams = {}
  for (const field of fields) {
    if (raw[field.name] === undefined) {
      throw new Error(`invalid params: ${field.name} is required`)
    }
    next[field.name] = assertFieldValue(field, raw[field.name])
  }
  return next
}

/** Merge defaults for missing fields, drop unknown keys, then validate. */
export function normalizeParams(
  fields: readonly ParamField[],
  defaults: Record<string, number | string>,
  raw: unknown
): ScriptParams {
  if (!isRecord(raw)) {
    throw new Error('params must be an object')
  }
  const allowed = fields.map((field) => field.name)
  const merged = {
    ...defaults,
    ...pickKnown(raw, allowed)
  }
  return assertParams(fields, merged)
}
