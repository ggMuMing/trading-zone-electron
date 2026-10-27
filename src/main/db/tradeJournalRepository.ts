import { randomUUID } from 'node:crypto'
import { journalStatus, readTradeJournalDraft } from '../../shared/tradeJournal/tradeJournal'
import type { TradeJournal, TradeJournalDraft } from '../../shared/types/tradeJournal'
import { getDb } from './sqlite'

interface JournalRow {
  id: string
  payload: string
  created_at: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapRow(row: JournalRow): TradeJournal {
  let payload: unknown
  try {
    payload = JSON.parse(row.payload) as unknown
  } catch {
    throw new Error(`交易记录无效：${row.id}`)
  }
  try {
    return {
      id: row.id,
      ...readTradeJournalDraft(payload),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`交易记录无效：${message}`)
  }
}

export const tradeJournalRepository = {
  list(): TradeJournal[] {
    const rows = getDb()
      .prepare(
        `SELECT id, payload, created_at, updated_at
         FROM trade_journal
         ORDER BY updated_at DESC, id DESC`
      )
      .all() as JournalRow[]
    return rows.map(mapRow)
  },

  get(id: string): TradeJournal | null {
    const row = getDb()
      .prepare(
        `SELECT id, payload, created_at, updated_at
         FROM trade_journal
         WHERE id = ?`
      )
      .get(id) as JournalRow | undefined
    return row ? mapRow(row) : null
  },

  create(draft: TradeJournalDraft): TradeJournal {
    const id = randomUUID().replaceAll('-', '')
    const timestamp = nowIso()
    const payload = readTradeJournalDraft(draft)
    getDb()
      .prepare(
        `INSERT INTO trade_journal (id, payload, created_at, updated_at)
         VALUES (@id, @payload, @created_at, @updated_at)`
      )
      .run({
        id,
        payload: JSON.stringify(payload),
        created_at: timestamp,
        updated_at: timestamp
      })
    const created = this.get(id)
    if (!created) {
      throw new Error('交易记录创建失败')
    }
    return created
  },

  update(id: string, draft: TradeJournalDraft): TradeJournal {
    const existing = this.get(id)
    if (!existing) {
      throw new Error('交易记录不存在')
    }
    if (journalStatus(existing) === 'closed') {
      throw new Error('已完成的交易不能修改')
    }
    const payload = readTradeJournalDraft(draft)
    const updatedAt = nowIso()
    getDb()
      .prepare(
        `UPDATE trade_journal
         SET payload = @payload, updated_at = @updated_at
         WHERE id = @id`
      )
      .run({
        id,
        payload: JSON.stringify(payload),
        updated_at: updatedAt
      })
    const updated = this.get(id)
    if (!updated) {
      throw new Error('交易记录保存失败')
    }
    return updated
  },

  remove(id: string): void {
    const result = getDb().prepare(`DELETE FROM trade_journal WHERE id = ?`).run(id)
    if (result.changes === 0) {
      throw new Error('交易记录不存在')
    }
  }
}
