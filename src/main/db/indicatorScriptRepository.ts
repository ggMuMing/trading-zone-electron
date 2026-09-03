import { randomUUID } from 'node:crypto'
import { readIndicatorManifest } from '../../shared/chart/indicatorScript'
import type { IndicatorManifest, IndicatorScript } from '../../shared/types/indicatorScript'
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

function parseManifest(raw: string): IndicatorManifest {
  return readIndicatorManifest(JSON.parse(raw) as unknown)
}

function mapRow(row: ScriptRow): IndicatorScript {
  return {
    id: row.id,
    title: row.title,
    source: row.source,
    manifest: parseManifest(row.manifest),
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

export const indicatorScriptRepository = {
  list(): IndicatorScript[] {
    const rows = getDb()
      .prepare(
        `SELECT id, title, source, manifest, updated_at
         FROM indicator_script
         ORDER BY updated_at DESC, id DESC`
      )
      .all() as ScriptRow[]
    return rows.map(mapRow)
  },

  get(id: string): IndicatorScript | null {
    const row = getDb()
      .prepare(
        `SELECT id, title, source, manifest, updated_at
         FROM indicator_script
         WHERE id = ?`
      )
      .get(id) as ScriptRow | undefined
    return row ? mapRow(row) : null
  },

  create(input: { title: string; source: string; manifest: IndicatorManifest }): IndicatorScript[] {
    return this.insert({
      id: randomUUID().replaceAll('-', ''),
      title: input.title,
      source: input.source,
      manifest: input.manifest
    })
  },

  createWithId(input: {
    id: string
    title: string
    source: string
    manifest: IndicatorManifest
  }): IndicatorScript[] {
    const id = input.id.trim()
    if (!id) {
      throw new Error('id is required')
    }
    return this.insert({
      id,
      title: input.title,
      source: input.source,
      manifest: input.manifest
    })
  },

  insert(input: {
    id: string
    title: string
    source: string
    manifest: IndicatorManifest
  }): IndicatorScript[] {
    const title = requireTitle(input.title)
    const source = input.source
    const updatedAt = nowIso()
    getDb()
      .prepare(
        `INSERT INTO indicator_script (id, title, source, manifest, updated_at)
         VALUES (@id, @title, @source, @manifest, @updated_at)`
      )
      .run({
        id: input.id,
        title,
        source,
        manifest: JSON.stringify(input.manifest),
        updated_at: updatedAt
      })
    return this.list()
  },

  update(id: string, patch: { title?: string; source?: string; manifest: IndicatorManifest }): IndicatorScript[] {
    const existing = this.get(id)
    if (!existing) {
      throw new Error(`脚本不存在：${id}`)
    }
    const title = patch.title !== undefined ? requireTitle(patch.title) : existing.title
    const source = patch.source !== undefined ? patch.source : existing.source
    const updatedAt = nowIso()
    getDb()
      .prepare(
        `UPDATE indicator_script
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

  remove(id: string): IndicatorScript[] {
    const existing = this.get(id)
    if (!existing) {
      throw new Error(`脚本不存在：${id}`)
    }
    getDb().prepare('DELETE FROM indicator_script WHERE id = ?').run(id)
    return this.list()
  },

  removeAll(): void {
    getDb().prepare('DELETE FROM indicator_script').run()
  }
}
