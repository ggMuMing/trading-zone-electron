import { randomUUID } from 'node:crypto'
import { DEFAULT_LAYOUT_ID } from '../../shared/types/chartLayout'
import type { ChartLayout, ChartLayoutItem, LayoutItemKind, LayoutItemParams } from '../../shared/types/chartLayout'
import { getDb } from './sqlite'

interface LayoutRow {
  id: string
  updated_at: string
}

interface ItemRow {
  id: string
  layout_id: string
  kind: string
  ref: string
  params: string
  sort_order: number
}

function nowIso(): string {
  return new Date().toISOString()
}

function parseParams(raw: string): LayoutItemParams {
  const value = JSON.parse(raw) as unknown
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('layout item params must be a JSON object')
  }
  return value as LayoutItemParams
}

function parseKind(value: string): LayoutItemKind {
  if (value === 'script') {
    return value
  }
  throw new Error(`unknown layout item kind: ${value}`)
}

function mapItem(row: ItemRow): ChartLayoutItem {
  return {
    id: row.id,
    layoutId: row.layout_id,
    kind: parseKind(row.kind),
    ref: row.ref,
    params: parseParams(row.params),
    sortOrder: row.sort_order
  }
}

function readLayout(id: string): ChartLayout | null {
  const db = getDb()
  const header = db.prepare('SELECT id, updated_at FROM chart_layout WHERE id = ?').get(id) as
    | LayoutRow
    | undefined
  if (!header) {
    return null
  }
  const rows = db
    .prepare(
      `SELECT id, layout_id, kind, ref, params, sort_order
       FROM chart_layout_item
       WHERE layout_id = ? AND kind = 'script'
       ORDER BY sort_order ASC, id ASC`
    )
    .all(id) as ItemRow[]
  return {
    id: header.id,
    updatedAt: header.updated_at,
    items: rows.map(mapItem)
  }
}

function seedDefault(updatedAt: string): void {
  getDb()
    .prepare('INSERT INTO chart_layout (id, updated_at) VALUES (@id, @updated_at)')
    .run({ id: DEFAULT_LAYOUT_ID, updated_at: updatedAt })
}

export const chartLayoutRepository = {
  deleteBuiltinItems(): void {
    const db = getDb()
    const updatedAt = nowIso()
    const run = db.transaction(() => {
      db.prepare(`DELETE FROM chart_layout_item WHERE kind = 'builtin'`).run()
      db.prepare('UPDATE chart_layout SET updated_at = @updated_at WHERE id = @id').run({
        id: DEFAULT_LAYOUT_ID,
        updated_at: updatedAt
      })
    })
    run()
  },

  ensureDefault(): ChartLayout {
    this.deleteBuiltinItems()
    const existing = readLayout(DEFAULT_LAYOUT_ID)
    if (existing) {
      return existing
    }
    seedDefault(nowIso())
    const seeded = readLayout(DEFAULT_LAYOUT_ID)
    if (!seeded) {
      throw new Error('failed to seed default chart layout')
    }
    return seeded
  },

  get(): ChartLayout {
    return this.ensureDefault()
  },

  add(input: { kind: LayoutItemKind; ref: string; params: LayoutItemParams }): ChartLayout {
    if (input.kind !== 'script') {
      throw new Error('kind must be script')
    }
    const layout = this.ensureDefault()
    const maxOrder = layout.items.reduce((max, item) => Math.max(max, item.sortOrder), -1)
    const updatedAt = nowIso()
    const db = getDb()
    const run = db.transaction(() => {
      db.prepare(
        `INSERT INTO chart_layout_item (id, layout_id, kind, ref, params, sort_order)
         VALUES (@id, @layout_id, @kind, @ref, @params, @sort_order)`
      ).run({
        id: randomUUID().replaceAll('-', ''),
        layout_id: DEFAULT_LAYOUT_ID,
        kind: input.kind,
        ref: input.ref,
        params: JSON.stringify(input.params),
        sort_order: maxOrder + 1
      })
      db.prepare('UPDATE chart_layout SET updated_at = @updated_at WHERE id = @id').run({
        id: DEFAULT_LAYOUT_ID,
        updated_at: updatedAt
      })
    })
    run()
    return this.get()
  },

  remove(id: string): ChartLayout {
    this.ensureDefault()
    const db = getDb()
    const existing = db
      .prepare('SELECT id FROM chart_layout_item WHERE layout_id = ? AND id = ?')
      .get(DEFAULT_LAYOUT_ID, id) as { id: string } | undefined
    if (!existing) {
      throw new Error(`指标不存在：${id}`)
    }
    const updatedAt = nowIso()
    const run = db.transaction(() => {
      db.prepare('DELETE FROM chart_layout_item WHERE layout_id = ? AND id = ?').run(DEFAULT_LAYOUT_ID, id)
      db.prepare('UPDATE chart_layout SET updated_at = @updated_at WHERE id = @id').run({
        id: DEFAULT_LAYOUT_ID,
        updated_at: updatedAt
      })
    })
    run()
    return this.get()
  },

  update(id: string, params: LayoutItemParams): ChartLayout {
    this.ensureDefault()
    const db = getDb()
    const existing = db
      .prepare('SELECT id FROM chart_layout_item WHERE layout_id = ? AND id = ?')
      .get(DEFAULT_LAYOUT_ID, id) as { id: string } | undefined
    if (!existing) {
      throw new Error(`指标不存在：${id}`)
    }
    const updatedAt = nowIso()
    const run = db.transaction(() => {
      db.prepare(
        'UPDATE chart_layout_item SET params = @params WHERE layout_id = @layout_id AND id = @id'
      ).run({
        id,
        layout_id: DEFAULT_LAYOUT_ID,
        params: JSON.stringify(params)
      })
      db.prepare('UPDATE chart_layout SET updated_at = @updated_at WHERE id = @id').run({
        id: DEFAULT_LAYOUT_ID,
        updated_at: updatedAt
      })
    })
    run()
    return this.get()
  },

  swapSortOrder(idA: string, idB: string): ChartLayout {
    this.ensureDefault()
    const db = getDb()
    const rowA = db
      .prepare(
        `SELECT id, sort_order FROM chart_layout_item WHERE layout_id = ? AND id = ?`
      )
      .get(DEFAULT_LAYOUT_ID, idA) as { id: string; sort_order: number } | undefined
    const rowB = db
      .prepare(
        `SELECT id, sort_order FROM chart_layout_item WHERE layout_id = ? AND id = ?`
      )
      .get(DEFAULT_LAYOUT_ID, idB) as { id: string; sort_order: number } | undefined
    if (!rowA || !rowB) {
      throw new Error('指标不存在')
    }
    const updatedAt = nowIso()
    const run = db.transaction(() => {
      db.prepare('UPDATE chart_layout_item SET sort_order = @sort_order WHERE id = @id').run({
        id: rowA.id,
        sort_order: rowB.sort_order
      })
      db.prepare('UPDATE chart_layout_item SET sort_order = @sort_order WHERE id = @id').run({
        id: rowB.id,
        sort_order: rowA.sort_order
      })
      db.prepare('UPDATE chart_layout SET updated_at = @updated_at WHERE id = @id').run({
        id: DEFAULT_LAYOUT_ID,
        updated_at: updatedAt
      })
    })
    run()
    return this.get()
  },

  isScriptReferenced(scriptId: string): boolean {
    const row = getDb()
      .prepare(
        `SELECT 1 AS ok FROM chart_layout_item WHERE kind = 'script' AND ref = ? LIMIT 1`
      )
      .get(scriptId) as { ok: number } | undefined
    return Boolean(row)
  },

  clearItems(): void {
    const db = getDb()
    const updatedAt = nowIso()
    const run = db.transaction(() => {
      db.prepare('DELETE FROM chart_layout_item').run()
      db.prepare('UPDATE chart_layout SET updated_at = @updated_at WHERE id = @id').run({
        id: DEFAULT_LAYOUT_ID,
        updated_at: updatedAt
      })
    })
    run()
  }
}
