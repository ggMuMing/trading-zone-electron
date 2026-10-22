import { randomUUID } from 'node:crypto'
import { readPaperArchiveDraft } from '../../shared/paper/paperArchive'
import type { PaperArchive, PaperArchiveDraft } from '../../shared/types/paperArchive'
import { getDb } from './sqlite'

interface ArchiveRow {
  id: string
  payload: string
  archived_at: string
  started_on: string
  ended_on: string
  duration_days: number
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapRow(row: ArchiveRow): PaperArchive {
  let payload: unknown
  try {
    payload = JSON.parse(row.payload) as unknown
  } catch {
    throw new Error(`模拟记录无效：${row.id}`)
  }
  try {
    return {
      id: row.id,
      ...readPaperArchiveDraft(payload),
      startedOn: row.started_on,
      endedOn: row.ended_on,
      durationDays: row.duration_days,
      archivedAt: row.archived_at
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`模拟记录无效：${message}`)
  }
}

export const paperArchiveRepository = {
  list(): PaperArchive[] {
    const rows = getDb()
      .prepare(
        `SELECT id, payload, archived_at, started_on, ended_on, duration_days
         FROM paper_archive
         ORDER BY archived_at DESC, id DESC`
      )
      .all() as ArchiveRow[]
    return rows.map(mapRow)
  },

  get(id: string): PaperArchive | null {
    const row = getDb()
      .prepare(
        `SELECT id, payload, archived_at, started_on, ended_on, duration_days
         FROM paper_archive
         WHERE id = ?`
      )
      .get(id) as ArchiveRow | undefined
    return row ? mapRow(row) : null
  },

  create(draft: PaperArchiveDraft): PaperArchive {
    const id = randomUUID().replaceAll('-', '')
    const archivedAt = nowIso()
    const payload = readPaperArchiveDraft(draft)
    getDb()
      .prepare(
        `INSERT INTO paper_archive (id, payload, archived_at, started_on, ended_on, duration_days)
         VALUES (@id, @payload, @archived_at, @started_on, @ended_on, @duration_days)`
      )
      .run({
        id,
        payload: JSON.stringify(payload),
        archived_at: archivedAt,
        started_on: payload.startedOn,
        ended_on: payload.endedOn,
        duration_days: payload.durationDays
      })
    const created = this.get(id)
    if (!created) {
      throw new Error('归档失败')
    }
    return created
  }
}
