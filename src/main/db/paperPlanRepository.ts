import { randomUUID } from 'node:crypto'
import { readPaperPlanDraft } from '../../shared/paper/paperPlan'
import type { PaperPlan, PaperPlanDraft } from '../../shared/types/paperPlan'
import { getDb } from './sqlite'

interface PlanRow {
  id: string
  payload: string
  updated_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function mapRow(row: PlanRow): PaperPlan {
  let payload: unknown
  try {
    payload = JSON.parse(row.payload) as unknown
  } catch {
    throw new Error(`方案数据无效：${row.id}`)
  }
  try {
    return { id: row.id, ...readPaperPlanDraft(payload), updatedAt: row.updated_at }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`方案数据无效：${message}`)
  }
}

function write(id: string, draft: PaperPlanDraft, updatedAt: string): void {
  const payload = readPaperPlanDraft(draft)
  getDb()
    .prepare(
      `INSERT INTO paper_plan (id, payload, updated_at)
       VALUES (@id, @payload, @updated_at)
       ON CONFLICT(id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`
    )
    .run({
      id,
      payload: JSON.stringify(payload),
      updated_at: updatedAt
    })
}

export const paperPlanRepository = {
  list(): PaperPlan[] {
    const rows = getDb()
      .prepare(
        `SELECT id, payload, updated_at
         FROM paper_plan
         ORDER BY updated_at DESC, id DESC`
      )
      .all() as PlanRow[]
    return rows.map(mapRow)
  },

  get(id: string): PaperPlan | null {
    const row = getDb()
      .prepare(
        `SELECT id, payload, updated_at
         FROM paper_plan
         WHERE id = ?`
      )
      .get(id) as PlanRow | undefined
    return row ? mapRow(row) : null
  },

  create(draft: PaperPlanDraft): PaperPlan {
    const id = randomUUID().replaceAll('-', '')
    const updatedAt = nowIso()
    write(id, draft, updatedAt)
    const created = this.get(id)
    if (!created) {
      throw new Error('方案创建失败')
    }
    return created
  },

  update(id: string, draft: PaperPlanDraft): PaperPlan {
    if (!this.get(id)) {
      throw new Error('方案不存在')
    }
    const updatedAt = nowIso()
    write(id, draft, updatedAt)
    const updated = this.get(id)
    if (!updated) {
      throw new Error('方案保存失败')
    }
    return updated
  },

  remove(id: string): void {
    const result = getDb().prepare(`DELETE FROM paper_plan WHERE id = ?`).run(id)
    if (result.changes === 0) {
      throw new Error('方案不存在')
    }
  }
}
