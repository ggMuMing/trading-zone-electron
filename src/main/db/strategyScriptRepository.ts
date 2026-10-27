import { randomUUID } from 'node:crypto'
import {
  readStrategyParameters,
  type StrategyScript
} from '../../shared/types/strategyScript'
import type { StrategyParameter } from '../../shared/types/pythonProtocol'
import { getDb } from './sqlite'

interface ScriptRow {
  id: string
  title: string
  source: string
  manifest: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapRow(row: ScriptRow): StrategyScript {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    manifest: readStrategyParameters(JSON.parse(row.manifest) as unknown),
    updatedAt: row.updated_at
  }
}

function requireTitle(title: string): string {
  const trimmed = title.trim()
  if (!trimmed) {
    throw new Error('title is required')
  }
  return trimmed
}

export const strategyScriptRepository = {
  list(): StrategyScript[] {
    const rows = getDb()
      .prepare(
        `SELECT id, title, source, manifest, updated_at
         FROM strategy_script
         ORDER BY updated_at DESC, id DESC`
      )
      .all() as ScriptRow[]
    return rows.map(mapRow)
  },

  get(id: string): StrategyScript | null {
    const row = getDb()
      .prepare(
        `SELECT id, title, source, manifest, updated_at
         FROM strategy_script
         WHERE id = ?`
      )
      .get(id) as ScriptRow | undefined
    return row ? mapRow(row) : null
  },

  create(input: { title: string; source: string; manifest: StrategyParameter[] }): StrategyScript[] {
    const title = requireTitle(input.title)
    const updatedAt = nowIso()
    getDb()
      .prepare(
        `INSERT INTO strategy_script (id, title, source, manifest, updated_at)
         VALUES (@id, @title, @source, @manifest, @updated_at)`
      )
      .run({
        id: randomUUID().replaceAll('-', ''),
        title,
        source: input.source,
        manifest: JSON.stringify(input.manifest),
        updated_at: updatedAt
      })
    return this.list()
  },

  update(
    id: string,
    patch: { title?: string; source?: string; manifest: StrategyParameter[] }
  ): StrategyScript[] {
    const existing = this.get(id)
    if (!existing) {
      throw new Error(`策略不存在：${id}`)
    }
    const title = patch.title !== undefined ? requireTitle(patch.title) : existing.title
    const source = patch.source !== undefined ? patch.source : existing.source
    const updatedAt = nowIso()
    getDb()
      .prepare(
        `UPDATE strategy_script
         SET title = @title, source = @source, manifest = @manifest, updated_at = @updated_at
         WHERE id = @id`
      )
      .run({
        id,
        title,
        source,
        manifest: JSON.stringify(patch.manifest),
        updated_at: updatedAt
      })
    return this.list()
  },

  remove(id: string): StrategyScript[] {
    const existing = this.get(id)
    if (!existing) {
      throw new Error(`策略不存在：${id}`)
    }
    getDb().prepare('DELETE FROM strategy_script WHERE id = ?').run(id)
    return this.list()
  }
}
